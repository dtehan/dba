---
phase: 03-core-subagents
plan: 03
subsystem: subagents
tags: [mvc, compression, bedrock, teradata, tool-use, package-bit-cost-model]

# Dependency graph
requires:
  - phase: 03-01
    provides: Bedrock client shared service, tool-use loop pattern
  - phase: 03-02
    provides: Security audit subagent pattern (tool filter, buildSystemPrompt, MAX_TOOL_ROUNDS)
provides:
  - MVC Analysis subagent (mvc-analysis.ts) with full Package Bit-Cost Model algorithm in system prompt
  - mvcAnalysisDef registered in subagent registry — appears in launcher with Database icon
  - Two-parameter form: databaseName (required) + tableName (optional)
affects:
  - Phase 04 (UI/integration) — MVC subagent visible in SubagentLauncher
  - Statistics subagent (03-04) — follows same tool-use loop pattern

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Tool-use loop with MAX_TOOL_ROUNDS=100 for multi-table analysis (extends security audit pattern)"
    - "MVC_TOOLS filter: base_readQuery, base_columnDescription, base_tableDDL, dba_tableSpace, base_tableList"
    - "max_tokens: 16384 for large analysis output (executive summary + SQL blocks)"
    - "Package Bit-Cost Model encoded entirely in system prompt — Claude executes algorithm via MCP tool calls"

key-files:
  created:
    - src/main/subagents/mvc-analysis.ts
  modified:
    - src/main/subagents/registry.ts

key-decisions:
  - "MAX_TOOL_ROUNDS=100 — MVC requires many tool calls: each table needs row count + column metadata + PI query + DDL + N distribution queries"
  - "max_tokens=16384 — MVC output is large: executive summary + per-table details + compression SQL + rollback SQL"
  - "Algorithm encoded in system prompt not as TypeScript — Claude executes Package Bit-Cost Model step-by-step using MCP tools, no calculation in app code"
  - "Single-agent approach — combined orchestrator+worker into one system prompt since the app runs sequentially (no parallel Agent spawning)"

patterns-established:
  - "MVC tool-use loop: same pattern as security-audit but with higher round/token limits"
  - "Optional parameter handling: trim() + || undefined for tableName"

requirements-completed: [MVCA-01, MVCA-02, MVCA-03, MVCA-04, MVCA-05]

# Metrics
duration: 2min
completed: 2026-03-26
---

# Phase 03 Plan 03: MVC Analysis Summary

**MVC Analysis subagent with complete Package Bit-Cost Model algorithm (Jim Calvert, Teradata/NCR) encoded in system prompt, using 100-round tool-use loop and 16,384-token output budget**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-26T02:34:23Z
- **Completed:** 2026-03-26T02:36:27Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Created mvc-analysis.ts with mvcAnalysisDef (Database icon, databaseName required, tableName optional) and runMvcAnalysis function
- Encoded complete Package Bit-Cost Model algorithm (Steps A-I: ValueSavings, rank, extended length check, package grouping, cumulative net benefit, optimal package selection) in system prompt
- All algorithm parameters present: 0.00055 HAVING threshold, SAMPLE 0.10 for >10M rows, 8,100 extended length limit, 40,000 cumulative header limit, CRITICAL/HIGH/MEDIUM/SKIP priority thresholds
- Registered mvc-analysis in registry alongside echo and security-audit

## Task Commits

Each task was committed atomically:

1. **Task 1: Create MVC Analysis subagent with Package Bit-Cost Model system prompt** - `da56440` (feat)
2. **Task 2: Register MVC Analysis in the subagent registry** - `4fab820` (feat)

**Plan metadata:** (docs commit below)

## Files Created/Modified
- `src/main/subagents/mvc-analysis.ts` - MVC Analysis subagent: definition, 100-round tool-use loop, complete Package Bit-Cost Model system prompt
- `src/main/subagents/registry.ts` - Added import and registration of mvcAnalysisDef + runMvcAnalysis

## Decisions Made
- MAX_TOOL_ROUNDS=100 (vs 20 for security audit) — MVC needs many more tool calls: each table requires row count query, column metadata, PI columns query, identity columns query, DDL fetch, plus one distribution query per eligible column
- max_tokens=16384 — MVC output is substantially larger than security audit: executive summary table + priority classification + per-table details + compression SQL blocks + rollback SQL
- Algorithm fully in system prompt — Claude runs Package Bit-Cost Model as directed text instructions via MCP tool calls, no TypeScript math needed; this keeps the subagent definition simple and easy to tune
- Combined orchestrator+worker into one prompt — the source MVC agent used parallel spawning (two agent definitions); the app runs sequentially so both roles merged into a single system prompt

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- MVC Analysis subagent complete — will appear in SubagentLauncher with Database icon
- Statistics analysis subagent (03-04) follows the same tool-use loop pattern
- Phase 04 UI/integration can pick up mvc-analysis from the registry immediately

## Self-Check: PASSED

- FOUND: src/main/subagents/mvc-analysis.ts
- FOUND: src/main/subagents/registry.ts
- FOUND: .planning/phases/03-core-subagents/03-03-SUMMARY.md
- FOUND commit: da56440 (Task 1)
- FOUND commit: 4fab820 (Task 2)

---
*Phase: 03-core-subagents*
*Completed: 2026-03-26*
