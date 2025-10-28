/**
 * Action management for pulsar-agent-turbo.
 *
 * Discovers and executes local actions from per-action directories with support for
 * screening, invocation, run tracking, and feedback collection.
 */

import { readFile, access, readdir } from 'fs/promises';
import { spawn, ChildProcess } from 'child_process';
import { randomUUID } from 'uuid';
import { join, resolve } from 'path';
import {
  ActionMeta,
  ActionResult,
  Feedback,
  ScreeningConfig,
  ActionSpec as ActionType
} from '../types/index.js';

/**
 * Specification of an available action.
 */
export interface ActionSpec {
  meta: ActionMeta;
  path: string;
}

/**
 * Manages available actions with registry, execution, and feedback support.
 */
export class Action {
  private home: string;
  private screening: ScreeningConfig;
  private actions: Map<string, ActionSpec> = new Map();
  private runningActions: Map<string, ChildProcess> = new Map();
  private completedActions: Map<string, ActionResult> = new Map();
  private feedback: Map<string, Feedback[]> = new Map();

  constructor(home: string, screening: ScreeningConfig) {
    /** Initialize Action with home directory and screening configuration.

    Args:
        home: Path to actions directory (e.g., "~/.pulsar-agent-turbo/actions")
        screening: Screening configuration for selecting relevant actions
    */
    this.home = resolve(home.replace(/^~/, process.env.HOME || ''));
    this.screening = screening;
    this.loadActions();
  }

  private async loadActions(): Promise<void> {
    /** Load all available actions from the home directory. */
    try {
      await access(this.home);
    } catch (error) {
      console.warn(`Warning: Actions directory does not exist: ${this.home}`);
      return;
    }

    try {
      const entries = await readdir(this.home, { withFileTypes: true });

      for (const entry of entries) {
        if (!entry.isDirectory()) {
          continue;
        }

        const actionDir = join(this.home, entry.name);

        // Check for required files
        const metaFile = join(actionDir, 'meta.json');
        const performFile = join(actionDir, 'perform.js');

        try {
          await access(metaFile);
          await access(performFile);
        } catch (error) {
          console.warn(`Warning: Action directory missing required files: ${actionDir}`);
          continue;
        }

        try {
          // Load metadata
          const metaContent = await readFile(metaFile, 'utf-8');
          const metaData = JSON.parse(metaContent);

          const meta: ActionMeta = {
            name: metaData.name || entry.name,
            description: metaData.description || '',
            arguments: metaData.arguments || [],
            timeoutSec: metaData.timeout_sec || 120,
            tags: metaData.tags || []
          };

          // Create action spec
          const spec: ActionSpec = {
            meta,
            path: actionDir
          };

          this.actions.set(meta.name, spec);

        } catch (error: any) {
          console.warn(`Warning: Failed to load action ${entry.name}: ${error.message}`);
        }
      }
    } catch (error: any) {
      console.warn(`Warning: Failed to read actions directory: ${error.message}`);
    }
  }

  async select(query: string, k?: number): Promise<ActionSpec[]> {
    /** Discovery/screening: return top-k relevant actions for a query.

    Args:
        query: Query string to match against actions
        k: Number of actions to return (overrides screening.k if provided)

    Returns:
        List of relevant action specifications
    */
    const resultsK = k ?? this.screening.k;

    // Collect all actions
    const allActions = Array.from(this.actions.values());

    if (allActions.length === 0) {
      return [];
    }

    // Apply screening strategy
    let scoredActions: Array<[ActionSpec, number]>;
    if (this.screening.strategy === 'keyword') {
      scoredActions = this.keywordScreening(query, allActions);
    } else if (this.screening.strategy === 'vector') {
      scoredActions = await this.vectorScreening(query, allActions);
    } else if (this.screening.strategy === 'hybrid') {
      scoredActions = await this.hybridScreening(query, allActions);
    } else {
      // Default to keyword screening for unknown strategies
      scoredActions = this.keywordScreening(query, allActions);
    }

    // Sort by score (descending) and return top-k
    scoredActions.sort((a, b) => b[1] - a[1]);
    return scoredActions.slice(0, resultsK).map(([action]) => action);
  }

