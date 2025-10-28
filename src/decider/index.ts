/**
 * Decider for pulsar-agent-turbo.
 *
 * Chooses the next action based on plan/progress and available actions,
 * honoring planner advisories and providing decision reasoning.
 */

import { LLM } from '../llm/index.js';
import { Action, ActionSpec } from '../action/index.js';
import {
  Decision,
  Plan,
  Progress,
  ActionType,
  validateDecision
} from '../types/index.js';

/**
 * Metrics for decision operations.
 */
export interface DeciderMetrics {
  decisionsTotal: number;
  byType: {
    execute: number;
    ask: number;
    wait: number;
    terminate: number;
  };
  meanDecisionLatencyMs: number;
  confirmationsRequested: number;
  confirmationsSkipped: number;
  policyBypasses: number;
}

/**
 * Chooses the next action consistent with plan/progress; honors planner advisories.
 */
export class Decider {
  private llm: LLM;
  private actionRegistry: Action;
  private metrics: DeciderMetrics;
  private decisionLatencies: number[] = [];

  constructor(llm: LLM, actionRegistry: Action) {
    /** Initialize Decider with LLM and action registry.

    Args:
        llm: LLM instance for decision reasoning
        actionRegistry: Action instance for discovering available actions
    */
    this.llm = llm;
    this.actionRegistry = actionRegistry;
    this.metrics = {
      decisionsTotal: 0,
      byType: {
        execute: 0,
        ask: 0,
        wait: 0,
        terminate: 0
      },
      meanDecisionLatencyMs: 0,
      confirmationsRequested: 0,
      confirmationsSkipped: 0,
      policyBypasses: 0
    };
  }

  async next(
    plan: Plan,
    progress: Progress,
    actions: ActionSpec[],
    advisory?: Record<string, any>
  ): Promise<Decision> {
    /** Choose the next action based on plan, progress, and available actions.

    Args:
        plan: Current plan with steps
        progress: Current progress information
        actions: Available actions that could be executed
        advisory: Optional advisory from planner after last action result

    Returns:
        Decision about what to do next
    */
    const startTime = Date.now();

    try {
      let decision: Decision;

      // Check planner advisory first
      if (advisory?.status === 'terminate') {
        decision = this.handleTerminationAdvisory(advisory);
      } else if (advisory?.status === 'blocked') {
        decision = await this.handleBlockedAdvisory(advisory, plan, progress);
      } else {
        // Normal decision making
        decision = await this.makeNormalDecision(plan, progress, actions, advisory);
      }

      // Validate decision
      if (!validateDecision(decision)) {
        throw new Error(`Generated decision failed validation: ${JSON.stringify(decision)}`);
      }

      // Update metrics
      this.updateMetrics(decision, startTime);

      return decision;

    } catch (error: any) {
      console.warn(`Warning: Decision making failed: ${error.message}`);
      // Return safe fallback decision
      return this.createFallbackDecision(error.message);
    }
  }

  private handleTerminationAdvisory(advisory: Record<string, any>): Decision {
    /** Handle termination advisory from planner. */
    return {
      type: 'terminate',
      reason: advisory.reason || 'Planner advised termination',
      hint: advisory.reason || 'terminate' as any
    };
  }

  private async handleBlockedAdvisory(advisory: Record<string, any>, plan: Plan, progress: Progress): Promise<Decision> {
    /** Handle blocked advisory from planner. */
    // Check if we can recover from the block
    const blockedStep = plan.steps.find(step => step.status === 'blocked');

    if (blockedStep) {
      // Try to find an alternative action or ask for help
      const context = this.prepareBlockedContext(plan, progress, blockedStep, advisory);

      try {
        const decisionData = await this.generateDecisionWithLLM(context, 'blocked');
        return this.parseDecisionFromData(decisionData);
      } catch (error) {
        // Fallback: ask user for help
        return {
          type: 'ask',
          reason: `Plan is blocked at step "${blockedStep.desc}". ${advisory.reason || 'Unknown blockage'}`,
          hint: 'blocked'
        };
      }
    }

    // No specific blocked step found, terminate
    return {
      type: 'terminate',
      reason: 'Plan execution is blocked with no clear recovery path',
      hint: 'blocked'
    };
  }

