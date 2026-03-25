# Phase 02: Chat - Research

**Researched:** 2026-03-25
**Domain:** Electron IPC streaming, Anthropic Bedrock SDK streaming, MCP JSON-RPC tool calls, React chat UI, Zustand state management
**Confidence:** HIGH

## Summary

Phase 2 delivers the primary user interface: a streaming chat powered by Claude via AWS Bedrock, with schema context injected from the Teradata MCP server, session memory managed in Zustand, and a subagent launcher scaffold. All core technologies were decided in Phase 1 and are already installed (`@anthropic-ai/bedrock-sdk`, Zustand, shadcn/ui). This phase is an integration phase — no new major dependencies beyond `streamdown` and `immer`.

The streaming pipeline is: Bedrock SDK `.stream()` in main process → `.on('text')` callback → `webContents.send('chat:token', delta)` → preload `ipcRenderer.on` → renderer Zustand store `appendToken(id, delta)`. The MCP schema context pipeline is: main process `fetch()` to MCP HTTP endpoint with JSON-RPC `tools/call` → parse result → inject as structured text block in system message.

The key architectural decision is already locked: streaming goes through Electron IPC (main process to renderer via `webContents.send`), not through a direct renderer connection to Bedrock. This keeps AWS credentials exclusively in the main process.

**Primary recommendation:** Build streaming IPC first (Wave 1), then markdown rendering + schema injection (Wave 2), then subagent scaffold (Wave 3). Validate each wave before proceeding — streaming IPC is the hardest part and must be solid.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Chat UI & Input Design**
- Chat IS the home screen — replaces WelcomeState as default page. Sidebar gets "Chat" nav item at top, "Settings" below.
- Fixed bottom input bar with Send button, Shift+Enter for newlines — standard AI chat UX
- User messages right-aligned with subtle dark card, assistant messages left-aligned full-width with markdown rendering — similar to Claude.ai
- Blinking cursor at end of streaming text + "Stop" button to cancel generation

**Streaming & Claude Integration**
- Use `@anthropic-ai/bedrock-sdk` directly (already in codebase) — `messages.stream()` for SSE token streaming through main process, forward tokens to renderer via IPC
- Zustand store in renderer owns conversation state — messages array with `{role, content, timestamp}`. Main process is stateless relay. Full message history sent with each API call for context.
- IPC event stream — main process emits `chat:token` events via `webContents.send()`, renderer accumulates into current message. Single `chat:done` event on completion.
- Send full conversation history up to model token limit. No truncation in v1 — sessions are short-lived DBA interactions. Warn user if approaching limit.

**Schema Context & MCP Integration**
- System prompt injection — on chat start, fetch database/table list via MCP and include as structured context in system message. Refresh on explicit user request or new session.
- Inject database names + table names + column names/types for user-selected database(s). Cap at ~4K tokens of schema context. User picks active database in sidebar or chat.
- HTTP to the already-configured MCP endpoint (from Phase 1 settings). Main process makes MCP tool calls, returns results to chat service.
- Surface MCP errors as inline error message in chat — "Could not fetch schema: {error}". Chat continues working without schema context (graceful degradation).

