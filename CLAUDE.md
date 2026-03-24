<!-- GSD:project-start source:PROJECT.md -->
## Project

**Teradata DBA Agent**

A local desktop application that gives Teradata DBAs an AI-powered chat interface with specialized subagents for common DBA tasks. Users can have freeform conversations about their Teradata environment and launch prebuilt capabilities like security auditing, multi-value compression analysis, and statistics analysis — all powered by Claude. The UI carries Teradata's visual identity and brand feel.

**Core Value:** DBAs can run expert-level analysis on their Teradata environment through natural conversation, getting actionable results from specialized subagents without writing complex queries manually.

### Constraints

- **LLM Provider**: Claude API (Anthropic) — chosen by user
- **Deployment**: Local application on DBA's machine — no server infrastructure
- **Connectivity**: Requires network access to both Teradata instance and Claude API
- **Brand**: UI must reflect Teradata visual identity (colors, feel, typography)
- **Tech Stack**: Open — research will guide framework selection
<!-- GSD:project-end -->

<!-- GSD:stack-start source:research/STACK.md -->
## Technology Stack

## Recommended Stack
### Core Technologies
| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Electron | 41.x | Desktop shell (main process, OS integration, native APIs) | Latest stable (v41.0.2 as of March 2026); ships Chromium 146, Node v24; only mature cross-platform desktop framework for Node.js. No browser-native alternative can access OS keychain or a local Teradata TCP connection. |
| React | 19.2.x | UI rendering (renderer process) | Stable, huge ecosystem, excellent TypeScript support. v19.2.4 current. Concurrent features matter for streaming AI responses without blocking UI. |
| TypeScript | 5.x | Type safety across main + renderer | Non-negotiable for a project with complex IPC boundaries, Teradata query types, and AI streaming types. Catches IPC contract mismatches at compile time. |
| electron-vite | 5.0.0 | Build tooling (Vite-powered HMR for both main and renderer) | Released Dec 2025. Vite HMR dramatically speeds up UI development. Handles the unusual dual-process (main + renderer) build configuration that plain Vite/webpack require manual work for. More mature than Electron Forge's experimental Vite support. |
| electron-builder | latest | Packaging and distribution | De-facto standard for producing signed `.app`/`.exe`/`.deb` binaries. Integrates cleanly with electron-vite output directories. |
| TailwindCSS | 4.2.x | Utility-first styling | v4 (Jan 2025) eliminates `tailwind.config.js` and PostCSS config — simpler setup. CSS-variable–based theming makes it straightforward to apply Teradata orange (`#F37440`) and charcoal (`#1D1D1D`) as design tokens. |
| shadcn/ui | latest CLI (v4) | Accessible component library | Copy-owns components (not an npm dependency), so the source lives in-repo and is fully customisable for Teradata brand. Built on Radix UI primitives for accessible dialogs, dropdowns, command palettes. Active as of March 2026 (shadcn CLI v4 released). |
| @anthropic-ai/claude-agent-sdk | 0.2.x | Subagent orchestration | The right Anthropic library for this project — not the base `@anthropic/sdk`. The Agent SDK's `query()` function plus subagent spawning handles the orchestrator-→-subagent pattern natively. Subagents run in isolated context windows, perfect for long DBA analysis tasks that would overflow a single chat context. |
| @anthropic-ai/sdk | 0.80.0 | Direct Claude API access (chat messages, streaming) | Use for the freeform chat turn loop where you need raw streaming control; Agent SDK wraps this internally but exposes less control over streaming tokens. Use both: Agent SDK for subagent dispatch, raw SDK for chat stream rendering. |
| teradatasql | latest stable | Teradata database connectivity | Official Teradata driver for Node.js. Supports TD2, LDAP, Kerberos, OIDC. Requires Node v18.20.7+. Run exclusively in the Electron main process (never renderer) — keeps credentials out of the renderer's JavaScript context. The old `teradata-nodejs-driver` is deprecated; `teradatasql` is the replacement. |
| Zustand | 5.x | Application state management | 3KB, no boilerplate, excellent TypeScript generics. Right size for this app: chat history, active subagent state, credentials/config, streaming status. Redux is over-engineered for a single-user desktop app. Jotai is fine but Zustand's store pattern maps more naturally to this app's state shape. |
### Supporting Libraries
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| electron-store | latest (requires Electron 30+) | Persist non-sensitive settings to JSON | Store app config: Teradata host/port, UI preferences, subagent history. Do NOT use for credentials. Reads/writes full JSON on each change — keep to small data. |
| safeStorage (Electron built-in) | built-in to Electron 41 | Encrypt credentials at rest using OS keychain | Store Teradata username and password encrypted via macOS Keychain / Windows DPAPI / Linux secret store. Prefer over `node-keytar` as it requires no native module rebuild. |
| streamdown | latest | Streaming-aware Markdown renderer | Drop-in replacement for `react-markdown` from Vercel, purpose-built for AI token streaming. Handles incomplete Markdown blocks (partial code fences, mid-sentence bold) without layout thrashing. Use for rendering AI chat responses. |
| react-syntax-highlighter | latest | Code block highlighting inside Markdown | For when subagents return SQL or Teradata BTEQ scripts in chat. Pair with streamdown's code block override. |
| Zod | 3.x | Runtime validation of IPC payloads and Teradata config | Validate Teradata credentials form inputs and IPC messages from renderer → main. The `anthropic-sdk` v0.79+ requires `^3.25` for Zod v4 import path compatibility — use `zod@^3.25`. |
| zustand/middleware (immer) | bundled with Zustand | Immutable state updates for complex chat history | Use immer middleware when mutating nested chat message arrays to avoid spread-copy bugs. |
| date-fns | 4.x | Lightweight date formatting | Format timestamps on chat messages and subagent run history. Do not install `moment` (3× larger, deprecated). |
| lucide-react | latest | Icon set compatible with shadcn/ui | shadcn/ui is designed for lucide-react icons. Consistent with Teradata's clean aesthetic. |
### Development Tools
| Tool | Purpose | Notes |
|------|---------|-------|
| ESLint 9.x + `eslint-plugin-react-hooks` | Lint renderer code | Flat config format (ESLint 9). Add `@typescript-eslint/eslint-plugin`. |
| Prettier | Code formatting | Add `prettier-plugin-tailwindcss` to sort Tailwind class names automatically. |
| Vitest | Unit and component tests | Vite-native test runner; shares electron-vite's transform config. Much faster than Jest for this setup. |
| `@electron/rebuild` | Rebuild native modules for Electron's Node ABI | Required after install to rebuild `teradatasql` against Electron's bundled Node (v24 in Electron 41). Run as a `postinstall` script. |
## Installation
# Scaffold with electron-vite (React + TypeScript template)
# Core AI
# Teradata
# State management + validation
# UI component system
# Storage and security
# TailwindCSS v4 (Vite plugin approach — no PostCSS config needed)
# Dev dependencies
## Alternatives Considered
| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| electron-vite | Electron Forge + Vite template | If the team is already standardised on Forge and Forge's experimental Vite support becomes stable. As of March 2026 it is still marked experimental. |
| electron-vite | electron-webpack / CRA | Never for new projects. Webpack is slower, CRA is unmaintained. |
| shadcn/ui | Mantine, Ant Design, Chakra | Mantine if you want a fully packaged opinionated component system with less copy-ownership. Ant Design if users expect an enterprise-software feel. shadcn/ui is preferred here because Teradata branding requires deep customisation that copy-owned components facilitate better than sealed npm packages. |
| Zustand | Redux Toolkit | Choose Redux Toolkit only if the app grows to multiple developers who need enforced reducers/actions patterns or if you need time-travel debugging. Overkill for a single-user desktop tool. |
| Zustand | Jotai | Jotai is equally valid; Zustand's single-store model is slightly easier to reason about for chat state that crosses subagent dispatches. |
| @anthropic-ai/claude-agent-sdk | @anthropic-ai/sdk only | Use base SDK only if you want full manual control over every LLM call. The Agent SDK's subagent infrastructure avoids reinventing the orchestration loop. For this project the Agent SDK is the right default. |
| streamdown | react-markdown | react-markdown is fine for static content. For streaming AI token output, `streamdown` handles incomplete Markdown blocks correctly. If streaming is removed or responses are fully awaited before render, `react-markdown` suffices. |
| teradatasql | ODBC via `node-odbc` | Use ODBC if `teradatasql` cannot connect to older Teradata versions (<16.20) or if the team already has ODBC DSNs configured. The official driver is preferred where possible. |
| safeStorage (built-in) | node-keytar | node-keytar is the older battle-tested option but requires native module compilation on each Electron upgrade. Electron's built-in `safeStorage` has no extra dependency. |
## What NOT to Use
| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `teradata-nodejs-driver` (npm) | Officially deprecated by Teradata. No longer maintained. | `teradatasql` |
| `node-keytar` | Requires native module rebuild on every Electron version bump; abandoned by GitHub/Atom. Electron's `safeStorage` covers the same use case with zero extra dependencies. | `safeStorage` (Electron built-in) |
| `react-markdown` for streaming AI output | Re-renders on every token without memoization; doesn't handle incomplete Markdown syntax mid-stream (partial code fences cause layout shifts). | `streamdown` |
| `moment.js` | 67KB gzipped, no tree-shaking, deprecated by its own authors. | `date-fns` |
| Electron `nodeIntegration: true` in renderer | Exposes all Node.js APIs to the renderer's JavaScript context — if any third-party script runs there (e.g., a malicious Markdown link), it has full OS access. Electron 20+ defaults to `false`. Never override this. | IPC via `contextBridge` + `ipcRenderer` |
| `electron-remote` | Removed from Electron. Was already an antipattern for security. | IPC (ipcMain / ipcRenderer) |
| `create-react-app` | Unmaintained since 2023, broken webpack config, no Electron support. | `electron-vite` scaffold |
| SQLite / IndexedDB for chat history | Adds a dependency and schema migration problem for v1. Chat history in `electron-store` (JSON) is sufficient for a single-user tool with modest history. Revisit if history exceeds ~1MB. | `electron-store` |
## Stack Patterns by Variant
- electron-builder config can be simplified to a single `win` target
- `safeStorage` uses Windows DPAPI on Windows — no change to code, just simpler CI
- Replace `teradatasql` with `node-odbc` + system ODBC driver
- Because `teradatasql` requires direct TCP to Teradata; ODBC can use pre-configured DSNs or existing drivers already deployed by the DBA's IT team
- Build a custom orchestration layer using the base `@anthropic-ai/sdk` with tool-use
- Because the Agent SDK's subagents cannot spawn their own sub-subagents — for deeply nested task trees you need manual orchestration with tool_use message loops
- Migrate from `electron-store` to a local SQLite database via `better-sqlite3`
- Because `electron-store` reads/writes the entire JSON file on every change; `better-sqlite3` is synchronous, fast, and requires no separate process
## Version Compatibility
| Package | Compatible With | Notes |
|---------|-----------------|-------|
| `teradatasql` (latest) | Node.js v18.20.7+ | Must match Electron 41's bundled Node (v24). Run `@electron/rebuild` as `postinstall`. |
| `electron-store` (latest) | Electron 30+ | Electron 41 satisfies this. |
| `electron-vite` 5.0.0 | Vite 6.x, Electron 28+ | Electron 41 satisfies this. |
| `tailwindcss` v4.2 | `@tailwindcss/vite` plugin (not PostCSS) | The v4 Vite plugin replaces both PostCSS and `tailwind.config.js`. Do NOT install `postcss` or `autoprefixer` for Tailwind — they conflict with the v4 plugin. |
| `zod` | `^3.25` required by `@anthropic-ai/sdk` v0.79+ | Zod v4 import path changed; stay on `^3.25` until Anthropic SDK explicitly supports Zod v4. |
| `@anthropic-ai/claude-agent-sdk` | `@anthropic-ai/sdk` (peer dep) | Both packages must be installed. Agent SDK uses the base SDK internally; version alignment is handled by npm peer dependency resolution. |
## Sources
- [Anthropic TypeScript SDK releases (GitHub)](https://github.com/anthropics/anthropic-sdk-typescript/releases) — confirmed v0.80.0 current (March 18 2026), Zod ^3.25 requirement (HIGH confidence)
- [Claude Agent SDK TypeScript reference (official docs)](https://platform.claude.com/docs/en/agent-sdk/typescript) — `query()`, subagent patterns, `AgentDefinition` API (HIGH confidence)
- [Building agents with the Claude Agent SDK (Anthropic engineering)](https://claude.com/blog/building-agents-with-the-claude-agent-sdk) — subagent context isolation, orchestration design rationale (HIGH confidence)
- [Teradata nodejs-driver GitHub README](https://github.com/Teradata/nodejs-driver) — Node v18.20.7+ requirement, auth methods, deprecation of `teradata-nodejs-driver` (HIGH confidence)
- [electron-vite 5.0 release announcement](https://electron-vite.org/blog/) — v5.0.0 released December 2025 (HIGH confidence)
- [Electron releases page](https://releases.electronjs.org/) — v41 current stable, Node v24 bundled (HIGH confidence)
- [React versions page](https://react.dev/versions) — v19.2.x current (HIGH confidence)
- [TailwindCSS v4 announcement](https://tailwindcss.com/blog/tailwindcss-v4) — v4.2 current, Vite plugin replaces PostCSS (HIGH confidence)
- [shadcn/ui changelog](https://ui.shadcn.com/docs/changelog) — CLI v4 March 2026, active maintenance confirmed (HIGH confidence)
- [Electron safeStorage docs](https://www.electronjs.org/docs/latest/api/safe-storage) — built-in credential encryption, OS keychain integration (HIGH confidence)
- [Electron security docs](https://www.electronjs.org/docs/latest/tutorial/security) — `nodeIntegration: false`, `contextIsolation: true` as secure defaults since Electron 20 (HIGH confidence)
- [Streamdown GitHub (Vercel)](https://github.com/vercel/streamdown) — drop-in react-markdown replacement for AI streaming (MEDIUM confidence — newer library, less production history)
- [electron-store GitHub](https://github.com/sindresorhus/electron-store) — requires Electron 30+, JSON persistence model and limitations (HIGH confidence)
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

Conventions not yet established. Will populate as patterns emerge during development.
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

Architecture not yet mapped. Follow existing patterns found in the codebase.
<!-- GSD:architecture-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd:quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd:debug` for investigation and bug fixing
- `/gsd:execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->



<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd:profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
