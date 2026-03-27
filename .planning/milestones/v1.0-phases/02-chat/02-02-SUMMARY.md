---
phase: 02-chat
plan: 02
subsystem: ui
tags: [react, streamdown, zustand, chat, streaming, markdown, tailwind]

# Dependency graph
requires:
  - phase: 02-chat/02-01
    provides: chat-store (useChatStore), IPC types (sendChat, onChatToken, onChatDone, onChatError), ElectronAPI interface

provides:
  - ChatScreen component: full-page chat view composing MessageList + ChatInput
  - MessageList component: scrollable message list with auto-scroll on new messages and streaming tokens
  - MessageBubble component: Streamdown markdown rendering for assistant, dark card for user
  - ChatInput component: textarea with Enter-to-send, Shift+Enter newline, Send/Stop toggle
  - Chat as default home screen (NavPage 'chat', replacing 'welcome')
  - Sidebar with Chat + Settings nav items
  - IPC chat listeners registered once in App.tsx (onChatToken, onChatDone, onChatError)
  - buildSystemPrompt helper with optional schema context injection

affects: [03-schema, subagent phases]

# Tech tracking
tech-stack:
  added: [streamdown (markdown streaming renderer with built-in code copy), date-fns (timestamp formatting)]
  patterns: [streaming mode prop on Streamdown controlled by isStreaming state, IPC listeners registered once at app root]

key-files:
  created:
    - src/renderer/src/features/chat/ChatScreen.tsx
    - src/renderer/src/features/chat/MessageList.tsx
    - src/renderer/src/features/chat/MessageBubble.tsx
    - src/renderer/src/features/chat/ChatInput.tsx
  modified:
    - src/renderer/src/assets/globals.css
    - src/renderer/src/store/app-store.ts
    - src/renderer/src/components/Sidebar.tsx
    - src/renderer/src/components/AppShell.tsx
    - src/renderer/src/App.tsx

key-decisions:
  - "IPC chat listeners registered once in App.tsx useEffect (not ChatScreen) to prevent listener accumulation across re-mounts"
  - "Streamdown mode prop: mode='streaming' + isAnimating=true when message.isStreaming, mode='static' otherwise — correct streamdown v2 API usage"
  - "AppShell main uses overflow:hidden + flex column to allow ChatScreen to fill height without double scrollbars; chat scroll managed inside MessageList"
  - "buildSystemPrompt defined in ChatScreen (not a shared lib) — simple enough to stay inline, only one consumer in Phase 2"

patterns-established:
  - "Feature store access: useChatStore((s) => s.field) for reactive subscriptions, useChatStore.getState() for non-reactive imperative calls inside event handlers"
  - "Chat layout: flex column height 100%, MessageList flex:1 overflow:auto, ChatInput fixed at bottom with border-top"

requirements-completed: [CHAT-01, CHAT-02, CHAT-04, CHAT-05, CHAT-06, AGEN-05]

# Metrics
duration: 12min
completed: 2026-03-25
---

# Phase 02 Plan 02: Chat UI Summary

**Chat UI with streamdown markdown streaming, Enter-to-send textarea, Streamdown animated assistant bubbles, and Chat as the default home screen replacing WelcomeState**

## Performance

- **Duration:** 12 min
- **Started:** 2026-03-25T22:41:47Z
- **Completed:** 2026-03-25T22:53:47Z
- **Tasks:** 2
- **Files modified:** 9

## Accomplishments

- Four chat components built: ChatScreen (orchestrator with buildSystemPrompt), MessageList (auto-scroll), MessageBubble (Streamdown for assistant / dark card for user), ChatInput (Enter-to-send + Shift+Enter newline + Send/Stop toggle)
- Chat becomes the app default home screen; Sidebar now shows Chat + Settings nav items with correct Teradata active state styling
- IPC chat streaming pipeline fully wired: onChatToken accumulates tokens, onChatDone finalizes message, onChatError surfaces inline error — all registered once in App.tsx with cleanup

## Task Commits

Each task was committed atomically:

1. **Task 1: Chat UI components with streamdown markdown rendering** - `8b1d779` (feat)
2. **Task 2: Wire chat as default home screen in AppShell and Sidebar** - `09fa601` (feat)

**Plan metadata:** (see final commit below)

## Files Created/Modified

- `src/renderer/src/features/chat/ChatScreen.tsx` - Full-page chat orchestrator: sendMessage, buildSystemPrompt, composes MessageList + ChatInput
- `src/renderer/src/features/chat/MessageList.tsx` - Scrollable message list with auto-scroll sentinel div, empty state, inline error display
- `src/renderer/src/features/chat/MessageBubble.tsx` - Streamdown animated rendering for assistant, right-aligned dark card for user, timestamp in both
- `src/renderer/src/features/chat/ChatInput.tsx` - Textarea with auto-height, Enter-to-send, Shift+Enter newline, Send (orange) / Stop (red outline) button toggle
- `src/renderer/src/assets/globals.css` - Added `@import 'streamdown/styles.css'` and `@source "../../node_modules/streamdown"` for Tailwind scanning
- `src/renderer/src/store/app-store.ts` - NavPage type changed to `'chat' | 'settings'`, default currentPage changed to `'chat'`
- `src/renderer/src/components/Sidebar.tsx` - Added Chat nav item (MessageSquare icon) above Settings, both with Teradata active state (orange border-l-4)
- `src/renderer/src/components/AppShell.tsx` - Replaced WelcomeState with ChatScreen; main area uses overflow:hidden + flex column for correct chat layout
- `src/renderer/src/App.tsx` - Registered onChatToken/onChatDone/onChatError IPC listeners once at app mount with cleanup

## Decisions Made

- IPC chat listeners registered once in App.tsx useEffect (not in ChatScreen) to prevent listener accumulation across re-mounts — plan recommended this pattern explicitly
- Streamdown API: used `mode` + `isAnimating` props (not `animated` plugin) — simpler and matches the component's streaming use case without needing createAnimatePlugin
- AppShell `<main>` changed from `overflow: auto` to `overflow: hidden` + flex column so ChatScreen's internal scroll (MessageList) works correctly without competing with AppShell scroll

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] AppShell overflow:hidden for correct chat scroll containment**
- **Found during:** Task 2 (AppShell wiring)
- **Issue:** Original AppShell main had `overflow: auto` which would compete with ChatScreen's internal MessageList scroll, causing double scrollbar and incorrect layout
- **Fix:** Changed main element to `overflow: hidden` + `display: flex; flexDirection: column` so ChatScreen fills height and MessageList owns the scroll
- **Files modified:** src/renderer/src/components/AppShell.tsx
- **Verification:** Build passes
- **Committed in:** 09fa601 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 2 - missing critical layout fix)
**Impact on plan:** Essential for correct chat scroll behavior. No scope creep.

## Issues Encountered

- `@streamdown/code` sub-package does not exist in streamdown v2 — used streamdown without code plugin (streamdown already includes code copy buttons natively via its `controls` prop)

## Known Stubs

None — all components are wired to the real chat-store and IPC pipeline. buildSystemPrompt returns a real prompt string (not a placeholder).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Chat UI is fully wired to the streaming IPC pipeline from Plan 01
- Ready for Plan 03: schema context (listDatabases, fetchSchemaContext IPC, schema selector in Sidebar)
- The `schemaContext` and `activeDatabaseName` fields are consumed by buildSystemPrompt — Plan 03 only needs to call `setSchemaContext` and `setActiveDatabaseName` on the store

---
*Phase: 02-chat*
*Completed: 2026-03-25*
