---
phase: 03-core-subagents
plan: 04
subsystem: subagents
tags: [statistics, teradata, dbc-views, collect-statistics, subagent]
dependency_graph:
  requires: ["03-01", "03-03"]
  provides: ["stats-analysis subagent", "4-subagent registry"]
  affects: ["SubagentLauncher (renderer)", "registry.ts"]
tech_stack:
  added: []
  patterns: ["tool-use loop (20 rounds)", "STATS_TOOLS filter", "system-prompt-as-algorithm"]
key_files:
  created:
    - src/main/subagents/stats-analysis.ts
  modified:
    - src/main/subagents/registry.ts
decisions:
  - "MAX_TOOL_ROUNDS=20 for stats analysis — fewer rounds than MVC (100) because stats queries are simpler DBC view lookups, not per-column distribution scans"
  - "STATS_TOOLS=['base_readQuery'] only — stats analysis only needs raw SQL against DBC system views, no DDL or table inspection tools needed"
  - "max_tokens=8192 for stats — report is smaller than MVC (no per-column distribution tables), 8192 is sufficient"
metrics:
  duration: "2 minutes"
  completed: "2026-03-25"
  tasks_completed: 2
  files_created: 1
  files_modified: 1
---

# Phase 03 Plan 04: Statistics Analysis Subagent Summary

Statistics Analysis subagent that queries DBC.StatsV, DBC.IndicesV, and DBC.ColumnsV to identify missing and stale statistics, producing prioritized COLLECT STATISTICS statements for copy-paste execution.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create Statistics Analysis subagent definition and run function | 500f623 | src/main/subagents/stats-analysis.ts (created) |
| 2 | Register Statistics Analysis in the subagent registry | 3fce3cf | src/main/subagents/registry.ts (modified) |

## What Was Built

### stats-analysis.ts
- `statsAnalysisDef`: SubagentDefinition with id `stats-analysis`, name "Statistics Analysis", icon `BarChart3`, and two params: `databaseName` (required) and `tableName` (optional)
- `runStatsAnalysis(ctx)`: Tool-use loop with MAX_TOOL_ROUNDS=20 and max_tokens=8192, filtered to `base_readQuery` only
- `buildStatsSystemPrompt(databaseName, tableName?)`: Comprehensive system prompt encoding the full statistics analysis algorithm

### System Prompt Algorithm Coverage

| Requirement | Coverage |
|-------------|----------|
| STAT-01: User runs analysis for database/table | databaseName (required) + tableName (optional) params; user prompt branches on presence of tableName |
| STAT-02: Missing stats on indexed columns | Step 2 query joining DBC.IndicesV LEFT JOIN DBC.StatsV to find NULL StatsId |
| STAT-03: Stale statistics detection | Step 3 query with 30-day threshold for index columns (P/Q/S/K), 90-day for others |
| STAT-04: COLLECT STATISTICS statements | Step 5 templates for single-column COLUMN and multi-column INDEX forms |
| STAT-05: Priority ordering by query plan impact | CRITICAL (missing PI) > HIGH (stale index, >30 days) > MEDIUM (join columns) > LOW (stale non-index, >90 days) |

### Join Column Heuristic
Step 4 detects likely join columns without statistics using name pattern matching: `%_ID`, `%_KEY`, `%_CD`, `%_CODE`, `%_FK` against DBC.ColumnsV.

### registry.ts
Added `stats-analysis` as the 4th entry after `mvc-analysis`. Registry now provides: echo, security-audit, mvc-analysis, stats-analysis.

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None. The subagent is fully wired: definition exported, run function implemented with tool-use loop, registered in registry. The SubagentLauncher renderer (Phase 2) will pick up stats-analysis automatically from the registry.

## Self-Check: PASSED

- [x] `src/main/subagents/stats-analysis.ts` exists with all required exports
- [x] `src/main/subagents/registry.ts` contains statsAnalysisDef and runStatsAnalysis
- [x] Commit 500f623 exists (Task 1)
- [x] Commit 3fce3cf exists (Task 2)
- [x] `npx tsc --noEmit` passes with no errors
- [x] All 4 subagents present in registry: echo, security-audit, mvc-analysis, stats-analysis
