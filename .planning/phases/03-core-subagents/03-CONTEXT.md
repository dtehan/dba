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
- Database name required, optional table name to narrow scope. Uses `base_columnDescription` + `base_readQuery` for value distribution analysis.
- Output: ranked list of compression candidates — table, column, distinct values, current compression, estimated savings %, ready-to-copy ALTER TABLE statement.
- **User has existing MVC scripts** — to be provided and incorporated into the subagent prompt/logic.

### Statistics Analysis Subagent
- Database name required, optional table name. Uses `base_readQuery` with DBC.StatsV and DBC.ColumnsV to find missing/stale stats.
- Output: prioritized list — table, column, status (missing/stale/aged), last collected date, COLLECT STATISTICS statement for copy-paste. Sorted by query plan impact (most-joined columns first).

### Claude's Discretion
- Exact system prompt wording for each subagent
- How to detect "system-wide" vs user vs database scope from input
- MVC value distribution query design (unless user provides scripts)
- Statistics staleness thresholds (days since last collect)
- Result card visual layout within existing SubagentResultCard component

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

- User has existing MVC analysis scripts to incorporate — will be provided during planning/execution
- The MCP server already exposes `sec_*` tools for security analysis — use them directly
- `base_readQuery` can run arbitrary SQL for custom analysis queries not covered by specific tools
- Subagent execution should show tool-call status in the result card as they run

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>
