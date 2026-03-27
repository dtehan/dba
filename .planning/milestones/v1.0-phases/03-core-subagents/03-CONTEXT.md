# Phase 3: Core Subagents - Context

**Gathered:** 2026-03-26
**Status:** Ready for planning

<domain>
## Phase Boundary

Users can run Security Audit, MVC Analysis, and Statistics Analysis against their Teradata environment and receive structured, actionable findings with copy-paste SQL remediation steps. Each subagent leverages the existing MCP tool-use infrastructure from Phase 2 — no new backend plumbing needed, only specialized prompt engineering and UI for launching with parameters.

</domain>

<decisions>
## Implementation Decisions

### Subagent Architecture
- Each subagent is a specialized system prompt + MCP tool calls orchestrated by Claude via the existing agentic tool-use loop in chat.ts. No separate API call chain needed.
- Subagent definitions live in `src/main/subagents/` as TypeScript files exporting a `SubagentDefinition` — same pattern as the echo agent from Phase 2.
- System prompt instructs Claude to cap results (e.g. "show top 20 findings"). MCP tools already return bounded result sets. No additional backend capping needed.
- Each subagent can require input parameters (e.g. database name, username). The launcher UI shows a simple input form before running.

### Security Audit Subagent
- User provides a username OR database name OR "system-wide" — prompt adapts based on input type.
- Uses existing MCP tools: `sec_userRoles`, `sec_userDbPermissions`, `sec_rolePermissions`, `base_readQuery` (for custom queries like logon history).
- Output: prioritized findings list (High/Medium/Low severity), each with: finding description, affected objects, remediation SQL. Rendered as markdown in the result card.
- Checks: access rights, role membership, overly permissive grants (ALL/WITH GRANT OPTION), orphaned access. Logon anomalies via DBQL if available. Matches SECU-01 through SECU-05.

### MVC Analysis Subagent
- Database name required, optional table name to narrow scope.
- **User has provided complete MVC agent definitions** at `/Users/Daniel.Tehan/Code/MVC Agent/.claude/agents/`:
  - `mvc-compression-advisor.md` — Orchestrator: enumerates eligible tables (TableKind='T', >=100 rows), spawns parallel worker analysis per table, aggregates results into compression script, rollback script, and executive report.
  - `mvc-table-analyzer.md` — Worker: analyzes a single table using the **Package Bit-Cost Model** (Jim Calvert, Teradata/NCR). Determines optimal compression values per column using bit-cost packages, value savings ranking, extended length checks, and cumulative header limits (40KB).
- Key algorithm parameters: min 100 rows, HAVING threshold 0.00055×RowCount, extended length limit 8100, 255 max values/column, sampling at 10% for >10M rows.
- Uses MCP tools: `base_readQuery`, `base_columnDescription`, `base_tableDDL`, `dba_tableSpace`, `base_tableList`.
- Output: three files per analysis — `{db}_mvc_compression.sql`, `{db}_mvc_rollback.sql`, `{db}_mvc_report.md`. Priority classification: CRITICAL (>=25%), HIGH (10-24%), MEDIUM (5-9%), SKIP (<5%).
- In the DBA Agent app, the MVC subagent should adapt this orchestrator/worker pattern to run within the chat interface, with results rendered as a rich result card.

### Statistics Analysis Subagent
- Database name required, optional table name. Uses `base_readQuery` with DBC.StatsV and DBC.ColumnsV to find missing/stale stats.
- Output: prioritized list — table, column, status (missing/stale/aged), last collected date, COLLECT STATISTICS statement for copy-paste. Sorted by query plan impact (most-joined columns first).

### Claude's Discretion
- Exact system prompt wording for Security and Statistics subagents
- How to detect "system-wide" vs user vs database scope from Security audit input
- Statistics staleness thresholds (days since last collect)
- Result card visual layout within existing SubagentResultCard component
- How to adapt the MVC orchestrator/worker file-output pattern to in-app result cards

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/main/subagents/registry.ts` — SubagentDefinition registry with register/list/get
- `src/main/subagents/echo.ts` — Echo test subagent (template for new subagents)
- `src/main/ipc/subagent.ts` — IPC handler that runs subagents via registry
- `src/main/ipc/chat.ts` — Agentic tool-use loop with MCP tool discovery (reusable for subagent execution)
- `src/renderer/src/components/SubagentLauncher.tsx` — Sidebar launcher panel
- `src/renderer/src/features/chat/SubagentResultCard.tsx` — Orange-bordered result card
- `src/shared/subagent-types.ts` — SubagentDefinition, SubagentContext, SubagentRunResult types

### Established Patterns
- Subagents registered in registry.ts, listed via IPC, launched from SubagentLauncher
- MCP tools discovered dynamically from server — no hardcoded tool definitions needed
- Tool-use loop handles multi-step tool calls with streaming status updates

### Integration Points
- New subagent files in `src/main/subagents/` — register in registry.ts
- SubagentLauncher needs parameter input form for subagents that require it
- SubagentRunResult content rendered by SubagentResultCard (markdown)

</code_context>

<specifics>
## Specific Ideas

- User's complete MVC agent definitions are at `/Users/Daniel.Tehan/Code/MVC Agent/.claude/agents/mvc-compression-advisor.md` and `mvc-table-analyzer.md` — these contain the full Package Bit-Cost Model algorithm, SQL queries, output formats, and priority classification. Planner and executor MUST read these files.
- The MCP server already exposes `sec_*` tools for security analysis — use them directly
- `base_readQuery` can run arbitrary SQL for custom analysis queries not covered by specific tools
- Subagent execution should show tool-call status in the result card as they run

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>
