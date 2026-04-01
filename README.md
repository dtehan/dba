# Teradata DBA Agent

AI-powered desktop app for Teradata DBAs. Chat with your Teradata environment and run specialized analysis — security audits, compression analysis, statistics reviews, skew detection, space usage, query performance, index advising, lock contention, system health, workload management, cross-table redundancy detection, and duplicate data detection — all through natural conversation powered by Claude (AWS Bedrock) or Google Gemini.

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

### LLM Provider

The app supports two LLM providers. Select your provider in **Settings > LLM Provider**.

#### Claude via AWS Bedrock

1. **Open Settings** in the app (sidebar → Settings).
2. **Select "Claude (AWS Bedrock)"** as the LLM provider.
3. **Enter your AWS credentials:**
   - **AWS Access Key ID** and **Secret Access Key**
   - **Region** (e.g., `us-west-2`)
   - **Role ARN** (optional, for cross-account access)
   - **Model / Inference Profile ID** (optional override)
4. **Click "Test Connection"** to verify.

All credentials are encrypted via your OS keychain (macOS Keychain, Windows DPAPI, or Linux secret store).

#### Google Gemini

1. **Open Settings** in the app (sidebar → Settings).
2. **Select "Google Gemini"** as the LLM provider.
3. **Enter your Gemini API key** — get one from [Google AI Studio](https://aistudio.google.com/apikey).
4. **Select a model** (Gemini 2.5 Flash recommended, or 2.5 Pro for max capability).
5. **Click "Test Connection"** to verify.

See the [Gemini API docs](https://ai.google.dev/gemini-api/docs) for more information.

## Features

### System Overview

Dashboard showing storage by database, largest tables, and top users by CPU. Each section includes:

- **Filter** — type to narrow results by name (case-insensitive substring match)
- **Load More** — initially shows 10 items; click to load 20 more at a time (up to 200 fetched from Teradata)
- **Context menu** — click any database, table, or user to launch a relevant subagent

### Query Activity

Table of top queries by CPU consumption. Includes:

- **Filter** — search across SQL text and username (substring match, so searching `demo_user` finds queries containing that string)
- **Load More** — initially shows 10 queries; click to load 20 more at a time (up to 200 fetched)
- **Context menu** — click any row to launch query analysis, or click a username for user-level actions

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

## Evals

The eval harness lives in `evals/` and supports both Bedrock and Gemini as the LLM provider.

```bash
cd evals

# Structural tests (no LLM calls, instant)
./run.sh --smoke

# Live agent tests with Bedrock (default)
./run.sh --live

# Live agent tests with Gemini
./run.sh --live --provider gemini

# Full suite with LLM judge
./run.sh --full --provider gemini
```

Configure credentials in `evals/.env`:

```bash
# Provider: "bedrock" (default) or "gemini"
EVAL_PROVIDER=gemini

# Gemini
GEMINI_API_KEY=your-key-here

# Bedrock (AWS)
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
```

## Tech Stack

- **Electron** — desktop shell
- **React 19** + **TypeScript** — UI
- **electron-vite** — build tooling with HMR
- **TailwindCSS v4** — styling with Teradata brand tokens
- **shadcn/ui** — accessible component library
- **Zustand** — state management
- **Anthropic SDK** (Bedrock) — Claude AI
- **Google Generative AI SDK** — Gemini AI
- **Teradata MCP Server** — database connectivity
