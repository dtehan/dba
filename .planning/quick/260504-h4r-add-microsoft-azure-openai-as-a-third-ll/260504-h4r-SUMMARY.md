---
phase: quick
plan: 260504-h4r
subsystem: llm-providers
tags: [llm, azure-openai, settings, chat, streaming]
requires: []
provides: [azure-llm-provider]
affects: [chat-dispatch, settings-ui, health-poller]
tech-stack:
  added:
    - openai@^6.36.0 (Azure OpenAI client via AzureOpenAI class)
  patterns:
    - Mirror Gemini provider pattern across types/store/IPC/preload/UI/agent-loop
    - OpenAI streaming tool_calls accumulator keyed by index (not id)
    - safeStorage for API key encryption (OS keychain)
key-files:
  created:
    - src/main/services/azure-client.ts
    - src/renderer/src/features/settings/AzureApiForm.tsx
  modified:
    - package.json
    - package-lock.json
    - src/shared/types.ts
    - src/main/store.ts
    - src/main/ipc/claude.ts
    - src/main/ipc/chat.ts
    - src/main/services/health-poller.ts
    - src/preload/index.ts
    - src/renderer/src/features/settings/LlmProviderSelector.tsx
    - src/renderer/src/features/settings/SettingsScreen.tsx
decisions:
  - "Reused Gemini's pattern wholesale — provider widening + per-provider client service + per-provider agent loop in chat.ts. No abstraction layer; cost of duplication < cost of premature unification with three providers."
  - "Tool-call accumulation keyed by tc.index (not tc.id) since OpenAI only sends id once per tool_call but argument fragments stream across many deltas."
  - "Azure deployment name passed in both AzureOpenAI client constructor AND the model field of chat.completions.create — Azure routes by client deployment but the SDK still requires the model param."
  - "Set assistant content to null (not empty string) when emitting tool_calls — OpenAI rejects empty content with tool_calls."
metrics:
  duration_minutes: 6
  tasks_completed: 3
  files_created: 2
  files_modified: 10
  completed_date: 2026-05-04
---

# Quick Task 260504-h4r: Add Microsoft Azure OpenAI as a Third LLM Provider — Summary

Added Azure OpenAI as a third LLM provider alongside Bedrock and Gemini, including a settings UI tile, an API-key form, encrypted-key storage, health polling, and a streaming chat agent loop with full tool-call support — wired end-to-end through IPC.

## What Was Built

### Backend foundation (Task 1)

- Installed `openai@^6.36.0` (provides `AzureOpenAI` class with `apiKey/endpoint/apiVersion/deployment` config).
- Widened `LlmProvider` union from `'bedrock' | 'gemini'` to `'bedrock' | 'gemini' | 'azure'` in both `src/shared/types.ts` and `src/main/store.ts`.
- Added 4 new store fields with documented defaults:
  - `azureEncryptedApiKey: ''`
  - `azureEndpoint: 'https://danie-m3uu72y9-francecentral.openai.azure.com/'`
  - `azureApiVersion: '2024-12-01-preview'`
  - `azureDeployment: 'gpt-5.4'`
- Added 6 new IPC channel constants and matching `ElectronAPI` methods.
- Created `src/main/services/azure-client.ts` exporting:
  - `getDecryptedAzureApiKey()` — `safeStorage.decryptString(...)`.
  - `getAzureClient()` — returns `{ client: AzureOpenAI, deployment }`.
  - `convertToolsToOpenAI(tools)` — Anthropic `{name, description, input_schema}` → OpenAI `{type: 'function', function: {name, description, parameters}}`.
  - `convertMessagesToOpenAI(messages)` — handles text blocks, `tool_use` (assistant.tool_calls), `tool_result` (`role: 'tool'` standalone messages).
  - `getMcpToolsForAzure()` — caches MCP tools in OpenAI format.
  - `executeToolAzure(name, input)` — stringifies args, calls `callMcpTool`, returns string.
  - `clearAzureToolsCache()`.
- Wired 6 IPC handlers in `claude.ts`: `SAVE_AZURE_KEY`, `HAS_AZURE_KEY`, `LOAD_AZURE_KEY_HINT`, `AZURE_SAVE_CONFIG`, `AZURE_LOAD_CONFIG`, `TEST_AZURE_CONNECTION` (with 15s `AbortController` timeout).
- Updated `LLM_SAVE_PROVIDER` validation to accept `'azure'`.
- Added Azure branch to `health-poller.ts` `checkLlmStatus()` — returns `connected` only when key + endpoint + deployment are all set.
- Exposed 6 Azure preload bindings via `contextBridge` in `src/preload/index.ts`.

### Chat agent loop (Task 2)

- Added `runAzureAgentLoop` in `src/main/ipc/chat.ts`:
  - Streams via `client.chat.completions.create({ stream: true, model: deployment, ... })`.
  - Accumulates `tool_calls` deltas keyed by `index` (id, name, argsBuffer).
  - Translates OpenAI `finish_reason` (`tool_calls`/`stop`) to Anthropic-style `stop_reason` (`tool_use`/`end_turn`).
  - Injects system prompt as the first message (`role: 'system'`).
  - On tool calls, pushes assistant message with `tool_calls` array (content=null when text empty), then appends one `role: 'tool'` message per call with `tool_call_id` and result.
  - Handles `td_syntax` (local syntax tool) and routes other tool calls through `executeToolAzure`.
  - Honors `AbortController` for cancellation; matches existing Gemini/Bedrock abort error pattern.
