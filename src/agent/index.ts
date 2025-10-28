/**
 * Agent for pulsar-agent-turbo.
 *
 * Main orchestration layer that manages planning, decision, and action execution
 * with support for interactive and automatic modes, feedback collection, and performance reporting.
 */

import { randomUUID } from 'uuid';
import { LLM } from '../llm/index.js';
import { Guide } from '../guide/index.js';
import { Knowledge } from '../knowledge/index.js';
import { Action, ActionResult, Feedback } from '../action/index.js';
import { Planner } from '../planner/index.js';
import { Decider } from '../decider/index.js';
import {
  AgentConfig,
  Decision,
  EventEnvelope,
  Feedback as FeedbackType,
  Observation,
  Plan,
  Progress,
  ScreeningConfig,
  ActionSpec
} from '../types/index.js';

/**
 * Handle for tracking agent execution runs.
 */
export interface RunHandle {
  runId: string;
  request: {
    text: string;
    files: string[];
  };
  startedAt: string;
  executionMode: 'interactive' | 'auto';
}

/**
 * Metrics for agent operations.
 */
export interface AgentMetrics {
  planner: Record<string, any>;
  decider: Record<string, any>;
  llm: Record<string, any>;
  actionsTotal: number;
  actionsOk: number;
  actionsError: number;
  wallTimeMs: number;
}

/**
 * Main orchestration class for the LLM-driven agent.
 */
export class Agent {
  private llm: LLM;
  private guide: Guide;
  private knowledge: Knowledge;
  private action: Action;
  private config: AgentConfig;
  private planner: Planner;
  private decider: Decider;
  private feedbackHandler?: (actionResult: ActionResult) => Promise<Feedback | null>;

  constructor(
    llm: LLM,
    guide: Guide,
    knowledge: Knowledge,
    action: Action,
    config?: AgentConfig,
    options?: {
      plannerLlm?: LLM;
      deciderLlm?: LLM;
      guideLlm?: LLM;
      knowledgeLlm?: LLM;
    }
  ) {
    /** Initialize Agent with core components.

    Args:
        llm: Default LLM instance for text generation and reasoning
        guide: Guide instance for planning guidance
        knowledge: Knowledge instance for information retrieval
        action: Action instance for executing actions
        config: Optional agent configuration
        options: Optional component-specific LLMs
    */
    this.llm = llm;
    this.guide = guide;
    this.knowledge = knowledge;
    this.action = action;
    this.config = config || this.createDefaultAgentConfig();

    // Use component-specific LLMs if provided, otherwise use default
    const plannerLlm = options?.plannerLlm || llm;
    const deciderLlm = options?.deciderLlm || llm;

    // Initialize sub-components with their respective LLMs
    this.planner = new Planner(plannerLlm);
    this.decider = new Decider(deciderLlm, action);
  }

  async ask(
    text: string,
    files: string[] = [],
    options?: {
      executionMode?: 'interactive' | 'auto';
      feedbackHandler?: (actionResult: ActionResult) => Promise<Feedback | null>;
    }
  ): Promise<RunHandle> {
    /** Submit a request; returns a run handle (with run_id).

    Args:
        text: Request text
        files: Optional list of files to include
        options: Optional execution mode and feedback handler

    Returns:
        RunHandle for tracking the execution
    */
    const runId = randomUUID();
    const startedAt = new Date().toISOString();
    const executionMode = options?.executionMode || this.config.execution.executionMode;

    // Store feedback handler if provided
    if (options?.feedbackHandler) {
      this.feedbackHandler = options.feedbackHandler;
    }

    // Initialize run
    const request = { text, files };
    await this.initializeRun(runId, request, executionMode, startedAt);

    // Start the orchestration process
    this.orchestrate(runId, request).catch(error => {
      console.error(`Orchestration error for run ${runId}:`, error);
    });

    return {
      runId,
      request,
      startedAt,
      executionMode
    };
  }

  async getReport(runId: string): Promise<any> {
    /** Fetch the immutable report for a completed (or in-progress) run.

    Args:
        runId: Run ID to fetch report for

    Returns:
        Performance report data
    */
    // TODO: Implement report fetching from persistent storage
    // For now, return a placeholder structure
    return {
      runId,
      status: 'running',
      message: 'Report fetching not yet implemented'
    };
  }

