# Teradata DBA Agent

AI-powered desktop app for Teradata DBAs. Chat with your Teradata environment, run security audits, compression analysis, statistics reviews, and more — all through natural conversation powered by Claude.

## Prerequisites

- **Node.js** >= 20.x
- **Python** >= 3.11 (for the Teradata MCP server)
- **uv** (Python package manager) — install via `curl -LsSf https://astral.sh/uv/install.sh | sh`

## Quick Start

```bash
npm install
npm run dev
```

## Configuration

### Teradata MCP Server

The app connects to a [Teradata MCP server](https://github.com/Teradata/teradata-mcp-server) for database access. Run the MCP server before starting the app:

```bash
# Install and run via uvx (recommended)
uvx teradata-mcp-server

# Or with a specific HTTP endpoint
MCP_TRANSPORT=streamable-http MCP_HOST=127.0.0.1 MCP_PORT=8001 uvx teradata-mcp-server
```

The app's Settings screen has a "Teradata Connection" section where you enter your host, username, and password. These credentials are encrypted via your OS keychain (never stored in plaintext).

**MCP Server URL:** By default the app expects the MCP server at `http://127.0.0.1:8001/mcp`. Configure this in the Settings screen if your server runs on a different address.

### Claude via AWS Bedrock

This app uses Claude through AWS Bedrock. To configure:

1. **Get your Bearer token** from your AWS Bedrock deployment. This is typically a temporary credential from `aws bedrock-runtime invoke-model` or a gateway token.

2. **Open Settings** in the app (sidebar → Settings).

3. **Enter your Bedrock configuration:**
   - **Bearer Key** — your Bedrock authentication token
   - The app stores this securely via your OS keychain (macOS Keychain, Windows DPAPI, or Linux secret store)

4. **Click "Test Connection"** to verify the app can reach Claude via your Bedrock endpoint.

#### Bedrock Environment Variables (Alternative)

If you prefer environment variables over the UI:

```bash
# Set before launching the app
export AWS_REGION=us-east-1              # Your Bedrock region
export AWS_BEDROCK_BEARER_KEY=your-key   # Your bearer token

npm run dev
```

#### Bedrock SDK Configuration

Under the hood, the app uses the Anthropic SDK with Bedrock support:

```typescript
import AnthropicBedrock from '@anthropic-ai/bedrock-sdk';

const client = new AnthropicBedrock({
  awsRegion: 'us-east-1',
  // Bearer key authentication
});
```

See the [Anthropic Bedrock SDK docs](https://docs.anthropic.com/en/api/claude-on-amazon-bedrock) for full configuration options.

## Architecture

```
src/
├── main/           # Electron main process
│   ├── ipc/        # IPC handlers (credentials, MCP, Claude)
│   ├── services/   # MCP manager, health poller
│   └── store.ts    # electron-store (non-secret settings)
├── preload/        # contextBridge (IPC surface)
├── renderer/       # React UI
│   └── src/
│       ├── components/  # AppShell, Sidebar, StatusBar, shadcn/ui
│       ├── features/    # Settings screen, (future: chat, subagents)
│       ├── store/       # Zustand state
│       └── lib/         # Utilities, IPC accessor
└── shared/         # Types and Zod schemas (shared across processes)
```

**Security:** `nodeIntegration: false`, `contextIsolation: true`. All credentials encrypted via `safeStorage`. No secrets in renderer process.

## Development

```bash
npm run dev          # Start dev server + Electron
npm run build        # Production build
npm run lint         # ESLint
npm run typecheck    # TypeScript type checking
```

## Tech Stack

- **Electron** — desktop shell
- **React 19** + **TypeScript** — UI
- **electron-vite** — build tooling with HMR
- **TailwindCSS v4** — styling with Teradata brand tokens
- **shadcn/ui** — accessible component library
- **Zustand** — state management
- **Anthropic SDK** (Bedrock) — Claude AI
- **Teradata MCP Server** — database connectivity
