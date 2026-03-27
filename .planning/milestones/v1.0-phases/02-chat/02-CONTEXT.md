# Phase 2: Chat - Context

**Gathered:** 2026-03-25
**Status:** Ready for planning

<domain>
## Phase Boundary

Users can have freeform AI conversations about their Teradata environment with streaming responses, full schema awareness, and the ability to discover and launch specialist subagents. This phase delivers the chat UI, Claude Bedrock streaming integration, MCP-powered schema context injection, session memory, and the subagent launcher framework (scaffold only — real subagents in Phase 3).

</domain>

<decisions>
## Implementation Decisions

### Chat UI & Input Design
- Chat IS the home screen — replaces WelcomeState as default page. Sidebar gets "Chat" nav item at top, "Settings" below.
- Fixed bottom input bar with Send button, Shift+Enter for newlines — standard AI chat UX
- User messages right-aligned with subtle dark card, assistant messages left-aligned full-width with markdown rendering — similar to Claude.ai
- Blinking cursor at end of streaming text + "Stop" button to cancel generation

### Streaming & Claude Integration
- Use `@anthropic-ai/bedrock-sdk` directly (already in codebase) — `messages.stream()` for SSE token streaming through main process, forward tokens to renderer via IPC
- Zustand store in renderer owns conversation state — messages array with `{role, content, timestamp}`. Main process is stateless relay. Full message history sent with each API call for context.
- IPC event stream — main process emits `chat:token` events via `webContents.send()`, renderer accumulates into current message. Single `chat:done` event on completion.
- Send full conversation history up to model token limit. No truncation in v1 — sessions are short-lived DBA interactions. Warn user if approaching limit.

### Schema Context & MCP Integration
- System prompt injection — on chat start, fetch database/table list via MCP and include as structured context in system message. Refresh on explicit user request or new session.
- Inject database names + table names + column names/types for user-selected database(s). Cap at ~4K tokens of schema context. User picks active database in sidebar or chat.
- HTTP to the already-configured MCP endpoint (from Phase 1 settings). Main process makes MCP tool calls, returns results to chat service.
- Surface MCP errors as inline error message in chat — "Could not fetch schema: {error}". Chat continues working without schema context (graceful degradation).

### Subagent Launcher & Framework
- Collapsible panel in sidebar below Chat/Settings nav — shows available subagents as cards with name + one-line description. Click to launch. (Satisfies UIBR-03)
- Distinct "subagent card" in chat thread — visually differentiated with colored border and header showing subagent name + timestamp. Content is rich markdown. Isolated from conversation history (AGEN-03).
- Scaffold the framework only — define SubagentDefinition type, launcher UI, result card component. Use a single "echo" test subagent. Real subagents come in Phase 3.
- Subagent runs a separate API call chain — its own messages array, not appended to main chat history. Only the final result card is inserted into the chat view.

### Claude's Discretion
- Exact IPC channel naming for chat streaming events
- Zustand store shape for chat messages and subagent state
- Markdown rendering component choice and configuration
- System prompt wording for Teradata DBA context
- Schema context formatting within system prompt

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/renderer/src/components/ui/` — shadcn components: button, card, badge, input, form, label, separator, tooltip
- `src/renderer/src/store/app-store.ts` — Zustand store with `currentPage` and `connectionStatus` (needs extension for chat state)
- `src/renderer/src/lib/ipc.ts` — IPC utility layer
- `src/main/ipc/claude.ts` — Bedrock SDK integration with STS AssumeRole, `getDecryptedAwsCredentials()` export
- `src/main/services/mcp-manager.ts` — MCP connection manager
- `src/main/services/health-poller.ts` — Health polling service
- `src/shared/types.ts` — Shared IPC types, `ElectronAPI` interface, `IpcChannels` const

### Established Patterns
- Navigation via Zustand `currentPage` state with conditional render in AppShell
- IPC via `contextBridge.exposeInMainWorld('electronAPI', {...})` in preload
- IPC handlers registered in `src/main/ipc/` modules, called from `src/main/index.ts`
- Inline styles for layout (grid), Tailwind classes for component styling
- Sidebar active state: `border-l-4 border-[#F37440]` with `border-transparent` on inactive

### Integration Points
- `AppShell.tsx` — add `chat` page render case, extend `NavPage` type
- `Sidebar.tsx` — add Chat nav item + subagent launcher panel
- `app-store.ts` — extend with chat messages, streaming state, active subagent
- `preload/index.ts` — expose chat streaming IPC methods
- `shared/types.ts` — add chat message types, IPC channels for streaming
- `src/main/ipc/` — new `chat.ts` module for streaming handler

</code_context>

<specifics>
## Specific Ideas

- Bedrock SDK already configured with AssumeRole + inference profiles — reuse `getDecryptedAwsCredentials()` from `src/main/ipc/claude.ts`
- MCP endpoint configured via Phase 1 settings — reuse stored URL for schema queries
- User decided on Bedrock (not direct Anthropic API) in Phase 1 — all Claude calls go through AWS Bedrock
- Phase 1 decided on teradata-mcp-server (Python, official) for connectivity

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>