- Routed `provider === 'azure'` through `dispatchChat` to `runAzureAgentLoop` (alongside Gemini/Bedrock branches).
- Added `clearAzureToolsCache()` to `chat:refresh-tools` handler.

### Settings UI (Task 3)

- Created `src/renderer/src/features/settings/AzureApiForm.tsx` — mirrors `GeminiApiForm` (api-key branch only, no auth-method tabs):
  - Four fields in order: Azure Endpoint, API Version, Deployment Name (monospace), API Key (password with Eye/EyeOff toggle).
  - Defaults pre-populate from store on mount via `loadAzureConfig`.
  - API key field loads masked hint via `loadAzureKeyHint`; `keyEdited` flag prevents accidentally re-saving the masked hint.
  - Test Connection + Save buttons with success/error feedback (3-second auto-dismiss on success).
- Updated `LlmProviderSelector` to `Provider = 'bedrock' | 'gemini' | 'azure'` and added a third tile labeled "Microsoft Azure OpenAI".
- Updated `SettingsScreen` to render `<AzureApiForm />` when `provider === 'azure'`.

## Commits

| Task | Commit  | Message                                                                              |
| ---- | ------- | ------------------------------------------------------------------------------------ |
| 1    | 39df757 | feat(quick-260504-h4r): backend foundation for Azure OpenAI provider                  |
| 2    | e0e94e5 | feat(quick-260504-h4r): wire Azure into chat agent loop with streaming + tool-call accumulation |
| 3    | af93e7b | feat(quick-260504-h4r): add Azure OpenAI settings UI                                  |

## Verification

Per-task verification (all passed):

- **Task 1:** `npm run typecheck` shows 20 pre-existing errors and 0 new errors. `grep` confirms 9+ `azure` refs in `store.ts`, 6 `AZURE` refs in `types.ts`, all 6 preload bindings present, `azure-client.ts` exists, `node -e "require('openai')"` succeeds.
- **Task 2:** `npm run typecheck` shows 20 pre-existing errors and 0 new errors. `grep` confirms 5 `runAzureAgentLoop`/`provider === 'azure'`/`clearAzureToolsCache` references and the `tool_calls`/`toolCallsByIndex` accumulator pattern.
- **Task 3:** `npm run typecheck` shows 20 pre-existing errors and 0 new errors. `AzureApiForm.tsx` exists; `LlmProviderSelector` references `azure` 4 times; `SettingsScreen` imports and renders `AzureApiForm`.

Human-verification (Task 4) is **paused** for the user to drive the app end-to-end (see Plan).

## Deviations from Plan

### Auto-fixed Issues

None — plan executed exactly as written.

### Skipped (out of scope)

**Postinstall (`electron-rebuild`)** — Plan suggested running `npm run postinstall` after installing `openai`. Skipped because `openai` is a pure-JS package with no native module — it doesn't link against Electron's Node ABI, so a rebuild adds no value. `npm install` triggers `postinstall` automatically anyway, so this is functionally a no-op.

### Deferred Items

These are pre-existing issues, not caused by this plan, and out of scope for a quick task:

1. **`npm run lint` is broken project-wide.** ESLint 9 requires `eslint.config.js` (flat config) but the repo has none. Verified pre-existing by stashing changes and re-running lint — same failure. The plan's verify step `npm run lint` was never actually green at any point in the repo's history with the current ESLint version. Not addressing here per scope-boundary rules; the user can either pin ESLint to 8.x or migrate the config.
2. **`npm run typecheck` reports 20 pre-existing errors.** All errors are about `electron-store` typing quirks (`Property 'get' does not exist on type 'ElectronStore<...>'`) and one `@tailwindcss/vite` module-resolution warning under `tsconfig.node.json`. Verified pre-existing by stashing changes — error count is 20 both before and after my changes. The codebase already accommodates these via `(store as any).get/set` casts; my new code follows the same pattern.

## Authentication Gates

The user must paste a real Azure OpenAI API key into the settings form during human-verify (Task 4). The Plan's `user_setup` block documents this — Claude cannot retrieve an Azure-portal-generated API key on the user's behalf.

## Self-Check: PASSED

Files created (verified to exist on disk):

- FOUND: `src/main/services/azure-client.ts`
- FOUND: `src/renderer/src/features/settings/AzureApiForm.tsx`
- FOUND: `.planning/quick/260504-h4r-add-microsoft-azure-openai-as-a-third-ll/260504-h4r-SUMMARY.md`

Commits (verified via `git log --oneline`):

- FOUND: 39df757 (Task 1 — backend foundation)
- FOUND: e0e94e5 (Task 2 — chat agent loop)
- FOUND: af93e7b (Task 3 — settings UI)