**Subagent Launcher & Framework**
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

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CHAT-01 | User can send freeform messages and receive Claude-powered responses | Bedrock SDK `messages.stream()` + IPC relay pattern documented below |
| CHAT-02 | Chat responses stream in real-time (not wait-for-complete) | `.on('text')` callback + `webContents.send('chat:token')` pattern |
| CHAT-03 | Chat has access to Teradata schema context (databases, tables, columns) via MCP | MCP `tools/call` for `base_databaseList`, `base_tableList`, `base_columnDescription` |
| CHAT-04 | Session memory — follow-up questions retain conversation context | Full messages array sent with each API call; Zustand owns history |
| CHAT-05 | Rich formatted output — markdown tables, code blocks, summaries rendered in chat | `streamdown` v2.5.0 handles incomplete markdown during streaming |
| CHAT-06 | User can translate natural language to Teradata SQL via chat | System prompt + conversation context enables this without special implementation |
| AGEN-01 | User can browse and launch prebuilt subagents from a launcher UI | Collapsible sidebar panel with SubagentDefinition[] array |
| AGEN-02 | Subagent results appear as rich formatted messages in the chat thread | SubagentResultCard component with markdown content |
| AGEN-03 | Subagents run in isolated context (don't pollute main chat history) | Separate messages array in subagent invocation; only result card inserted into view |
| AGEN-04 | Subagent output includes actionable recommendations, not just raw data | Echo subagent in Phase 2 is scaffold only; real subagents in Phase 3 |
| AGEN-05 | SQL recommendations are surfaced for copy-paste — never auto-executed | Code block with copy button; no execute action |
| UIBR-03 | Chat interface has a sidebar with subagent launcher | Collapsible panel in Sidebar.tsx below nav items |
</phase_requirements>

---

## Standard Stack

### Core (already installed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@anthropic-ai/bedrock-sdk` | ^0.26.4 | Claude streaming via AWS Bedrock | Already configured with STS AssumeRole in `src/main/ipc/claude.ts` |
| `zustand` | ^5.0.2 | Chat state (messages, streaming status, active subagent) | Already in use for nav/connection state |
| `tailwindcss` | ^4.2.2 | Chat UI styling | Already integrated via `@tailwindcss/vite` plugin |
| `lucide-react` | ^0.511.0 | Icons (Send, Stop, ChevronDown, Bot, etc.) | Already installed |
| shadcn/ui components | (in-repo) | Button, Card, Badge, ScrollArea, Tooltip | Already in `src/renderer/src/components/ui/` |

### Needs Installation
| Library | Version | Purpose | Why Needed |
|---------|---------|---------|------------|
| `streamdown` | 2.5.0 | Streaming-aware markdown renderer | Handles incomplete code fences and partial markdown during token streaming; `react-markdown` re-renders thrash on every token |
| `immer` | 11.1.4 | Immutable state updates for message array | Safe `state.messages.push()` / `message.content += delta` patterns in Zustand; avoids spread-copy bugs on deep chat history |

### Installation
```bash
npm install streamdown immer
```

**Note on streamdown:** Import CSS as `import 'streamdown/styles.css'` in the renderer entry. Requires `@source` directive in Tailwind config for class scanning — add `@source "../../node_modules/streamdown"` to the CSS entry file.

**Note on immer:** Import as `import { immer } from 'zustand/middleware/immer'`. Zustand 5.x bundles the immer middleware — no separate `zustand/middleware` install needed.

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `streamdown` | `react-markdown` | react-markdown is fine for fully-completed text; breaks (layout shift, throws) on incomplete markdown blocks during streaming |
| `immer` middleware | Manual spread `[...state.messages]` | Spread is fine for shallow; chat messages have nested `content` that gets mutated per token — immer eliminates bugs |

---

## Architecture Patterns

### Recommended Project Structure (additions to Phase 1)
```
src/
├── main/
│   └── ipc/
│       └── chat.ts              # NEW: streaming IPC handler, MCP schema fetch
├── renderer/src/
│   ├── features/
│   │   └── chat/                # NEW: chat feature module
│   │       ├── ChatScreen.tsx   # Full-page chat view
│   │       ├── MessageList.tsx  # Scrollable messages with auto-scroll
│   │       ├── MessageBubble.tsx# Individual message (user/assistant)
│   │       ├── ChatInput.tsx    # Bottom input bar
│   │       └── SubagentResultCard.tsx  # Rich card for subagent output
│   ├── store/
│   │   └── chat-store.ts        # NEW: Zustand store for chat state
│   └── components/
│       └── SubagentLauncher.tsx # NEW: sidebar panel with subagent cards
└── shared/
    └── types.ts                 # EXTEND: chat message types, IPC channels
```

### Pattern 1: Bedrock Streaming via IPC

**What:** Main process runs the streaming loop, pushes text deltas to renderer via `webContents.send`. Renderer accumulates into Zustand store.

**When to use:** Always for any Claude API call — credentials never leave main process.

```typescript
// src/main/ipc/chat.ts
// Source: Anthropic SDK helpers.md + Electron IPC docs
import { ipcMain, BrowserWindow } from 'electron';
import AnthropicBedrock from '@anthropic-ai/bedrock-sdk';
import { getDecryptedAwsCredentials } from './claude';
import store from '../store';

let activeStream: { abort: () => void } | null = null;

ipcMain.handle('chat:send', async (event, messages: ChatMessage[], systemPrompt: string) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win) return { success: false, error: 'No window' };

  const { accessKeyId, secretKey } = getDecryptedAwsCredentials();
  const region = store.get('claude.region') || 'us-west-2';
  const modelId = store.get('claude.modelId') || 'anthropic.claude-sonnet-4-20250514-v1:0';

  const client = new AnthropicBedrock({ awsRegion: region, awsAccessKey: accessKeyId, awsSecretKey: secretKey });

  const stream = client.messages.stream({
    model: modelId,
    max_tokens: 4096,
    system: systemPrompt,
    messages: messages.map(m => ({ role: m.role, content: m.content })),
  });

  activeStream = stream;

  stream.on('text', (delta) => {
    win.webContents.send('chat:token', delta);
  });

  stream.on('message', (msg) => {
    win.webContents.send('chat:done', { stopReason: msg.stop_reason });
    activeStream = null;
  });

  stream.on('error', (err) => {
    win.webContents.send('chat:error', err.message);
    activeStream = null;
  });

  return { success: true };
});

ipcMain.handle('chat:abort', async () => {
  if (activeStream) {
    activeStream.abort();
    activeStream = null;
  }
});
```

**Preload additions:**
```typescript
// Renderer receives streaming tokens
onChatToken: (cb: (delta: string) => void) =>
  ipcRenderer.on('chat:token', (_e, delta) => cb(delta)),
onChatDone: (cb: (result: { stopReason: string }) => void) =>
  ipcRenderer.on('chat:done', (_e, result) => cb(result)),
onChatError: (cb: (error: string) => void) =>
  ipcRenderer.on('chat:error', (_e, err) => cb(err)),
removeChatListeners: () => {
  ipcRenderer.removeAllListeners('chat:token');
  ipcRenderer.removeAllListeners('chat:done');
  ipcRenderer.removeAllListeners('chat:error');
},
sendChat: (messages: ChatMessage[], systemPrompt: string) =>
  ipcRenderer.invoke('chat:send', messages, systemPrompt),
abortChat: () => ipcRenderer.invoke('chat:abort'),
```

### Pattern 2: Zustand Chat Store with Immer

**What:** Single Zustand store slice for chat state. Immer middleware enables safe mutation of the messages array during token streaming.

```typescript
// src/renderer/src/store/chat-store.ts
// Source: Zustand docs + immer middleware pattern
import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { nanoid } from 'nanoid'; // or use Date.now().toString() if nanoid not installed

export type MessageRole = 'user' | 'assistant';

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: number;
  isStreaming?: boolean;
}

export interface SubagentResult {
  id: string;
  agentName: string;
  content: string;
  timestamp: number;
}

interface ChatState {
  messages: ChatMessage[];
  subagentResults: SubagentResult[];
  isStreaming: boolean;
  streamingMessageId: string | null;
  schemaContext: string | null;
  activeDatabaseName: string | null;

  addUserMessage: (content: string) => string;
  addAssistantMessagePlaceholder: () => string;
  appendToken: (id: string, delta: string) => void;
  finalizeMessage: (id: string) => void;
  setSchemaContext: (ctx: string | null) => void;
  setActiveDatabaseName: (name: string | null) => void;
  addSubagentResult: (result: Omit<SubagentResult, 'id'>) => void;
  clearMessages: () => void;
}

export const useChatStore = create<ChatState>()(
  immer((set) => ({
    messages: [],
    subagentResults: [],
    isStreaming: false,
    streamingMessageId: null,
    schemaContext: null,
    activeDatabaseName: null,

    addUserMessage: (content) => {
      const id = Date.now().toString();
      set((state) => {
        state.messages.push({ id, role: 'user', content, timestamp: Date.now() });
      });
      return id;
    },

    addAssistantMessagePlaceholder: () => {
      const id = Date.now().toString() + '-a';
      set((state) => {
        state.messages.push({ id, role: 'assistant', content: '', timestamp: Date.now(), isStreaming: true });
        state.isStreaming = true;
        state.streamingMessageId = id;
      });
      return id;
    },

    appendToken: (id, delta) => {
      set((state) => {
        const msg = state.messages.find((m) => m.id === id);
        if (msg) msg.content += delta;
      });
    },

    finalizeMessage: (id) => {
      set((state) => {
        const msg = state.messages.find((m) => m.id === id);
        if (msg) msg.isStreaming = false;
        state.isStreaming = false;
        state.streamingMessageId = null;
      });
    },

    setSchemaContext: (ctx) => set((state) => { state.schemaContext = ctx; }),
    setActiveDatabaseName: (name) => set((state) => { state.activeDatabaseName = name; }),

    addSubagentResult: (result) => {
      set((state) => {
        state.subagentResults.push({ ...result, id: Date.now().toString() });
      });
    },

    clearMessages: () => set((state) => {
      state.messages = [];
      state.subagentResults = [];
    }),
  }))
);
```

### Pattern 3: MCP Schema Fetch (Main Process)

**What:** Main process calls MCP HTTP endpoint with JSON-RPC `tools/call` to fetch schema. Returns structured text for system prompt injection.

**MCP session requirement:** The Streamable HTTP protocol requires an `initialize` handshake first, then subsequent calls include `Mcp-Session-Id` header. Phase 1 already does the handshake for connection testing — reuse that pattern but maintain the session ID for subsequent calls within the app session.

**Verified Teradata MCP tools (from official repo README):**
| Tool Name | Parameters | Returns |
|-----------|-----------|---------|
| `base_databaseList` | none | list of database names |
| `base_tableList` | `databaseName: string` | list of table names in that database |
| `base_columnDescription` | `databaseName: string, tableName: string` | column names, types, and descriptions |

```typescript
// src/main/services/mcp-schema.ts
// Source: MCP Streamable HTTP spec + Teradata MCP server README
import { getMcpUrl } from './mcp-manager';

interface McpToolResult {
  content: Array<{ type: 'text'; text: string }>;
  isError?: boolean;
}

async function callMcpTool(toolName: string, args: Record<string, string> = {}): Promise<string> {
  const url = getMcpUrl();
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json, text/event-stream',
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: Date.now(),
      method: 'tools/call',
      params: { name: toolName, arguments: args },
    }),
  });

  if (!response.ok) throw new Error(`MCP error: ${response.status}`);
  const json = await response.json() as { result?: McpToolResult; error?: { message: string } };
  if (json.error) throw new Error(json.error.message);
  return json.result?.content.map((c) => c.text).join('\n') ?? '';
}

export async function fetchSchemaContext(databaseName: string): Promise<string> {
  const [tables, columns] = await Promise.all([
    callMcpTool('base_tableList', { databaseName }),
    // Column descriptions fetched per-table up to token budget
  ]);

  // Build structured context block capped at ~4K tokens
  return buildSchemaPromptBlock(databaseName, tables, columns);
}

export async function listDatabases(): Promise<string[]> {
  const raw = await callMcpTool('base_databaseList');
  // Parse the text response — format is server-dependent, typically newline-separated names
  return raw.split('\n').filter(Boolean);
}
```

**Important:** The MCP session protocol requires an `initialize` handshake before `tools/call`. Reuse the existing connection test logic pattern in `mcp-manager.ts` but store the `Mcp-Session-Id` response header for reuse across the session. If the session expires (HTTP 404), re-initialize automatically.

### Pattern 4: streamdown Integration

**What:** Drop-in replacement for `react-markdown`. Handles incomplete markdown during streaming without layout shifts.

```tsx
// Source: streamdown GitHub README + streamdown.ai docs
import { Streamdown } from 'streamdown';
import { code } from '@streamdown/code';
import 'streamdown/styles.css';

function AssistantMessage({ content, isStreaming }: { content: string; isStreaming: boolean }) {
  return (
    <Streamdown animated plugins={{ code }} isAnimating={isStreaming}>
      {content}
    </Streamdown>
  );
}
```

**CSS integration with Tailwind v4:** In the renderer's `src/renderer/src/assets/main.css` (or equivalent Tailwind entry), add:
```css
@source "../../node_modules/streamdown";
```
This tells the Tailwind v4 Vite plugin to scan streamdown's classes.

### Pattern 5: Subagent Framework Scaffold

**What:** Type definition + launcher UI + result card. Echo subagent for testing. Real agents in Phase 3.

```typescript
// src/shared/subagent-types.ts
export interface SubagentDefinition {
  id: string;
  name: string;
  description: string;
  icon: string; // lucide-react icon name
  run: (context: SubagentContext) => Promise<SubagentRunResult>;
}

export interface SubagentContext {
  activeDatabaseName: string | null;
  schemaContext: string | null;
}

export interface SubagentRunResult {
  content: string;        // Markdown content for the result card
  metadata?: Record<string, unknown>;
}
```

The echo subagent for testing:
```typescript
export const echoSubagent: SubagentDefinition = {
  id: 'echo',
  name: 'Echo Test',
  description: 'Returns the current schema context — used for testing the subagent framework.',
  icon: 'Terminal',
  run: async (ctx) => ({
    content: `**Schema Context Available:** ${ctx.schemaContext ? 'Yes' : 'No'}\n\n**Active Database:** ${ctx.activeDatabaseName ?? 'None'}`,
  }),
};
```

### Anti-Patterns to Avoid

- **Streaming tokens directly from renderer to Bedrock:** The Bedrock SDK requires AWS credentials — never available in the renderer due to `nodeIntegration: false`. All Claude calls must go through the main process.
- **Adding `isStreaming` logic inside `appendToken` with a mutex:** Zustand + immer handles this correctly with atomic state updates; no mutex needed.
- **Storing entire conversation history in `electron-store`:** Per CLAUDE.md, `electron-store` reads/writes entire JSON on each change. Chat history for v1 should stay in memory only (Zustand); `electron-store` is for settings not message history.
- **Calling MCP `tools/call` without an `initialize` handshake first:** The Streamable HTTP transport requires initialization. If you skip it, the server returns 400 Bad Request.
- **Rendering every chat message with its own `useEffect` for scrolling:** Use a single `useEffect` in `MessageList.tsx` that watches `messages.length` and calls `containerRef.current.scrollTop = containerRef.current.scrollHeight`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Streaming markdown rendering | Custom tokenizer for incomplete markdown | `streamdown` v2.5.0 | Handles partial code fences, mid-sentence bold, incomplete tables — 48 releases, 2.2k dependents |
| Immutable array mutation in Zustand | `[...state.messages.slice(0,-1), {...last, content: last.content + delta}]` | `immer` middleware | O(n) clone on every token → performance degrades with long conversations |
| MCP JSON-RPC client | Custom fetch wrapper class with retry/session | Thin inline `fetch()` calls per the pattern above | MCP sessions are short-lived; simple fetch is adequate for v1 |
| Syntax highlighting in code blocks | CSS + regex | `@streamdown/code` plugin (bundled with streamdown) | Ships Shiki-powered highlighting with copy buttons |

**Key insight:** The streamdown + immer combination is the right pairing for AI chat in React. streamdown removes the rendering complexity; immer removes the state mutation complexity. Both are small libraries with minimal API surface.

---

## Common Pitfalls

### Pitfall 1: IPC Listener Accumulation
**What goes wrong:** Each time the chat input component mounts or the user sends a new message, `ipcRenderer.on('chat:token', ...)` adds another listener. After several messages, each token fires N listeners and content appends N times.
**Why it happens:** `ipcRenderer.on()` appends listeners; it doesn't replace them.
**How to avoid:** Register listeners once in the app entry (`App.tsx` useEffect) and route events through the store. Or use `ipcRenderer.removeAllListeners('chat:token')` before re-adding in each useEffect cleanup.
**Warning signs:** Chat responses contain repeated/doubled text.

### Pitfall 2: MCP Session Not Maintained
**What goes wrong:** Each `tools/call` request fails with HTTP 400 if the MCP server requires session state.
**Why it happens:** The Streamable HTTP spec assigns `Mcp-Session-Id` at initialization; subsequent requests must include it.
**How to avoid:** Store the session ID from the `initialize` response. If response header `Mcp-Session-Id` is present, include it as a header on all subsequent POSTs. Re-initialize on HTTP 404.
**Warning signs:** Schema fetch fails even though connection test passes (test uses `initialize`, schema calls use `tools/call`).

### Pitfall 3: Main Process `activeStream` Global
**What goes wrong:** If the user sends two messages rapidly, two streams start and both push tokens to the renderer. The second stream's tokens interleave with the first.
**Why it happens:** The `activeStream` variable in `chat.ts` is module-level; two concurrent `chat:send` invocations both set it.
**How to avoid:** Abort any active stream before starting a new one at the start of the `chat:send` handler.
**Warning signs:** Chat bubbles contain mixed text from two different responses.

### Pitfall 4: Bedrock AssumeRole Credentials Expiry
**What goes wrong:** After ~1 hour of the app running, STS temporary credentials expire. All subsequent `messages.stream()` calls fail with auth errors.
**Why it happens:** STS `AssumeRole` returns credentials with `DurationSeconds: 3600`. The current Phase 1 code obtains credentials at each `TEST_CLAUDE_CONNECTION` call but there is no refresh mechanism for the chat stream handler.
**How to avoid:** Extract credential fetching into a shared service that caches credentials and re-assumes role when they are within 5 minutes of expiry. Check `assumed.Credentials.Expiration` timestamp before each use.
**Warning signs:** Chat works after app launch but fails after ~1 hour with "InvalidClientTokenId" or "ExpiredToken" errors.

### Pitfall 5: Token Budget Exceeded Silently
**What goes wrong:** After many turns, total conversation length exceeds the model's context window (200K tokens for Claude Sonnet). The API returns an error, but if the error handler isn't wired into the UI, it fails silently.
**Why it happens:** Full message history is sent with each request (by design, v1). Sessions can grow.
**How to avoid:** Catch `context_length_exceeded` in the stream error handler and surface it as a visible message in the chat. In v1, suggest the user clear the conversation.
**Warning signs:** Assistant responses stop mid-session with no visible error.

### Pitfall 6: streamdown CSS Conflicts with Tailwind v4
**What goes wrong:** streamdown ships its own CSS file (`streamdown/styles.css`). With Tailwind v4's aggressive CSS reset/base styles, streamdown's component styles may be overridden.
**Why it happens:** Tailwind v4 uses CSS layers; external CSS not in a layer can conflict with layer-based styles.
**How to avoid:** Import `streamdown/styles.css` after the Tailwind entry CSS. Add the `@source` directive so Tailwind scans streamdown's classes. Test code block rendering specifically — it's the most likely to conflict.
**Warning signs:** Code blocks render without background/borders; monospace font not applied.

---

## Code Examples

### Building the System Prompt with Schema Context

```typescript
// Source: Pattern derived from CONTEXT.md decisions
function buildSystemPrompt(schemaContext: string | null, activeDatabaseName: string | null): string {
  const base = `You are an expert Teradata DBA assistant. You help database administrators analyze their Teradata environment, write optimized SQL queries, and understand performance characteristics.

Rules:
- Never execute SQL automatically. Always present SQL as copy-paste recommendations.
- All SQL must be valid Teradata SQL syntax (not ANSI or Oracle syntax).
- Reference actual table and column names from the schema context when available.
- When you cannot determine something from the schema, say so — don't hallucinate column names.`;

  if (!schemaContext) {
    return base + '\n\nNo schema context is currently loaded. Ask the user to select a database if they need schema-aware responses.';
  }

  return `${base}

## Active Database: ${activeDatabaseName ?? 'Unknown'}

## Schema Context
${schemaContext}

Use the above schema when answering questions about tables and columns. If the user asks about something not in this schema, say you don't see it in the current context.`;
}
```

### Auto-Scroll in MessageList

```tsx
// Source: Standard React pattern — single useEffect approach
import { useEffect, useRef } from 'react';