  private async makeNormalDecision(plan: Plan, progress: Progress, actions: ActionSpec[], advisory?: Record<string, any>): Promise<Decision> {
    /** Normal decision making process. */

    // Find current step to execute
    const currentStep = this.findCurrentStep(plan, progress);

    if (!currentStep) {
      // No current step, check if plan is complete
      const allDone = plan.steps.every(step => step.status === 'done');
      if (allDone) {
        return {
          type: 'terminate',
          reason: 'All plan steps completed successfully',
          hint: 'terminate'
        };
      } else {
        return {
          type: 'wait',
          reason: 'No clear next step identified, waiting for guidance',
          hint: 'continue'
        };
      }
    }

    // Determine what action to take for the current step
    const context = this.prepareDecisionContext(plan, progress, currentStep, actions, advisory);

    try {
      const decisionData = await this.generateDecisionWithLLM(context, 'normal');
      return this.parseDecisionFromData(decisionData);
    } catch (error) {
      // Fallback: try to select a relevant action
      const relevantAction = await this.selectRelevantAction(currentStep, actions);

      if (relevantAction) {
        return {
          type: 'execute',
          action: {
            name: relevantAction.meta.name,
            args: this.inferActionArgs(currentStep, relevantAction)
          },
          reason: `Execute action "${relevantAction.meta.name}" for step "${currentStep.desc}"`
        };
      } else {
        return {
          type: 'ask',
          reason: `Cannot determine appropriate action for step "${currentStep.desc}"`,
          hint: 'continue'
        };
      }
    }
  }

  private findCurrentStep(plan: Plan, progress: Progress): PlanStep | undefined {
    /** Find the current step that should be executed. */

    // First check if there's a running step
    const runningStep = plan.steps.find(step => step.status === 'running');
    if (runningStep) {
      return runningStep;
    }

    // Find the first pending step whose dependencies are satisfied
    for (const step of plan.steps) {
      if (step.status === 'pending') {
        const dependenciesMet = step.deps.every(depId => {
          const depStep = plan.steps.find(s => s.id === depId);
          return depStep?.status === 'done';
        });

        if (dependenciesMet) {
          return step;
        }
      }
    }

    // No suitable step found
    return undefined;
  }

  private prepareDecisionContext(plan: Plan, progress: Progress, currentStep: PlanStep, actions: ActionSpec[], advisory?: Record<string, any>): string {
    /** Prepare context for LLM decision generation. */

    let context = `Current Plan:\n`;
    context += `Task: ${plan.task}\n`;
    context += 'Steps:\n';

    for (const step of plan.steps) {
      const statusIcon = step.status === 'done' ? '✓' : step.status === 'running' ? '→' : step.status === 'blocked' ? '✗' : '○';
      const isCurrent = step.id === currentStep.id ? ' (CURRENT)' : '';
      context += `  ${statusIcon} ${step.id}: ${step.desc}${isCurrent}\n`;
      if (step.deps.length > 0) {
        context += `    Dependencies: ${step.deps.join(', ')}\n`;
      }
    }

    context += `\nCurrent Progress: ${progress.notes}\n`;
    context += `Current Step: ${currentStep.desc}\n`;

    if (advisory) {
      context += `\nPlanner Advisory:\n`;
      context += `Status: ${advisory.status}\n`;
      context += `Reason: ${advisory.reason}\n`;
    }

    context += `\nAvailable Actions:\n`;
    for (const action of actions.slice(0, 10)) { // Limit to top 10 for context
      context += `- ${action.meta.name}: ${action.meta.description}\n`;
      if (action.meta.tags.length > 0) {
        context += `  Tags: ${action.meta.tags.join(', ')}\n`;
      }
      if (action.meta.arguments.length > 0) {
        context += `  Arguments: ${action.meta.arguments.map(arg => `${arg.name}${arg.required ? '*' : ''}`).join(', ')}\n`;
      }
    }

    context += `\nPlease decide what to do next for the current step.
Return your decision as a JSON object with one of these types:
1. "execute" - Execute a specific action with arguments
2. "ask" - Ask the user for clarification or help
3. "wait" - Wait for something to happen
4. "terminate" - End the process

Decision format:
{
  "type": "execute|ask|wait|terminate",
  "action": {
    "name": "action_name",
    "args": {"key": "value"}
  },
  "reason": "explanation of the decision",
  "hint": "continue|terminate|blocked"
}`;

    return context;
  }

  private prepareBlockedContext(plan: Plan, progress: Progress, blockedStep: PlanStep, advisory: Record<string, any>): string {
    /** Prepare context for handling blocked plan steps. */

    let context = `Plan Execution Blocked:\n`;
    context += `Task: ${plan.task}\n`;
    context += `Blocked Step: ${blockedStep.desc}\n`;
    context += `Blockage Reason: ${advisory.reason || 'Unknown'}\n\n`;

    context += 'Current Plan Status:\n';
    for (const step of plan.steps) {
      const statusIcon = step.status === 'done' ? '✓' : step.status === 'blocked' ? '✗' : step.status === 'running' ? '→' : '○';
      context += `  ${statusIcon} ${step.id}: ${step.desc}\n`;
    }

    context += `\nPlease decide how to handle this blockage.
Options:
1. Find an alternative action to complete the blocked step
2. Ask the user for help or clarification
3. Skip the step if it's not critical
4. Terminate if the task cannot be completed

Return your decision as JSON in the same format as normal decisions.`;

    return context;
  }

