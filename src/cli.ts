#!/usr/bin/env node

/**
 * CLI entrypoint for pulsar-agent-turbo.
 *
 * Provides command-line interface for running agent requests, managing plans,
 * decisions, actions, and generating performance reports.
 */

import { Command } from 'commander';
import { readFile, writeFile, access } from 'fs/promises';
import { resolve } from 'path';
import { createAgent, runAgent, createDefaultAgentConfig } from './index.js';
import type {
  AgentConfig,
  LLMConfig,
  OnlineConfig,
  ScreeningConfig
} from './types/index.js';

const program = new Command();

/**
 * Create default configuration.
 */
function createDefaultConfig(): Record<string, any> {
  return {
    llm: {
      provider: 'ollama',
      baseUrl: 'http://localhost:11434',
      model: 'llama3.2:3b',
      temperature: 0.7,
      maxTokens: 2000,
      alias: 'default'
    },
    componentLlms: {
      planner: {
        provider: 'ollama',
        baseUrl: 'http://localhost:11434',
        model: 'llama3.2:3b',
        temperature: 0.3,
        maxTokens: 2000,
        alias: 'planner'
      },
      decider: {
        provider: 'ollama',
        baseUrl: 'http://localhost:11434',
        model: 'llama3.2:3b',
        temperature: 0.5,
        maxTokens: 1000,
        alias: 'decider'
      },
      guide: {
        provider: 'ollama',
        baseUrl: 'http://localhost:11434',
        model: 'llama3.2:3b',
        temperature: 0.6,
        maxTokens: 1500,
        alias: 'guide'
      },
      knowledge: {
        provider: 'ollama',
        baseUrl: 'http://localhost:11434',
        model: 'llama3.2:3b',
        temperature: 0.6,
        maxTokens: 1500,
        alias: 'knowledge'
      }
    },
    guides: [],
    knowledge: [],
    actions: '~/.pulsar-agent-turbo/actions',
    online: {
      provider: 'web',
      maxResults: 5,
      timeout: 30.0
    },
    screening: {
      strategy: 'keyword',
      k: 5
    },
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

/**
 * Load configuration from file.
 */
async function loadConfig(configPath?: string): Promise<Record<string, any>> {
  if (!configPath) {
    return createDefaultConfig();
  }

  try {
    await access(configPath);
    const configContent = await readFile(configPath, 'utf-8');
    const config = JSON.parse(configContent);
    return { ...createDefaultConfig(), ...config };
  } catch (error: any) {
    console.warn(`Warning: Could not load config from ${configPath}: ${error.message}`);
    return createDefaultConfig();
  }
}

/**
 * Save configuration to file.
 */
async function saveConfig(config: Record<string, any>, configPath: string): Promise<void> {
  try {
    await writeFile(configPath, JSON.stringify(config, null, 2));
    console.log(`Configuration saved to ${configPath}`);
  } catch (error: any) {
    console.error(`Error saving configuration: ${error.message}`);
  }
}

/**
 * Run an agent request.
 */
program
  .name('pulsar-agent-turbo')
  .description('LLM-driven agent with modular architecture for task planning and execution')
  .version('0.1.0');

program
  .command('run')
  .description('Run an agent request (auto or interactive)')
  .argument('<request>', 'The request to process')
  .option('-f, --files <files...>', 'Files to include in the request')
  .option('-a, --auto', 'Run in automatic mode without interactive confirmation')
  .option('-c, --config <path>', 'Path to configuration file')
  .option('-g, --guides <paths...>', 'Paths to guide files')
  .option('-k, --knowledge <paths...>', 'Paths to knowledge files')
  .option('--actions <path>', 'Path to actions directory')
  .option('--llm-provider <provider>', 'LLM provider (openai|ollama)')
  .option('--llm-base-url <url>', 'LLM base URL')
  .option('--llm-model <model>', 'LLM model name')
  .option('--llm-api-key <key>', 'LLM API key (for OpenAI)')
  .option('--llm-temperature <temp>', 'LLM temperature', parseFloat)
  .option('--llm-max-tokens <tokens>', 'LLM max tokens', parseInt)
  .option('--screening-strategy <strategy>', 'Screening strategy (keyword|vector|hybrid)')
  .option('--screening-k <k>', 'Number of items to retrieve', parseInt)
  .action(async (request, options) => {
    try {
      const config = await loadConfig(options.config);

      // Override config with command line options
      if (options.llmProvider) config.llm.provider = options.llmProvider;
      if (options.llmBaseUrl) config.llm.baseUrl = options.llmBaseUrl;
      if (options.llmModel) config.llm.model = options.llmModel;
      if (options.llmApiKey) config.llm.apiKey = options.llmApiKey;
      if (options.llmTemperature !== undefined) config.llm.temperature = options.llmTemperature;
      if (options.llmMaxTokens !== undefined) config.llm.maxTokens = options.llmMaxTokens;

      if (options.guides) config.guides = options.guides;
      if (options.knowledge) config.knowledge = options.knowledge;
      if (options.actions) config.actions = options.actions;

      if (options.screeningStrategy) config.screening.strategy = options.screeningStrategy;
      if (options.screeningK !== undefined) config.screening.k = options.screeningK;

      if (options.auto) config.execution.executionMode = 'auto';

      console.log(`Running request: ${request}`);
      console.log(`Execution mode: ${config.execution.executionMode}`);

      // Create and run agent
      const agent = await createAgent({
        llm: config.llm,
        guides: config.guides,
        knowledge: config.knowledge,
        actions: config.actions,
        online: config.online,
        screening: config.screening
      });

      const runHandle = await agent.ask(request, options.files || [], {
        executionMode: config.execution.executionMode
      });

      console.log(`Run started with ID: ${runHandle.runId}`);

      // In a real implementation, you would monitor the run and show progress
      console.log('Agent is processing your request...');

    } catch (error: any) {
      console.error('Error running request:', error.message);
      process.exit(1);
    }
  });

program
  .command('config')
  .description('Manage configuration')
  .option('--init', 'Initialize default configuration')
  .option('--show', 'Show current configuration')
  .option('--save <path>', 'Save configuration to file')
  .option('--load <path>', 'Load configuration from file')
  .action(async (options) => {
    try {
      if (options.init) {
        const config = createDefaultConfig();
        console.log('Default configuration:');
        console.log(JSON.stringify(config, null, 2));

        if (options.save) {
          await saveConfig(config, options.save);
        }
      } else if (options.show) {
        const config = await loadConfig(options.load);
        console.log('Current configuration:');
        console.log(JSON.stringify(config, null, 2));
      } else if (options.save) {
        const config = await loadConfig(options.load);
        await saveConfig(config, options.save);
      } else {
        console.log('Use --init, --show, or --save options');
      }
    } catch (error: any) {
      console.error('Error managing configuration:', error.message);
      process.exit(1);
    }
  });

program
  .command('plan')
  .description('Build a plan for a request')
  .argument('<request>', 'The request to create a plan for')
  .option('-c, --config <path>', 'Path to configuration file')
  .option('-g, --guides <paths...>', 'Paths to guide files')
  .option('-k, --knowledge <paths...>', 'Paths to knowledge files')
  .option('--llm-provider <provider>', 'LLM provider (openai|ollama)')
  .option('--llm-base-url <url>', 'LLM base URL')
  .option('--llm-model <model>', 'LLM model name')
  .option('--llm-api-key <key>', 'LLM API key (for OpenAI)')
  .action(async (request, options) => {
    try {
      const config = await loadConfig(options.config);

      // Override config with command line options
      if (options.llmProvider) config.llm.provider = options.llmProvider;
      if (options.llmBaseUrl) config.llm.baseUrl = options.llmBaseUrl;
      if (options.llmModel) config.llm.model = options.llmModel;
      if (options.llmApiKey) config.llm.apiKey = options.llmApiKey;

      if (options.guides) config.guides = options.guides;
      if (options.knowledge) config.knowledge = options.knowledge;

      console.log(`Creating plan for: ${request}`);

      // Create agent components
      const agent = await createAgent({
        llm: config.llm,
        guides: config.guides,
        knowledge: config.knowledge,
        actions: config.actions,
        online: config.online,
        screening: config.screening
      });

      // The agent would handle planning internally
      // For now, just show that the request would be processed
      console.log('Plan generation not yet implemented in CLI');
      console.log('Use the run command to execute the full agent process');

    } catch (error: any) {
      console.error('Error creating plan:', error.message);
      process.exit(1);
    }
  });

program
  .command('report')
  .description('Generate performance report for a run')
  .argument('<runId>', 'Run ID to generate report for')
  .option('-o, --out <path>', 'Output file for the report')
  .action(async (runId, options) => {
    try {
      console.log(`Generating report for run: ${runId}`);

      // TODO: Implement report generation
      console.log('Report generation not yet implemented');

    } catch (error: any) {
      console.error('Error generating report:', error.message);
      process.exit(1);
    }
  });

// Parse command line arguments
program.parse();

// Show help if no command provided
if (!process.argv.slice(2).length) {
  program.outputHelp();
}