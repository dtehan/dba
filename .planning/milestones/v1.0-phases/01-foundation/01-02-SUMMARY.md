---
phase: 01-foundation
plan: 02
subsystem: ipc
tags: [electron, safeStorage, ipc, electron-store, zod, contextBridge, typescript]

# Dependency graph
requires:
  - phase: 01-foundation/01-01
    provides: "Electron scaffold with main/preload/renderer structure and tsconfig setup"

provides:
  - "Typed IPC contract layer with centralized channel names (IpcChannels const)"
  - "Zod-validated credential IPC handlers in main process"
  - "safeStorage encryption for Teradata username/password and Claude API key"
  - "electron-store with typed schema for persistent (non-secret) settings"
  - "contextBridge preload bridge exposing full ElectronAPI to renderer"
  - "Typed renderer-side IPC accessor (getElectronAPI)"
  - "MCP server process lifecycle manager (spawn, kill, test)"
  - "Claude API connection test handler using @anthropic-ai/sdk"

affects: [settings-ui, chat, subagents, mcp-integration, claude-integration]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "IPC channel names centralized as typed const object in src/shared/types.ts"
    - "Zod validation on all incoming IPC payloads before processing"
    - "safeStorage.encryptString -> base64 -> electron-store -> base64 -> safeStorage.decryptString"
    - "Typed preload bridge: contextBridge.exposeInMainWorld('electronAPI', ...) with ElectronAPI interface"
    - "Renderer accesses Electron via getElectronAPI() in src/renderer/src/lib/ipc.ts"
    - "Internal-only decrypt functions (getDecryptedTeradataCredentials, getDecryptedClaudeKey) not exposed via IPC"

key-files:
  created:
    - src/shared/types.ts
    - src/shared/schemas.ts
    - src/main/store.ts
    - src/main/ipc/credentials.ts
    - src/main/ipc/claude.ts
    - src/main/ipc/mcp.ts
    - src/main/services/mcp-manager.ts
    - src/renderer/src/lib/ipc.ts
  modified:
    - src/preload/index.ts
    - src/main/index.ts
    - tsconfig.node.json
    - tsconfig.web.json
    - electron.vite.config.ts

key-decisions:
  - "IPC channel names defined as const object (not enum) for type-safe string literals"
  - "safeStorage base64 encoding chosen for binary-safe electron-store persistence"
  - "Internal decrypt functions not exposed via IPC - called only from main process services"
  - "MCP manager uses uvx to spawn teradata-mcp-server with DATABASE_URI env var (stdio transport)"

patterns-established:
  - "Pattern 1: All IPC channels named in IpcChannels const in src/shared/types.ts - never hardcode channel strings"
  - "Pattern 2: Zod safeParse on every IPC handler's input before processing"
  - "Pattern 3: safeStorage encrypt -> base64 string for electron-store; decrypt with Buffer.from(str, 'base64')"
  - "Pattern 4: contextBridge only - never nodeIntegration; renderer gets ElectronAPI via window.electronAPI"

requirements-completed: [FOUN-02, FOUN-03, FOUN-05]

# Metrics
duration: 2min
completed: 2026-03-24
---

# Phase 01 Plan 02: IPC Contract Layer Summary

**Typed IPC bridge with safeStorage credential encryption, Zod-validated handlers, and electron-store persistence — secrets never leave the main process**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-24T20:28:27Z
- **Completed:** 2026-03-24T20:30:41Z
- **Tasks:** 2
- **Files modified:** 13

## Accomplishments

- Established security boundary between renderer and main process: credentials are encrypted with OS keychain via safeStorage and never touch the renderer's JS context
- Created centralized IPC contract in src/shared/types.ts with typed channel names and ElectronAPI interface shared across all three Electron processes
- Implemented Zod validation on all IPC payloads, safeStorage encryption for Teradata username/password and Claude API key, and electron-store persistence with typed schema
- Connected preload bridge via contextBridge.exposeInMainWorld exposing full typed ElectronAPI
- MCP server lifecycle manager (spawn/kill/test) wired to IPC for Teradata connection testing

## Task Commits

Each task was committed atomically:

1. **Task 1: Shared types, Zod schemas, and electron-store configuration** - `c62ed20` (feat)
2. **Task 2: Credential IPC handlers, safeStorage encryption, and preload bridge** - `531ca7e` (feat)