  perform(name: string, args: Record<string, any>): string {
    /** Invocation: perform an action with given arguments.

    Args:
        name: Name of the action to perform
        args: Arguments to pass to the action

    Returns:
        Run ID for tracking the action execution
    */
    const actionSpec = this.actions.get(name);
    if (!actionSpec) {
      throw new Error(`Action not found: ${name}`);
    }

    const runId = randomUUID();

    try {
      // Validate arguments against action metadata
      this.validateArguments(actionSpec.meta, args);

      // Prepare execution environment
      const env = this.prepareEnvironment(actionSpec);

      // Create the perform script
      const performScript = this.createPerformScript(actionSpec, args, runId);

      // Start subprocess
      const process = spawn('node', ['-e', performScript], {
        cwd: actionSpec.path,
        env,
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: true
      });

      this.runningActions.set(runId, process);

      // Set timeout handling
      this.scheduleTimeout(runId, actionSpec.meta.timeoutSec);

      // Handle process completion
      process.on('close', (code, signal) => {
        this.handleProcessCompletion(runId, name, process, code, signal);
      });

      process.on('error', (error) => {
        const result: ActionResult = {
          actionRunId: runId,
          name,
          status: 'error',
          error: error.message,
          logs: []
        };
        this.completedActions.set(runId, result);
        this.runningActions.delete(runId);
      });

      return runId;

    } catch (error: any) {
      // Create error result immediately
      const result: ActionResult = {
        actionRunId: runId,
        name,
        status: 'error',
        error: error.message,
        logs: []
      };
      this.completedActions.set(runId, result);
      return runId;
    }
  }

  getResult(runId: string): ActionResult | null {
    /** Retrieval: get the result of a completed action.

    Args:
        runId: Run ID returned by perform()

    Returns:
        ActionResult if action is completed, null if still running
    */
    // Check if already completed
    if (this.completedActions.has(runId)) {
      return this.completedActions.get(runId)!;
    }

    // Check if still running
    if (this.runningActions.has(runId)) {
      const process = this.runningActions.get(runId)!;
      if (process.exitCode === null && !process.killed) {
        return null; // Still running
      }
    }

    return null;
  }

  addFeedback(runId: string, feedback: Feedback): void {
    /** Add feedback for a completed action run.

    Args:
        runId: Run ID of the action
        feedback: Feedback data to add
    */
    if (!this.feedback.has(runId)) {
      this.feedback.set(runId, []);
    }
    this.feedback.get(runId)!.push(feedback);
  }

  getFeedback(runId: string): Feedback[] {
    /** Get all feedback for an action run. */
    return this.feedback.get(runId) || [];
  }

  private validateArguments(meta: ActionMeta, args: Record<string, any>): void {
    /** Validate arguments against action metadata. */
    // Check required arguments
    for (const arg of meta.arguments) {
      if (arg.required && !(arg.name in args)) {
        throw new Error(`Required argument missing: ${arg.name}`);
      }
    }

    // Check for unexpected arguments (optional)
    const validArgs = new Set(meta.arguments.map(arg => arg.name));
    const unexpectedArgs = Object.keys(args).filter(arg => !validArgs.has(arg));
    if (unexpectedArgs.length > 0) {
      console.warn(`Warning: Unexpected arguments: ${unexpectedArgs.join(', ')}`);
    }
  }

