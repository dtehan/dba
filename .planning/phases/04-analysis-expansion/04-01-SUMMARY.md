---
phase: 04-analysis-expansion
plan: 01
subsystem: subagents
tags: [teradata, dbc-views, skew-analysis, primary-index, performance]

# Dependency graph
requires:
  - phase: 03-subagents
    provides: "Convention-based subagent auto-discovery from markdown files in subagents/; base_readQuery MCP tool; SubagentLauncher with Performance category registered"
provides:
  - "Skew Analysis subagent (subagents/skew-analysis.md) discoverable by registry.ts"
  - "5-step DBC view analysis: TableSizeV skew calculation, IndicesV PI lookup, ColumnsV cardinality, ALTER TABLE output"
  - "Severity classification at CRITICAL/HIGH/MEDIUM/LOW thresholds (0.5/0.2/0.1 SkewFactor)"
affects: [04-analysis-expansion]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Skew factor formula encoded in SQL prompt: (MAX_AMP_rows - AVG_AMP_rows) / NULLIF(CAST(AVG_AMP_rows AS FLOAT), 0)"
    - "Mustache conditional blocks for optional tableName param switching between single-table and all-tables mode"
    - "Single-AMP detection gate at Step 1 to abort gracefully on dev/single-AMP systems"

key-files:
  created:
    - subagents/skew-analysis.md
  modified: []

key-decisions:
  - "Skew Analysis uses exactly 20 max_tool_rounds and 8192 max_tokens, matching stats-analysis.md budget (4-5 queries per table is sufficient)"
  - "Single-AMP detection runs first via COUNT(DISTINCT Vproc) on DBC.TableSizeV — skew is undefined on 1-AMP systems"
  - "NULLIF(CAST(AVG(RowCount) AS FLOAT), 0) in denominator prevents division-by-zero for truncated tables with 0 rows"
  - "HAVING SUM(RowCount) > 0 filters empty tables before skew calculation"
  - "IndexType IN ('P', 'Q') captures both NUPI (P) and UPI (Q) primary indexes — P-only would miss UPI tables"
  - "DBC.ColumnsV cardinality check required before recommending PI alternatives — prevents suggesting low-cardinality columns"

patterns-established:
  - "Pattern: Markdown subagent with dual-mode Mustache conditionals for optional table scoping"

requirements-completed: [SKEW-01, SKEW-02, SKEW-03, SKEW-04, SKEW-05]

# Metrics
duration: 1min
completed: 2026-03-26
---

# Phase 4 Plan 01: Skew Analysis Summary

**Teradata skew analysis subagent with 5-step DBC view pipeline: per-AMP TableSizeV skew factor, IndicesV PI cause lookup, ColumnsV cardinality check, and ALTER TABLE PI alternative suggestions ranked CRITICAL/HIGH/MEDIUM/LOW**

## Performance

- **Duration:** 1 min
- **Started:** 2026-03-26T18:42:03Z
- **Completed:** 2026-03-26T18:43:17Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments

- Created `subagents/skew-analysis.md` — auto-discovered by registry.ts with no TypeScript changes required
- Implemented full skew pipeline: single-AMP detection gate, TableSizeV skew factor, IndicesV PI lookup, ColumnsV cardinality, ALTER TABLE generation
- Severity banding at 0.5/0.2/0.1 SkewFactor with CRITICAL/HIGH/MEDIUM/LOW classification
- All pitfalls from RESEARCH.md addressed: NULLIF guards, HAVING filter, IndexType IN ('P','Q'), cardinality check before PI suggestions

## Task Commits

1. **Task 1: Create Skew Analysis subagent markdown file** - `024389f` (feat)

**Plan metadata:** (docs commit — see below)

## Files Created/Modified

- `subagents/skew-analysis.md` - Skew Analysis subagent; frontmatter with Performance/BarChart3; 5-step DBC view analysis with Mustache conditional blocks for optional table scoping

## Decisions Made

- Used exact same frontmatter schema as stats-analysis.md (closest sibling) — same max_tool_rounds, max_tokens, tool, category, icon
- Single-AMP detection placed at Step 1 to gate the entire analysis gracefully rather than producing misleading zero-skew results
- Mustache {{#tableName}}/{{^tableName}} blocks used for dual-mode (single table vs all tables) matching the established pattern in stats-analysis.md

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required. The file is auto-discovered by the existing registry.ts on next app start.

## Known Stubs

None - subagent definition is complete and will produce real analysis output when run against a live Teradata system.

## Next Phase Readiness

- Skew Analysis subagent ready for use; will appear under Performance category in SubagentLauncher
- Plan 02 (Space Usage subagent) can proceed independently — same pattern, Storage category with Database icon

---
*Phase: 04-analysis-expansion*
*Completed: 2026-03-26*