  async submitFeedback(actionRunId: string, feedback: Feedback): Promise<void> {
    /** Programmatic feedback injection (e.g., from a UI or CLI).

    Args:
        actionRunId: Action run ID to submit feedback for
        feedback: Feedback data
    */
    this.action.addFeedback(actionRunId, feedback);
  }

  private async initializeRun(runId: string, request: any, executionMode: string, startedAt: string): Promise<void> {
    /** Initialize a new run with logging and event emission. */

    // Emit run started event
    await this.emitEvent({
      type: 'run_started',
      id: randomUUID(),
      ts: new Date().toISOString(),
      payload: {
        runId,
        executionMode,
        request
      }
    });

    // Emit user request event
    await this.emitEvent({
      type: 'user_request',
      id: randomUUID(),
      ts: new Date().toISOString(),
      payload: {
        runId,
        text: request.text,
        files: request.files
      }
    });
  }

  private async orchestrate(runId: string, request: any): Promise<void> {
    /** Main orchestration loop for a run. */

    try {
      // Step 1: Screen guides and knowledge
      const guides = await this.guide.select(request.text);
      const knowledge = await this.knowledge.select(request.text);

      // Step 2: Build initial plan
      const plan = await this.planner.build(request.text, guides, knowledge);

      // Emit plan built event
      await this.emitEvent({
        type: 'plan_built',
        id: randomUUID(),
        ts: new Date().toISOString(),
        payload: {
          runId,
          plan,
          buildTimeMs: this.planner.getMetrics().buildTimeMs
        }
      });

      // Step 3: Execute plan loop
      await this.executePlanLoop(runId, plan);

    } catch (error: any) {
      console.error(`Orchestration failed for run ${runId}:`, error);

      // Emit run finished with failure
      await this.emitEvent({
        type: 'run_finished',
        id: randomUUID(),
        ts: new Date().toISOString(),
        payload: {
          runId,
          finishedAt: new Date().toISOString(),
          status: 'failed',
          reason: 'orchestration_error',
          wallTimeMs: 0
        }
      });
    }
  }

  private async executePlanLoop(runId: string, plan: Plan): Promise<void> {
    /** Execute the plan through a decision-action loop. */

    let currentPlan = plan;
    let advisory: Record<string, any> | undefined;

    while (true) {
      // Get current progress
      const progress = this.planner.progress(currentPlan);

      // Screen available actions
      const actions = await this.action.select(currentPlan.task);

      // Make next decision
      const decision = await this.decider.next(currentPlan, progress, actions, advisory);

      // Emit decision event
      await this.emitEvent({
        type: 'decision',
        id: randomUUID(),
        ts: new Date().toISOString(),
        payload: {
          runId,
          decision,
          latencyMs: this.decider.getMetrics().meanDecisionLatencyMs
        }
      });

      // Handle different decision types
      if (decision.type === 'terminate') {
        await this.handleTermination(runId, decision);
        break;
      } else if (decision.type === 'ask') {
        await this.handleAsk(runId, decision);
        break;
      } else if (decision.type === 'wait') {
        await this.handleWait(runId, decision);
        break;
      } else if (decision.type === 'execute' && decision.action) {
        const result = await this.handleExecute(runId, decision.action);
        advisory = this.planner.updateFromAction(currentPlan, result);
        currentPlan = advisory.updatedPlan;

        // Emit plan updated event
        await this.emitEvent({
          type: 'plan_updated',
          id: randomUUID(),
          ts: new Date().toISOString(),
          payload: {
            runId,
            diff: { lastActionResult: result },
            updatedAt: currentPlan.updatedAt
          }
        });

        // Collect feedback if in interactive mode
        if (this.config.execution.executionMode === 'interactive') {
          await this.collectFeedback(runId, result);
        }

        // Emit progress evaluated event
        await this.emitEvent({
          type: 'progress_evaluated',
          id: randomUUID(),
          ts: new Date().toISOString(),
          payload: {
            runId,
            status: advisory.status,
            reason: advisory.reason,
            atStep: this.getCurrentStepId(currentPlan)
          }
        });

        // Continue loop if not terminating
        if (advisory.status === 'terminate') {
          await this.handleTermination(runId, {
            type: 'terminate',
            reason: `Plan completed: ${advisory.reason}`,
            hint: advisory.reason as any
          });
          break;
        }
      }
    }
  }

