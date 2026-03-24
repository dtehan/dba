# Project Research Summary

**Project:** Teradata DBA Agent
**Domain:** Local desktop AI chat application with specialized DBA subagents
**Researched:** 2026-03-24
**Confidence:** HIGH

## Executive Summary

The Teradata DBA Agent is a local Electron desktop application that gives Teradata DBAs a branded AI chat interface backed by Claude, with specialized subagents for Security Auditing, MVC Analysis, and Statistics Analysis. The recommended approach is Electron 41 + React 19 + TypeScript with electron-vite as the build system, using the Claude Agent SDK for subagent orchestration and MCP-based Teradata connectivity — specifically `tdsql-mcp` and `teradata-mcp-server` — instead of raw driver code. This MCP layer is a significant architectural simplifier: Teradata connectivity, query execution, schema discovery, and SQL syntax reference are all handled by the MCP servers, removing the need for Python subprocess management, teradatasql driver compilation, or ODBC configuration from the app itself.

The recommended architecture is an orchestrator-router pattern: a central Chat Orchestrator routes each user message to either freeform Claude conversation or a specialist subagent, each of which runs in an isolated context window (no conversation history pollution) and calls Teradata via MCP tools before returning a structured finding to the chat thread. The MCP integration point lives entirely in the Electron main process, preserving the critical security boundary — credentials and all external I/O stay out of the renderer. The subagent pattern (one file, one system prompt, one `execute()` entry point per subagent) enables safe expansion with zero impact on orchestration logic.

The dominant risks are security (credentials must use OS keychain from day one, never flat config files), safety (LLM-generated SQL must be allowlisted to SELECT/SHOW/HELP/EXPLAIN only — the MCP tool layer helps enforce this), and cost/performance (Teradata result sets must be aggregated before reaching Claude — raw row dumps will cause memory exhaustion and token cost explosions). All three risks must be addressed in the foundation phases, not retrofitted. There is no direct competitor for a Teradata-specific AI DBA chat tool as of March 2026; Statistics and MVC analysis are genuine gaps in Viewpoint and Teradata Studio.

## Key Findings

### Recommended Stack

The stack centers on Electron 41 (Node v24, Chromium 146) with React 19 and TypeScript, scaffolded via electron-vite 5.0. This combination provides strong HMR for rapid UI development, a clean dual-process build configuration, and TypeScript coverage across the IPC boundary where contract mismatches are most dangerous. TailwindCSS v4 (Vite plugin, no PostCSS config) with shadcn/ui provides Teradata-brandable components that can be copy-owned and customized. Zustand 5 handles state management at the right scale for a single-user desktop tool.

The MCP integration context changes the stack materially from what STACK.md assumed. The `teradatasql` Python driver and its associated `@electron/rebuild` complexity is no longer needed. Instead, subagents call Teradata via MCP tool invocations. The Claude Agent SDK (`@anthropic-ai/claude-agent-sdk`) handles both subagent orchestration and MCP tool dispatch natively. The base `@anthropic-ai/sdk` remains useful for streaming freeform chat turns where fine-grained token rendering control is needed.

**Core technologies:**
- **Electron 41**: Desktop shell, OS integration, secure credential storage — only mature cross-platform Node.js desktop framework
- **React 19 + TypeScript**: UI renderer — concurrent features handle streaming without blocking; TypeScript catches IPC contract mismatches at compile time
- **electron-vite 5.0**: Build tooling — Vite HMR for both main and renderer processes; more mature than Electron Forge's experimental Vite support
- **@anthropic-ai/claude-agent-sdk 0.2.x**: Subagent orchestration and MCP tool dispatch — handles isolated context windows and the orchestrator pattern natively
- **@anthropic-ai/sdk 0.80.0**: Direct streaming for freeform chat turns — finer token rendering control than the Agent SDK exposes
- **tdsql-mcp / teradata-mcp-server**: Teradata connectivity via MCP — eliminates raw driver management; provides execute_query, list_databases, list_tables, describe_table, explain_query tools plus 21 SQL syntax reference files
- **Zustand 5**: State management — right size for single-user app; maps cleanly to chat history + subagent state shape
- **TailwindCSS 4.2 + shadcn/ui**: Styling and components — copy-owned components enable full Teradata brand customization
- **Electron safeStorage**: Credential encryption — OS keychain without native module rebuild complexity

