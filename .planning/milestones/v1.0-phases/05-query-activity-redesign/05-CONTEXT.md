# Phase 5: Query Activity Dashboard Redesign - Context

**Gathered:** 2026-04-26
**Status:** Ready for planning
**Source:** Interactive grilling session

<domain>
## Phase Boundary

Redesign the Query Activity Dashboard from a card-based layout to a proper data table with server-side sorting, time range filtering, and a SQL detail slide-out panel with EXPLAIN and subagent integration. No new subagents are created — this phase enhances the existing `query-performance` subagent integration and adds EXPLAIN plan execution.

**Files in scope:**
- `src/renderer/src/features/query-activity/QueryActivityScreen.tsx` — complete rewrite from cards to data table + slide-out panel
- `src/renderer/src/store/query-activity-store.ts` — add sort/time range params to fetch
- `src/main/services/query-activity-metrics.ts` — parameterize SQL query (ORDER BY, WHERE StartTime)
- `src/main/ipc/overview.ts` — update IPC handler to accept sort/time range params
- `src/shared/types.ts` — extend QueryActivityMetrics and IPC types
- `src/preload/index.ts` — update preload bridge for new params
- New: slide-out panel component, EXPLAIN IPC handler

</domain>

<decisions>
## Implementation Decisions

### Table Layout (LOCKED)
- Replace card-style rows with a proper HTML data table
- Columns: #, Username, CPU Time, I/O Count, Elapsed Time, Start Time, SQL Text (~100 char truncated)
- Dense rows to maximize visible queries without scrolling
- Existing text filter (SQL text + username) retained

### Sorting (LOCKED)
- Clickable column headers on CPU Time and I/O Count columns
- Arrow indicators: up for ascending, down for descending, neutral arrows on inactive sortable columns
- **Server-side sort**: changing sort column triggers a re-fetch from Teradata with new `ORDER BY` clause
- Default sort: CPU Time descending
- Rationale: client-side sort only re-sorts the top 200 by CPU — misses the true top 200 by I/O

### Time Range Filtering (LOCKED)
- Preset button row: Last 1 hour, Last 4 hours, Today, Yesterday, Last 7 days
- Default: Today (midnight to now)
- Each preset triggers server-side re-fetch with `WHERE StartTime >= <threshold>` (and `StartTime < <end>` for Yesterday)
- No custom date picker

### SQL Detail Slide-Out Panel (LOCKED)
- Opens when user clicks SQL text in the table
- Slides in from the right side, ~40% of screen width
- Query table stays visible on the left (compressed)
- Contents:
  - **Metadata header**: username, CPU time, I/O count, elapsed time, start time
  - **Full SQL**: fetched via existing `fetchFullSql` IPC, displayed with syntax highlighting and copy button
  - **Action buttons**: "Explain Plan" and "Analyze"
- Panel auto-closes when sort column or time range changes

### Explain Plan Action (LOCKED)
- Runs `EXPLAIN <the full SQL>` against the connected Teradata instance via MCP
- Displays raw EXPLAIN output in the slide-out panel below the SQL
- New IPC channel needed: `QUERY_EXPLAIN` → calls `callMcpTool('base_readQuery', { sql: 'EXPLAIN ...' })`
- No subagent interpretation — raw output only

### Analyze Action (LOCKED)
- Launches the existing `query-performance` subagent with the full SQL text as `queryText` param
- Navigates to chat page to show streaming response
- Uses existing `runSubagentInChat` IPC pattern
- DBA can then continue the conversation for follow-up questions

### Refresh Behavior (LOCKED)
- No auto-refresh — manual refresh button only
- Rationale: auto-refresh is disorienting when scanning/investigating queries; DBA controls when data updates
- Remove the existing 60-second auto-refresh interval

### Claude's Discretion
- Slide-out panel animation style and transition duration
- Exact styling of EXPLAIN output (monospace block vs structured display)
- How to handle EXPLAIN errors (display inline in panel)
- Loading states for full SQL fetch, EXPLAIN execution
- Whether to add Elapsed Time and Start Time to the server query (they should exist in DBC.QryLogV as TotalFirstRespTime and StartTime)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Current Implementation
- `src/renderer/src/features/query-activity/QueryActivityScreen.tsx` — current dashboard component (full rewrite target)
- `src/renderer/src/store/query-activity-store.ts` — current Zustand store (extend with params)
- `src/main/services/query-activity-metrics.ts` — current SQL queries and fetchFullSql (parameterize)
- `src/main/ipc/overview.ts` — current IPC handlers (add EXPLAIN handler)
- `src/shared/types.ts` — QueryActivityMetrics interface, IpcChannels, ElectronAPI
- `src/preload/index.ts` — preload bridge (add new IPC methods)

### Subagent Integration
- `src/renderer/src/lib/subagent-mapping.ts` — QUERY_AGENTS array, query-performance agent mapping
- `subagents/query-performance/prompt.md` — query-performance subagent prompt (receives queryText param)
- `src/main/subagents/registry.ts` — subagent registry

### Patterns to Follow
- `src/renderer/src/features/overview/OverviewScreen.tsx` — reference for dashboard layout patterns
- `src/renderer/src/features/overview/MetricCard.tsx` — reference for loading/error states
- `src/renderer/src/components/SubagentContextMenu.tsx` — existing subagent context menu pattern

</canonical_refs>

<specifics>
## Specific Ideas

- The SQL query in `query-activity-metrics.ts` currently uses `SUBSTR(QueryText, 1, 300)` — change to `SUBSTR(QueryText, 1, 100)` for table display
- Add `StartTime` and `CAST(TotalFirstRespTime AS DECIMAL(18,4)) AS ElapsedTime` to the SELECT
- The `fetchFullSql` function already exists and handles multi-row SQL concatenation from `DBC.DBQLSqlTbl`
- Use `react-syntax-highlighter` (already in the project) for SQL highlighting in the panel
- The EXPLAIN IPC can reuse the `callMcpTool('base_readQuery', ...)` pattern — just prefix the SQL with `EXPLAIN`

</specifics>

<deferred>
## Deferred Ideas

- Custom date picker for arbitrary time ranges
- Additional sort columns (Elapsed Time, Start Time)
- Subagent interpretation of EXPLAIN output (run through Claude for plain-English analysis)
- Export query list to CSV
- Query kill functionality from the panel

</deferred>

---

*Phase: 05-query-activity-redesign*
*Context gathered: 2026-04-26 via interactive grilling session*
