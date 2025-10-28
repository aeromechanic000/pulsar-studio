/**
 * Planner for pulsar-agent-turbo.
 *
 * Transforms user requests into executable multi-step plans and tracks progress
 * through plan execution with termination evaluation.
 */

import { LLM } from '../llm/index.js';
import { GuideEntry } from '../guide/index.js';
import { KnowledgeEntry } from '../knowledge/index.js';
import {
  Plan,
  PlanStep,
  Progress,
  ActionResult,
  Observation,
  validatePlan
} from '../types/index.js';

/**
 * Metrics for planning operations.
 */
export interface PlanningMetrics {
  buildTimeMs: number;
  updateCount: number;
  replans: number;
  steps: Array<{
    id: string;
    status: string;
    latencyMs: number;
  }>;
}

/**
 * Builds/updates multi-step plans from requests and tracks progress.
 */
export class Planner {
  private llm: LLM;
  private metrics: PlanningMetrics;

  constructor(llm: LLM) {
    /** Initialize Planner with LLM instance for plan generation.

    Args:
        llm: LLM instance for generating plans and reasoning
    */
    this.llm = llm;
    this.metrics = {
      buildTimeMs: 0,
      updateCount: 0,
      replans: 0,
      steps: []
    };
  }

  async build(request: string, guides: GuideEntry[], knowledge: KnowledgeEntry[]): Promise<Plan> {
    /** Build initial plan from request plus screened guides/knowledge.

    Args:
        request: User request to create a plan for
        guides: Relevant guide entries screened by request
        knowledge: Relevant knowledge entries screened by request

    Returns:
        Initial Plan with steps and metadata
    */
    const startTime = Date.now();

    try {
      // Prepare context for LLM
      const context = this.preparePlanningContext(request, guides, knowledge);

      // Generate plan using LLM
      const planData = await this.generatePlanWithLLM(context);

      // Create Plan object
      const plan = this.createPlanFromData(request, planData);

      // Validate plan
      if (!validatePlan(plan)) {
        throw new Error('Generated plan failed validation');
      }

      // Update metrics
      this.metrics.buildTimeMs = Date.now() - startTime;
      this.metrics.steps = plan.steps.map(step => ({
        id: step.id,
        status: step.status,
        latencyMs: 0
      }));

      return plan;

    } catch (error: any) {
      // Create fallback plan for critical errors
      return this.createFallbackPlan(request, error.message);
    }
  }

  async update(plan: Plan, observation: Observation): Promise<Plan> {
    /** Update plan based on new observation.

    Args:
        plan: Current plan to update
        observation: New observation that may require plan changes

    Returns:
        Updated Plan with modifications
    */
    const startTime = Date.now();

    try {
      // Analyze observation against current plan
      const updateContext = this.prepareUpdateContext(plan, observation);

      // Generate plan updates using LLM
      const updateData = await this.generatePlanUpdateWithLLM(updateContext);

      // Apply updates to plan
      const updatedPlan = this.applyPlanUpdates(plan, updateData);

      // Update metrics
      this.metrics.updateCount += 1;
      this.metrics.replans += 1;

      // Update timestamp
      updatedPlan.updatedAt = new Date().toISOString();

      return updatedPlan;

    } catch (error: any) {
      console.warn(`Warning: Failed to update plan: ${error.message}`);
      // Return original plan if update fails
      plan.updatedAt = new Date().toISOString();
      return plan;
    }
  }

  progress(plan: Plan): Progress {
    /** Get current progress of plan execution.

    Args:
        plan: Plan to get progress for

    Returns:
        Progress information
    */
    // Find current active step
    let currentStep: PlanStep | undefined;
    let completedSteps = 0;
    const totalSteps = plan.steps.length;

    for (const step of plan.steps) {
      if (step.status === 'done') {
        completedSteps += 1;
      } else if ((step.status === 'running' || step.status === 'pending') && !currentStep) {
        currentStep = step;
      }
    }

    return {
      stepId: currentStep?.id || '',
      status: currentStep?.status || 'completed',
      notes: `Completed ${completedSteps}/${totalSteps} steps`
    };
  }

