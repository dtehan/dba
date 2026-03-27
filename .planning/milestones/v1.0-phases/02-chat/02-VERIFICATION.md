---
phase: 02-chat
verified: 2026-03-26T02:00:00Z
status: gaps_found
score: 16/21 must-haves verified
gaps:
  - truth: "User can select a database from a dropdown/list in the sidebar"
    status: failed
    reason: "DatabaseSelector component exists but is orphaned — not imported in Sidebar.tsx (Plan 05 removed it). The component also calls setActiveDatabaseName(), setSchemaContext(), and reads activeDatabaseName — none of which exist on ChatState after Plan 05 refactoring replaced pre-fetched schema with agentic tool-use."
    artifacts:
      - path: "src/renderer/src/components/DatabaseSelector.tsx"
        issue: "Calls useChatStore((s) => s.activeDatabaseName) — property does not exist on ChatState. Calls setActiveDatabaseName() and setSchemaContext() — methods do not exist on ChatState. Type errors confirmed by tsc."
      - path: "src/renderer/src/components/Sidebar.tsx"
        issue: "DatabaseSelector is never imported. The Sidebar no longer includes a database selector panel."
    missing:
      - "Either: re-integrate DatabaseSelector with a working data model (e.g. local state or new store fields), or formally accept that the database selection UI was superseded by the agentic MCP tool-use model and remove DatabaseSelector.tsx to avoid the broken orphan"
  - truth: "Sidebar shows Chat nav item at top, Settings below"
    status: failed
    reason: "The Chat nav button with MessageSquare icon was replaced in Plan 05 with a New Chat button and session history list. MessageSquare is imported in Sidebar.tsx but never rendered — TypeScript confirms 'MessageSquare' is declared but its value is never read. Settings is the only standard nav item. Chat is accessed implicitly via the New Chat button or history list."
    artifacts:
      - path: "src/renderer/src/components/Sidebar.tsx"
        issue: "No <button> renders MessageSquare or navigates to 'chat' page via setCurrentPage('chat') in the nav section. Navigation to chat is through handleNewChat() and handleLoadSession() which both call setCurrentPage('chat') but are not labelled as a 'Chat' nav item."
    missing:
      - "Either: add a Chat nav button as the plan specified (UIBR-03 requires sidebar with subagent launcher, which is present), or document that the nav design changed to a session-list paradigm. The requirement UIBR-03 ('Chat interface has a sidebar with subagent launcher') is functionally satisfied — SubagentLauncher is present in Sidebar."
  - truth: "Schema context is injected into Claude system prompt on next message send"
    status: partial
    reason: "The Plan 04 schema context injection path (DatabaseSelector -> setSchemaContext -> buildSystemPrompt reads schemaContext) no longer exists. ChatScreen uses a static SYSTEM_PROMPT constant with no schema injection. Schema awareness is now achieved through Claude's agentic MCP tool-use loop instead — functionally equivalent or superior, but the originally planned injection path is gone."
    artifacts:
      - path: "src/renderer/src/features/chat/ChatScreen.tsx"
        issue: "Uses static SYSTEM_PROMPT const. No buildSystemPrompt() function. No schemaContext injection. The agentic loop in chat.ts handles schema discovery via MCP tools dynamically."
    missing:
      - "This is an architectural change, not a bug. Recommend formally accepting the agentic tool-use approach as the schema-awareness mechanism and removing the dead DatabaseSelector code."
human_verification:
  - test: "Verify streaming tokens display character-by-character in UI"
    expected: "Assistant responses appear progressively, not all at once"
    why_human: "Cannot test Bedrock streaming without live credentials and running app"
  - test: "Verify Stop button aborts ongoing streaming response"
    expected: "Response stops mid-sentence when Stop is clicked"
    why_human: "Requires live streaming session to test abort behavior"
  - test: "Verify Markdown code blocks render with copy button in assistant messages"
    expected: "SQL code blocks have syntax highlighting and a functional copy button via streamdown"
    why_human: "Requires running app with streamdown rendering active"
  - test: "Verify agentic MCP tool-use works: ask about databases and Claude calls MCP tools"
    expected: "Claude invokes MCP tools, shows 'Querying Teradata: tool_name...' inline, returns real schema-aware answer"
    why_human: "Requires live Teradata MCP server and Bedrock credentials"
  - test: "Verify Echo Test subagent produces orange-bordered result card in chat"
    expected: "Clicking Echo Test in sidebar shows orange-bordered card with Bot icon and Streamdown content"
    why_human: "Requires running app with live subagent IPC"
  - test: "Verify chat session persistence: start chat, reload app, session appears in history"
    expected: "Chat history list in sidebar shows previous sessions, clicking loads them"
    why_human: "Requires running app with electron-store persistence"