### Expected Features

The research confirms no existing Teradata tool (Viewpoint, Studio) provides AI-assisted analysis with natural language recommendations. Statistics and MVC analysis are genuine capability gaps in the current tool landscape. The DBA market is small and expert — users will immediately test edge cases and evaluate output quality.

**Must have (table stakes):**
- Teradata connection configuration (host, port, credentials) — gate for all other features
- Chat interface with Teradata brand identity (orange #F37440, charcoal #1D1D1D) — trust signal for the target audience
- Claude API integration with streaming — 15-30s blank wait is unacceptable UX
- Security Auditing subagent — high-value, repetitive DBC task; queries DBC.AccessRights, DBC.RoleMembers, DBC.AccLogTbl
- MVC Analysis subagent — concrete ROI (space savings), well-understood DBC query pattern
- Statistics Analysis subagent — stale stats are the #1 cause of bad query plans; highly repetitive task
- Subagent launcher UI — makes specialized capabilities discoverable without natural language intent detection
- Rich formatted output — findings as structured chat cards, not raw query dumps
- Freeform chat about the connected Teradata environment — validates conversational DBA use case

**Should have (competitive, add in v1.x):**
- Skew Analysis subagent — silent performance killer; high DBA value once base pattern is validated
- Space Usage and Growth subagent — proactive capacity management; DBC.DiskSpaceV analysis
- Conversation memory within session — iterative follow-ups ("now filter that to prod only") require prior context
- Natural language to Teradata SQL — high complexity; validate subagent pattern first

**Defer (v2+):**
- DBQL Log Analysis subagent — requires DBQL enabled; environment dependency makes it risky for early releases
- Query Performance / EXPLAIN Analysis — powerful but complex plan parsing; defer until v1 is mature
- Workload Analysis (TASM) — specialist topic; small subset of DBAs need it

**Never build:**
- DDL/DML execution from chat — catastrophic risk on production; always surface SQL for manual execution
- Automated scheduling — incompatible with local desktop model
- Real-time streaming metrics — competes with Viewpoint; out of scope

### Architecture Approach

The architecture follows a strict two-process Electron model with an orchestrator-router pattern in the main process. Every user message enters the Chat Orchestrator, which classifies intent and routes to either freeform Claude streaming or the Subagent Router. Subagents run in fully isolated Claude context windows — no conversation history, no cross-contamination — and call Teradata exclusively via MCP tool invocations. The MCP layer sits inside the main process service layer, keeping all external I/O and credentials away from the renderer. The contextBridge/preload surface is the only renderer-to-main boundary; it exposes typed, namespaced IPC functions only.

The MCP integration simplifies the architecture significantly: what ARCHITECTURE.md described as a Python subprocess approach for teradatasql becomes a direct MCP tool call through the Agent SDK. Connection lifecycle, session management, and driver compilation are all handled by the MCP server process rather than the app.

**Major components:**
1. **React Chat UI (renderer)** — renders messages, streams tokens, hosts subagent launcher panel; communicates only via contextBridge
2. **Chat Orchestrator (main)** — conversation history, intent routing, freeform vs. subagent dispatch decision
3. **Subagent Router (main)** — intent detection, dispatch to specialist modules, IDLE/TASK_ACTIVE state machine
4. **Subagent Modules (main)** — one file per subagent; `execute()` calls MCP tools for Teradata data, then Claude for analysis; returns SubagentResult
5. **Claude API Service (main)** — Anthropic SDK wrapper; handles streaming SSE for freeform chat; used by subagents for analysis calls
6. **MCP Tool Bridge (main)** — wraps tdsql-mcp / teradata-mcp-server; surfaces execute_query, list_databases, describe_table as typed service methods
7. **Credential Store (main)** — safeStorage encryption for Claude API key and Teradata credentials; never exposes raw values via IPC

### Critical Pitfalls

1. **Credentials in plaintext config** — Use Electron `safeStorage` from day one; credentials must be in the OS keychain before the first connection screen is built. Recovery after shipping is a credential rotation incident.

2. **Destructive SQL execution from chat** — The MCP tool layer (execute_query) should be wrapped with an allowlist: only SELECT, SHOW, HELP, EXPLAIN pass through. Include the constraint in every subagent system prompt. The MCP integration actually helps here — the app never constructs raw SQL strings; it calls tool functions, making validation easier to centralize.

3. **Unbounded Teradata result sets** — Subagent query templates must aggregate, not enumerate rows. Cap results at the MCP tool call level (TOP N or result limit parameter) before data enters the LLM pipeline. A single uncapped query against a large table can OOM the process and send thousands of tokens to Claude.

4. **Token cost explosion from raw result sets** — Pre-aggregate and summarize before calling Claude. Pass "top 50 MVC candidates by estimated savings" not all 500 rows. Instrument token counts per subagent during development — costs are invisible until the bill arrives.

5. **Vague subagent prompts producing inconsistent output** — Each subagent system prompt must specify exact decision criteria, precise output format (structured sections), and 1-2 few-shot examples. Treat prompt engineering as a testable deliverable with expected output schemas. Generic DBA advice that ignores the actual query results will destroy DBA trust immediately.

## Implications for Roadmap

Based on combined research, the architecture's dependency chain and pitfall prevention requirements suggest a 5-phase structure:

### Phase 1: Foundation and Shell
**Rationale:** All other phases depend on this layer. Credential storage, IPC bridge, and the Electron window must exist before any service or UI component is built. Pitfalls 1 (credential storage) and Electron IPC security must be addressed here — retrofitting is expensive.
**Delivers:** Working Electron app with contextBridge, safeStorage-backed credential store, and a configuration UI for Teradata connection details and Claude API key.
**Addresses:** Teradata connection configuration (table stakes), Teradata brand identity baseline
**Avoids:** Credentials in plaintext (critical pitfall), Electron nodeIntegration security mistake

### Phase 2: Connectivity and Services
**Rationale:** Services must be validated independently before the orchestrator or subagents build on them. MCP connectivity in particular needs a working proof-of-concept (list_databases, execute_query) before subagent query templates are designed.
**Delivers:** Functioning MCP tool bridge (tdsql-mcp and/or teradata-mcp-server integrated), Claude API streaming service, connection health indicator in the UI.
**Uses:** tdsql-mcp, teradata-mcp-server, @anthropic-ai/sdk, @anthropic-ai/claude-agent-sdk
**Avoids:** Connection lifecycle mismanagement (session leaks), query execution on main thread blocking UI

### Phase 3: Core Chat and Freeform Conversation
**Rationale:** Freeform chat proves the end-to-end loop (user input → Claude → streaming response) before subagent complexity is added. Schema grounding (injecting DBC metadata from MCP into system prompt) must be established here or schema hallucination will pollute all subsequent work.
**Delivers:** Working chat interface with Teradata brand styling, streaming token rendering, in-session conversation history, schema context injection from MCP describe_table/list_tables.
**Addresses:** Chat interface (table stakes), Claude API integration, freeform chat, rich formatted output
**Implements:** Chat Orchestrator (freeform path), streaming IPC events, ChatStore (Zustand)
**Avoids:** Schema hallucination (inject schema context here), SQL safety allowlist (enforce in MCP wrapper here)

### Phase 4: First Subagent and Pattern Validation
**Rationale:** Build one complete subagent (Security Audit recommended — well-defined DBC query set, high DBA value, good test of the full subagent loop) to validate the base pattern before replicating it. The result-capping pattern, token measurement, and output schema validation must all be proven here. PITFALLS.md is explicit: establish these patterns before building multiple subagents.
**Delivers:** Security Audit subagent fully working end-to-end; base subagent class, SubagentRouter, subagent launcher UI, SubagentResult rich card component.
**Addresses:** Security Auditing subagent (table stakes), Subagent launcher UI, rich formatted output for subagent results
**Implements:** BaseSubagent, SubagentRouter (IDLE/TASK_ACTIVE state machine), subagent IPC events (progress, complete)
**Avoids:** Unbounded result sets (cap pattern established here), token cost explosion (instrumentation required), vague prompts (output schema validated here)

### Phase 5: Remaining Core Subagents
**Rationale:** With the base pattern proven in Phase 4, MVC Analysis and Statistics Analysis are drop-in additions — new files, new system prompts, registered in the router. The pattern is tested; iteration is low-risk.
**Delivers:** MVC Analysis subagent and Statistics Analysis subagent, completing the v1 feature set.
**Addresses:** MVC Analysis (table stakes), Statistics Analysis (table stakes)
**Avoids:** God subagent anti-pattern (each has isolated system prompt), sequential query bottleneck (where queries are independent, run in parallel via MCP)

### Phase Ordering Rationale

- Phases 1 and 2 are strict prerequisites: no service can run without credentials, no subagent can run without services.
- Freeform chat (Phase 3) comes before subagents (Phases 4-5) because the streaming IPC infrastructure, schema injection, and SQL safety layer must be proven before subagents build on them.
- Security Audit is the recommended first subagent because its DBC query set is well-defined, its output structure is natural (findings with severity), and it exercises the full subagent loop without the aggregation complexity of MVC or the statistics-staleness logic.
- MVC and Statistics follow as pattern-conformant additions once Phase 4 validates the architecture.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 2 (Connectivity):** MCP server setup and configuration is relatively new tooling. Integration between Electron's main process and MCP server processes (stdio transport vs. HTTP, process lifecycle, credential passing) needs hands-on investigation before implementation.
- **Phase 3 (Schema grounding):** The optimal strategy for injecting DBC schema context (which tables to describe, how much metadata to include, caching strategy) is not well-documented for Teradata-specific AI applications. Needs prompt engineering experimentation.
- **Phase 4 (Subagent prompts):** Each subagent system prompt requires DBA domain expertise to specify correct decision criteria (e.g., MVC thresholds, statistics staleness heuristics). Plan for prompt iteration and testing against real Teradata data.

Phases with standard patterns (skip research-phase):
- **Phase 1 (Foundation):** Electron shell + safeStorage + contextBridge patterns are extensively documented and stable.
- **Phase 3 (Chat UI, streaming):** Streaming IPC pattern and React streaming token rendering are well-established.
- **Phase 5 (Remaining subagents):** Once Phase 4 pattern is proven, additional subagents follow the same structure — no new patterns needed.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Core technologies (Electron, React, TypeScript, electron-vite, shadcn/ui) verified via official sources. MCP integration replaces teradatasql — simplifies the stack materially. Agent SDK is the right choice for subagent + MCP dispatch. |
| Features | MEDIUM | DBA task landscape well-documented. Competitor analysis is solid (no direct Teradata AI DBA tool exists). Feature priority is synthesized from DBA community sources rather than direct user research — validate with real DBAs at first opportunity. |
| Architecture | HIGH | Electron IPC, orchestrator-router, and subagent isolation patterns are well-established. MCP simplifies the Teradata integration layer significantly. The main uncertainty is MCP process lifecycle in Electron, which needs hands-on validation in Phase 2. |
| Pitfalls | HIGH | Security and safety pitfalls (credentials, SQL safety, Electron IPC) are well-documented. Token cost and result-set risks are confirmed by multiple sources. Teradata-specific items (session limits, DBQL availability) are MEDIUM — environment-dependent. |

**Overall confidence:** HIGH

### Gaps to Address

- **MCP process lifecycle in Electron:** How to spawn, manage, and restart the MCP server process (tdsql-mcp / teradata-mcp-server) from the Electron main process. Which transport (stdio vs. HTTP)? How are Teradata credentials passed to the MCP server process securely? Resolve in Phase 2 planning.
- **MCP server selection:** `tdsql-mcp` and `teradata-mcp-server` have overlapping capabilities. Evaluate which to use as primary (or both) based on tool coverage, maintenance status, and credential handling before Phase 2 implementation.
- **Subagent prompt thresholds:** DBA-domain decision criteria for each subagent (MVC column cardinality thresholds, statistics staleness age, skew factor cutoffs) need validation with real Teradata environments. Treat prompts as testable deliverables with versioned examples.
- **Schema context injection scope:** Determine how much DBC metadata to inject into freeform chat system prompts. Too little causes hallucination; too much inflates token costs. Define a caching and scoping strategy in Phase 3 planning.
- **Result set aggregation patterns per subagent:** MVC and Statistics analysis have well-documented DBC views (DBC.TableSizeV, DBC.StatsTbl) but the right aggregation approach for each query template needs validation against production-scale Teradata data volumes.

## Sources

### Primary (HIGH confidence)
- [Anthropic TypeScript SDK releases (GitHub)](https://github.com/anthropics/anthropic-sdk-typescript/releases) — v0.80.0 current, Zod ^3.25 requirement
- [Claude Agent SDK TypeScript reference (Anthropic official docs)](https://platform.claude.com/docs/en/agent-sdk/typescript) — subagent patterns, MCP tool dispatch
- [Electron releases page](https://releases.electronjs.org/) — v41 current, Node v24 bundled
- [Electron Security Documentation](https://www.electronjs.org/docs/latest/tutorial/security) — contextBridge, nodeIntegration defaults
- [Electron safeStorage API](https://www.electronjs.org/docs/latest/api/safe-storage) — credential encryption
- [TailwindCSS v4 announcement](https://tailwindcss.com/blog/tailwindcss-v4) — v4.2 Vite plugin approach
- [electron-vite 5.0 release](https://electron-vite.org/blog/) — December 2025
- [tdsql-mcp](https://github.com/ksturgeon-td/tdsql-mcp) — execute_query, list_databases, list_tables, describe_table, explain_query + 21 SQL reference files
- [teradata-mcp-server](https://github.com/Teradata/teradata-mcp-server) — official Teradata community MCP server (Python)

### Secondary (MEDIUM confidence)
- [Advanced Electron.js Architecture — LogRocket](https://blog.logrocket.com/advanced-electron-js-architecture/) — orchestrator/IPC patterns
- [AI Agent Architecture — Redis](https://redis.io/blog/ai-agent-architecture/) — orchestrator-router pattern
- [Teradata DBQL Tables — dwhpro.com](https://www.dwhpro.com/teradata-query-logging-dbql/) — DBQL availability dependency
- [Teradata Space Management — dwhpro.com](https://www.dwhpro.com/teradata-space/) — DBC.DiskSpaceV queries
- [Teradata Table Skew — dwhpro.com](https://www.dwhpro.com/teradata-table-skew-misleading-natural-artificial/) — skew analysis patterns
- [MVC Analysis via SHOW STATISTICS — dwhpro.com](https://www.dwhpro.com/teradata-multivalue-compression-a-quick-approach/) — MVC query approach
- [Reducing hallucinations in text-to-SQL — Wren AI](https://medium.com/wrenai/reducing-hallucinations-in-text-to-sql-building-trust-and-accuracy-in-data-access-176ac636e208) — schema grounding strategies

### Tertiary (LOW confidence / needs validation)
- Subagent decision thresholds (MVC cardinality, stats staleness age) — synthesized from Teradata community documentation; needs validation against real environments
- Token cost estimates per subagent invocation — no direct benchmarks available; instrument in Phase 4

---
*Research completed: 2026-03-24*
*Ready for roadmap: yes*