## Files Created/Modified

- `src/shared/types.ts` - IPC channel names (IpcChannels const), TeradataCredentials, ConnectionStatus, ElectronAPI interface
- `src/shared/schemas.ts` - Zod schemas for teradataCredentials and claudeApiKey validation
- `src/main/store.ts` - Typed electron-store schema with encrypted secret fields and plaintext host
- `src/main/ipc/credentials.ts` - registerCredentialHandlers() with safeStorage encrypt/decrypt; getDecryptedTeradataCredentials() internal function
- `src/main/ipc/claude.ts` - registerClaudeHandlers() for key storage + TEST_CLAUDE_CONNECTION handler; getDecryptedClaudeKey() internal function
- `src/main/ipc/mcp.ts` - registerMcpHandlers() for TEST_TERADATA_CONNECTION IPC channel
- `src/main/services/mcp-manager.ts` - MCP server process lifecycle: spawn via uvx, kill on cleanup, testTeradataConnection()
- `src/renderer/src/lib/ipc.ts` - getElectronAPI() typed accessor for renderer code
- `src/preload/index.ts` - Updated to expose full ElectronAPI via contextBridge using IpcChannels
- `src/main/index.ts` - Registers credential and Claude IPC handlers; safeStorage.isEncryptionAvailable() warning
- `tsconfig.node.json` - Added src/shared/** to include and @shared/* path alias
- `tsconfig.web.json` - Added src/shared/** to include and @shared/* path alias
- `electron.vite.config.ts` - Added @shared alias for main, preload, and renderer Vite configs

## Decisions Made

- IPC channel names defined as a `const` object (not TypeScript enum) to produce literal string values that work cleanly as ipcMain.handle channel names
- safeStorage base64 encoding chosen: safeStorage returns Buffer which cannot be stored in JSON; base64 string is JSON-safe and reversible
- Internal decrypt functions (`getDecryptedTeradataCredentials`, `getDecryptedClaudeKey`) not exposed via IPC -- called only from main process services to keep secrets in main process memory only
- MCP server spawned via `uvx teradata-mcp-server` with DATABASE_URI env var, stdio transport (no network port management needed)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Installed missing class-variance-authority dependency**
- **Found during:** Task 2 (build verification)
- **Issue:** shadcn/ui badge.tsx component (from Plan 01) imported class-variance-authority which was declared in package.json but not installed in node_modules, causing build failure
- **Fix:** Ran `npm install` to install all declared dependencies
- **Files modified:** package-lock.json
- **Verification:** Build passes with all 1644 modules transformed
- **Committed in:** 531ca7e (Task 2 commit)

**2. [Rule 2 - Missing Critical] Added TEST_CLAUDE_CONNECTION and TEST_TERADATA_CONNECTION IPC handlers**
- **Found during:** Task 2 (IpcChannels defines these channels but plan did not specify their handlers)
- **Issue:** ElectronAPI interface declares testTeradataConnection and testClaudeConnection but plan only covered credential storage handlers; leaving IPC channels unregistered would cause runtime errors when renderer calls them
- **Fix:** Created src/main/ipc/mcp.ts with registerMcpHandlers() and added TEST_CLAUDE_CONNECTION handler to claude.ts; created src/main/services/mcp-manager.ts for MCP process lifecycle
- **Files modified:** src/main/ipc/claude.ts, src/main/ipc/mcp.ts, src/main/services/mcp-manager.ts
- **Verification:** Build succeeds; handlers registered
- **Committed in:** 531ca7e (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 missing critical)
**Impact on plan:** Both auto-fixes required for functional correctness. Missing handlers would cause runtime IPC errors when UI calls testTeradataConnection() or testClaudeConnection().

## Issues Encountered

None beyond the deviations documented above.

## User Setup Required

None - no external service configuration required beyond what was already set up.

## Next Phase Readiness

- IPC contract layer complete: renderer can call all credential and connection test functions
- Settings UI (Plan 05) can call saveTeradataCredentials(), saveClaudeApiKey(), hasTeradataCredentials(), hasClaudeKey() immediately
- MCP server lifecycle ready for Plan 03 (chat/subagent integration)
- getDecryptedTeradataCredentials() and getDecryptedClaudeKey() available for any main process service that needs live credentials

---
*Phase: 01-foundation*
*Completed: 2026-03-24*