  private prepareEnvironment(actionSpec: ActionSpec): Record<string, string> {
    /** Prepare environment variables for action execution. */
    const env = { ...process.env };

    // Whitelist of environment variables to pass through
    const allowedVars = [
      'PATH', 'HOME', 'USER', 'SHELL',
      'NODE_PATH', 'NODE_ENV'
    ];

    // Filter environment
    const filteredEnv: Record<string, string> = {};
    for (const key of allowedVars) {
      if (env[key]) {
        filteredEnv[key] = env[key]!;
      }
    }

    // Add action-specific environment
    filteredEnv.PULSAR_ACTION_HOME = actionSpec.path;
    filteredEnv.PULSAR_ACTION_NAME = actionSpec.meta.name;

    return filteredEnv;
  }

  private createPerformScript(actionSpec: ActionSpec, args: Record<string, any>, runId: string): string {
    /** Create a JavaScript script to execute the action. */
    return `
// Pulsar Agent Action Execution Script
const fs = require('fs');
const path = require('path');

try {
  // Import and execute the action
  const performModule = require('./perform.js');

  // Create an agent mock (for now)
  const agentMock = {};

  // Initialize and run the action
  const perform = new performModule.Perform(agentMock);
  const result = perform.run(${JSON.stringify(args)});

  // Handle promise results
  Promise.resolve(result).then(output => {
    // Ensure result is a dictionary
    if (typeof output !== 'object' || output === null) {
      output = { output: String(output) };
    }

    // Add run ID to result
    output.run_id = "${runId}";

    // Output result as JSON
    console.log(JSON.stringify(output));
    process.exit(0);
  }).catch(error => {
    // Output error as JSON
    const errorResult = {
      status: "error",
      error: error.message || String(error),
      run_id: "${runId}"
    };
    console.log(JSON.stringify(errorResult));
    process.exit(1);
  });

} catch (error) {
  // Handle synchronous errors
  const errorResult = {
    status: "error",
    error: error.message || String(error),
    run_id: "${runId}"
  };
  console.log(JSON.stringify(errorResult));
  process.exit(1);
}
`;
  }

  private scheduleTimeout(runId: string, timeoutSec: number): void {
    /** Schedule timeout handling for an action. */
    setTimeout(() => {
      if (this.runningActions.has(runId)) {
        const process = this.runningActions.get(runId)!;
        if (process.exitCode === null && !process.killed) {
          // Kill the process
          process.kill('SIGKILL');

          const actionName = this.getActionNameByRunId(runId);
          const result: ActionResult = {
            actionRunId: runId,
            name: actionName,
            status: 'timeout',
            error: `Action timed out after ${timeoutSec} seconds`,
            logs: []
          };

          this.runningActions.delete(runId);
          this.completedActions.set(runId, result);
        }
      }
    }, timeoutSec * 1000);
  }

  private handleProcessCompletion(runId: string, name: string, process: ChildProcess, code: number | null, signal: string | null): void {
    /** Handle the completion of a process. */
    let stdout = '';
    let stderr = '';

    if (process.stdout) {
      stdout = process.stdout.read()?.toString() || '';
    }
    if (process.stderr) {
      stderr = process.stderr.read()?.toString() || '';
    }

    try {
      // Parse output as JSON
      const outputData = stdout.trim() ? JSON.parse(stdout) : {};

      const result: ActionResult = {
        actionRunId: runId,
        name,
        status: outputData.status || 'error',
        result: outputData.result,
        data: outputData.data,
        error: outputData.error,
        logs: stderr ? stderr.split('\n').filter(line => line.trim()) : []
      };

      this.completedActions.set(runId, result);

    } catch (error) {
      // Fallback for non-JSON output
      const result: ActionResult = {
        actionRunId: runId,
        name,
        status: 'error',
        error: `Failed to parse action output: ${stdout}`,
        logs: stderr ? stderr.split('\n').filter(line => line.trim()) : []
      };

      this.completedActions.set(runId, result);
    }

    this.runningActions.delete(runId);
  }

  private getActionNameByRunId(runId: string): string {
    /** Get action name associated with a run ID. */
    // This is a simplified approach - in practice, you'd maintain a mapping
    for (const [actionName] of this.actions.entries()) {
      // For now, just return the action name (this could be improved)
      return actionName;
    }
    return 'unknown';
  }

