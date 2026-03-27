---
phase: 02-chat
plan: 03
subsystem: api
tags: [mcp, teradata, ipc, schema, electron]

requires:
  - phase: 02-01
    provides: "Chat IPC infrastructure with SCHEMA_FETCH and SCHEMA_LIST_DATABASES channel placeholders in preload"

provides:
  - "MCP schema context service (listDatabases, fetchSchemaContext) with session lifecycle management"
  - "Schema IPC handlers registered in main process (SCHEMA_LIST_DATABASES, SCHEMA_FETCH)"
  - "Structured Markdown schema context formatted for Claude system prompt injection (~4K token cap)"

affects:
  - 02-04
  - 02-05

tech-stack:
  added: []
  patterns:
    - "MCP tool calls via JSON-RPC tools/call over HTTP POST — same pattern as initialize in mcp-manager.ts"
    - "Session ID optional: store Mcp-Session-Id if server provides it, proceed without if not"
    - "Promise.allSettled for parallel MCP calls — one table error doesn't abort all column fetches"
    - "Token budget cap: truncate output at ~4000 chars with 'and N more tables' note"
    - "IPC graceful degradation: MCP errors return {success: false, error} not throw to renderer"

key-files:
  created:
    - src/main/services/mcp-schema.ts
    - src/main/ipc/schema.ts
  modified:
    - src/main/index.ts

key-decisions:
  - "MCP session ID tracking: store header value if present, proceed without if absent — stateless servers work fine"
  - "Column description parsing: split on 2+ spaces or tab to separate name from type — handles variable-width text output"
  - "Table cap at 20 with char cap at 4000: prevents token overflow while still providing useful context"
  - "Promise.allSettled for column fetches: one slow/missing table doesn't degrade entire schema context result"

patterns-established:
  - "MCP service pattern: module-level session state + initializeMcpSession + callMcpTool + exported functions"
  - "IPC handler pattern: validate input, try/catch wrapping service call, return {success, data | error}"

requirements-completed: [CHAT-03, CHAT-06]

duration: 5min
completed: 2026-03-25
---

# Phase 02 Plan 03: MCP Schema Context Service Summary

**MCP tool call service fetching Teradata databases/tables/columns via JSON-RPC, formatted as 4K-token-capped Markdown for Claude system prompt injection**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-03-25T22:40:00Z
- **Completed:** 2026-03-25T22:42:21Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- Built `mcp-schema.ts` service that calls `base_databaseList`, `base_tableList`, and `base_columnDescription` MCP tools
- Handles MCP session lifecycle — initializes session on first call, stores `Mcp-Session-Id` if provided, re-initializes on 404
- `fetchSchemaContext` builds column-per-row Markdown tables with ~4K char output cap and truncation note
- Registered `SCHEMA_LIST_DATABASES` and `SCHEMA_FETCH` IPC handlers with input validation and graceful error degradation

## Task Commits

Each task was committed atomically:

1. **Task 1: MCP schema context service** - `d22b473` (feat)
2. **Task 2: Schema IPC handlers and main process registration** - `801a44a` (feat)

## Files Created/Modified

- `src/main/services/mcp-schema.ts` - MCP tool call service: listDatabases, fetchSchemaContext, session lifecycle
- `src/main/ipc/schema.ts` - IPC handlers for SCHEMA_LIST_DATABASES and SCHEMA_FETCH channels
- `src/main/index.ts` - Added registerSchemaHandlers() import and call after registerChatHandlers()

## Decisions Made

- Column description text parsing splits on 2+ spaces or tab separator — Teradata MCP output format is fixed-width text, not structured JSON
- Token budget enforced as character count (~4000 chars) rather than actual token count — cheap to compute, conservative enough
- 15-second AbortController timeout per MCP tool call — consistent with connection test timeout in mcp-manager.ts

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Schema context service ready for ChatScreen to call via `window.electron.listDatabases()` and `window.electron.fetchSchemaContext(db)`
- Plan 04 (ChatScreen schema injection) can wire these IPC calls into the system prompt construction
- No blockers

---
*Phase: 02-chat*
*Completed: 2026-03-25*
