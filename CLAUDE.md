# CLAUDE.md

Guidance for Claude Code (claude.ai/code) working in this repository.

## Project Overview

`pulsar-agent-turbo` (Node.js/TypeScript) provides an easily deployed LLM-driven agent. The primary entry point is the `Agent` class; supporting modules implement planning, decision, knowledge/guide retrieval, action execution, and LLM abstraction. A desktop GUI (“Pulsar Studio”) is included for non-CLI operation.

Core classes:

* **Guide**: Manages planning guides from JSON files; retrieval via keyword/vector/hybrid screening.
* **Knowledge**: Manages knowledge entries; local screening plus optional online retrieval.
* **Action**: Discovers & executes actions (one directory per action); supports screening, invocation, run tracking, and feedback.
* **Planner**: Builds/updates multi-step plans; tracks progress and termination.
* **Decider**: Chooses next action consistent with plan/progress; honors planner advisories.
* **LLM**: Unified interface for OpenAI-compatible and Ollama providers with aliasable configs.

The agent supports:

* **Interactive** mode (confirm actions) and **Auto-run** mode (no confirmations, with guardrails).
* **Per-run performance reports** (JSONL) covering planner/decider/LLM/actions.
* **Feedback capture** (user/system) routed to `Action.addFeedback()`.

## Project Architecture

```
pulsar-agent-turbo/
├─ src/
│  ├─ index.ts                 # Library entry (re-exports Agent and helpers)
│  ├─ cli.ts                   # CLI entrypoint
│  ├─ types/                   # Type definitions and interfaces
│  │  └─ index.ts
│  ├─ llm/                     # LLM abstraction layer
│  │  └─ index.ts
│  ├─ guide/                   # Guides + screening
│  │  └─ index.ts
│  ├─ knowledge/               # Knowledge + online adapters
│  │  └─ index.ts
│  ├─ action/                  # Action registry, execution, feedback
│  │  └─ index.ts
│  ├─ planner/                 # Planner (plan build/update/progress/termination)
│  │  └─ index.ts
│  ├─ decider/                 # Decider (next-step selection)
│  │  └─ index.ts
│  ├─ agent/                   # Agent orchestrator
│  │  └─ index.ts
│  └─ util/                    # JSONL logger, UUID, path helpers
│     └─ index.ts
├─ apps/desktop/               # Pulsar Studio (Electron or Tauri)
│  ├─ main/                    # Main process (Electron/Tauri Core)
│  ├─ renderer/                # React/Vue/Svelte UI
│  └─ preload/                 # Secure IPC bridge
├─ package.json
├─ tsconfig.json
└─ README.md
```

## Contracts & Behavior

### LLM Class

**Config**

```ts
export interface LLMConfig {
  provider: "openai_compatible" | "ollama";
  baseUrl: string;
  apiKey?: string;            // optional for Ollama
  model: string;
  temperature?: number;       // 0..2 (clamped)
  maxTokens?: number;
  think?: boolean;            // enable chain-of-thought/“reasoning” modes if supported
  alias?: string;             // user-defined handle
  requestTimeoutMs?: number;  // per-call timeout
}
```

**Interface**

```ts
// Text (stream or non-stream)
generateText(
  prompt: string,
  opts?: { alias?: string; stream?: boolean; [k: string]: any }
): Promise<string> | AsyncGenerator<string>;

// Structured (JSON schema enforced); non-streaming
generateStructured(
  prompt: string,
  schema: object,
  opts?: { alias?: string; [k: string]: any }
): Promise<Record<string, any>>;
```

**Behavior**

* Clamp `temperature` to [0,2]. Enforce `maxTokens` and per-provider timeouts.
* If `think=true` but unsupported, degrade to normal generation and set `metadata.thinkSupported=false`.

### Guide Class

**Store format (per file)**

```json
{
  "meta": { "name": "string", "version": "semver", "domain": "string" },
  "entries": [
    { "name": "string", "description": "string", "plan": ["step 1","step 2"] }
  ]
}
```

**Interface**

```ts
new Guide(paths: string[], screening: ScreeningConfig);
select(query: string, k = 5): Promise<GuideEntry[]>;
```

**Screening strategies**

* `"keyword"` (default): TF-IDF/BM25 token overlap
* `"vector"`: embedding index + ANN, optional cross-encoder rerank
* `"hybrid"`: union + weighted rerank

### Knowledge Class

**Store format (per file)**

```json
{
  "meta": { "name": "string", "version": "semver", "domain": "string" },
  "entries": [
    { "name": "string", "description": "string", "content": "string" }
  ]
}
```

**Interface**

