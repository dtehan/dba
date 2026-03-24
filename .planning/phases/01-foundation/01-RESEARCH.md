# Phase 1: Foundation - Research

**Researched:** 2026-03-24
**Domain:** Electron desktop shell, credential management, Python MCP server process lifecycle, Teradata-branded UI
**Confidence:** HIGH

## Summary

Phase 1 is a greenfield Electron + React + TypeScript application with four distinct technical concerns: scaffold and build tooling (electron-vite), secure credential storage (Electron safeStorage + electron-store), spawning and communicating with a Python MCP server process (teradata-mcp-server via stdio), and a Teradata-branded dark UI (TailwindCSS v4 + shadcn/ui). All four concerns are well-understood with high-confidence sources.

The most nuanced concern is the MCP server lifecycle. teradata-mcp-server defaults to stdio transport when no `MCP_TRANSPORT` env var is set, which is exactly right for Electron — the main process spawns it as a child process, passes a `DATABASE_URI` environment variable, and communicates over stdin/stdout using the MCP protocol. This avoids any network port management entirely. The server requires Python >= 3.11 (Python 3.14.3 is installed on the dev machine, which satisfies this).

UI implementation is fully spec'd in the UI-SPEC.md. The key execution risk is the shadcn/ui initialization into an electron-vite project, which requires manual path alias configuration and a specific `npx shadcn init` invocation. TailwindCSS v4's `@theme` directive handles Teradata brand tokens without a `tailwind.config.js`.

**Primary recommendation:** Scaffold with `npm create @quick-start/electron@latest` (react-ts template), then layer in TailwindCSS v4, shadcn/ui, Zustand, electron-store, and the MCP server process manager in dedicated waves. Keep all credential and MCP logic strictly in `src/main/`.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**MCP Server Strategy**
- Use **teradata-mcp-server** (Python, official Teradata community) for database connectivity — requires Python runtime on user's machine
- **Bundle syntax markdown files** from tdsql-mcp into app resources — 21 Teradata SQL syntax reference files available for progressive disclosure to agents in later phases
- Pass credentials as **environment variables** when spawning the MCP server process
- **On-demand lifecycle** — spawn MCP server when credentials are saved/tested, kill on app close or credentials cleared

**Connection Health & Testing**
- Teradata connection test: **execute `SELECT 1`** via MCP server — confirms end-to-end connectivity
- Claude API test: **send minimal messages request** (single "ping" message, max_tokens=1) — proves auth and generation capability
- Connection test timeout: **10 seconds** — accommodates slow Teradata instances without frustrating users
- Health poll: **pause on blur, resume on focus** — saves resources and avoids unnecessary Teradata load; polls every 30 seconds when focused

**Electron Architecture**
- **Typed IPC channels with Zod validation** — renderer sends validated payloads via contextBridge, main process handles crypto + MCP
- **electron-vite default directory structure** — `src/main/`, `src/renderer/`, `src/preload/` with feature folders inside renderer
- **electron-store** for non-secret settings (host, port, UI preferences) — JSON persistence, not for credentials
- **Single window, native OS chrome** — Electron default title bar, enforce min size 1024×640 per UI-SPEC

