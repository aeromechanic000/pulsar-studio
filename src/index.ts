/**
 * Pulsar Agent Turbo - LLM-driven agent with modular architecture.
 *
 * This package provides a comprehensive agent system that can:
 * - Build and execute multi-step plans
 * - Make intelligent decisions about next actions
 * - Manage knowledge bases and guides
 * - Execute actions in a controlled environment
 * - Support multiple LLM providers and configurations
 *
 * Main Components:
 * - Agent: Main orchestration class
 * - LLM: Unified LLM interface supporting multiple providers
 * - Planner: Plan generation and progress tracking
 * - Decider: Next action selection
 * - Guide: Planning guide management
 * - Knowledge: Knowledge base management with online search
 * - Action: Action discovery and execution framework
 */

// Export main classes
export { Agent } from './agent/index.js';
export { LLM } from './llm/index.js';
export { Guide } from './guide/index.js';
export { Knowledge } from './knowledge/index.js';
export { Action } from './action/index.js';
export { Planner } from './planner/index.js';
export { Decider } from './decider/index.js';

// Export types and configurations
export type {
  // Core types
  AgentConfig,
  ExecutionConfig,
  LoggingConfig,
  FeedbackConfig,
  ScreeningConfig,
  OnlineConfig,
  LLMConfig,

  // Plan and Progress types
  Plan,
  PlanStep,
  Progress,

  // Decision types
  Decision,
  ActionSpec,

  // Action types
  ActionResult,
  ActionMeta,
  Feedback,

  // Guide types
  GuideEntry,
  GuideFile,

  // Knowledge types
  KnowledgeEntry,
  KnowledgeFile,

  // Event and Observation types
  EventEnvelope,
  Observation,

  // Metrics types
  AgentMetrics,
  PlanningMetrics,
  DeciderMetrics
} from './types/index.js';

// Export utility functions
export {
  validateScreeningConfig,
  validatePlan,
  validateDecision,
  createDefaultScreeningConfig,
  createDefaultOnlineConfig,
  createDefaultExecutionConfig,
  createDefaultLoggingConfig,
  createDefaultFeedbackConfig,
  createDefaultAgentConfig
} from './types/index.js';

// Export error classes
export {
  LLMError,
  LLMTimeoutError,
  LLMRateLimitError,
  LLMValidationError
} from './types/index.js';

// Package metadata
export const VERSION = '0.1.0';
export const AUTHOR = 'pulsar-agent-turbo Contributors';

/**
 * Convenience function to create a complete agent with default configuration.
 */
export async function createAgent(config?: {
  llm?: {
    provider: 'openai' | 'ollama';
    baseUrl: string;
    apiKey?: string;
    model: string;
    temperature?: number;
    maxTokens?: number;
    think?: boolean;
    alias?: string;
  };
  guides?: string[];
  knowledge?: string[];
  actions?: string;
  online?: {
    provider: 'web' | 'custom_api';
    baseUrl?: string;
    apiKey?: string;
    index?: string;
    maxResults?: number;
    timeout?: number;
  };
  screening?: {
    strategy?: 'keyword' | 'vector' | 'hybrid';
    k?: number;
  };
}) {
  const {
    llm: llmConfig,
    guides = [],
    knowledge = [],
    actions = '~/.pulsar-agent-turbo/actions',
    online,
    screening
  } = config || {};

  // Create LLM instance
  const llm = new LLM();
  if (llmConfig) {
    llm.addConfig({
      provider: llmConfig.provider,
      baseUrl: llmConfig.baseUrl,
      apiKey: llmConfig.apiKey,
      model: llmConfig.model,
      temperature: llmConfig.temperature || 0.7,
      maxTokens: llmConfig.maxTokens,
      think: llmConfig.think || false,
      alias: llmConfig.alias
    });
  } else {
    // Add default Ollama configuration
    llm.addConfig({
      provider: 'ollama',
      baseUrl: 'http://localhost:11434',
      model: 'llama3.2:3b',
      temperature: 0.7,
      think: false,
      alias: 'default'
    });
  }

  // Create screening configuration
  const screeningConfig = {
    strategy: screening?.strategy || 'keyword',
    k: screening?.k || 5
  };

  // Create online configuration
  const onlineConfig = online ? {
    provider: online.provider,
    baseUrl: online.baseUrl,
    apiKey: online.apiKey,
    index: online.index,
    maxResults: online.maxResults || 5,
    timeout: online.timeout || 30.0
  } : undefined;

  // Create components
  const guide = new Guide(guides, screeningConfig);
  const knowledgeInstance = new Knowledge(knowledge, screeningConfig, onlineConfig);
  const actionInstance = new Action(actions, screeningConfig);

  // Create and return agent
  return new Agent(llm, guide, knowledgeInstance, actionInstance);
}

/**
 * Convenience function to quickly run an agent request with default configuration.
 */
export async function runAgent(
  request: string,
  options?: {
    files?: string[];
    executionMode?: 'interactive' | 'auto';
    llm?: {
      provider: 'openai' | 'ollama';
      baseUrl: string;
      apiKey?: string;
      model: string;
      temperature?: number;
      maxTokens?: number;
      think?: boolean;
      alias?: string;
    };
    guides?: string[];
    knowledge?: string[];
    actions?: string;
    online?: {
      provider: 'web' | 'custom_api';
      baseUrl?: string;
      apiKey?: string;
      index?: string;
      maxResults?: number;
      timeout?: number;
    };
    screening?: {
      strategy?: 'keyword' | 'vector' | 'hybrid';
      k?: number;
    };
  }
) {
  const agent = await createAgent(options);
  return agent.ask(request, options?.files, {
    executionMode: options?.executionMode
  });
}

// Default export
export default {
  Agent,
  LLM,
  Guide,
  Knowledge,
  Action,
  Planner,
  Decider,
  createAgent,
  runAgent,
  VERSION,
  AUTHOR
};