```ts
new Knowledge(paths: string[], screening: ScreeningConfig, online?: OnlineConfig);
select(query: string, k = 5): Promise<KnowledgeEntry[]>;
searchOnline(query: string, k = 5): Promise<KnowledgeEntry[]>; // explicit opt-in
```

**OnlineConfig**

```ts
export interface OnlineConfig {
  provider: "web" | "custom_api";
  baseUrl?: string;
  apiKey?: string;
  index?: string;
}
```

### Action Class

**Filesystem layout**

* Actions live in `~/.pulsar-agent-turbo/actions/<actionName>/`
* Required files:

  * `meta.json`
  * `perform.js` (CommonJS or ESM, see note)

**`meta.json`**

```json
{
  "name": "string",
  "description": "string",
  "arguments": [
    { "name": "string", "type": "string", "description": "string", "required": true }
  ],
  "timeout_sec": 120,
  "tags": ["network","write","destructive"]  // optional
}
```

**`perform.js` contract (CommonJS)**

```js
// ~/.pulsar-agent-turbo/actions/<name>/perform.js
class Perform {
  constructor(agent) { this.agent = agent; }
  /**
   * @param {Record<string,any>} kwargs - validated against meta.json.arguments
   * @returns {Promise<{status:"ok"|"error", result:string, data?:any, error?:string|null, logs?:string[]}>}
   */
  async run(kwargs) { /* ... */ }
}
module.exports = { Perform };
```

**API**

```ts
new Action(home: string, screening: ScreeningConfig);

select(query: string, k = 5): Promise<ActionSpec[]>;

perform(name: string, args: Record<string, any>): string; // returns actionRunId (uuid)

getResult(actionRunId: string): ActionResult | null;

addFeedback(actionRunId: string, feedback: Feedback): void;
```

**Execution**

* Each run gets UUID `actionRunId`. Enforce `timeout_sec` with SIGTERM→SIGKILL.
* Spawn with filtered env; capture `stdout/stderr` into logs; JSON-serialize result.

### Planner Class

**Purpose:** Build/maintain a plan; assess termination after each action.

**Interface**

```ts
build(request: string, guides: GuideEntry[], knowledge: KnowledgeEntry[]): Promise<Plan>;
update(plan: Plan, observation: Observation): Promise<Plan>;
progress(plan: Plan): Progress;

// After each action_result; returns advisory
updateFromAction(plan: Plan, actionResult: ActionResult): {
  status: "continue" | "terminate" | "blocked";
  reason: "goal_achieved" | "impossible" | "exhausted" | "error";
  updatedPlan: Plan;
};
```

**Plan shape**

```json
{
  "task": "string",
  "steps": [
    { "id": "s1", "desc": "string", "status": "pending|running|done|blocked", "deps": [] }
  ],
  "created_at": "iso",
  "updated_at": "iso"
}
```

### Decider Class

**Purpose:** Choose next action consistent with plan/progress; honor planner advisories.

**Interface**

```ts
next(
  plan: Plan, progress: Progress,
  actions: ActionSpec[], advisory?: Record<string, any>
): Promise<Decision>;
```

**Decision**

```json
{
  "type": "execute|ask|wait|terminate",
  "action": { "name": "string", "args": {} },
  "reason": "string",
  "hint": "continue|terminate|blocked"
}
```

## Agent Class

**Responsibilities**

* Orchestrate planning, decision, and action execution
* Manage **interactive** vs **auto-run** execution
* Capture **feedback** and forward to `Action.addFeedback`
* Produce a per-request **performance report** (JSONL)

### Configuration

```json
{
  "execution": {
    "execution_mode": "interactive | auto",
    "confirm_policy": {
      "default": true,
      "require_for_tags": ["destructive","write","network"],
      "max_parallel_actions": 1
    }
  },
  "logging": {
    "dir": "~/.pulsar-agent-turbo/logs",
    "report_format": "jsonl",
    "capture_stdout": true,
    "capture_stderr": true,
    "keep_last_runs": 100
  },
  "feedback": {
    "enable_user_feedback": true,
    "implicit_success_on_ok": true
  }
}
```

### Public API

```ts
ask(
  text: string,
  files: string[] = [],
  opts?: {
    executionMode?: "interactive" | "auto";
    feedbackHandler?: (actionResult: ActionResult) => Promise<Feedback | null>;
  }
): Promise<RunHandle>; // returns { runId: string }

getReport(runId: string): Promise<any>;

submitFeedback(actionRunId: string, feedback: Feedback): Promise<void>;
```

### Feedback Schema

```ts
export interface Feedback {
  actionRunId: string;
  score: number; // 0..5
  signal: "success" | "partial" | "fail";
  comment?: string;
  labels?: string[];
  suggestions?: string;
  submittedBy: "user" | "system";
  ts: string; // ISO-8601
}
```