function MessageList({ messages }: { messages: ChatMessage[] }) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, messages[messages.length - 1]?.content.length]);

  return (
    <div style={{ overflowY: 'auto', flex: 1 }}>
      {messages.map(msg => <MessageBubble key={msg.id} message={msg} />)}
      <div ref={bottomRef} />
    </div>
  );
}
```

### IPC Channel Constants (addition to shared/types.ts)

```typescript
// Additions to IpcChannels const in src/shared/types.ts
CHAT_SEND: 'chat:send',
CHAT_ABORT: 'chat:abort',
CHAT_TOKEN: 'chat:token',        // main → renderer push
CHAT_DONE: 'chat:done',          // main → renderer push
CHAT_ERROR: 'chat:error',        // main → renderer push
SCHEMA_FETCH: 'schema:fetch',
SCHEMA_LIST_DATABASES: 'schema:list-databases',
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `react-markdown` for AI chat | `streamdown` | 2024 (streamdown v1) | Eliminates layout thrash during token streaming |
| `useReducer` for chat messages | Zustand + immer | Mature pattern 2023+ | Less boilerplate, same correctness guarantees |
| HTTP+SSE dual endpoints (MCP) | Streamable HTTP single endpoint | MCP spec 2025-03-26 | One POST endpoint handles everything; Phase 1 already uses this correctly |
| `ipcRenderer.send` (fire-and-forget) | `ipcRenderer.invoke` for commands, `ipcRenderer.on` for push | Established best practice | `invoke` gives error propagation; `on` is correct for server-push streaming events |

