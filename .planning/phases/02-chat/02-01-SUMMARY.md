---
phase: 02-chat
plan: 01
subsystem: chat-pipeline
tags: [chat, streaming, ipc, zustand, bedrock, immer]
dependency_graph:
  requires: []
  provides: [chat-store, chat-ipc-handler, preload-bridge, chat-types]
  affects: [02-02-chat-ui, 02-03-schema, 02-04-subagents]
tech_stack:
  added: [streamdown, immer]
  patterns: [zustand-immer-middleware, bedrock-streaming, sts-credential-refresh, webcontents-push-ipc]
key_files:
  created:
    - src/shared/subagent-types.ts
    - src/renderer/src/store/chat-store.ts
    - src/main/ipc/chat.ts
  modified:
    - src/shared/types.ts
    - src/preload/index.ts
    - src/main/index.ts
    - package.json
decisions:
  - "Abort existing stream before starting new one in CHAT_SEND handler to prevent token interleave"
  - "Ignore AbortError in stream error handler — abort is intentional, not a user-facing error"
  - "Schema IPC placeholders (fetchSchemaContext, listDatabases) added to preload now for type completeness; implemented in Plan 03"
metrics:
  duration_minutes: 2
  tasks_completed: 2
  files_created: 3
  files_modified: 4
  completed_date: "2026-03-25T22:39:27Z"
---

# Phase 02 Plan 01: Chat Pipeline — Types, Store, and Streaming Handler Summary

Established the complete streaming data pipeline from user message to streamed Claude/Bedrock response: chat types, Zustand chat store with immer, main process Bedrock streaming handler with STS credential refresh, and preload IPC bridge.

## What Was Built

### Shared Types (`src/shared/types.ts`)
Extended with:
- `MessageRole` type and `ChatMessage` interface for message lifecycle
- 7 new IPC channels: `CHAT_SEND`, `CHAT_ABORT`, `CHAT_TOKEN`, `CHAT_DONE`, `CHAT_ERROR`, `SCHEMA_FETCH`, `SCHEMA_LIST_DATABASES`
- 8 new `ElectronAPI` methods: `sendChat`, `abortChat`, `onChatToken`, `onChatDone`, `onChatError`, `removeChatListeners`, `fetchSchemaContext`, `listDatabases`

### Subagent Types (`src/shared/subagent-types.ts`)
New file with `SubagentDefinition`, `SubagentContext`, `SubagentRunResult` interfaces for the subagent system (Plans 04+).

### Chat Store (`src/renderer/src/store/chat-store.ts`)
Zustand store with immer middleware providing:
- `messages` array with full lifecycle: `addUserMessage`, `addAssistantMessagePlaceholder`, `appendToken`, `finalizeMessage`
- Streaming state: `isStreaming`, `streamingMessageId`
- Schema context: `schemaContext`, `activeDatabaseName`, `setSchemaContext`, `setActiveDatabaseName`
- Subagent results: `subagentResults`, `addSubagentResult`
- `setError`, `clearMessages`

### Bedrock Streaming Handler (`src/main/ipc/chat.ts`)
- `getBedrockClient()` helper: reads stored region/roleArn/modelId, optionally assumes IAM role via STS, returns configured `AnthropicBedrock` client
- `CHAT_SEND` handler: aborts any active stream first, starts new Bedrock stream, pushes tokens/done/error events via `webContents.send`
- `CHAT_ABORT` handler: aborts active stream if present
- `registerChatHandlers()` export registered in `src/main/index.ts`

### Preload Bridge (`src/preload/index.ts`)
All chat IPC methods exposed: `sendChat`, `abortChat`, `onChatToken`, `onChatDone`, `onChatError`, `removeChatListeners`, `fetchSchemaContext` (stub), `listDatabases` (stub).

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| Task 1 | 06968c0 | feat(02-01): install streaming deps, define chat types, and create Zustand chat store |
| Task 2 | 21d78d7 | feat(02-01): add Bedrock streaming IPC handler and preload bridge |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing] Ignore AbortError in stream error handler**
- **Found during:** Task 2
- **Issue:** Plan did not specify filtering AbortError in the stream error handler. Without this, aborting a stream would send a CHAT_ERROR event to the renderer, causing a spurious error display for the user.
- **Fix:** Added `if (err.name !== 'AbortError')` guard before sending CHAT_ERROR.
- **Files modified:** src/main/ipc/chat.ts
- **Commit:** 21d78d7

## Known Stubs

- `fetchSchemaContext` in preload/index.ts: invokes `SCHEMA_FETCH` IPC channel but no handler exists yet — will be wired in Plan 03
- `listDatabases` in preload/index.ts: invokes `SCHEMA_LIST_DATABASES` IPC channel but no handler exists yet — will be wired in Plan 03

These stubs are intentional — they are included now so the `ElectronAPI` TypeScript interface is complete. The renderer will not call these until Plan 03 implements the handlers.

## Self-Check: PASSED

Files exist:
- src/shared/types.ts — FOUND
- src/shared/subagent-types.ts — FOUND
- src/renderer/src/store/chat-store.ts — FOUND
- src/main/ipc/chat.ts — FOUND
- src/preload/index.ts — FOUND
- src/main/index.ts — FOUND

Commits exist:
- 06968c0 — FOUND
- 21d78d7 — FOUND

Build: PASSED (npm run build exits 0)