* Interactive: call `feedbackHandler`. If it returns null/timeout, record a neutral stub `{score:3,signal:"partial",submittedBy:"system"}`.
* Auto: on `status:"ok"`, record `{score:4,signal:"success",submittedBy:"system"}` (overridable later).

### Processes & Pipeline

1. **`agent.ask(...)`**

   * Allocate `runId`, open `logs/<runId>.jsonl`, emit `run_started`.

2. **Planning**

   * Build initial plan with screened Guides/Knowledge.
   * Emit `plan_built`, later `plan_updated` on changes.

3. **Decision**

   * Emit `decision`:

     * `ask` → UI/CLI prompt for more info.
     * `wait` → backoff (blocked).
     * `execute`:

       * **Interactive**: confirm unless policy waives it; decline marks step `blocked`.
       * **Auto**: proceed immediately unless `require_for_tags` matches.

4. **Action execution & planner progress update**

   * `Action.perform(...)` → `actionRunId`.
   * On completion: emit `action_result`; append to report.
   * **Planner tick**: `planner.updateFromAction(actionResult)` sets step `done|blocked|failed`, updates deps, evaluates termination.
   * Planner emits `plan_updated` and **`progress_evaluated` advisory**:

     ```json
     { "status":"continue|terminate|blocked", "reason":"goal_achieved|impossible|exhausted|error" }
     ```
   * **Quick user response**: UI/CLI prints one-liner about the step outcome and whether execution will continue or stop.
   * **Feedback**: interactive via `feedbackHandler`, or implicit in auto mode → emit `feedback_received`.
   * Decider may re-score future candidates based on recent feedback (simple online learning).

5. **Continue or terminate**

   * If `advisory.status=="terminate"`, emit `run_summary` then `run_finished` with `status:"succeeded"` if `reason=="goal_achieved"`, else `status:"failed"`.
   * Otherwise continue (may yield `ask|wait|execute`).

## Message Bus & Types (inter-process)

**Envelope**

```json
{
  "type": "user_request|plan_built|plan_updated|decision|action_started|action_result|feedback_received|progress_evaluated|task_interrupted|run_started|run_summary|run_finished",
  "id": "uuid",
  "ts": "iso-8601",
  "payload": {}
}
```

**Backpressure**

* Drop order when congested: `plan_updated`, `run_summary`.
* **Never** drop: `decision`, `action_result`, `feedback_received`, `progress_evaluated`, `run_finished`.

## ScreeningConfig (shared)

```ts
export interface ScreeningConfig {
  strategy: "keyword" | "vector" | "hybrid";
  k?: number;
  embeddingAlias?: string;
  rerankerAlias?: string;
}
```

## CLI (`src/cli.ts`)

```
# run an agent request (auto or interactive)
pulsar-agent-turbo run --request "..." [--auto] [--files f1 f2]

# low-level ops (optional)
pulsar-agent-turbo plan  --request "..." [--guides ...] [--knowledge ...]
pulsar-agent-turbo decide --plan plan.json
pulsar-agent-turbo action --name <action> --args '{"k":"v"}'

# report tools
pulsar-agent-turbo report --run-id <uuid> [--out summary.json]

# config management
pulsar-agent-turbo config --init [--save config.json]
pulsar-agent-turbo config --show [--load config.json]
```

* `--auto` maps to `executionMode="auto"`.
* CLI prints a one-line progress update on each `progress_evaluated`; exits immediately on `terminate`.

## Security & Resource Policy

* Actions: timeouts, sandboxed subprocess, filtered env.
* Network access is **off by default**; whitelist via `meta.json.tags=["network"]`.
* Auto-mode guardrails:

  * Always respect `require_for_tags` unless explicitly disabled.
  * Enforce per-run action quota and max wall-time; on breach, finish with `status:"failed", reason:"timeout"`.
* LLM calls: token budgets and retry w/ backoff on 429/5xx.

## Reports & Logging

* Per-run JSONL at `~/.pulsar-agent-turbo/logs/<runId>.jsonl` (one event per line).
* Keep the **latest 100 runs** (configurable); rotate oldest.
* Provide a small `tools/merge_report.ts` to convert JSONL → summary JSON (for dashboards/CI).

## Identifier Conventions

* `runId`, `actionRunId`: UUID v4
* Timestamps: strict ISO-8601 with timezone (`Z` or offset)

---

# Pulsar Studio (Desktop GUI)

A cross-platform desktop app for running agents with a visual workflow.

## Tech Stack