  updateFromAction(plan: Plan, actionResult: ActionResult): {
    status: 'continue' | 'terminate' | 'blocked';
    reason: 'goal_achieved' | 'impossible' | 'exhausted' | 'error';
    updatedPlan: Plan;
  } {
    /** Update plan based on action result and evaluate termination.

    Args:
        plan: Current plan to update
        actionResult: Result from the last action execution

    Returns:
        Advisory with status, reason, and updated plan
    */
    try {
      // Find the step that corresponds to this action
      const currentStep = plan.steps.find(step => step.status === 'running');

      if (currentStep) {
        // Update step status based on action result
        if (actionResult.status === 'ok') {
          currentStep.status = 'done';
        } else if (actionResult.status === 'error') {
          currentStep.status = 'blocked';
        } else if (actionResult.status === 'timeout') {
          currentStep.status = 'blocked';
        }

        // Update plan timestamp
        plan.updatedAt = new Date().toISOString();
      }

      // Evaluate termination conditions
      const allStepsDone = plan.steps.every(step => step.status === 'done');
      const hasBlockedSteps = plan.steps.some(step => step.status === 'blocked');

      if (allStepsDone) {
        return {
          status: 'terminate',
          reason: 'goal_achieved',
          updatedPlan: plan
        };
      } else if (hasBlockedSteps) {
        return {
          status: 'blocked',
          reason: 'error',
          updatedPlan: plan
        };
      } else {
        return {
          status: 'continue',
          reason: 'exhausted',
          updatedPlan: plan
        };
      }

    } catch (error: any) {
      console.warn(`Warning: Failed to update plan from action: ${error.message}`);
      return {
        status: 'continue',
        reason: 'error',
        updatedPlan: plan
      };
    }
  }

  private preparePlanningContext(request: string, guides: GuideEntry[], knowledge: KnowledgeEntry[]): string {
    /** Prepare context for LLM plan generation. */
    let context = `Task: ${request}\n\n`;

    if (guides.length > 0) {
      context += 'Relevant Guides:\n';
      for (const guide of guides) {
        context += `- ${guide.name}: ${guide.description}\n`;
        context += `  Plan: ${guide.plan.join(' -> ')}\n`;
      }
      context += '\n';
    }

    if (knowledge.length > 0) {
      context += 'Relevant Knowledge:\n';
      for (const kn of knowledge.slice(0, 5)) { // Limit to top 5 for context
        context += `- ${kn.name}: ${kn.description}\n`;
      }
      context += '\n';
    }

    context += `Please create a detailed step-by-step plan to accomplish the task.
Each step should be specific, actionable, and dependent on previous steps when needed.
Return the plan as a JSON object with the following structure:
{
  "task": "brief task description",
  "steps": [
    {
      "id": "step1",
      "desc": "description of step 1",
      "deps": []
    },
    {
      "id": "step2",
      "desc": "description of step 2",
      "deps": ["step1"]
    }
  ]
}`;

    return context;
  }

