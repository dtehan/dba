# Architecture Research

**Domain:** Local desktop AI chat application with specialized DBA subagents
**Researched:** 2026-03-24
**Confidence:** HIGH (core patterns well-established; Electron IPC and subagent routing extensively documented)

## Standard Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         RENDERER PROCESS                             │
│   ┌──────────────────────────────────────────────────────────────┐  │
│   │                    React Chat UI                              │  │
│   │   ┌──────────────┐  ┌────────────────┐  ┌────────────────┐  │  │
│   │   │ Chat Thread  │  │ Subagent Panel │  │ Credentials    │  │  │
│   │   │ (messages,   │  │ (launch, select│  │ Config UI      │  │  │
│   │   │  streaming)  │  │  prebuilt)     │  │                │  │  │
│   │   └──────┬───────┘  └───────┬────────┘  └───────┬────────┘  │  │
│   └──────────┼───────────────── │─────────────────── │───────────┘  │
│              │     contextBridge / preload.js         │              │
├──────────────┼──────────────────┼────────────────────┼──────────────┤
│                         MAIN PROCESS (Node.js)                       │
│   ┌──────────┴───────┐  ┌───────┴────────┐  ┌───────┴────────────┐ │
│   │  Chat Orchestrator│  │ Subagent Router│  │ Credential Store   │ │
│   │  - conversation  │  │ - intent detect│  │ - safeStorage      │ │
│   │    history       │  │ - dispatch     │  │ - keychain bridge  │ │
│   │  - streaming SSE │  │ - state machine│  │                    │ │
│   └────────┬─────────┘  └───────┬────────┘  └────────────────────┘ │
│            │                    │                                    │
│   ┌────────┴────────────────────┴──────────┐                        │
│   │              Service Layer              │                        │
│   │   ┌──────────────┐  ┌───────────────┐  │                        │
│   │   │  Claude API  │  │ Teradata      │  │                        │
│   │   │  Service     │  │ Service       │  │                        │
│   │   │  (HTTP/SSE)  │  │ (teradatasql) │  │                        │
│   │   └──────────────┘  └───────────────┘  │                        │
│   └─────────────────────────────────────────┘                       │
├─────────────────────────────────────────────────────────────────────┤
│                      EXTERNAL SERVICES                               │
│   ┌──────────────────────┐    ┌──────────────────────────────────┐  │
│   │   Claude API         │    │   Teradata Instance              │  │
│   │   (Anthropic)        │    │   (on-prem or VantageCloud)      │  │
│   └──────────────────────┘    └──────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Communicates With |
|-----------|---------------|-------------------|
| React Chat UI | Renders messages, streams tokens, provides subagent launch panel, manages input | Main process via IPC/preload |
| Chat Orchestrator | Maintains conversation history, decides freeform vs. subagent route, assembles Claude API calls | Claude API Service, Subagent Router |
| Subagent Router | Detects intent for specialized subagents, dispatches execution, tracks active-vs-idle state | Chat Orchestrator, individual subagent modules |
| Subagent Modules (Security, MVC, Stats) | Isolated prompt chains that query Teradata, send data to Claude, return structured analysis | Teradata Service, Claude API Service |
| Claude API Service | Wraps Anthropic SDK, handles streaming SSE, manages request construction | Claude API (external), Chat Orchestrator, Subagent modules |
| Teradata Service | Manages connection lifecycle, executes queries, handles errors and connection pooling | teradatasql driver, Subagent modules |
| Credential Store | Encrypts and persists Claude API key + Teradata credentials using OS secure storage | Main process safeStorage (Electron), Config UI |
| Preload / contextBridge | Exposes safe, namespaced IPC API to renderer — sole bridge between renderer and main | Renderer process, Main process ipcMain handlers |

## Recommended Project Structure

```
src/
├── main/                        # Electron main process (Node.js)
│   ├── index.ts                 # App entry, window creation, lifecycle
│   ├── preload.ts               # contextBridge — renderer API surface
│   ├── ipc/                     # IPC handlers registered on ipcMain
│   │   ├── chat.ts              # chat:send, chat:stream-cancel
│   │   ├── subagents.ts         # subagent:launch, subagent:list
│   │   └── credentials.ts       # credentials:save, credentials:load
│   ├── orchestrator/
│   │   ├── chat-orchestrator.ts # Conversation state, routing decision
│   │   └── subagent-router.ts   # Intent detection, dispatch, state machine
│   ├── subagents/               # One file per subagent
│   │   ├── base-subagent.ts     # Abstract: execute() → SubagentResult
│   │   ├── security-audit.ts
│   │   ├── mvc-analysis.ts
│   │   └── stats-analysis.ts
│   ├── services/
│   │   ├── claude.ts            # Anthropic SDK wrapper, streaming
│   │   └── teradata.ts          # teradatasql wrapper, query execution
│   └── store/
│       └── credentials.ts       # safeStorage encryption/decryption
│
└── renderer/                    # React UI (Chromium renderer process)
    ├── App.tsx
    ├── components/
    │   ├── ChatThread.tsx        # Message list, streaming token display
    │   ├── MessageBubble.tsx     # Renders user/assistant messages
    │   ├── SubagentResult.tsx    # Rich result card for subagent output
    │   ├── SubagentPanel.tsx     # Launch panel, prebuilt subagent list
    │   └── CredentialsForm.tsx   # Settings/config UI
    ├── hooks/
    │   ├── useChat.ts            # Chat send/receive, streaming state
    │   └── useSubagents.ts       # Subagent launch/status
    └── ipc.ts                   # Typed wrapper around window.electronAPI
```

