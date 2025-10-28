// Agent and Thread types
export interface Thread {
  id: string;
  name: string;
  working_dir: string;
  created_at: string;
  updated_at: string;
  agent_state?: AgentState;
  config?: ThreadConfig;
}

export interface ThreadConfig {
  plannerLlmAlias: string;
  deciderLlmAlias: string;
  selectedKnowledge: string[];
  selectedGuides: string[];
  selectedActions: string[];
}

export interface AgentState {
  run_id?: string;
  execution_mode: 'interactive' | 'auto';
  current_plan?: Plan;
  last_activity: string;
}

export interface Plan {
  task: string;
  steps: PlanStep[];
  created_at: string;
  updated_at: string;
}

export interface PlanStep {
  id: string;
  desc: string;
  status: 'pending' | 'running' | 'done' | 'blocked';
  deps: string[];
}

export interface Progress {
  steps_total: number;
  steps_completed: number;
  steps_blocked: number;
  actions_total: number;
  actions_ok: number;
  actions_error: number;
}

// Configuration types
export interface LLMProvider {
  name: string;
  provider: 'openai' | 'ollama';
  base_url: string;
  model: string;
  api_key?: string;
  temperature: number;
  max_tokens?: number;
  think: boolean;
  alias: string;
}

export interface AppConfig {
  llm_providers: LLMProvider[];
  data_root: string;
}

// Action and Event types
export interface ActionSpec {
  name: string;
  description: string;
  arguments: ActionArgument[];
  timeout_sec: number;
  tags?: string[];
}

export interface ActionArgument {
  name: string;
  type: string;
  description: string;
  required: boolean;
}

export interface ActionResult {
  action_run_id: string;
  action_name: string;
  status: 'ok' | 'error';
  result: string;
  data?: any;
  error?: string | null;
  logs?: string[];
  started_at: string;
  finished_at: string;
  duration_ms: number;
}

export interface EventEnvelope {
  type: string;
  id: string;
  ts: string;
  payload: any;
}

// Resource management types
export interface GuideEntry {
  id: string;
  name: string;
  description: string;
  plan: string[];
  file_path: string;
}

export interface KnowledgeEntry {
  id: string;
  name: string;
  description: string;
  content: string;
  file_path: string;
}

export interface GuideFile {
  meta: {
    name: string;
    version: string;
    domain: string;
    [key: string]: any;
  };
  entries: GuideEntry[];
}

export interface KnowledgeFile {
  meta: {
    name: string;
    version: string;
    domain: string;
    [key: string]: any;
  };
  entries: KnowledgeEntry[];
}

// UI State types
export interface UIState {
  current_page: 'working' | 'settings' | 'guides' | 'knowledge' | 'actions';
  selected_thread_id?: string;
  sidebar_collapsed: boolean;
}

// Request/Response types for Tauri commands
export interface CreateThreadRequest {
  name: string;
  working_dir: string;
  plannerLlmAlias: string;
  deciderLlmAlias: string;
  selectedKnowledge: string[];
  selectedGuides: string[];
  selectedActions: string[];
}

export interface DirectoryPermissionResult {
  path: string;
  exists: boolean;
  readable: boolean;
  writable: boolean;
  isDirectory: boolean;
  error?: string;
}

export interface AgentAskRequest {
  thread_id: string;
  text: string;
  files: string[];
  execution_mode: 'interactive' | 'auto';
}

export interface Feedback {
  action_run_id: string;
  score: number;
  signal: 'success' | 'partial' | 'fail';
  comment?: string;
  labels?: string[];
  suggestions?: string;
  submitted_by: 'user' | 'system';
  ts: string;
}