  private keywordScreening(query: string, actions: ActionSpec[]): Array<[ActionSpec, number]> {
    /** Keyword-based screening for actions. */
    const queryTerms = new Set(query.toLowerCase().split(/\s+/));

    const scoredActions: Array<[ActionSpec, number]> = [];
    for (const action of actions) {
      // Combine name, description, and tags for scoring
      const text = `${action.meta.name} ${action.meta.description} ${action.meta.tags.join(' ')}`.toLowerCase();
      const textTerms = new Set(text.split(/\s+/));

      // Simple scoring: count matching terms
      const matchCount = [...queryTerms].filter(term => textTerms.has(term)).length;
      if (matchCount > 0) {
        // Normalize by text length
        const score = textTerms.size > 0 ? matchCount / textTerms.size : 0;
        scoredActions.push([action, score]);
      }
    }

    return scoredActions;
  }

  private async vectorScreening(query: string, actions: ActionSpec[]): Promise<Array<[ActionSpec, number]>> {
    /** Vector-based screening (placeholder implementation). */
    console.warn('Warning: Vector screening not implemented, falling back to keyword screening');
    return this.keywordScreening(query, actions);
  }

  private async hybridScreening(query: string, actions: ActionSpec[]): Promise<Array<[ActionSpec, number]>> {
    /** Hybrid screening (placeholder implementation). */
    console.warn('Warning: Hybrid screening not implemented, falling back to keyword screening');
    return this.keywordScreening(query, actions);
  }

  getAllActions(): ActionSpec[] {
    /** Get all available actions without screening. */
    return Array.from(this.actions.values());
  }

  getActionInfo(): Record<string, any> {
    /** Get information about available actions. */
    const info: Record<string, any> = {
      totalActions: this.actions.size,
      runningActions: this.runningActions.size,
      completedActions: this.completedActions.size,
      screeningStrategy: this.screening.strategy,
      screeningK: this.screening.k,
      actionsDirectory: this.home
    };

    // Add action details
    for (const [name, spec] of this.actions.entries()) {
      info[`action_${name}`] = {
        description: spec.meta.description,
        arguments: spec.meta.arguments,
        tags: spec.meta.tags,
        timeout: spec.meta.timeoutSec
      };
    }

    return info;
  }

  async reloadActions(): Promise<void> {
    /** Reload all actions from disk. */
    this.actions.clear();
    await this.loadActions();
  }

  cancelAction(runId: string): boolean {
    /** Cancel a running action. */
    if (this.runningActions.has(runId)) {
      const process = this.runningActions.get(runId)!;
      if (process.exitCode === null && !process.killed) {
        process.kill('SIGTERM');

        // Force kill if it doesn't terminate gracefully
        setTimeout(() => {
          if (process.exitCode === null && !process.killed) {
            process.kill('SIGKILL');
          }
        }, 5000);

        // Create cancellation result
        const actionName = this.getActionNameByRunId(runId);
        const result: ActionResult = {
          actionRunId: runId,
          name: actionName,
          status: 'error',
          error: 'Action was cancelled',
          logs: []
        };

        this.runningActions.delete(runId);
        this.completedActions.set(runId, result);
        return true;
      }
    }

    return false;
  }

  cleanupCompletedActions(maxKeep: number = 100): void {
    /** Clean up old completed action results to limit memory usage. */
    if (this.completedActions.size <= maxKeep) {
      return;
    }

    // Keep only the most recent results
    const completedItems = Array.from(this.completedActions.entries());
    completedItems.sort((a, b) => a[0].localeCompare(b[0])); // Sort by run_id

    // Remove oldest results
    const toRemove = completedItems.slice(0, completedItems.length - maxKeep);
    for (const [runId] of toRemove) {
      this.completedActions.delete(runId);
      this.feedback.delete(runId);
    }
  }
}

export * from '../types/index.js';