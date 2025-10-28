# Pulsar Studio Desktop App

Pulsar Studio is a cross-platform desktop GUI for the Pulsar Agent Turbo library, built with Tauri (Rust backend) and React + TypeScript (frontend).

## Features

- **3-Column Layout**: Thread history, main workspace, and task/plan panel
- **Thread Management**: Create and manage multiple agent conversation threads
- **Agent Control**: Interactive and auto-execution modes
- **Resource Managers**: Guides, Knowledge, and Actions management
- **Real-time Updates**: Live plan progress and activity monitoring
- **Settings Management**: LLM provider configuration
- **Data Persistence**: Automatic saving and restoration of threads

## Architecture

### Technology Stack

- **Backend**: Tauri (Rust) with IPC commands
- **Frontend**: React 18 + TypeScript + Vite
- **State Management**: Zustand
- **Styling**: CSS with CSS variables
- **Build**: Tauri CLI + Vite

### Directory Structure

```
apps/desktop/
├── src/
│  ├── components/     # React components
│  ├── pages/         # Page components
│  ├── stores/        # Zustand state stores
│  ├── types/         # TypeScript type definitions
│  ├── styles/        # Global styles
│  ├── main.tsx       # React entry point
│  └── App.tsx        # Main App component
├── src-tauri/
│  ├── src/
│  │  ├── main.rs     # Tauri main process
│  │  └── commands.rs # Tauri IPC commands
│  ├── Cargo.toml     # Rust dependencies
│  └── tauri.conf.json # Tauri configuration
├── public/           # Static assets
└── dist/            # Build output
```

## Development Setup

### Prerequisites

1. **Node.js** (v18+): Install from https://nodejs.org/
2. **Rust**: Install from https://rustup.rs/
3. **Tauri CLI**: `cargo install tauri-cli`

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd pulsar-studio
```

2. Install dependencies:
```bash
# Install Node.js dependencies for all workspaces
npm install

# Or install specifically for desktop app
cd apps/desktop
npm install
```

3. Build the core library:
```bash
npm run build
```

### Development

1. Start the development server:
```bash
# From root directory
npm run desktop:dev

# Or from apps/desktop
npm run dev
```

2. Build for production:
```bash
# From root directory
npm run desktop:build

# Or from apps/desktop
npm run tauri build
```

3. Run Tauri commands:
```bash
# From root directory
npm run desktop:tauri -- <command>

# Or from apps/desktop
npm run tauri <command>
```

### Available Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build React app for production
- `npm run tauri dev` - Start Tauri development mode
- `npm run tauri build` - Build Tauri app for production
- `npm run lint` - Run ESLint

## Configuration

### Data Directory

Pulsar Studio stores its data in `~/.pulsar-studio/`:
- `guides/` - Planning guide JSON files
- `knowledge/` - Knowledge base JSON files
- `actions/` - Action directories with meta.json and perform.js
- `saves/` - Thread serialization files
- `logs/` - Agent execution logs

### LLM Providers

Currently supports:
- **Ollama** (default): Local models via http://localhost:11434
- **OpenAI**: Remote API integration

## Current Status

### ✅ Implemented

- Basic Tauri + React project structure
- 3-column layout as specified in requirements
- Zustand state management
- Thread creation and selection
- Mock agent operations
- File system integration for resources
- Basic settings placeholder pages

### 🚧 In Progress

- Node.js agent integration
- Real agent execution
- LLM provider configuration
- Resource managers (CRUD operations)

### 📋 To Do

- Real-time agent updates via event streaming
- Complete settings page implementation
- File picker for agent requests
- Action execution feedback
- Build configuration for multiple platforms
- Application signing and distribution

## Integration with Pulsar Agent Turbo

The desktop app is designed to work with the core `pulsar-agent-turbo` library through:

1. **Node.js Integration**: Spawning Node.js processes that use the core library
2. **IPC Communication**: Tauri commands forwarding requests to Node.js
3. **Event Streaming**: Real-time updates from agent execution

### Future Integration Options

1. **NAPI-RS**: Direct Rust bindings to the Node.js library
2. **WebAssembly**: Compile core logic to WASM for direct integration
3. **HTTP API**: Run agent as separate service with HTTP API

## Troubleshooting

### Common Issues

1. **Rust/Tauri not found**: Ensure Rust and Tauri CLI are installed
2. **Node modules missing**: Run `npm install` in root directory
3. **Build failures**: Check Rust and Node.js versions
4. **IPC errors**: Verify Tauri commands are properly exported

### Development Tips

1. Use `console.log` in React components for debugging
2. Use `println!` in Rust for backend debugging
3. Check browser DevTools and Tauri console output
4. Use `npm run tauri dev` for hot reload during development

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

MIT License - see LICENSE file for details.