### Claude's Discretion
- Python MCP server transport mechanism (stdio vs HTTP) — choose based on teradata-mcp-server's documented capabilities
- Exact IPC channel naming conventions
- electron-store schema structure
- Error handling patterns for MCP server process crashes

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| FOUN-01 | App launches as a local Electron desktop application | electron-vite scaffold creates Electron 41 shell; `minWidth`/`minHeight` enforce 1024×640 |
| FOUN-02 | User can configure Teradata connection credentials (host, username, password) | shadcn/ui Form + Input + Label components; Settings screen layout from UI-SPEC |
| FOUN-03 | Credentials are stored securely via OS keychain (Electron safeStorage) | `safeStorage.encryptString` / `decryptString` after `app.whenReady`; electron-store for non-secret host/port |
| FOUN-04 | App connects to Teradata via MCP server (teradata-mcp-server) | Python process spawned via `child_process.spawn` with `DATABASE_URI` env var; stdio transport confirmed |
| FOUN-05 | App connects to Claude API with user-provided API key | `@anthropic-ai/sdk` minimal messages call (`max_tokens=1`) to validate key; key stored via safeStorage |
| FOUN-06 | Connection health indicator shows Teradata and Claude API status | Polling loop in main process; IPC push to renderer; Badge + status dot UI from UI-SPEC |
| UIBR-01 | UI uses Teradata brand colors (orange #F37440, dark charcoal #1D1D1D) | TailwindCSS v4 `@theme` directive defines `--color-td-orange` and `--color-td-charcoal` tokens |
| UIBR-02 | UI has a clean, modern aesthetic consistent with Teradata product family | shadcn/ui default style + dark mode base; Inter font; UI-SPEC accessibility targets met |
| UIBR-04 | Responsive layout that works well on typical DBA monitor sizes | 1024×640 minimum enforced; layout tested at 1280×800 and 1920×1080 per UI-SPEC |
</phase_requirements>

---

## Project Constraints (from CLAUDE.md)

The following directives from CLAUDE.md are binding for all implementation work:

- **LLM Provider:** Claude API (Anthropic) only — no OpenAI, Gemini, or other LLM providers
- **Deployment:** Local Electron desktop — no server infrastructure, no cloud hosting
- **safeStorage only for credentials** — never `node-keytar`, never plaintext files
- **No `nodeIntegration: true` in renderer** — all Node APIs accessed via IPC + contextBridge
- **No `teradata-nodejs-driver`** — deprecated; use `teradatasql` (Python SDK via MCP, not direct Node)
- **No `react-markdown`** for streaming output — use `streamdown` (not relevant in Phase 1 but establish the pattern)
- **No `moment.js`** — use `date-fns`
- **No SQLite/IndexedDB** for chat history in v1 — `electron-store` JSON is sufficient
- **No `create-react-app`** — scaffold with `electron-vite` only
- **TailwindCSS v4:** Do NOT install `postcss` or `autoprefixer` — they conflict with the v4 Vite plugin
- **Zod version:** Stay on `^3.25` — required by `@anthropic-ai/sdk` v0.80.0; do not upgrade to Zod v4
- **`@electron/rebuild`** must run as a `postinstall` script to rebuild native modules for Electron's Node ABI
- **GSD workflow enforcement:** All file edits go through GSD commands (`/gsd:execute-phase`)

---

## Standard Stack

### Core (Phase 1)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Electron | 41.0.3 | Desktop shell, main process, OS integration | Only mature cross-platform Node.js desktop framework; ships Node v24, Chromium 146 |
| React | 19.2.4 | UI rendering (renderer process) | Concurrent features matter for future streaming; large ecosystem |
| TypeScript | 5.x | Type safety across main + renderer + preload | Non-negotiable for typed IPC contract boundaries |
| electron-vite | 5.0.0 | Build tooling with HMR for dual processes | Handles unusual main+renderer dual-process build; Vite HMR for fast development |
| electron-builder | 26.8.1 | App packaging and distribution | De-facto standard for signed .app/.exe binaries |
| TailwindCSS | 4.2.2 | Utility-first styling | v4 @theme directive handles Teradata tokens without tailwind.config.js |
| shadcn/ui | 4.1.0 (CLI) | Accessible component library | Copy-owned components fully customisable for Teradata brand |
| @anthropic-ai/sdk | 0.80.0 | Claude API connection test (minimal call) | Raw SDK for direct API validation; Agent SDK added in Phase 2 |
| Zustand | 5.0.12 | App state (connection status, credentials loaded flag, UI nav) | 3KB, zero boilerplate, excellent TypeScript generics |
| Zod | 3.25+ (use ^3.25) | IPC payload validation + credential form validation | Required by @anthropic-ai/sdk 0.80.0; validates IPC messages renderer→main |

### Supporting (Phase 1)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| electron-store | 11.0.2 | Persist non-secret settings to JSON | Store Teradata host/port, UI preferences — never credentials |
| react-hook-form | 7.72.0 | Form state management with shadcn/ui Form component | Credential entry forms; integrates with Zod via @hookform/resolvers |
| lucide-react | 1.6.0 | Icons (Database, Eye, EyeOff, Settings, etc.) | shadcn/ui design system uses lucide-react; Eye/EyeOff for password toggle |
| date-fns | 4.1.0 | Date formatting | Timestamps on connection events; do not use moment.js |
| @electron/rebuild | 4.0.3 | Rebuild native modules for Electron's Node ABI | Run as postinstall script; rebuilds teradatasql against Electron 41's Node v24 |

### Development Tools
| Tool | Version | Purpose |
|------|---------|---------|
| ESLint | 9.x | Flat config format; add @typescript-eslint + react-hooks plugins |
| Prettier | latest | Code formatting; add prettier-plugin-tailwindcss for class sorting |
| Vitest | latest | Vite-native test runner; shares electron-vite's transform config |

**Installation:**
```bash
# Scaffold
npm create @quick-start/electron@latest teradata-dba-agent -- --template react-ts
cd teradata-dba-agent

# Core AI
npm install @anthropic-ai/sdk@0.80.0

# State + validation
npm install zustand zod@^3.25 react-hook-form @hookform/resolvers

# UI
npm install tailwindcss @tailwindcss/vite
npx shadcn@latest init
npm install lucide-react date-fns

# Storage
npm install electron-store

# Dev
npm install -D @electron/rebuild
npm install -D eslint @typescript-eslint/eslint-plugin eslint-plugin-react-hooks prettier prettier-plugin-tailwindcss vitest

# postinstall in package.json
# "postinstall": "electron-rebuild"
```

**Version verification (confirmed 2026-03-24 against npm registry):**
- electron: 41.0.3
- electron-vite: 5.0.0
- react: 19.2.4
- tailwindcss: 4.2.2
- shadcn (CLI): 4.1.0
- @anthropic-ai/sdk: 0.80.0
- zustand: 5.0.12
- zod: 4.3.6 (but pin to `^3.25` due to SDK compatibility)
- electron-store: 11.0.2
- react-hook-form: 7.72.0
- lucide-react: 1.6.0
- electron-builder: 26.8.1
- @electron/rebuild: 4.0.3
- date-fns: 4.1.0

---

## Architecture Patterns

### Recommended Project Structure
```
teradata-dba-agent/
├── src/
│   ├── main/                    # Electron main process (Node.js)
│   │   ├── index.ts             # App entry, BrowserWindow creation
│   │   ├── ipc/
│   │   │   ├── credentials.ts   # safeStorage encrypt/decrypt handlers
│   │   │   ├── mcp.ts           # MCP server spawn/kill/health handlers
│   │   │   └── claude.ts        # Claude API connection test handler
│   │   ├── services/
│   │   │   ├── mcp-manager.ts   # Python process lifecycle manager
│   │   │   └── health-poller.ts # 30s polling loop, pause-on-blur logic
│   │   └── store.ts             # electron-store schema (non-secret settings)
│   ├── preload/
│   │   └── index.ts             # contextBridge API surface (electronAPI)
│   └── renderer/
│       ├── src/
│       │   ├── App.tsx          # Root component, router
│       │   ├── components/
│       │   │   ├── ui/          # shadcn/ui generated components
│       │   │   ├── AppShell.tsx # Sidebar + main content + status bar layout
│       │   │   ├── Sidebar.tsx  # 220px nav sidebar
│       │   │   ├── StatusBar.tsx # Connection health indicators
│       │   │   └── WelcomeState.tsx # Empty state placeholder
│       │   ├── features/
│       │   │   └── settings/
│       │   │       ├── SettingsScreen.tsx
│       │   │       ├── TeradataForm.tsx
│       │   │       └── ClaudeApiForm.tsx
│       │   ├── store/
│       │   │   └── app-store.ts # Zustand: connection status, nav state
│       │   ├── lib/
│       │   │   ├── utils.ts     # cn() helper (clsx + tailwind-merge)
│       │   │   └── ipc.ts       # Typed wrappers around window.electronAPI
│       │   └── assets/
│       │       └── globals.css  # @import "tailwindcss" + @theme tokens
│       └── index.html
├── resources/
│   └── syntax/                  # 21 Teradata SQL syntax markdown files (bundled, Phase 1)
├── electron.vite.config.ts
├── package.json
└── tsconfig.json
```

### Pattern 1: Typed IPC Contract

The preload script is the trust boundary. It exposes a typed `electronAPI` surface via contextBridge. The renderer calls these methods; the main process handles them via `ipcMain.handle`.

**Preload (src/preload/index.ts):**
```typescript
// Source: Electron IPC docs + contextBridge API
import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  // Credentials
  saveTeradataCredentials: (creds: TeradataCredentials) =>
    ipcRenderer.invoke('credentials:save-teradata', creds),
  loadTeradataHost: () =>
    ipcRenderer.invoke('credentials:load-teradata-host'),
  saveClaudeApiKey: (key: string) =>
    ipcRenderer.invoke('credentials:save-claude-key', key),

  // MCP / health
  testTeradataConnection: () =>
    ipcRenderer.invoke('mcp:test-connection'),
  testClaudeConnection: () =>
    ipcRenderer.invoke('claude:test-connection'),

  // Status updates pushed from main → renderer
  onConnectionStatus: (callback: (status: ConnectionStatus) => void) => {
    ipcRenderer.on('connection:status-update', (_event, status) => callback(status));
  },
  removeConnectionStatusListener: () =>
    ipcRenderer.removeAllListeners('connection:status-update'),
});
```

**Main (src/main/ipc/credentials.ts):**
```typescript
// Source: Electron safeStorage docs + ipcMain.handle pattern
import { ipcMain, safeStorage } from 'electron';
import store from '../store';
import { credentialsSchema } from '../schemas';

ipcMain.handle('credentials:save-teradata', async (_event, rawPayload) => {
  const parsed = credentialsSchema.safeParse(rawPayload);
  if (!parsed.success) throw new Error('Invalid credentials payload');

  const { host, port, username, password } = parsed.data;
  // Store non-secret settings in electron-store
  store.set('teradata.host', host);
  store.set('teradata.port', port);

  // Encrypt secrets via OS keychain
  const encryptedUser = safeStorage.encryptString(username);
  const encryptedPass = safeStorage.encryptString(password);
  store.set('teradata.encryptedUsername', encryptedUser.toString('base64'));
  store.set('teradata.encryptedPassword', encryptedPass.toString('base64'));
});
```

### Pattern 2: MCP Server Process Lifecycle

teradata-mcp-server uses **stdio transport by default** (no `MCP_TRANSPORT` env var needed — omitting it causes `run_stdio_async()` to be called). Spawn with `child_process.spawn` in the main process only.

```typescript
// Source: verified from teradata-mcp-server/src/teradata_mcp_server/server.py
// and Node.js child_process.spawn docs
import { spawn, ChildProcess } from 'child_process';

let mcpProcess: ChildProcess | null = null;

export function spawnMcpServer(databaseUri: string): void {
  if (mcpProcess) return; // already running

  mcpProcess = spawn('uvx', ['teradata-mcp-server'], {
    env: {
      ...process.env,
      DATABASE_URI: databaseUri,
      // No MCP_TRANSPORT set → defaults to stdio
    },
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  mcpProcess.on('error', (err) => {
    console.error('[MCP] process error:', err);
    mcpProcess = null;
  });

  mcpProcess.on('exit', (code) => {
    console.log(`[MCP] process exited with code ${code}`);
    mcpProcess = null;
  });
}

export function killMcpServer(): void {
  if (mcpProcess) {
    mcpProcess.kill('SIGTERM');
    mcpProcess = null;
  }
}
```

**DATABASE_URI format** (confirmed from README.md):
```
teradata://<USERNAME>:<PASSWORD>@<HOST_URL>:1025/<USERNAME>
```

Constructed at spawn time from decrypted safeStorage values. Never stored as the full URI string — always reconstruct from parts at runtime.

### Pattern 3: TailwindCSS v4 Teradata Design Tokens

In v4, `@theme` directive in the root CSS file defines tokens that generate utility classes:

```css
/* Source: tailwindcss.com/docs/theme — verified */
@import "tailwindcss";

@theme {
  /* Teradata brand */
  --color-td-orange: #F37440;
  --color-td-orange-hover: #E55C20;
  --color-td-orange-active: #CC4A10;
  --color-td-charcoal: #1D1D1D;

  /* UI surface scale */
  --color-surface-base: #1A1A1A;
  --color-surface-card: #262626;
  --color-surface-border: #333333;

  /* Text */
  --color-text-primary: #F5F5F5;
  --color-text-muted: #A3A3A3;

  /* Semantic */
  --color-status-connected: #22C55E;
  --color-status-disconnected: #EF4444;
  --color-status-checking: #EAB308;
  --color-destructive: #EF4444;

  /* Typography */
  --font-sans: Inter, ui-sans-serif, system-ui, sans-serif;
  --font-mono: "Cascadia Code", ui-monospace, Menlo, Monaco, monospace;

  /* Spacing */
  --spacing-xs: 4px;
  --spacing-sm: 8px;
  --spacing-md: 16px;
  --spacing-lg: 24px;
  --spacing-xl: 32px;
  --spacing-2xl: 48px;
}

/* shadcn/ui CSS variables — dark mode as default (no .dark class needed) */
:root {
  --background: 0 0% 10%;        /* #1A1A1A */
  --foreground: 0 0% 96%;        /* #F5F5F5 */
  --card: 0 0% 15%;               /* #262626 */
  --card-foreground: 0 0% 96%;
  --border: 0 0% 20%;             /* #333333 */
  --input: 0 0% 15%;
  --primary: 18 88% 60%;          /* #F37440 */
  --primary-foreground: 0 0% 100%;
  --destructive: 0 84% 60%;       /* #EF4444 */
  --muted-foreground: 0 0% 64%;   /* #A3A3A3 */
  --ring: 18 88% 60%;             /* #F37440 focus ring */
  --radius: 0.5rem;
}
```

**shadcn init command for dark-mode-only setup:**
```bash
# From inside the electron-vite project
npx shadcn@latest init
# When prompted:
# - Style: Default
# - Base color: Neutral (then override with custom vars above)
# - CSS variables: Yes
# Then manually replace the generated CSS variables with Teradata tokens
```

**Vite config for electron-vite + TailwindCSS v4:**
```typescript
// electron.vite.config.ts
import { defineConfig } from 'electron-vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { resolve } from 'path';

export default defineConfig({
  main: { /* ... */ },
  preload: { /* ... */ },
  renderer: {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: { '@': resolve(__dirname, 'src/renderer/src') }
    }
  }
});
```

**CRITICAL:** Do NOT install `postcss` or `autoprefixer` — they conflict with the TailwindCSS v4 Vite plugin. The `@tailwindcss/vite` plugin replaces both.

### Pattern 4: safeStorage for Credentials

```typescript
// Source: Electron safeStorage docs — verified
import { app, safeStorage } from 'electron';

// Must be called AFTER app.whenReady()
app.whenReady().then(() => {
  if (!safeStorage.isEncryptionAvailable()) {
    // Log warning — on Linux this may fall back to basic_text encryption
    console.warn('[safeStorage] Encryption not fully available on this system');
  }
});

// Encrypt: returns Buffer, store as base64 string in electron-store
const encrypted = safeStorage.encryptString(plaintext);
store.set('key', encrypted.toString('base64'));

// Decrypt: read base64 from store, convert back to Buffer
const buf = Buffer.from(store.get('key') as string, 'base64');
const plaintext = safeStorage.decryptString(buf);
```

### Pattern 5: Connection Health Polling

Health polling lives entirely in the main process. It pushes status updates to the renderer via `mainWindow.webContents.send()`:

```typescript
// src/main/services/health-poller.ts
import { BrowserWindow, app } from 'electron';

const POLL_INTERVAL_MS = 30_000;
let pollTimer: ReturnType<typeof setInterval> | null = null;

export function startHealthPolling(win: BrowserWindow): void {
  const poll = async () => {
    const status = await checkBothConnections();
    win.webContents.send('connection:status-update', status);
  };

  poll(); // immediate first check
  pollTimer = setInterval(poll, POLL_INTERVAL_MS);

  // Pause on blur, resume on focus
  win.on('blur', () => { if (pollTimer) clearInterval(pollTimer); pollTimer = null; });
  win.on('focus', () => {
    if (!pollTimer) { poll(); pollTimer = setInterval(poll, POLL_INTERVAL_MS); }
  });
}

export function stopHealthPolling(): void {
  if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
}
```

### Anti-Patterns to Avoid

- **Accessing safeStorage before `app.whenReady()`:** Will throw — always gate on `app.whenReady()` or inside `ipcMain.handle` (which runs after ready)
- **Storing credentials in electron-store as plaintext:** electron-store JSON is readable by any process on the machine — only store host/port there
- **Spawning MCP server in renderer process:** Node.js `child_process` is unavailable in renderer — always spawn in main
- **Reconstructing DATABASE_URI from store and caching it in memory long-term:** Reconstruct it on each spawn from decrypted parts to minimize exposure window
- **Installing `postcss` alongside TailwindCSS v4:** Causes silent conflicts; the v4 Vite plugin handles PostCSS internally
- **Setting `nodeIntegration: true` in BrowserWindow:** Never do this — all Node access must go through IPC + contextBridge

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| OS keychain credential storage | Custom file encryption | `safeStorage` (Electron built-in) | Platform-native DPAPI/Keychain; zero extra dependency; handles key rotation |
| Form validation | Manual onChange validators | `react-hook-form` + Zod resolver | Handles blur/submit validation, async validation, error state management |
| Settings JSON persistence | `fs.writeFileSync` JSON | `electron-store` | Handles concurrent reads, atomic writes, schema migration |
| UI component accessibility | Custom accessible Button/Input | `shadcn/ui` (Radix UI primitives) | ARIA attributes, keyboard navigation, focus management built-in |
| Class name merging | String concatenation | `cn()` (clsx + tailwind-merge) | Handles Tailwind class conflicts (e.g., `bg-red-500` overriding `bg-blue-500`) |
| IPC type safety | Any-typed window.ipcRenderer | Typed contextBridge surface + Zod validation | Catches IPC contract breaks at compile + runtime |

**Key insight:** The most dangerous hand-roll in this phase is credential storage — any custom file-based approach creates security risks that safeStorage eliminates with no code complexity tradeoff.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | electron-vite scaffold, npm | Yes | v20.18.0 | — |
| npm | Package installation | Yes | 10.8.2 | — |
| Python 3 | teradata-mcp-server runtime | Yes | 3.14.3 (>= 3.11 required) | Must be documented for other machines |
| pip3 | Python package install | Yes | 26.0 | — |
| uv / uvx | teradata-mcp-server via `uvx` runner | Yes | 0.6.0 | Install uv: `curl -LsSf https://astral.sh/uv/install.sh \| sh` |
| teradatasql (Python) | Referenced in MCP server | Yes | 20.0.0.54 (installed globally) | pip3 install teradatasql |
| teradata-mcp-server | FOUN-04 | No (not installed) | — | `pip install teradata-mcp-server` or use `uvx teradata-mcp-server` |

**Missing dependencies with no fallback:**
- `teradata-mcp-server` package itself — must be installable on the end user's machine. Document in app README. For development/testing, use `uvx teradata-mcp-server` (uvx is available at 0.6.0).

**Missing dependencies with fallback:**
- None identified for this dev machine.

**Notes for other DBA machines (not this dev machine):**
- Python >= 3.11 is required; older machines running Python 3.8/3.9 will need upgrade
- `uv`/`uvx` is the recommended runner; the app README must include installation instructions
- Windows machines: `safeStorage` uses DPAPI — no behavior difference in code, but requires Electron to run on Windows 10+

---

## Common Pitfalls

### Pitfall 1: shadcn/ui Init Breaks Path Aliases in electron-vite

**What goes wrong:** `npx shadcn init` generates `components.json` and `tsconfig.json` path aliases assuming a standard Vite project. electron-vite has three tsconfig files (`tsconfig.json`, `tsconfig.node.json`, `tsconfig.web.json`). shadcn writes aliases to `tsconfig.json` only; the renderer uses `tsconfig.web.json`. The `@/` import alias fails at build time.

**Why it happens:** electron-vite splits TypeScript configs per process to prevent renderer code from importing Node modules. shadcn is unaware of this split.

**How to avoid:** After `npx shadcn init`, manually copy the `compilerOptions.paths` entry (`"@/*": ["./src/renderer/src/*"]`) into `tsconfig.web.json`. Also add the corresponding alias to `electron.vite.config.ts` under `renderer.resolve.alias`.

**Warning signs:** TypeScript error "Cannot find module '@/components/ui/button'" in renderer files.

### Pitfall 2: TailwindCSS v4 @theme Conflicts with shadcn/ui HSL Variables

**What goes wrong:** shadcn/ui generates CSS variables in HSL channel format (e.g., `--primary: 18 88% 60%`), which are consumed by Tailwind utilities as `hsl(var(--primary))`. TailwindCSS v4 uses OKLCH by default in `@theme`. Mixing the two formats causes color utilities to produce wrong output.

**Why it happens:** shadcn's components reference CSS variables like `bg-primary`, which Tailwind v4 maps differently than v3.

**How to avoid:** Keep shadcn's CSS variables in `:root` in HSL format (as shadcn generates them). Put only the Teradata brand extension tokens in `@theme` using hex/oklch. Do not redefine `--color-primary` in `@theme` — let shadcn's `:root` vars own the primary color.

**Warning signs:** Buttons appear wrong color despite correct hex values in theme.

### Pitfall 3: safeStorage Called Before app.whenReady

**What goes wrong:** If any IPC handler that calls `safeStorage.encryptString()` is registered and triggered before `app.whenReady()` resolves, Electron throws `Error: safeStorage is not available`.

**Why it happens:** `safeStorage` requires the app to be fully initialized before the OS keychain is accessible.

**How to avoid:** Register all `ipcMain.handle` handlers inside or after the `app.whenReady()` callback. In practice, `ipcMain.handle` calls placed at module load time are fine because the renderer (which triggers them) never loads until `BrowserWindow` is shown (which happens inside `app.whenReady()`). Explicit gate: call `safeStorage.isEncryptionAvailable()` and log a warning if false.

**Warning signs:** App throws on first credentials save; `isEncryptionAvailable()` returns false on Linux (where no secret store exists — common in headless dev environments).

### Pitfall 4: MCP Server Process Left Running After Dev HMR Restart

**What goes wrong:** During electron-vite development with HMR, the main process restarts but may not clean up the MCP child process. The old Python process keeps running; the new main process tries to spawn another; port conflicts or zombie processes result.

**Why it happens:** electron-vite's HMR for the main process sends SIGTERM to Electron but the Python subprocess may have already detached or ignored the signal.

**How to avoid:** In `main/index.ts`, register `app.on('before-quit', () => killMcpServer())` AND `process.on('exit', () => killMcpServer())`. In development mode, also use `app.on('will-quit')`. Store the PID and check if process is still alive before spawning.

**Warning signs:** `lsof | grep teradata-mcp-server` shows multiple Python processes after repeated HMR reloads.

### Pitfall 5: electron-store Requires Electron 30+ (Verified)

**What goes wrong:** electron-store v11 requires Electron 30+. On older projects migrating to this setup this could fail silently.

**Why it matters here:** We're on Electron 41 — this is satisfied. But the postinstall script must use `@electron/rebuild` not `electron-rebuild` (the old package name).

**How to avoid:** Use `@electron/rebuild` (the scoped package). Run as: `npx @electron/rebuild` in postinstall. The unscoped `electron-rebuild` is outdated.

### Pitfall 6: DATABASE_URI Contains URL-Encoded Characters

**What goes wrong:** If the Teradata password contains special characters (`@`, `/`, `#`, `%`), the URI format `teradata://user:pass@host/user` breaks the URI parser on the Python side.

**Why it happens:** URI format requires percent-encoding of special characters in the password component.

**How to avoid:** Percent-encode the password when constructing `DATABASE_URI`: `encodeURIComponent(password)`. Alternatively, investigate whether teradata-mcp-server supports separate `TD_USERNAME`, `TD_PASSWORD`, `TD_HOST` environment variables (check server.py settings). If separate vars are supported, use them to avoid URI encoding entirely.

**Warning signs:** MCP server fails to connect with passwords containing `@` or `#`.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `tailwind.config.js` + PostCSS | `@theme` directive in CSS, `@tailwindcss/vite` plugin | Jan 2025 (v4.0) | No config file needed; do NOT install postcss |
| `electron-rebuild` (unscoped) | `@electron/rebuild` (scoped package) | ~2022 | Old package is unmaintained; use scoped version |
| `node-keytar` for OS keychain | `safeStorage` (Electron built-in) | Electron 15+ | No native module rebuild needed |
| `react-markdown` | `streamdown` (for streaming AI output) | 2024 | Not used in Phase 1, but establish the import for Phase 2 |
| shadcn v3 CLI | shadcn v4 CLI (March 2026) | Mar 2026 | `npx shadcn@latest init` uses v4 CLI; command format unchanged |
| `teradata-nodejs-driver` | `teradatasql` (Python via MCP) | Deprecated | Do not use; officially deprecated by Teradata |

---

## Open Questions

1. **teradata-mcp-server separate credential env vars**
   - What we know: `DATABASE_URI` is the documented credential mechanism
   - What's unclear: Whether `TD_HOST`, `TD_USER`, `TD_PASSWORD` (separate vars) are supported, which would avoid URI percent-encoding issues
   - Recommendation: At implementation time, read `src/teradata_mcp_server/settings.py` directly (check `TD_*` prefixed Pydantic fields); if separate vars exist, use them instead of composing the URI

2. **`uvx` availability on end-user DBA machines**
   - What we know: `uvx` (uv 0.6.0) is available on the dev machine; it's the officially recommended runner for teradata-mcp-server per the README
   - What's unclear: Corporate DBA environments may have restricted Python tool installation; `uvx` is a relatively new tool (Astral/uv) that may not be pre-installed
   - Recommendation: Plan A is `uvx teradata-mcp-server`; fall back to detecting an existing `teradata-mcp-server` binary on `$PATH`; document both in app setup instructions

3. **electron-vite + TailwindCSS v4 renderer config exact path**
   - What we know: `@tailwindcss/vite` plugin goes in the renderer's Vite config block; electron.vite.config.ts has separate `main`, `preload`, `renderer` sections
   - What's unclear: Whether `@tailwindcss/vite` plugin needs to be listed in only the renderer block or at the top-level plugins array
   - Recommendation: Add to `renderer.plugins` only — TailwindCSS only processes renderer CSS, not main process code

---

## Sources

### Primary (HIGH confidence)
- [teradata-mcp-server pyproject.toml](https://raw.githubusercontent.com/Teradata/teradata-mcp-server/main/pyproject.toml) — Python >= 3.11 requirement, FastMCP dependency, `teradata-mcp-server` CLI entry point
- [teradata-mcp-server server.py](https://raw.githubusercontent.com/Teradata/teradata-mcp-server/main/src/teradata_mcp_server/server.py) — stdio vs HTTP transport logic confirmed; stdio is default when `MCP_TRANSPORT` not set
- [teradata-mcp-server README.md](https://github.com/Teradata/teradata-mcp-server/blob/main/README.md) — `DATABASE_URI` format, `uvx` run command
- [Electron safeStorage docs](https://www.electronjs.org/docs/latest/api/safe-storage) — `encryptString`, `decryptString`, `isEncryptionAvailable`, platform behavior
- [Electron IPC docs](https://www.electronjs.org/docs/latest/tutorial/ipc) — `contextBridge`, `ipcMain.handle`, `ipcRenderer.invoke` patterns
- [TailwindCSS v4 @theme directive docs](https://tailwindcss.com/docs/theme) — `@theme` syntax, CSS variable generation, utility class creation
- [TailwindCSS v4 Vite installation](https://tailwindcss.com/docs/installation) — `@tailwindcss/vite` plugin; no postcss/autoprefixer needed
- [electron-vite scaffold docs](https://electron-vite.org/guide/) — `npm create @quick-start/electron@latest` with react-ts template
- [Node.js child_process.spawn docs](https://nodejs.org/api/child_process.html) — env vars, stdio pipe configuration for MCP subprocess
- npm registry version verification (2026-03-24): electron@41.0.3, electron-vite@5.0.0, react@19.2.4, tailwindcss@4.2.2, shadcn@4.1.0, @anthropic-ai/sdk@0.80.0, zustand@5.0.12, electron-store@11.0.2, zod@4.3.6, react-hook-form@7.72.0, electron-builder@26.8.1, @electron/rebuild@4.0.3, @anthropic-ai/claude-agent-sdk@0.2.81

### Secondary (MEDIUM confidence)
- [shadcn/ui manual installation docs](https://ui.shadcn.com/docs/installation/manual) — CSS variable structure for dark mode; HSL channel format for component variables

### Tertiary (LOW confidence — flag for validation)
- electron-vite + shadcn path alias fix in `tsconfig.web.json`: derived from knowledge of electron-vite's triple tsconfig structure; needs hands-on validation during Wave 0 of execution

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all versions verified against npm registry 2026-03-24
- MCP transport: HIGH — verified directly from teradata-mcp-server/server.py source code
- Architecture patterns: HIGH — all sourced from official Electron, Node.js, and TailwindCSS docs
- shadcn/ui + electron-vite path alias pitfall: LOW — derived from structural knowledge, not tested

**Research date:** 2026-03-24
**Valid until:** 2026-04-23 (30 days — stable frameworks; re-check teradata-mcp-server if behavior issues arise)