---

# Phase 02: Chat Verification Report

**Phase Goal:** Users can have freeform AI conversations about their Teradata environment with streaming responses, full schema awareness, and the ability to discover and launch specialist subagents
**Verified:** 2026-03-26T02:00:00Z
**Status:** gaps_found
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Chat IPC channels are defined as typed constants in shared/types.ts | VERIFIED | CHAT_SEND, CHAT_ABORT, CHAT_TOKEN, CHAT_DONE, CHAT_ERROR, SCHEMA_FETCH, SCHEMA_LIST_DATABASES, SUBAGENT_LIST, SUBAGENT_RUN all present in IpcChannels const |
| 2 | Zustand chat store manages messages array with immer mutations | VERIFIED | useChatStore uses immer middleware; addUserMessage, addAssistantMessagePlaceholder, appendToken, finalizeMessage all mutate state via immer |
| 3 | Main process streams Bedrock tokens to renderer via webContents.send | VERIFIED | chat.ts streams via win.webContents.send(IpcChannels.CHAT_TOKEN, delta) in agentic loop; also sends CHAT_DONE and CHAT_ERROR |
| 4 | Preload bridge exposes chat send/abort/token/done/error IPC methods | VERIFIED | sendChat, abortChat, onChatToken, onChatDone, onChatError, removeChatListeners all present in preload/index.ts |
| 5 | Active stream is aborted before starting a new one | VERIFIED | chat.ts checks activeAbort and calls activeAbort.abort() before starting new CHAT_SEND handler |
| 6 | Chat is the default home screen — replaces WelcomeState | VERIFIED | app-store.ts NavPage is 'chat' | 'settings', default is 'chat'; AppShell renders ChatScreen when currentPage === 'chat'; WelcomeState not referenced |
| 7 | User can type a message and see it appear in the chat thread | VERIFIED | ChatInput calls onSubmit which calls addUserMessage(); MessageList renders messages array; timeline merge renders MessageBubble for each message |
| 8 | Assistant responses stream token-by-token into the chat window | VERIFIED | App.tsx registers onChatToken once at mount; handler calls appendToken(msgId, delta); MessageBubble renders with Streamdown mode='streaming' when isStreaming=true |
| 9 | User can click Stop to abort a streaming response | VERIFIED | ChatInput shows Stop button (Square icon, red outline) when isStreaming=true; calls getElectronAPI().abortChat(); main process aborts AbortController |
| 10 | Markdown tables, code blocks, and formatting render correctly | VERIFIED | MessageBubble uses Streamdown component for assistant messages; mode='static' when not streaming; streamdown/styles.css imported in globals.css |
| 11 | Shift+Enter inserts newline, Enter sends message | VERIFIED | ChatInput onKeyDown: if Enter and !shiftKey → preventDefault + submit; Shift+Enter falls through to default |
| 12 | Chat auto-scrolls to bottom on new messages | VERIFIED | MessageList useEffect calls bottomRef.current?.scrollIntoView({behavior:'smooth'}) on messages.length, subagentResults.length, lastMessage.content.length |
| 13 | Sidebar shows Chat nav item at top, Settings below | FAILED | Sidebar has no Chat nav button rendering MessageSquare. MessageSquare is imported but unused (TypeScript error: declared but never read). Chat access is via New Chat button and session history, not a dedicated nav item. |
| 14 | Main process can list databases and fetch schema from MCP | VERIFIED | mcp-schema.ts exports listDatabases, fetchSchemaContext; uses base_databaseList, base_tableList, base_columnDescription MCP tools; SSE parsing, 4K char cap, session lifecycle all present |
| 15 | Schema context is injected into Claude system prompt | FAILED (changed) | The pre-fetched schema injection path was replaced by an agentic MCP tool-use loop in Plan 05. ChatScreen uses static SYSTEM_PROMPT. Claude discovers schema dynamically via MCP tools during the conversation. DatabaseSelector.tsx exists but is orphaned — its store methods (setSchemaContext, setActiveDatabaseName, activeDatabaseName) do not exist on ChatState. |
| 16 | User can see a collapsible subagent launcher panel in the sidebar | VERIFIED | SubagentLauncher component present in Sidebar; collapsible via isOpen state; default open |
| 17 | Subagent cards in sidebar show name and one-line description | VERIFIED | SubagentLauncher fetches agents via listSubagents() on mount; renders name (14px, #F5F5F5) and description (12px, #A3A3A3) per card |
| 18 | Clicking a subagent launches it and inserts a result card into the chat thread | VERIFIED | handleRun calls runSubagent(), on success calls useChatStore.getState().addSubagentResult(); MessageList renders SubagentResultCard in unified timeline |
| 19 | Subagent result card is visually distinct with colored border and header | VERIFIED | SubagentResultCard has border: '2px solid #F37440', orange header bar with Bot icon and agent name, #262626 content area with Streamdown |
| 20 | Subagent runs in isolated context | VERIFIED | ipc/subagent.ts passes {activeDatabaseName: null, schemaContext: null} context; echo subagent makes no API call; result is content string only, not appended to messages array |
| 21 | User can select a database from a dropdown/list in the sidebar | FAILED | DatabaseSelector exists at src/renderer/src/components/DatabaseSelector.tsx but is NOT imported in Sidebar.tsx. The component references chatStore.activeDatabaseName, setActiveDatabaseName(), and setSchemaContext() — none of which exist on ChatState. Three TypeScript type errors. Component is an orphan. |

**Score:** 16/21 truths verified (3 failed)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/shared/types.ts` | ChatMessage type, IPC channel additions, ElectronAPI chat methods | VERIFIED | All channels present; ChatMessage, MessageRole, ElectronAPI with all 8 chat methods |
| `src/shared/subagent-types.ts` | SubagentDefinition, SubagentContext, SubagentRunResult | VERIFIED | All three interfaces present and complete |
| `src/renderer/src/store/chat-store.ts` | Zustand+immer store with message lifecycle | VERIFIED | useChatStore with immer, full session management, addUserMessage/appendToken/finalizeMessage |
| `src/main/ipc/chat.ts` | Bedrock streaming handler with STS credential refresh | VERIFIED | Agentic tool-use loop with getBedrockClient, STS AssumeRole, stream via webContents.send |
| `src/preload/index.ts` | Chat IPC bridge methods | VERIFIED | sendChat, abortChat, onChatToken, onChatDone, onChatError, removeChatListeners all present |
| `src/renderer/src/features/chat/ChatScreen.tsx` | Full-page chat view composing MessageList + ChatInput | VERIFIED | 57 lines; composes MessageList + ChatInput; sendMessage wired to store and IPC |
| `src/renderer/src/features/chat/MessageList.tsx` | Scrollable message list with auto-scroll | VERIFIED | scrollIntoView on bottomRef; unified timeline; SubagentResultCard rendering |
| `src/renderer/src/features/chat/MessageBubble.tsx` | Individual message rendering with Streamdown | VERIFIED | Streamdown with mode/isAnimating props for assistant; dark card for user |
| `src/renderer/src/features/chat/ChatInput.tsx` | Bottom input bar with Send/Stop toggle | VERIFIED | Enter/Shift+Enter; Send/Stop toggle; abortChat on Stop |
| `src/main/services/mcp-schema.ts` | MCP tool call functions: listDatabases, fetchSchemaContext | VERIFIED | Both exported; also exports callMcpTool, discoverMcpTools; SSE parsing; session lifecycle; 4K cap |
| `src/main/ipc/schema.ts` | IPC handlers for SCHEMA_FETCH and SCHEMA_LIST_DATABASES | VERIFIED | registerSchemaHandlers exports both handlers with graceful error degradation |
| `src/main/subagents/registry.ts` | Registry of available subagents | VERIFIED | getSubagentRegistry and runSubagent exported; echo subagent registered |
| `src/main/subagents/echo.ts` | Echo test subagent implementation | VERIFIED | runEchoSubagent returns schema context status; echoSubagentDef exported |
| `src/main/ipc/subagent.ts` | Subagent IPC handlers | VERIFIED | SUBAGENT_LIST and SUBAGENT_RUN registered; agentId validation; isolated context |
| `src/renderer/src/features/chat/SubagentResultCard.tsx` | Rich card with colored border | VERIFIED | Orange border, header bar, Bot icon, Streamdown content area |
| `src/renderer/src/components/SubagentLauncher.tsx` | Collapsible sidebar panel | VERIFIED | Fetches on mount; collapsible; running state indicator |
| `src/renderer/src/components/DatabaseSelector.tsx` | Database picker wired to listDatabases and chat store | ORPHANED | File exists (164 lines, substantive) but is not imported in Sidebar.tsx. Calls store methods that no longer exist on ChatState. TypeScript type errors at lines 12, 34, 39, 41, 45. |
| `src/main/ipc/chat-history.ts` | Chat session persistence | VERIFIED | Registers CHAT_SESSIONS_LIST, CHAT_SESSION_SAVE, CHAT_SESSION_DELETE, chat:session-load handlers |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| src/main/ipc/chat.ts | src/main/ipc/claude.ts | getDecryptedAwsCredentials() | WIRED | Line 4: import { getDecryptedAwsCredentials } from './claude' |
| src/preload/index.ts | src/shared/types.ts | IpcChannels.CHAT_SEND | WIRED | Line 2: import { IpcChannels } from '../shared/types'; CHAT_SEND used in sendChat |
| src/renderer/src/features/chat/ChatScreen.tsx | src/renderer/src/store/chat-store.ts | useChatStore | WIRED | Lines 1, 18-20: useChatStore subscriptions and getState() calls |
| src/renderer/src/App.tsx | src/preload/index.ts | IPC listener registration | WIRED | onChatToken, onChatDone, onChatError registered in useEffect with cleanup |
| src/renderer/src/components/AppShell.tsx | src/renderer/src/features/chat/ChatScreen.tsx | conditional render | WIRED | Line 14: {currentPage === 'chat' && <ChatScreen />} |
| src/main/services/mcp-schema.ts | src/main/services/mcp-manager.ts | getMcpUrl() | WIRED | Line 1: import { getMcpUrl } from './mcp-manager' |
| src/main/ipc/schema.ts | src/main/services/mcp-schema.ts | listDatabases/fetchSchemaContext | WIRED | Lines 3: import { listDatabases, fetchSchemaContext } |
| src/renderer/src/components/SubagentLauncher.tsx | src/renderer/src/features/chat/ChatScreen.tsx | addSubagentResult via chat store | WIRED | Line 42: useChatStore.getState().addSubagentResult() |
| src/main/ipc/subagent.ts | src/main/subagents/registry.ts | getSubagentRegistry | WIRED | Line 3: import { getSubagentRegistry, runSubagent } |
| src/renderer/src/components/DatabaseSelector.tsx | src/preload/index.ts | listDatabases/fetchSchemaContext | ORPHANED | DatabaseSelector calls these correctly via getElectronAPI(), but the component is not mounted anywhere |
| src/renderer/src/components/DatabaseSelector.tsx | src/renderer/src/store/chat-store.ts | setSchemaContext/setActiveDatabaseName | BROKEN | Methods do not exist on ChatState; TypeScript errors at DatabaseSelector.tsx:12,34,39,41,45 |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| ChatScreen.tsx | messages (from store) | chat-store.ts messages[] populated by appendToken from CHAT_TOKEN IPC | Yes — Bedrock stream tokens via webContents.send | FLOWING |
| MessageList.tsx | timeline (messages + subagentResults) | useChatStore subscriptions | Yes — both arrays populated from real IPC events | FLOWING |
| SubagentLauncher.tsx | agents[] | getElectronAPI().listSubagents() → registry.ts | Yes — registry returns real SubagentDefinition array | FLOWING |
| DatabaseSelector.tsx | databases[] | getElectronAPI().listDatabases() → mcp-schema.ts | Yes — MCP tool call — but component is orphaned and store methods broken | HOLLOW_PROP |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Build produces output | npm run build | Exit 0, renderer bundle 1714KB | PASS |
| All handler registrations present in main/index.ts | grep registerChatHandlers\|registerSchemaHandlers\|registerSubagentHandlers main/index.ts | Lines 7-10: all 4 handler imports; lines 67-70: all registered in app.whenReady | PASS |
| useChatStore exports expected functions | Read chat-store.ts | addUserMessage, appendToken, finalizeMessage, addSubagentResult, newChat, saveCurrentSession all present | PASS |
| IPC channel constants all defined | Read shared/types.ts | CHAT_SEND, CHAT_ABORT, CHAT_TOKEN, CHAT_DONE, CHAT_ERROR, SCHEMA_FETCH, SCHEMA_LIST_DATABASES, SUBAGENT_LIST, SUBAGENT_RUN, CHAT_SESSIONS_LIST, CHAT_SESSION_SAVE, CHAT_SESSION_DELETE all present | PASS |
| DatabaseSelector TypeScript errors | tsc -p tsconfig.web.json --noEmit | 3 type errors in DatabaseSelector.tsx (activeDatabaseName, setActiveDatabaseName, setSchemaContext not on ChatState) | FAIL |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| CHAT-01 | 02-01, 02-02 | User can send freeform messages and receive Claude responses | SATISFIED | sendChat IPC; Bedrock streaming; App.tsx token listener |
| CHAT-02 | 02-01, 02-02 | Chat responses stream in real-time | SATISFIED | CHAT_TOKEN events; appendToken in store; Streamdown animated rendering |
| CHAT-03 | 02-03, 02-04 | Chat has access to Teradata schema context via MCP | SATISFIED (changed mechanism) | Agentic tool-use loop in chat.ts calls discoverMcpTools and executeTool; Claude calls MCP directly. Pre-fetched schema path removed but goal achieved. |
| CHAT-04 | 02-01, 02-02 | Session memory — follow-up questions retain conversation context | SATISFIED | ChatScreen builds messagesForApi from full messages array; chat-history.ts persists sessions |
| CHAT-05 | 02-02 | Rich formatted output — markdown, code blocks rendered | SATISFIED | MessageBubble uses Streamdown with mode/isAnimating; streamdown/styles.css imported |
| CHAT-06 | 02-03 | User can translate natural language to Teradata SQL | SATISFIED | Claude responds to SQL requests; code blocks rendered via Streamdown; "Present SQL as copy-paste" in SYSTEM_PROMPT |
| AGEN-01 | 02-04 | User can browse and launch prebuilt subagents from launcher UI | SATISFIED | SubagentLauncher in Sidebar; fetches registry on mount; Echo Test clickable |
| AGEN-02 | 02-04 | Subagent results appear as rich formatted messages in chat thread | SATISFIED | SubagentResultCard with Streamdown content appears in unified timeline in MessageList |
| AGEN-03 | 02-04 | Subagents run in isolated context | SATISFIED | ipc/subagent.ts runs runSubagent with null context; result not added to messages array |
| AGEN-04 | 02-04 | Subagent output includes actionable recommendations | NEEDS HUMAN | Echo subagent returns schema status (test scaffold only). Real recommendations come from Phase 3 subagents. Agentic chat itself provides actionable Teradata guidance. |
| AGEN-05 | 02-02, 02-04 | SQL recommendations surfaced for copy-paste, never auto-executed | SATISFIED | SYSTEM_PROMPT: "Never execute DDL or DML automatically. Present SQL modifications as copy-paste only." Streamdown renders code blocks with copy button. |
| UIBR-03 | 02-02, 02-04 | Chat interface has sidebar with subagent launcher | SATISFIED | SubagentLauncher in Sidebar with collapsible panel; subagent cards rendered |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/renderer/src/components/DatabaseSelector.tsx` | 12, 34, 39, 41, 45 | Calls non-existent store methods: activeDatabaseName, setActiveDatabaseName, setSchemaContext | Blocker | Component will throw TypeScript errors and runtime errors if ever mounted |
| `src/renderer/src/components/Sidebar.tsx` | 2 | MessageSquare imported but unused | Warning | Dead import, TypeScript warning |
| `src/renderer/src/store/chat-store.ts` | 134 | Uses `(window as any).electronAPI` for IPC calls inside store (loadSession, deleteSession, etc.) | Warning | Bypasses TypeScript types; should use getElectronAPI() helper from lib/ipc.ts |

### Human Verification Required

#### 1. Streaming Response Display

**Test:** Launch the app, type a message, press Enter
**Expected:** Message appears right-aligned in dark card; assistant response streams token-by-token into chat window
**Why human:** Cannot test Bedrock streaming without live AWS credentials and running Electron app

#### 2. MCP Agentic Tool-Use

**Test:** Ask "What databases are on this Teradata system?" with MCP server running
**Expected:** Claude invokes base_databaseList MCP tool, shows `Querying Teradata: base_databaseList...` inline, returns actual database list
**Why human:** Requires live Teradata MCP server (http://127.0.0.1:8001/mcp) and Bedrock credentials

#### 3. Stop Button Behavior

**Test:** Start a long streaming response, click the Stop (square) button
**Expected:** Response stops mid-generation; stop reason is 'abort'; no error displayed
**Why human:** Requires live streaming session

#### 4. Markdown Rendering Quality

**Test:** Ask Claude to "show a complex SQL query with a JOIN and a subquery"
**Expected:** Code block renders with syntax highlighting, copy button is visible and functional
**Why human:** Visual quality of Streamdown rendering requires human inspection

#### 5. Echo Subagent End-to-End

**Test:** Click Echo Test in Subagents panel
**Expected:** Orange-bordered result card appears in chat thread with "Echo Subagent Result" header, shows schema context status
**Why human:** Requires running app with live subagent IPC

#### 6. Chat Session Persistence

**Test:** Send several messages, close and reopen the app, check sidebar
**Expected:** Previous session appears in "Recent Chats" list; clicking it restores the conversation
**Why human:** Requires electron-store persistence to be tested across app restarts

#### 7. AGEN-04 Actionable Recommendations

**Test:** Ask Claude "What tables in the [database] database have potential compression candidates?"
**Expected:** Claude uses MCP tools to inspect actual tables, returns specific actionable SQL recommendations with table names
**Why human:** AGEN-04 requires human judgment on whether recommendations are "actionable" vs raw data

### Gaps Summary

Three gaps were found, all traceable to the Plan 05 architectural refactoring that replaced pre-fetched schema context with an agentic MCP tool-use loop:

**Gap 1 — DatabaseSelector orphan (Blocker):** `src/renderer/src/components/DatabaseSelector.tsx` was built in Plan 04 and depended on `setSchemaContext`, `setActiveDatabaseName`, and `activeDatabaseName` on `ChatState`. Plan 05 removed these fields when it pivoted to agentic tool-use for schema discovery. DatabaseSelector was not updated or removed — it now references non-existent store methods (3 TypeScript type errors) and is not imported in Sidebar.tsx. If ever mounted, it would crash at runtime.

**Gap 2 — Chat nav item removed (Warning):** Plan 02 added a Chat nav button with MessageSquare icon. Plan 05 replaced this with a New Chat button and session history list. The requirement UIBR-03 ("sidebar with subagent launcher") is still met, and users can still navigate to chat. The `MessageSquare` import remains but is unused. This is a minor regression — the requirement is functionally satisfied but the specified UI element changed.

**Gap 3 — Schema injection path replaced (Architectural change):** CHAT-03 is satisfied via a better mechanism (agentic MCP tools), but the originally planned data path (DatabaseSelector -> setSchemaContext -> buildSystemPrompt) is broken and the old code was not cleaned up. The static SYSTEM_PROMPT in ChatScreen tells Claude to use its MCP tools to discover schema — this works, but the DatabaseSelector orphan is a code quality issue.

**Recommended fixes:**
1. Remove `DatabaseSelector.tsx` or rewrite it with local state (not chat store). If database selection UI is still wanted (for filtering subagent scope in Phase 3), redesign it without the dead store methods.
2. Remove unused `MessageSquare` import from Sidebar.tsx.
3. Optionally, document the schema-awareness approach change in CONTEXT.md or a decision record.

---

_Verified: 2026-03-26T02:00:00Z_
_Verifier: Claude (gsd-verifier)_