**Deprecated/outdated:**
- HTTP+SSE MCP transport (old 2024-11-05 spec): replaced by Streamable HTTP. Phase 1 already uses the new spec — no change needed.

---

## Open Questions

1. **MCP Session ID persistence**
   - What we know: The Streamable HTTP spec says servers MAY assign a session ID. Phase 1's connection test re-initializes on every call.
   - What's unclear: Whether the teradata-mcp-server actually assigns session IDs or is stateless (returns just application/json, no SSE, no session ID).
   - Recommendation: Write the schema fetch code to handle both cases. Check for `Mcp-Session-Id` header in the initialize response; if absent, treat as stateless and don't include it. The Phase 1 connection test works fine today without session IDs, so stateless is likely.

2. **streamdown Tailwind v4 compatibility**
   - What we know: streamdown v2.5.0 requires `@source` directive and its own CSS file. Tailwind v4 uses CSS layers.
   - What's unclear: Whether specific streamdown styles conflict with the existing Tailwind v4 setup in this repo.
   - Recommendation: Wave 1 task should include a visual smoke test of streamdown rendering (code block with syntax, table, bold/italic) before proceeding.

3. **Bedrock credential refresh strategy**
   - What we know: STS credentials expire in 3600s. Current code re-assumes on each connection test only.
   - What's unclear: Whether DBA sessions routinely last >1 hour (likely yes for long analysis sessions).
   - Recommendation: The chat IPC handler should check credential expiry before each call and re-assume role if within 5 minutes of expiry. Extract into `getBedrockClient()` helper.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | electron-vite dev server | Yes | v20.18.0 | — |