* **Electron** (default) or **Tauri** (optional). Set via `PULSAR_STUDIO_RUNTIME=electron|tauri`.
* Renderer: **React** + **TypeScript** (recommended) with Zustand/Redux for state.
* IPC bridge: **preload** script exposes a minimal, audited API (no Node primitives in renderer).

## Layout & UX

* **Window**: Maximized viewport **excluding** OS taskbar/dock; resizable, frameless controls allowed.

* **Pages**:

  1. **Working** (default)
  2. **Settings**
  3. **Guides Manager**
  4. **Knowledge Manager**
  5. **Actions Manager**

* **Working page (3 columns)**:

  * **Left (≈20%)**: “Pulsar Studio” header; list of **history threads**; buttons to open Settings/Guides/Knowledge/Actions.
  * **Middle (≈60%)**: **Thread detail**; each thread owns an `Agent` instance.

    * Top config bar: **Working Directory** selector and **Available Actions** (from the actions in the action manager) picker.
    * Chat-style interaction area with file picker (≤5 files, total ≤50 MB).
  * **Right (≈20%)**:

    * Top half: **Task description + Plan + Progress** (live).
    * Bottom half: **Generated/edited files** list with “Reveal in Finder/Explorer” links.

* **Status bar (bottom)**: last event line (success/failure for guide/knowledge/action ops; core logs).

## Persistence & Paths

* **Data root**: `~/.pulsar-studio/`

  * `guides/` — JSON guide files
  * `knowledge/` — JSON knowledge files
  * `actions/` — per-action directories (`meta.json`, `perform.js`)
  * `saves/` — serialized **threads** and **Agent** state (resumable)
  * `logs/` — symlinks or copies of `~/.pulsar-agent-turbo/logs/*` for GUI
* **Restore on launch**: load `saves/*`, rehydrate threads, resume unfinished runs (continue/terminate prompt).

## Settings Page

* Manage **LLM entries**: provider, model, baseUrl, apiKey, temperature, maxTokens, think flag, **alias** (required).
* Validate connectivity; test prompts; save config to `~/.pulsar-studio/config.json`.

## Guides/Knowledge/Actions Managers

* CRUD over JSON files (with schemas above). Inline validation & previews.
* Action directories managed under `~/.pulsar-studio/actions/`.
* “Create from template” for new actions (scaffold `meta.json` + `perform.js`).

## IPC API (Main ↔ Renderer)

Minimal, typed channels (examples):

```ts
// agent lifecycle
invoke("agent:createThread", { workingDir, actions }): { threadId }
invoke("agent:ask", { threadId, text, files, executionMode }): { runId }
invoke("agent:getReport", { runId }): Report
invoke("agent:submitFeedback", { actionRunId, feedback }): void
on("agent:event", (ev: EventEnvelope) => void) // stream run_* and plan/action events

// resource managers
invoke("guide:list") => GuideMeta[]
invoke("guide:save", { file, contents }) => void
// same for knowledge/actions
```

**Security**

* Expose **only** these IPC methods via the preload bridge.
* Validate all file paths under the allowed roots; reject traversal.
* For Electron, set `contextIsolation: true`, `nodeIntegration: false`.

## Logging & Telemetry

* Renderer never writes directly to disk; it asks main to persist logs/events.
* Keep the **latest 100 Agent runs** in GUI (older are pruned).
* Optional telemetry should be **opt-in** and disabled by default.

---

## Testing Hints (JS)

* **Unit**: Planner termination logic; Action timeouts; LLM alias fallbacks; screening strategies.
* **Contract**: `perform.js` result schema; feedback plumbing (`feedback_received` emitted once; idempotent by `actionRunId`).
* **Property-based**: Merge JSONL events in any order → stable summary.
* **E2E (desktop)**: IPC guards; resume from `saves/`; cannot change workingDir/actions after start.

---

## Node.js Specific Notes

* **Type Safety**: full TypeScript; export all public interfaces from `src/types/index.ts`.
* **Modules**: `"type": "module"`; for CommonJS actions, dynamic import via `createRequire` or spawn; prefer **spawned** actions for isolation.
* **Async**: Promise/async-await throughout; never block the event loop during action execution (use child_process).
* **Dev tools**: Jest (tests), ESLint, Prettier, `tsx`/`ts-node` for dev, `pnpm` or `npm` scripts for build/test.

---

### Final sanity notes

* Paths normalized: **`~/.pulsar-studio/{guides,knowledge,actions,saves,logs}`** and **`~/.pulsar-agent-turbo/logs`**.
* GUI copy says “whole area” and “excluding dock/taskbar.” Implement with `workAreaSize` (Electron/Tauri) rather than assuming dimensions.
* Keep “available actions” and “working directory” **immutable** after task start—your event model already supports it.
