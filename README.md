# Pulsar Agent Turbo

[![Node.js Version](https://img.shields.io/badge/node-18%2B-green.svg)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/typescript-5.3+-blue.svg)](https://www.typescriptlang.org)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![Package Version](https://img.shields.io/badge/version-0.1.0-orange.svg)](package.json)

**Pulsar Agent Turbo** is a powerful LLM-driven agent framework built with Node.js and TypeScript, featuring modular architecture for intelligent task planning and execution. It provides a comprehensive system for building multi-step plans, making intelligent decisions, and executing actions in a controlled environment with both a CLI interface and desktop GUI (Pulsar Studio).

## 🚀 Key Features

- **Multi-LLM Support**: Configure different LLM providers (OpenAI, Ollama, OpenAI-compatible APIs)
- **Modular Architecture**: Separate components for planning, decision making, knowledge management, and action execution
- **Intelligent Planning**: AI-powered plan generation with dependency resolution and progress tracking
- **Smart Decision Making**: Context-aware next action selection based on plan progress
- **Knowledge Management**: Local and online knowledge retrieval with keyword/vector/hybrid screening
- **Action Framework**: Extensible action system with subprocess isolation and timeout handling
- **Comprehensive CLI**: Full-featured command-line interface for all operations
- **Desktop GUI**: Cross-platform desktop application (Pulsar Studio) built with Tauri + React
- **TypeScript First**: Full type safety and excellent developer experience
- **JSONL Logging**: Per-run performance reports with detailed event tracking

## 📋 Table of Contents

- [Installation](#installation)
- [Quick Start](#quick-start)
- [CLI Usage](#cli-usage)
- [Node.js API Usage](#nodejs-api-usage)
- [Desktop App (Pulsar Studio)](#desktop-app-pulsar-studio)
- [Configuration](#configuration)
- [Architecture](#architecture)
- [Examples](#examples)
- [Development](#development)

## 🛠️ Installation

### Prerequisites

- Node.js 18.0 or higher
- npm or pnpm package manager
- Access to an LLM provider (Ollama, OpenAI, or OpenAI-compatible API)

### Install from Source

```bash
# Clone the repository
git clone https://github.com/pulsar-agent-turbo/pulsar-studio.git
cd pulsar-studio

# Install dependencies
npm install

# Build the project
npm run build

# Install globally (optional)
npm install -g .
```

### Development Setup

```bash
# Install dependencies
npm install

# Start development mode with watch
npm run dev

# Run tests
npm test

# Lint code
npm run lint
```

### Verify Installation

```bash
# Check CLI is available
pulsar-agent-turbo --help

# Test Node.js import
node -e "const { Agent, VERSION } = require('./dist/index.js'); console.log(`Version: ${VERSION}`)"
```

## 🎯 Quick Start

### 1. Basic CLI Usage

```bash
# Generate a default configuration
pulsar-agent-turbo config --init

# Run a simple request (requires Ollama running locally)
pulsar-agent-turbo run --request "Create a JavaScript script that counts words in a text file" --auto

# With custom LLM configuration
pulsar-agent-turbo run \
  --request "Build a REST API for user management" \
  --auto \
  --llm-provider openai \
  --llm-base-url https://api.openai.com/v1 \
  --llm-model gpt-4 \
  --llm-api-key your-api-key-here
```

### 2. Basic Node.js API Usage

```javascript
import { Agent, LLM, Guide, Knowledge, Action, createAgent } from 'pulsar-agent-turbo';

// Quick start with convenience function
const agent = await createAgent({
  llm: {
    provider: 'ollama',
    baseUrl: 'http://localhost:11434',
    model: 'llama3.2:3b',
    temperature: 0.7,
    maxTokens: 2000
  },
  guides: ['./guides'],
  knowledge: ['./knowledge'],
  screening: {
    strategy: 'keyword',
    k: 5
  }
});

// Submit a request
const handle = await agent.ask('Create a simple data analysis script', [], {
  executionMode: 'auto'
});

console.log(`Request submitted with ID: ${handle.runId}`);
```

### 3. Start Desktop App

```bash
# Start development server for desktop app
npm run desktop:dev

# Build desktop app for production
npm run desktop:build
```

## 💻 CLI Usage

### Commands Overview

#### `run` - Execute Agent Requests

```bash
# Interactive mode (default)
pulsar-agent-turbo run --request "Analyze this dataset and create visualizations"

# Automatic mode
pulsar-agent-turbo run --request "Create a web scraper for news articles" --auto

# With files
pulsar-agent-turbo run --request "Summarize these documents" --files doc1.pdf doc2.txt --auto

# With custom configuration
pulsar-agent-turbo run --request "Build a REST API" --config config.json --auto

# With custom LLM settings
pulsar-agent-turbo run \
  --request "Create a machine learning pipeline" \
  --auto \
  --llm-provider ollama \
  --llm-base-url http://localhost:11434 \
  --llm-model llama3.2:3b \
  --llm-temperature 0.3
```

#### `config` - Configuration Management

```bash
# Generate default configuration
pulsar-agent-turbo config --init

# Show current configuration
pulsar-agent-turbo config --show

# Save configuration to file
pulsar-agent-turbo config --init --save my-config.json

# Load and show configuration
pulsar-agent-turbo config --show --load my-config.json
```

#### `plan` - Generate Plans Only

```bash
# Generate a plan
pulsar-agent-turbo plan --request "Create a machine learning pipeline"

# With custom guides and knowledge
pulsar-agent-turbo plan \
  --request "Build a chatbot" \
  --guides ./custom_guides \
  --knowledge ./ml_knowledge
```

#### `report` - Performance Reports

```bash
# Generate report for a specific run
pulsar-agent-turbo report --run-id <uuid> --out performance_report.json

# View report in terminal
pulsar-agent-turbo report --run-id <uuid>
```

### Global Options

All commands support various options for LLM configuration, screening strategies, and resource paths:

```bash
# LLM Configuration
--llm-provider <provider>     # LLM provider (openai|ollama)
--llm-base-url <url>          # LLM base URL
--llm-model <model>           # LLM model name
--llm-api-key <key>           # LLM API key (for OpenAI)
--llm-temperature <temp>      # LLM temperature (0-2)
--llm-max-tokens <tokens>     # LLM max tokens

# Screening Configuration
--screening-strategy <strategy>  # Screening strategy (keyword|vector|hybrid)
--screening-k <k>                # Number of items to retrieve

# Resource Paths
--guides <paths...>          # Paths to guide files
--knowledge <paths...>       # Paths to knowledge files
--actions <path>             # Path to actions directory
```

## 📱 Desktop App (Pulsar Studio)

Pulsar Studio is a cross-platform desktop application built with Tauri + React that provides a visual interface for running agents.

### Features

- **3-Column Layout**: History threads, chat interface, and task/plan progress
- **Visual Workflow Management**: Interactive plan creation and progress tracking
- **Resource Managers**: Built-in managers for guides, knowledge, and actions
- **Settings Page**: LLM configuration management with connectivity testing
- **File Management**: Drag-and-drop file support with size limits
- **Resume Capability**: Save and restore agent sessions

### Starting the Desktop App

```bash
# Development mode
npm run desktop:dev

# Production build
npm run desktop:build

# Access Tauri CLI directly
npm run desktop:tauri -- help
```

## ⚙️ Configuration

### Configuration File Structure

```json
{
  "llm": {
    "provider": "ollama",
    "baseUrl": "http://localhost:11434",
    "model": "llama3.2:3b",
    "temperature": 0.7,
    "maxTokens": 2000,
    "alias": "default",
    "apiKey": ""
  },
  "componentLlms": {
    "planner": {
      "provider": "ollama",
      "baseUrl": "http://localhost:11434",
      "model": "llama3.2:3b",
      "temperature": 0.3,
      "maxTokens": 2000,
      "alias": "planner"
    },
    "decider": {
      "provider": "ollama",
      "baseUrl": "http://localhost:11434",
      "model": "llama3.2:3b",
      "temperature": 0.5,
      "maxTokens": 1000,
      "alias": "decider"
    },
    "guide": {
      "provider": "ollama",
      "baseUrl": "http://localhost:11434",
      "model": "llama3.2:3b",
      "temperature": 0.6,
      "maxTokens": 1500,
      "alias": "guide"
    },
    "knowledge": {
      "provider": "ollama",
      "baseUrl": "http://localhost:11434",
      "model": "llama3.2:3b",
      "temperature": 0.6,
      "maxTokens": 1500,
      "alias": "knowledge"
    }
  },
  "guides": [],
  "knowledge": [],
  "actions": "~/.pulsar-agent-turbo/actions",
  "online": {
    "provider": "web",
    "maxResults": 5,
    "timeout": 30.0
  },
  "screening": {
    "strategy": "keyword",
    "k": 5
  },
  "execution": {
    "executionMode": "interactive",
    "confirmPolicy": {
      "default": true,
      "requireForTags": ["destructive", "write", "network"],
      "maxParallelActions": 1
    }
  },
  "logging": {
    "dir": "~/.pulsar-agent-turbo/logs",
    "reportFormat": "jsonl",
    "captureStdout": true,
    "captureStderr": true
  },
  "feedback": {
    "enableUserFeedback": true,
    "implicitSuccessOnOk": true
  }
}
```

### LLM Provider Configuration

#### Ollama (Local)

```json
{
  "llm": {
    "provider": "ollama",
    "baseUrl": "http://localhost:11434",
    "model": "llama3.2:3b"
  }
}
```

#### OpenAI

```json
{
  "llm": {
    "provider": "openai",
    "baseUrl": "https://api.openai.com/v1",
    "model": "gpt-4",
    "apiKey": "sk-your-api-key-here"
  }
}
```

#### OpenAI-Compatible APIs

```json
{
  "llm": {
    "provider": "openai",
    "baseUrl": "https://your-api-endpoint.com/v1",
    "model": "your-model-name",
    "apiKey": "your-api-key"
  }
}
```

## 🏗️ Architecture

### Core Components

- **Agent**: Main orchestration class that coordinates all components
- **LLM**: Unified interface for multiple LLM providers with configuration management
- **Planner**: Generates multi-step plans with dependency resolution
- **Decider**: Makes intelligent decisions about next actions based on context
- **Guide**: Manages planning guides with screening strategies
- **Knowledge**: Handles knowledge bases with local and online retrieval
- **Action**: Discovers and executes actions in isolated environments

### Project Structure

```
pulsar-studio/
├── src/                           # Main library source
│   ├── index.ts                   # Library entry point
│   ├── cli.ts                     # CLI interface
│   ├── types/                     # Type definitions
│   │   └── index.ts
│   ├── llm/                       # LLM abstraction layer
│   │   └── index.ts
│   ├── guide/                     # Guides + screening
│   │   └── index.ts
│   ├── knowledge/                 # Knowledge + online adapters
│   │   └── index.ts
│   ├── action/                    # Action registry, execution, feedback
│   │   └── index.ts
│   ├── planner/                   # Planner (plan build/update/progress/termination)
│   │   └── index.ts
│   ├── decider/                   # Decider (next-step selection)
│   │   └── index.ts
│   ├── agent/                     # Agent orchestrator
│   │   └── index.ts
│   └── util/                      # JSONL logger, UUID, path helpers
│      └── index.ts
├── apps/desktop/                  # Pulsar Studio (Tauri + React)
│   ├── src/                       # React frontend source
│   ├── src-tauri/                 # Tauri backend (Rust)
│   ├── public/                    # Static assets
│   └── package.json               # Desktop app dependencies
├── dist/                          # Compiled JavaScript output
├── node_modules/                  # Dependencies
├── package.json                   # Main package configuration
├── tsconfig.json                  # TypeScript configuration
└── README.md                      # This file
```

### Data Flow

```
User Request → Agent → Planner → Plan → Decider → Action → Result → Feedback
                ↓         ↓       ↓        ↓        ↓
              Guide    Knowledge  Progress  Action Registry  Logs
```

### Extension Points

- **Custom Actions**: Create new actions by adding directories to `actions_home`
- **Custom Guides**: Add JSON guide files to the guides directory
- **Custom Knowledge**: Add JSON knowledge files to the knowledge directory
- **Custom LLMs**: Implement new LLM providers by extending the LLM class

## 📚 Examples

### Example 1: Basic Node.js API Usage

```javascript
import { Agent, LLM, Guide, Knowledge, Action } from 'pulsar-agent-turbo';

// Create LLM instance
const llm = new LLM();
llm.addConfig({
  provider: 'ollama',
  baseUrl: 'http://localhost:11434',
  model: 'llama3.2:3b',
  temperature: 0.7,
  maxTokens: 2000,
  alias: 'default'
});

// Configure screening
const screeningConfig = {
  strategy: 'keyword',
  k: 5
};

// Set up components
const guide = new Guide(['./guides'], screeningConfig);
const knowledge = new Knowledge(['./knowledge'], screeningConfig);
const action = new Action('./actions', screeningConfig);

// Create agent
const agent = new Agent(llm, guide, knowledge, action);

// Submit a request
const handle = await agent.ask(
  'Create a data analysis script for sales data',
  ['sales.csv'],
  { executionMode: 'auto' }
);

console.log(`Request submitted with ID: ${handle.runId}`);
```

### Example 2: Component-Specific LLM Configuration

```javascript
import { Agent, LLM } from 'pulsar-agent-turbo';

// Main LLM for general tasks
const mainLlm = new LLM();
mainLlm.addConfig({
  provider: 'ollama',
  model: 'llama3.2:3b',
  alias: 'default'
});

// Specialized LLMs for different components
const plannerLlm = new LLM();
plannerLlm.addConfig({
  provider: 'openai',
  model: 'gpt-4',
  temperature: 0.3,  // Lower temperature for structured planning
  alias: 'planner'
});

const deciderLlm = new LLM();
deciderLlm.addConfig({
  provider: 'ollama',
  model: 'llama3.1:8b',
  temperature: 0.5,  // Balanced temperature for decisions
  alias: 'decider'
});

// Create agent with component-specific LLMs
const agent = new Agent(
  mainLlm,
  guide,
  knowledge,
  action,
  undefined, // config
  plannerLlm,
  deciderLlm
);
```

### Example 3: Custom Action Integration

Create a custom action at `~/.pulsar-agent-turbo/actions/send_email/`:

**meta.json**:
```json
{
  "name": "send_email",
  "description": "Send an email with specified content",
  "arguments": [
    {
      "name": "to",
      "type": "string",
      "description": "Recipient email address",
      "required": true
    },
    {
      "name": "subject",
      "type": "string",
      "description": "Email subject",
      "required": true
    },
    {
      "name": "body",
      "type": "string",
      "description": "Email body content",
      "required": true
    }
  ],
  "timeoutSec": 30,
  "tags": ["communication", "network"]
}
```

**perform.js**:
```javascript
class Perform {
  constructor(agent) {
    this.agent = agent;
  }

  async run(kwargs) {
    try {
      const { to, subject, body } = kwargs;

      // Your email sending logic here
      // For example, using nodemailer or another email service

      return {
        status: "ok",
        result: `Email sent to ${to}`,
        data: { to, subject },
        error: null,
        logs: [`Email queued for sending to ${to}`]
      };
    } catch (error) {
      return {
        status: "error",
        result: "",
        error: error.message,
        logs: [`Failed to send email: ${error.message}`]
      };
    }
  }
}

module.exports = { Perform };
```

### Example 4: Advanced Configuration with Online Search

```javascript
import { createAgent } from 'pulsar-agent-turbo';

const agent = await createAgent({
  llm: {
    provider: 'openai',
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-4',
    apiKey: process.env.OPENAI_API_KEY,
    temperature: 0.7
  },
  guides: ['./guides', './custom-guides'],
  knowledge: ['./knowledge-base'],
  actions: './my-actions',
  online: {
    provider: 'web',
    maxResults: 10,
    timeout: 60.0
  },
  screening: {
    strategy: 'hybrid',
    k: 8
  }
});

const handle = await agent.ask(
  'Research the latest trends in AI and create a summary report',
  [],
  { executionMode: 'auto' }
);
```

## 🔧 Development

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm test -- --watch

# Run tests with coverage
npm test -- --coverage
```

### Building

```bash
# Build the main library
npm run build

# Build the desktop app
npm run desktop:build

# Build both library and desktop app
npm run build && npm run desktop:build
```

### Linting and Formatting

```bash
# Lint TypeScript code
npm run lint

# Lint desktop app code
npm run lint -w apps/desktop

# Auto-fix linting issues
npm run lint -- --fix
```

### Project Scripts

```bash
# Development mode (watch)
npm run dev

# Start CLI with built code
npm run cli -- --help

# Desktop development
npm run desktop:dev

# Desktop production build
npm run desktop:build

# Access Tauri CLI
npm run desktop:tauri -- <command>
```

### Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Run the test suite (`npm test`)
5. Run linting (`npm run lint`)
6. Commit your changes (`git commit -m 'Add amazing feature'`)
7. Push to the branch (`git push origin feature/amazing-feature`)
8. Open a Pull Request

### Code Style

This project uses ESLint and Prettier for consistent code formatting. Please ensure your code follows the established patterns:

- Use TypeScript for all new code
- Follow the existing component structure
- Add proper JSDoc comments for public APIs
- Include type annotations for all functions and variables
- Write tests for new functionality

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🤝 Support

- **Issues**: [GitHub Issues](https://github.com/pulsar-agent-turbo/pulsar-studio/issues)
- **Documentation**: [Online Docs](https://pulsar-agent-turbo.readthedocs.io)
- **Discussions**: [GitHub Discussions](https://github.com/pulsar-agent-turbo/pulsar-studio/discussions)

## 🙏 Acknowledgments

- Built with [TypeScript](https://www.typescriptlang.org) for type safety
- Desktop app powered by [Tauri](https://tauri.app) and [React](https://reactjs.org)
- LLM providers: [Ollama](https://ollama.com), [OpenAI](https://openai.com)
- CLI built with [Commander.js](https://commanderjs.com)
- Architecture inspired by modern agent frameworks and cognitive science principles