| npm | Package installation | Yes | 10.8.2 | — |
| `@anthropic-ai/bedrock-sdk` | Streaming chat | Yes (in package.json) | ^0.26.4 | — |
| `streamdown` | Markdown rendering | No (not installed) | 2.5.0 available | Use `react-markdown` temporarily |
| `immer` | Zustand store mutations | No (not installed) | 11.1.4 available | Manual spread (worse DX) |
| MCP server (external) | Schema context | Unknown at build time | Runtime dependency | Graceful degradation — chat works without schema |
| AWS Bedrock endpoint | Claude streaming | Runtime dependency | — | Show error in chat |

**Missing dependencies with no fallback:**
- None blocking — streamdown and immer are installable; Bedrock/MCP availability is a runtime concern, not build concern.

**Missing dependencies with fallback:**
- `streamdown` not yet installed — must be added before Phase 2 execution. `react-markdown` is a temporary fallback if streamdown causes unexpected issues.
- `immer` not yet installed — must be added. Manual spread is the fallback but discouraged for streaming updates.

---

## Project Constraints (from CLAUDE.md)

Directives the planner must verify compliance with:

| Constraint | Implication for Phase 2 |
|------------|------------------------|
| All Claude API calls via AWS Bedrock, not direct Anthropic API | Use `@anthropic-ai/bedrock-sdk`; never `@anthropic-ai/sdk` for chat in this app |
| `nodeIntegration: false` in renderer | All Bedrock/MCP calls must be in main process; preload bridge required for all IPC |
| Credentials only in main process memory | Chat store holds messages only; never stores AWS credentials in renderer state |
| Tailwind v4 — no `tailwind.config.js`, use `@tailwindcss/vite` plugin | streamdown `@source` directive goes in CSS file, not a config file |
| Custom `@theme` tokens broken in Tailwind v4 (from memory) — use inline styles or standard values | Chat layout (grid, flex) should use inline styles; Tailwind classes for colors/spacing |
| shadcn/ui CLI output goes to literal `@/` path — copy to `src/renderer/src/components/ui/` | Any new shadcn components (e.g., ScrollArea, Badge) need manual copy after add |
| `electron-store` for non-sensitive config only; not for chat history | Chat messages stay in Zustand (memory only); do not persist to electron-store in v1 |
| `teradatasql` deprecated — use MCP for all Teradata access | Schema fetching goes through MCP `tools/call`, never direct SQL driver |