  private async handleExecute(runId: string, action: ActionSpec): Promise<ActionResult> {
    /** Handle action execution decision. */

    // Check confirmation policy
    const needsConfirmation = this.needsConfirmation(action);

    if (needsConfirmation && this.config.execution.executionMode === 'interactive') {
      // TODO: Implement user confirmation logic
      console.log(`Would you like to execute action "${action.name}" with args:`, action.args);
    }

    // Execute the action
    const actionRunId = this.action.perform(action.name, action.args);

    // Emit action started event
    await this.emitEvent({
      type: 'action_started',
      id: randomUUID(),
      ts: new Date().toISOString(),
      payload: {
        runId,
        actionRunId,
        name: action.name,
        args: action.args,
        startedAt: new Date().toISOString()
      }
    });

    // Wait for action completion
    const result = await this.waitForActionCompletion(actionRunId);

    // Emit action result event
    await this.emitEvent({
      type: 'action_result',
      id: randomUUID(),
      ts: new Date().toISOString(),
      payload: {
        runId,
        actionRunId: result.actionRunId,
        name: result.name,
        status: result.status,
        result: result.result,
        data: result.data,
        error: result.error,
        logsBytes: result.logs.join('\n').length,
        durationMs: 0 // TODO: Calculate actual duration
      }
    });

    return result;
  }

  private async waitForActionCompletion(actionRunId: string): Promise<ActionResult> {
    /** Wait for action to complete and return its result. */

    return new Promise((resolve) => {
      const checkInterval = setInterval(() => {
        const result = this.action.getResult(actionRunId);

        if (result) {
          clearInterval(checkInterval);
          resolve(result);
        }
      }, 100); // Check every 100ms

      // Timeout after 5 minutes
      setTimeout(() => {
        clearInterval(checkInterval);
        resolve({
          actionRunId,
          name: 'unknown',
          status: 'timeout',
          error: 'Action completion timeout',
          logs: []
        });
      }, 5 * 60 * 1000);
    });
  }

  private async collectFeedback(runId: string, actionResult: ActionResult): Promise<void> {
    /** Collect feedback on action execution. */

    let feedback: Feedback | null = null;

    // Try custom feedback handler first
    if (this.feedbackHandler) {
      try {
        feedback = await this.feedbackHandler(actionResult);
      } catch (error) {
        console.warn('Feedback handler failed:', error);
      }
    }

    // If no custom feedback, use implicit feedback
    if (!feedback) {
      if (actionResult.status === 'ok' && this.config.feedback.implicitSuccessOnOk) {
        feedback = {
          actionRunId: actionResult.actionRunId,
          score: 4,
          signal: 'success',
          comment: 'Implicit success feedback',
          labels: [],
          suggestions: '',
          submittedBy: 'system',
          ts: new Date().toISOString()
        };
      } else {
        // Neutral feedback for no response
        feedback = {
          actionRunId: actionResult.actionRunId,
          score: 3,
          signal: 'partial',
          comment: 'no user feedback',
          labels: [],
          suggestions: '',
          submittedBy: 'system',
          ts: new Date().toISOString()
        };
      }
    }

    // Submit feedback
    if (feedback) {
      this.action.addFeedback(actionResult.actionRunId, feedback);

      // Emit feedback received event
      await this.emitEvent({
        type: 'feedback_received',
        id: randomUUID(),
        ts: new Date().toISOString(),
        payload: {
          runId,
          actionRunId: feedback.actionRunId,
          feedback
        }
      });
    }
  }

  private async handleTermination(runId: string, decision: Decision): Promise<void> {
    /** Handle termination decision. */

    await this.emitEvent({
      type: 'run_finished',
      id: randomUUID(),
      ts: new Date().toISOString(),
      payload: {
        runId,
        finishedAt: new Date().toISOString(),
        status: decision.reason === 'goal_achieved' ? 'succeeded' : 'failed',
        reason: decision.reason || 'user_terminated',
        wallTimeMs: 0 // TODO: Calculate actual wall time
      }
    });
  }

