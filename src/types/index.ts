/**
 * Shared type definitions for pulsar-agent-turbo.
 *
 * Contains common data structures and configurations used across multiple modules.
 */

export interface ScreeningConfig {
  /** Configuration for screening strategies used by Guide, Knowledge, and Action classes. */
  strategy: 'keyword' | 'vector' | 'hybrid';
  k: number;
  embeddingAlias?: string;
  rerankerAlias?: string;
}

export interface OnlineConfig {
  /** Configuration for online knowledge retrieval. */
  provider: 'web' | 'custom_api';
  baseUrl?: string;
  apiKey?: string;
  index?: string;
  maxResults: number;
  timeout: number;
}

// Plan and Progress types
export interface PlanStep {
  /** A single step in a plan. */
  id: string;
  desc: string;
  status: 'pending' | 'running' | 'done' | 'blocked';
  deps: string[]; // List of step IDs this step depends on
}

export interface Plan {
  /** A plan consisting of multiple steps. */
  task: string;
  steps: PlanStep[];
  createdAt: string;
  updatedAt: string;
}

export interface Progress {
  /** Progress tracking for a plan. */
  stepId: string;
  status: string;
  completedAt?: string;
  notes?: string;
}

// Decision types
export interface ActionSpec {
  /** Specification of an action to be performed. */
  name: string;
  args: Record<string, any>;
}

export interface Decision {
  /** A decision about what to do next. */
  type: 'execute' | 'ask' | 'wait' | 'terminate';
  action?: ActionSpec; // Present iff type == "execute"
  reason: string;
  hint?: 'continue' | 'terminate' | 'blocked';
}

// Action types
export interface ActionResult {
  /** Result of an action execution. */
  actionRunId: string;
  name: string;
  status: 'ok' | 'error' | 'timeout';
  result?: string;
  data?: Record<string, any>;
  error?: string;
  logs: string[];
}

export interface ActionMeta {
  /** Metadata for an action. */
  name: string;
  description: string;
  arguments: Array<{
    name: string;
    type: string;
    description: string;
    required: boolean;
  }>;
  timeoutSec: number;
  tags: string[];
}

// Feedback types
export interface Feedback {
  /** Feedback on an action execution. */
  actionRunId: string;
  score: number; // 0-5 scale
  signal: 'success' | 'partial' | 'fail';
  comment: string;
  labels: string[];
  suggestions: string;
  submittedBy: 'user' | 'system';
  ts: string;
}

// Event types for message bus
export interface EventEnvelope {
  /** Envelope for inter-process communication events. */
  type: string;
  id: string;
  ts: string;
  payload: Record<string, any>;
}

// Observation types
export interface Observation {
  /** An observation about the world or system state. */
  content: string;
  source: string;
  timestamp: string;
  metadata?: Record<string, any>;
}

// Configuration types
export interface ExecutionConfig {
  /** Configuration for execution behavior. */
  executionMode: 'interactive' | 'auto';
  confirmPolicy: {
    default: boolean;
    requireForTags: string[];
    maxParallelActions: number;
  };
}

export interface LoggingConfig {
  /** Configuration for logging behavior. */
  dir: string;
  reportFormat: string;
  captureStdout: boolean;
  captureStderr: boolean;
}

export interface FeedbackConfig {
  /** Configuration for feedback collection. */
  enableUserFeedback: boolean;
  implicitSuccessOnOk: boolean;
}

export interface AgentConfig {
  /** Main configuration for the agent. */
  execution: ExecutionConfig;
  logging: LoggingConfig;
  feedback: FeedbackConfig;
}

// Guide types
export interface GuideEntry {
  /** A single guide entry. */
  name: string;
  description: string;
  plan: string[];
}

export interface GuideFile {
  /** A guide file with metadata and entries. */
  meta: Record<string, any>;
  entries: GuideEntry[];
}

// Knowledge types
export interface KnowledgeEntry {
  /** A single knowledge entry. */
  name: string;
  description: string;
  content: string;
}

export interface KnowledgeFile {
  /** A knowledge file with metadata and entries. */
  meta: Record<string, any>;
  entries: KnowledgeEntry[];
}

// LLM types
export interface LLMConfig {
  /** Configuration for LLM clients. */
  provider: 'openai' | 'ollama';
  baseUrl: string;
  apiKey?: string;
  model: string;
  temperature: number;
  maxTokens?: number;
  think: boolean;
  alias?: string;
}

export interface LLMResponse {
  /** Response from LLM with metadata. */
  content: string;
  model: string;
  usage?: Record<string, number>;
  finishReason?: string;
  requestId?: string;
  thinkSupported: boolean;
}

// Error classes
export class LLMError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LLMError';
  }
}

export class LLMTimeoutError extends LLMError {
  constructor(message: string) {
    super(message);
    this.name = 'LLMTimeoutError';
  }
}

export class LLMRateLimitError extends LLMError {
  constructor(message: string) {
    super(message);
    this.name = 'LLMRateLimitError';
  }
}

export class LLMValidationError extends LLMError {
  constructor(message: string) {
    super(message);
    this.name = 'LLMValidationError';
  }
}

// Utility functions for type validation
export function validateScreeningConfig(config: ScreeningConfig): boolean {
  /** Validate a screening configuration. */
  if (!['keyword', 'vector', 'hybrid'].includes(config.strategy)) {
    return false;
  }
  if (config.k <= 0) {
    return false;
  }
  return true;
}

export function validatePlan(plan: Plan): boolean {
  /** Validate a plan structure. */
  if (!plan.task || !plan.steps) {
    return false;
  }

  // Check step IDs are unique
  const stepIds = plan.steps.map(step => step.id);
  const uniqueStepIds = new Set(stepIds);
  if (stepIds.length !== uniqueStepIds.size) {
    return false;
  }

  // Check dependencies refer to existing steps
  const allStepIds = uniqueStepIds;
  for (const step of plan.steps) {
    for (const dep of step.deps) {
      if (!allStepIds.has(dep)) {
        return false;
      }
    }
  }

  return true;
}

export function validateDecision(decision: Decision): boolean {
  /** Validate a decision structure. */
  if (!['execute', 'ask', 'wait', 'terminate'].includes(decision.type)) {
    return false;
  }

  if (decision.type === 'execute' && !decision.action) {
    return false;
  }

  if (decision.type !== 'execute' && decision.action) {
    return false;
  }

  return true;
}

// Default configurations
export function createDefaultScreeningConfig(): ScreeningConfig {
  return {
    strategy: 'keyword',
    k: 5,
  };
}

export function createDefaultOnlineConfig(): OnlineConfig {
  return {
    provider: 'web',
    maxResults: 5,
    timeout: 30.0,
  };
}

export function createDefaultExecutionConfig(): ExecutionConfig {
  return {
    executionMode: 'interactive',
    confirmPolicy: {
      default: true,
      requireForTags: ['destructive', 'write', 'network'],
      maxParallelActions: 1,
    },
  };
}

export function createDefaultLoggingConfig(): LoggingConfig {
  return {
    dir: '~/.pulsar-agent-turbo/logs',
    reportFormat: 'jsonl',
    captureStdout: true,
    captureStderr: true,
  };
}

export function createDefaultFeedbackConfig(): FeedbackConfig {
  return {
    enableUserFeedback: true,
    implicitSuccessOnOk: true,
  };
}

export function createDefaultAgentConfig(): AgentConfig {
  return {
    execution: createDefaultExecutionConfig(),
    logging: createDefaultLoggingConfig(),
    feedback: createDefaultFeedbackConfig(),
  };
}