---

## Sources

### Primary (HIGH confidence)
- Anthropic SDK `helpers.md` (github.com/anthropics/anthropic-sdk-typescript) — `.on('text')`, `.abort()`, `.on('message')` streaming API
- Electron IPC tutorial (electronjs.org/docs/latest/tutorial/ipc) — `webContents.send()` + preload `contextBridge` pattern for main-to-renderer push
- MCP Streamable HTTP specification (modelcontextprotocol.io/specification/2025-03-26/basic/transports) — session management, `initialize` handshake, `tools/call` format
- Teradata MCP server tools README (github.com/Teradata/teradata-mcp-server) — `base_databaseList`, `base_tableList`, `base_columnDescription` tool names
- `src/main/ipc/claude.ts` (existing codebase) — `getDecryptedAwsCredentials()` export, STS AssumeRole pattern
- `src/main/services/mcp-manager.ts` (existing codebase) — `getMcpUrl()`, existing HTTP MCP call pattern
- `src/shared/types.ts` (existing codebase) — `IpcChannels` const pattern, `ElectronAPI` interface shape

### Secondary (MEDIUM confidence)
- streamdown GitHub README (github.com/vercel/streamdown) — drop-in replacement API, `isAnimating` prop, plugin system, CSS import requirement
- streamdown.ai docs — `@source` directive requirement for Tailwind integration
- npm registry — verified streamdown@2.5.0 current (2026-03-25), immer@11.1.4 current
- Zustand immer middleware pattern (github.com/pmndrs/zustand discussions) — TypeScript-safe mutation pattern for arrays

### Tertiary (LOW confidence — needs validation)
- streamdown + Tailwind v4 compatibility: no direct source; inferred from Tailwind v4 CSS layers architecture. Validate during Wave 1 smoke test.
- MCP session ID behavior for teradata-mcp-server specifically: spec says servers MAY assign session IDs; actual behavior of this Python server not verified from docs alone.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages verified against npm registry; streaming API verified against official Anthropic SDK helpers.md
- Architecture: HIGH — IPC patterns from official Electron docs; Zustand+immer from official Zustand docs; MCP protocol from official spec
- MCP tool names: MEDIUM — from Teradata repo README, text description, not programmatic verification
- streamdown Tailwind v4 compatibility: LOW — inferred, not verified; flag for Wave 1 validation

**Research date:** 2026-03-25
**Valid until:** 2026-04-25 (stable libraries; MCP spec version pinned to 2025-03-26)