  private async handleAsk(runId: string, decision: Decision): Promise<void> {
    /** Handle ask decision. */

    // TODO: Implement user interaction logic
    console.log(`Agent asks: ${decision.reason}`);

    await this.emitEvent({
      type: 'run_finished',
      id: randomUUID(),
      ts: new Date().toISOString(),
      payload: {
        runId,
        finishedAt: new Date().toISOString(),
        status: 'interrupted',
        reason: 'waiting_for_user_input',
        wallTimeMs: 0
      }
    });
  }

  private async handleWait(runId: string, decision: Decision): Promise<void> {
    /** Handle wait decision. */

    // TODO: Implement waiting logic
    console.log(`Agent waiting: ${decision.reason}`);

    // For now, just wait a bit and continue
    setTimeout(async () => {
      await this.emitEvent({
        type: 'run_summary',
        id: randomUUID(),
        ts: new Date().toISOString(),
        payload: {
          runId,
          status: 'running',
          stepsTotal: 0,
          stepsCompleted: 0,
          actionsTotal: 0,
          actionsOk: 0,
          actionsError: 0,
          planner: this.planner.getMetrics(),
          decider: this.decider.getMetrics(),
          llm: { calls: 0, tokensPrompt: 0, tokensCompletion: 0, thinkUsed: 0 }
        }
      });
    }, 1000);
  }

  private needsConfirmation(action: ActionSpec): boolean {
    /** Check if action requires confirmation based on policy. */

    const policy = this.config.execution.confirmPolicy;

    // Check if confirmation is required for action tags
    const actionSpec = this.action.getAllActions().find(a => a.meta.name === action.name);
    if (actionSpec) {
      const hasRestrictedTag = actionSpec.meta.tags.some(tag =>
        policy.requireForTags.includes(tag)
      );
      if (hasRestrictedTag) {
        return true;
      }
    }

    return policy.default;
  }

  private getCurrentStepId(plan: Plan): string {
    /** Get the ID of the current active step. */

    const runningStep = plan.steps.find(step => step.status === 'running');
    if (runningStep) {
      return runningStep.id;
    }

    const pendingStep = plan.steps.find(step => step.status === 'pending');
    if (pendingStep) {
      const dependenciesMet = pendingStep.deps.every(depId => {
        const depStep = plan.steps.find(s => s.id === depId);
        return depStep?.status === 'done';
      });

      if (dependenciesMet) {
        return pendingStep.id;
      }
    }

    return '';
  }

  private async emitEvent(event: EventEnvelope): Promise<void> {
    /** Emit an event to the message bus. */

    // TODO: Implement actual event emission to message bus
    // For now, just log the event
    console.log(`Event: ${event.type}`, {
      id: event.id,
      ts: event.ts,
      payload: event.payload
    });
  }

  private createDefaultAgentConfig(): AgentConfig {
    /** Create default agent configuration. */

    return {
      execution: {
        executionMode: 'interactive',
        confirmPolicy: {
          default: true,
          requireForTags: ['destructive', 'write', 'network'],
          maxParallelActions: 1
        }
      },
      logging: {
        dir: '~/.pulsar-agent-turbo/logs',
        reportFormat: 'jsonl',
        captureStdout: true,
        captureStderr: true
      },
      feedback: {
        enableUserFeedback: true,
        implicitSuccessOnOk: true
      }
    };
  }

  getMetrics(): AgentMetrics {
    /** Get current agent metrics. */

    return {
      planner: this.planner.getMetrics(),
      decider: this.decider.getMetrics(),
      llm: {
        // TODO: Get actual LLM metrics
        calls: 0,
        tokensPrompt: 0,
        tokensCompletion: 0,
        thinkUsed: 0
      },
      actionsTotal: this.action.getAllActions().length,
      actionsOk: 0, // TODO: Track actual action success/failure
      actionsError: 0,
      wallTimeMs: 0 // TODO: Calculate actual wall time
    };
  }
}

export * from '../types/index.js';