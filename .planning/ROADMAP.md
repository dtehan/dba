# Roadmap: Teradata DBA Agent

## Overview

Four phases take the project from an empty directory to a fully featured local DBA AI assistant. Phase 1 builds the Electron shell with credentials and brand identity. Phase 2 adds the working chat loop — streaming freeform conversation with Teradata schema awareness. Phase 3 delivers the first three specialist subagents (Security, MVC, Statistics) with the full subagent framework. Phase 4 adds Skew and Space usage analysis, completing the v1 capability set.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Foundation** - Electron shell, credential storage, MCP/Claude connectivity, and Teradata brand identity (completed 2026-03-24)
- [ ] **Phase 2: Chat** - Freeform chat with streaming, schema grounding, session memory, and subagent launcher framework
- [ ] **Phase 3: Core Subagents** - Security Audit, MVC Analysis, and Statistics Analysis subagents with rich output
- [ ] **Phase 4: Analysis Expansion** - Skew Analysis and Space Usage subagents completing the v1 subagent set

## Phase Details

### Phase 1: Foundation
**Goal**: Users can launch the app, configure their Teradata and Claude credentials securely, and see live connection status before any AI interaction begins
**Depends on**: Nothing (first phase)
**Requirements**: FOUN-01, FOUN-02, FOUN-03, FOUN-04, FOUN-05, FOUN-06, UIBR-01, UIBR-02, UIBR-04
**Success Criteria** (what must be TRUE):
  1. User can launch the app as a native desktop window on their machine
  2. User can enter Teradata host/username/password and Claude API key through a settings UI — credentials saved securely via OS keychain, never in plaintext
  3. App connects to Teradata via MCP server (tdsql-mcp / teradata-mcp-server) using stored credentials
  4. Connection health indicator shows live green/red status for both Teradata and Claude API
  5. UI displays Teradata brand colors (orange #F37440, charcoal #1D1D1D) with a clean modern aesthetic on standard DBA monitor sizes
**Plans:** 5/5 plans complete
Plans:
- [x] 01-01-PLAN.md — Scaffold electron-vite project, TailwindCSS v4 + shadcn/ui with Teradata design tokens
- [x] 01-02-PLAN.md — IPC contract types, preload bridge, credential storage (safeStorage + electron-store)
- [x] 01-03-PLAN.md — MCP server process manager, Claude API test, health polling service
- [x] 01-04-PLAN.md — App shell layout, sidebar, status bar, welcome state, Zustand store
- [x] 01-05-PLAN.md — Settings screen (credential forms, test/save/clear), visual checkpoint
**UI hint**: yes

### Phase 2: Chat
**Goal**: Users can have freeform AI conversations about their Teradata environment with streaming responses, full schema awareness, and the ability to discover and launch specialist subagents
**Depends on**: Phase 1
**Requirements**: CHAT-01, CHAT-02, CHAT-03, CHAT-04, CHAT-05, CHAT-06, AGEN-01, AGEN-02, AGEN-03, AGEN-04, AGEN-05, UIBR-03
**Success Criteria** (what must be TRUE):
  1. User can type a freeform question and receive a Claude-powered response that streams token-by-token into the chat window
  2. User can ask follow-up questions and Claude remembers the full conversation within the session
  3. Claude can answer questions about specific databases and tables using live schema context from MCP without hallucinating table names or column types
  4. User can translate a plain-English request into a valid Teradata SQL query via chat
  5. User can see a subagent launcher panel, browse available subagents, and launch one — with results appearing as a distinct rich card in the chat thread, isolated from the main conversation history
**Plans:** 4/5 plans executed
Plans:
- [x] 02-01-PLAN.md — Install deps, chat types, Zustand store with immer, Bedrock streaming IPC handler
- [x] 02-02-PLAN.md — Chat UI components (ChatScreen, MessageList, MessageBubble, ChatInput), streamdown, AppShell wiring
- [x] 02-03-PLAN.md — MCP schema context service, system prompt injection, schema IPC handlers
- [x] 02-04-PLAN.md — Subagent framework scaffold (registry, echo agent, launcher panel, result cards)
- [x] 02-05-PLAN.md — Visual checkpoint: end-to-end chat verification
**UI hint**: yes

### Phase 3: Core Subagents
**Goal**: Users can run Security Audit, MVC Analysis, and Statistics Analysis against their Teradata environment and receive structured, actionable findings with copy-paste SQL remediation steps
**Depends on**: Phase 2
**Requirements**: SECU-01, SECU-02, SECU-03, SECU-04, SECU-05, MVCA-01, MVCA-02, MVCA-03, MVCA-04, MVCA-05, STAT-01, STAT-02, STAT-03, STAT-04, STAT-05
**Success Criteria** (what must be TRUE):
  1. User can run a Security Audit and receive a prioritized findings list covering access rights, role membership, overly permissive grants, and logon anomalies — each finding with a remediation step
  2. User can run MVC Analysis on a database and receive a ranked list of compression candidates with estimated space savings and ready-to-copy ALTER TABLE statements
  3. User can run Statistics Analysis and receive a prioritized list of missing and stale statistics with COLLECT STATISTICS statements for copy-paste application
  4. All subagent SQL recommendations are surfaced for copy-paste only — no query is auto-executed
  5. Results are capped and pre-aggregated before reaching Claude — no unbounded result sets reach the LLM
**Plans:** 4/5 plans executed
Plans:
- [x] 03-01-PLAN.md — Extend subagent types with params, extract shared Bedrock client service, update IPC/preload, launcher parameter form
- [x] 03-02-PLAN.md — Security Audit subagent (system prompt, run function, registry)
- [x] 03-03-PLAN.md — MVC Analysis subagent (Package Bit-Cost Model system prompt, run function, registry)
- [x] 03-04-PLAN.md — Statistics Analysis subagent (missing/stale stats detection, COLLECT STATISTICS, registry)
- [ ] 03-05-PLAN.md — Visual checkpoint: end-to-end subagent verification
**UI hint**: yes

### Phase 4: Analysis Expansion
**Goal**: Users can run Skew Analysis and Space Usage analysis to identify silent performance killers and proactively manage capacity — completing the full v1 DBA analysis toolkit
**Depends on**: Phase 3
**Requirements**: SKEW-01, SKEW-02, SKEW-03, SKEW-04, SKEW-05, SPAC-01, SPAC-02, SPAC-03, SPAC-04, SPAC-05
**Success Criteria** (what must be TRUE):
  1. User can run Skew Analysis and receive a list of skewed tables ranked by severity, with an explanation of the likely skew cause and suggested primary index alternatives
  2. User can run Space Usage analysis on a database or full system and see current perm space vs. allocation per database, with databases approaching limits clearly flagged
  3. Space analysis surfaces the top space-consuming tables and provides concrete recommendations for space recovery
  4. Both new subagents follow the same result-capping and output schema patterns established in Phase 3
**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation | 5/5 | Complete   | 2026-03-24 |
| 2. Chat | 4/5 | In Progress|  |
| 3. Core Subagents | 4/5 | In Progress|  |
| 4. Analysis Expansion | 0/TBD | Not started | - |