  private async generateDecisionWithLLM(context: string, mode: 'normal' | 'blocked'): Promise<any> {
    /** Generate decision using LLM with structured output. */

    const schema = {
      type: 'object',
      properties: {
        type: { type: 'string', enum: ['execute', 'ask', 'wait', 'terminate'] },
        action: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            args: { type: 'object' }
          },
          required: ['name']
        },
        reason: { type: 'string' },
        hint: { type: 'string', enum: ['continue', 'terminate', 'blocked'] }
      },
      required: ['type', 'reason']
    };

    // Add conditional requirements for execute type
    if (mode === 'normal') {
      (schema as any).if = {
        properties: { type: { const: 'execute' } }
      };
      (schema as any).then = {
        properties: { action: { required: ['action'] } }
      };
    }

    return await this.llm.generateStructured(context, schema);
  }

  private parseDecisionFromData(decisionData: any): Decision {
    /** Parse decision data from LLM response. */

    const decision: Decision = {
      type: decisionData.type,
      reason: decisionData.reason || 'No reason provided'
    };

    if (decisionData.action) {
      decision.action = {
        name: decisionData.action.name,
        args: decisionData.action.args || {}
      };
    }

    if (decisionData.hint) {
      decision.hint = decisionData.hint;
    }

    return decision;
  }

  private async selectRelevantAction(step: PlanStep, actions: ActionSpec[]): Promise<ActionSpec | undefined> {
    /** Select a relevant action for a given step using keyword matching. */

    const stepText = `${step.desc} ${step.id}`.toLowerCase();

    let bestAction: ActionSpec | undefined;
    let bestScore = 0;

    for (const action of actions) {
      const actionText = `${action.meta.name} ${action.meta.description} ${action.meta.tags.join(' ')}`.toLowerCase();

      // Simple keyword matching score
      const stepWords = stepText.split(/\s+/);
      const actionWords = actionText.split(/\s+/);

      const matchCount = stepWords.filter(word => actionWords.includes(word)).length;
      const score = matchCount / Math.max(stepWords.length, 1);

      if (score > bestScore && score > 0.1) { // Minimum threshold
        bestScore = score;
        bestAction = action;
      }
    }

    return bestAction;
  }

  private inferActionArgs(step: PlanStep, action: ActionSpec): Record<string, any> {
    /** Infer arguments for an action based on the step description. */

    const args: Record<string, any> = {};

    // For now, use simple heuristics - this could be enhanced with LLM inference
    for (const argDef of action.meta.arguments) {
      if (argDef.name === 'query' || argDef.name === 'prompt') {
        args[argDef.name] = step.desc;
      } else if (argDef.name === 'step_id') {
        args[argDef.name] = step.id;
      } else if (!argDef.required) {
        // Don't infer optional arguments
        continue;
      } else {
        // Use a generic placeholder for required arguments we can't infer
        args[argDef.name] = step.desc;
      }
    }

    return args;
  }

  private createFallbackDecision(error: string): Decision {
    /** Create a safe fallback decision when normal decision making fails. */

    return {
      type: 'ask',
      reason: `Decision making failed (${error}), please provide guidance`,
      hint: 'continue'
    };
  }

  private updateMetrics(decision: Decision, startTime: number): void {
    /** Update decision metrics. */

    const latency = Date.now() - startTime;
    this.decisionLatencies.push(latency);

    // Keep only last 100 latencies for moving average
    if (this.decisionLatencies.length > 100) {
      this.decisionLatencies.shift();
    }

    this.metrics.decisionsTotal += 1;
    this.metrics.byType[decision.type] += 1;
    this.metrics.meanDecisionLatencyMs =
      this.decisionLatencies.reduce((sum, l) => sum + l, 0) / this.decisionLatencies.length;
  }

  getMetrics(): DeciderMetrics {
    /** Get current decision metrics. */

    return {
      ...this.metrics,
      byType: { ...this.metrics.byType }
    };
  }

  resetMetrics(): void {
    /** Reset decision metrics. */

    this.metrics = {
      decisionsTotal: 0,
      byType: {
        execute: 0,
        ask: 0,
        wait: 0,
        terminate: 0
      },
      meanDecisionLatencyMs: 0,
      confirmationsRequested: 0,
      confirmationsSkipped: 0,
      policyBypasses: 0
    };
    this.decisionLatencies = [];
  }
}

export * from '../types/index.js';