  private async generatePlanWithLLM(context: string): Promise<any> {
    /** Generate plan using LLM with structured output. */
    const schema = {
      type: 'object',
      properties: {
        task: { type: 'string' },
        steps: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              desc: { type: 'string' },
              deps: { type: 'array', items: { type: 'string' } }
            },
            required: ['id', 'desc', 'deps']
          }
        }
      },
      required: ['task', 'steps']
    };

    return await this.llm.generateStructured(context, schema);
  }

  private createPlanFromData(request: string, planData: any): Plan {
    /** Create Plan object from LLM-generated data. */
    const steps: PlanStep[] = planData.steps.map((stepData: any) => ({
      id: stepData.id,
      desc: stepData.desc,
      status: 'pending' as const,
      deps: Array.isArray(stepData.deps) ? stepData.deps : []
    }));

    const now = new Date().toISOString();

    return {
      task: planData.task || request,
      steps,
      createdAt: now,
      updatedAt: now
    };
  }

  private createFallbackPlan(request: string, error: string): Plan {
    /** Create a simple fallback plan when plan generation fails. */
    const now = new Date().toISOString();

    return {
      task: request,
      steps: [
        {
          id: 'fallback_step',
          desc: `Complete the task: ${request} (plan generation failed: ${error})`,
          status: 'pending',
          deps: []
        }
      ],
      createdAt: now,
      updatedAt: now
    };
  }

  private prepareUpdateContext(plan: Plan, observation: Observation): string {
    /** Prepare context for plan update generation. */
    let context = `Current Plan:\n`;
    context += `Task: ${plan.task}\n`;
    context += 'Steps:\n';

    for (const step of plan.steps) {
      const statusIcon = step.status === 'done' ? '✓' : step.status === 'running' ? '→' : '○';
      context += `  ${statusIcon} ${step.id}: ${step.desc} (${step.status})\n`;
      if (step.deps.length > 0) {
        context += `    Dependencies: ${step.deps.join(', ')}\n`;
      }
    }

    context += `\nNew Observation: ${observation.content}\n`;
    context += `Source: ${observation.source}\n`;
    context += `Timestamp: ${observation.timestamp}\n`;

    if (observation.metadata && Object.keys(observation.metadata).length > 0) {
      context += `Metadata: ${JSON.stringify(observation.metadata, null, 2)}\n`;
    }

    context += `\nBased on this observation, please suggest updates to the plan.
If the plan needs changes, return a JSON object with updated steps.
If no changes are needed, return the current plan as-is.
Use the same JSON structure as the original plan.`;

    return context;
  }

  private async generatePlanUpdateWithLLM(updateContext: string): Promise<any> {
    /** Generate plan updates using LLM. */
    const schema = {
      type: 'object',
      properties: {
        task: { type: 'string' },
        steps: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              desc: { type: 'string' },
              status: { type: 'string', enum: ['pending', 'running', 'done', 'blocked'] },
              deps: { type: 'array', items: { type: 'string' } }
            },
            required: ['id', 'desc', 'deps']
          }
        }
      },
      required: ['task', 'steps']
    };

    return await this.llm.generateStructured(updateContext, schema);
  }

  private applyPlanUpdates(plan: Plan, updateData: any): Plan {
    /** Apply updates to existing plan. */
    const updatedSteps: PlanStep[] = [];
    const existingStepMap = new Map(plan.steps.map(step => [step.id, step]));

    for (const stepData of updateData.steps) {
      const existingStep = existingStepMap.get(stepData.id);

      if (existingStep) {
        // Update existing step
        updatedSteps.push({
          ...existingStep,
          desc: stepData.desc || existingStep.desc,
          status: stepData.status || existingStep.status,
          deps: Array.isArray(stepData.deps) ? stepData.deps : existingStep.deps
        });
      } else {
        // Add new step
        updatedSteps.push({
          id: stepData.id,
          desc: stepData.desc,
          status: stepData.status || 'pending',
          deps: Array.isArray(stepData.deps) ? stepData.deps : []
        });
      }
    }

    return {
      ...plan,
      task: updateData.task || plan.task,
      steps: updatedSteps,
      updatedAt: new Date().toISOString()
    };
  }

  getMetrics(): PlanningMetrics {
    /** Get current planning metrics. */
    return { ...this.metrics };
  }

  resetMetrics(): void {
    /** Reset planning metrics. */
    this.metrics = {
      buildTimeMs: 0,
      updateCount: 0,
      replans: 0,
      steps: []
    };
  }
}

export * from '../types/index.js';