### Structure Rationale

- **main/ vs renderer/**: Strict process separation is mandatory for Electron security. All Node.js, file system, network, and credentials code lives in main. The renderer is treated as an untrusted web page.
- **subagents/**: Each subagent is a self-contained module with a single `execute()` entry point. Adding a new subagent requires only dropping a file here and registering it in the router — zero changes elsewhere.
- **services/**: Claude and Teradata are external I/O dependencies. Isolating them behind service wrappers makes testing and credential injection straightforward.
- **ipc/**: Grouping IPC handlers by domain (chat, subagents, credentials) prevents the monolithic handler file that grows unmanageable.

## Architectural Patterns

### Pattern 1: Orchestrator-Router with State Machine

**What:** A central Chat Orchestrator receives every user message and classifies it: freeform conversation (handled inline by Claude) or subagent request (dispatched to the Subagent Router). The Subagent Router maintains two explicit states — IDLE and TASK_ACTIVE — to avoid mode confusion during multi-turn subagent interactions.

**When to use:** Always in this app. Every message flows through the same entry point; routing logic determines the path, not the UI component.

**Trade-offs:** Slightly more initial complexity than a simple passthrough, but avoids the "generalist agent fails at complex workflows" problem and allows each specialist to maintain a narrow, high-quality prompt.

**Example:**
```typescript
// orchestrator/chat-orchestrator.ts
async function handleMessage(userMessage: string): Promise<void> {
  conversationHistory.push({ role: 'user', content: userMessage });

  const intent = await subagentRouter.detectIntent(userMessage);

  if (intent.type === 'freeform') {
    // Stream directly via Claude API with full conversation history
    await claudeService.streamMessage(conversationHistory, onToken);
  } else {
    // Dispatch to specialist — subagent runs isolated, returns structured result
    const result = await subagentRouter.dispatch(intent.subagentId);
    conversationHistory.push({ role: 'assistant', content: result.summary });
  }
}
```

### Pattern 2: Isolated Subagent Execution (Fresh Context per Run)

**What:** Each subagent runs in its own isolated call to Claude with a bespoke system prompt — it does NOT receive the conversation history. The subagent: (1) queries Teradata for relevant data, (2) sends that data + its specialist system prompt to Claude, (3) returns a structured result. Only the final summary surfaces back into the main conversation thread.

**When to use:** Every subagent invocation. Isolation prevents context pollution (the main conversation's chit-chat does not confuse the analyst prompt) and keeps token costs predictable.

**Trade-offs:** Subagents cannot self-direct across multiple turns; they are single-shot analysts. This is correct for v1 — the DBA triggers them explicitly rather than having them run autonomously.

**Example:**
```typescript
// subagents/base-subagent.ts
abstract class BaseSubagent {
  abstract systemPrompt: string;
  abstract gatherData(td: TeradataService): Promise<Record<string, unknown>>;

  async execute(td: TeradataService, claude: ClaudeService): Promise<SubagentResult> {
    const data = await td.query(this.buildQuery());
    // Fresh context — no conversation history passed
    const analysis = await claude.completeMessage([
      { role: 'user', content: JSON.stringify(data) }
    ], this.systemPrompt);
    return this.parseResult(analysis);
  }
}
```

### Pattern 3: IPC Bridge with Streaming Events

**What:** The renderer sends a single `chat:send` IPC invoke call. The main process processes asynchronously and pushes incremental `chat:token` events back to the renderer as Claude streams. This gives a responsive streaming UI without blocking the renderer on a long HTTP call.

**When to use:** All Claude interactions — both freeform chat and subagent results should feel responsive. Subagents may emit progress events ("Querying Teradata...", "Analyzing results...") before the final output.

**Trade-offs:** Slightly more complex than request/response IPC but necessary for good UX when queries take 5-30 seconds.

**Example:**
```typescript
// main/ipc/chat.ts
ipcMain.handle('chat:send', async (event, message: string) => {
  const webContents = event.sender;
  await orchestrator.handleMessage(message, {
    onToken: (token) => webContents.send('chat:token', token),
    onSubagentProgress: (msg) => webContents.send('chat:progress', msg),
    onComplete: (full) => webContents.send('chat:complete', full),
  });
});
```

## Data Flow

### Freeform Chat Flow

```
User types message
    ↓
renderer: chat input → ipc.send('chat:send', message)
    ↓
main: ipc/chat.ts handler receives message
    ↓
main: ChatOrchestrator.handleMessage()
    ↓
main: intent detection → "freeform"
    ↓
main: ClaudeService.streamMessage(history, systemPrompt)
    ↓ (HTTP/SSE to Anthropic)
Claude API → streaming tokens
    ↓
main: onToken callback → webContents.send('chat:token', token)
    ↓
renderer: ChatThread appends token to last message bubble
```

### Subagent Execution Flow

```
User clicks "Run Security Audit" (or message classified as subagent intent)
    ↓
renderer: ipc.invoke('subagent:launch', 'security-audit')
    ↓
main: SubagentRouter.dispatch('security-audit')
    ↓ sets state = TASK_ACTIVE
main: SecurityAuditSubagent.execute()
    ├── webContents.send('chat:progress', 'Querying Teradata...')
    ├── TeradataService.query(securityQueries[])
    │       ↓ (TCP to Teradata via teradatasql)
    │   Teradata → result sets (roles, access logs, user perms, etc.)
    ├── webContents.send('chat:progress', 'Analyzing with Claude...')
    ├── ClaudeService.completeMessage(data, specialistSystemPrompt)
    │       ↓ (HTTP to Anthropic — fresh context, no history)
    │   Claude → structured JSON analysis
    └── returns SubagentResult { summary, findings[], severity }
    ↓
main: ChatOrchestrator appends result to conversation history
main: webContents.send('chat:complete', { type: 'subagent', result })
    ↓
renderer: SubagentResult component renders rich card
    ↓ sets state = IDLE
```

### State Management (Renderer)

```
ChatStore (Zustand or React context)
    ├── messages: Message[]         ← append on chat:token / chat:complete
    ├── streamingContent: string    ← reset on chat:send, grow on chat:token
    ├── isStreaming: boolean        ← true between send and complete
    └── activeSubagent: string|null ← set on subagent:launch, cleared on complete

Components subscribe to relevant slices — ChatThread only re-renders on messages change.
```

## Suggested Build Order

Dependencies drive this order. Each layer depends only on what is below it.

| Order | Component | Dependency | Why First |
|-------|-----------|------------|-----------|
| 1 | Electron shell + preload | None | Everything else needs a window and IPC bridge |
| 2 | Credential Store | Electron safeStorage | Services need credentials before they can connect |
| 3 | Teradata Service | Credentials | Validate connectivity before building on top |
| 4 | Claude API Service | Credentials, streaming IPC | Validate streaming before orchestrator uses it |
| 5 | Chat Orchestrator (freeform) | Claude Service, IPC | Get basic chat working end-to-end |
| 6 | Chat UI | IPC bridge, streaming events | Can now show a real conversation |
| 7 | Base Subagent + one concrete subagent | Teradata + Claude services | Proves the pattern with real data |
| 8 | Subagent Router + intent detection | Chat Orchestrator, subagent modules | Integrates routing into chat flow |
| 9 | Subagent Panel UI + SubagentResult card | Subagent Router IPC | Surfaces subagents in the UI |
| 10 | Remaining subagents (MVC, Stats) | Base Subagent pattern | Drop-in once pattern is validated |

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| Claude API | HTTP/SSE via `@anthropic-ai/sdk` (Node.js) | Runs in main process only — API key never reaches renderer. Use `stream: true` for all interactions. |
| Teradata | `teradatasql` Python driver via `child_process` OR direct Node.js via ODBC | See note below on driver choice |

**Teradata driver choice:** `teradatasql` is a Python package. If the app is Electron (Node.js main process), the simplest approach is `teradatasql` called via a Python child process spawned from main, with JSON-serialized results piped back. Alternatively, use `node-odbc` with Teradata ODBC drivers. The Python subprocess approach is lower friction for DBA tooling because Teradata's Python ecosystem (including `teradatasqlalchemy`) is better documented. The ODBC approach requires the DBA to install native ODBC drivers separately.

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| Renderer ↔ Main | Electron IPC via contextBridge | Never expose raw `ipcRenderer` — always use preload API. Keep exposed surface minimal. |
| Chat Orchestrator ↔ Subagent Router | Direct function call (same process) | No IPC needed — both in main process |
| Subagent ↔ Claude API Service | Direct function call | Services are injected into subagents via constructor |
| Subagent ↔ Teradata Service | Direct function call | Same pattern — service injected |
| Main Process ↔ Python (if subprocess approach) | stdin/stdout JSON protocol via `child_process.spawn` | The Python process runs `teradatasql`, returns rows as JSON, exits. Connection pooling is handled by keeping a long-lived Python process running. |

## Anti-Patterns

### Anti-Pattern 1: Monolithic Claude Call

**What people do:** Pass the full conversation history plus all Teradata query context into a single giant Claude message.

**Why it's wrong:** Security audit data alone can be tens of thousands of rows. Stuffing it into the main conversation: (a) consumes context window rapidly, (b) contaminates subsequent freeform chat with stale DBA analysis, (c) makes costs unpredictable.

**Do this instead:** Subagents run isolated calls. Only the human-readable summary returns to the conversation history. Raw data stays in the subagent's ephemeral context and is discarded.

### Anti-Pattern 2: Credentials in Renderer Process

**What people do:** Store the Claude API key or Teradata password in renderer state or localStorage for convenience.

**Why it's wrong:** The renderer is a Chromium process — treated as untrusted. Credentials in renderer state are reachable from any injected script, and Electron's contextIsolation does not protect renderer memory from XSS.

**Do this instead:** Credentials are loaded once in the main process at startup via `safeStorage`. IPC calls never return the raw credential value — they return only connection status. All authenticated calls (Claude, Teradata) originate from the main process.

### Anti-Pattern 3: Synchronous IPC for Long Operations

**What people do:** Use `ipcRenderer.invoke` and await the entire Teradata + Claude round trip before updating the UI.

**Why it's wrong:** A security audit might query 15 tables and wait 20+ seconds for Claude analysis. The UI freezes; the DBA thinks the app crashed.

**Do this instead:** Fire-and-forget with progress events. `chat:send` returns immediately; progress, tokens, and results arrive as separate `send` events. The UI shows "Querying Teradata..." then "Analyzing..." then renders the result card.

### Anti-Pattern 4: One God Subagent

**What people do:** Build one subagent with a long system prompt that tries to handle security auditing AND MVC analysis AND statistics — switching behavior based on a parameter.

**Why it's wrong:** The specialist system prompt becomes incoherent, context leaks between domains, and debugging is hard ("why did the security audit mention MVC?"). Token costs for each call carry unused instructions.

**Do this instead:** One file per subagent, one system prompt per subagent. The router selects the right specialist. Adding a fourth subagent never touches the existing three.

## Scaling Considerations

This is a single-user local desktop tool. Traditional scaling (multiple users, load balancing) does not apply. The relevant "scaling" dimensions are:

| Concern | Approach |
|---------|----------|
| Large Teradata result sets | Stream query results, summarize in chunks. Avoid sending raw millions-of-rows to Claude. Subagent should aggregate/sample before sending. |
| Multiple subagents running in sequence | Chain them explicitly with progress events. Do not run in parallel v1 — keep the state machine simple. |
| Growing conversation history | Implement a rolling window or summarization pass after ~20 turns to prevent context window exhaustion on long sessions. |
| New subagents | The base class + router registry pattern supports unlimited subagents with zero changes to orchestration logic. |

## Sources

- [Sub-Agent Orchestration with Spring AI](https://gaetanopiazzolla.github.io/java/ai/2026/02/09/sub-agent-pattern.html) — MEDIUM confidence (pattern validated against multiple sources)
- [The Orchestrator Pattern: Routing Conversations to Specialized AI Agents](https://dev.to/akshaygupta1996/the-orchestrator-pattern-routing-conversations-to-specialized-ai-agents-33h8) — MEDIUM confidence
- [AI Agent Architecture: Build Systems That Work in 2026](https://redis.io/blog/ai-agent-architecture/) — MEDIUM confidence
- [Advanced Electron.js Architecture — LogRocket](https://blog.logrocket.com/advanced-electron-js-architecture/) — HIGH confidence
- [Electron Security Documentation](https://www.electronjs.org/docs/latest/tutorial/security) — HIGH confidence
- [Teradata SQL Driver for Python (teradatasql)](https://developers.teradata.com/quickstarts/create-applications/teradatasql/) — HIGH confidence
- [Streaming Messages — Claude API Docs](https://platform.claude.com/docs/en/build-with-claude/streaming) — HIGH confidence
- [AI Agent Orchestration Patterns — Azure Architecture Center](https://learn.microsoft.com/en-us/azure/architecture/ai-ml/guide/ai-agent-design-patterns) — MEDIUM confidence
- [Tauri vs Electron: The Complete Developer's Guide (2026)](https://blog.nishikanta.in/tauri-vs-electron-the-complete-developers-guide-2026) — MEDIUM confidence

---
*Architecture research for: Local desktop AI chat application with Teradata DBA subagents*
*Researched: 2026-03-24*
