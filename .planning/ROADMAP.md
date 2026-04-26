# Roadmap: Teradata DBA Agent

## Milestones

- ✅ **v1.0 MVP** — Phases 1-4 (shipped 2026-03-27)

## Phases

<details>
<summary>✅ v1.0 MVP (Phases 1-4) — SHIPPED 2026-03-27</summary>

- [x] Phase 1: Foundation (5/5 plans) — completed 2026-03-24
- [x] Phase 2: Chat (5/5 plans) — completed 2026-03-26
- [x] Phase 3: Core Subagents (5/5 plans) — completed 2026-03-26
- [x] Phase 4: Analysis Expansion (2/2 plans) — completed 2026-03-26

</details>

- [ ] **Phase 5: Query Activity Dashboard Redesign** - Replace card layout with data table, add server-side sorting, time range filters, SQL detail slide-out panel with EXPLAIN and subagent launch

### Phase 5: Query Activity Dashboard Redesign
**Goal**: DBAs can efficiently investigate query performance by sorting, filtering by time range, and drilling into individual queries with full SQL, EXPLAIN plans, and one-click subagent optimization — all from a dense, scannable data table
**Depends on**: Phase 4
**Requirements**: QADH-01, QADH-02, QADH-03, QADH-04, QADH-05, QADH-06, QADH-07, QADH-08, QADH-09
**Plans:** 1/3 plans executed
Plans:
- [x] 05-01-PLAN.md — Backend pipeline: extend types, parameterize SQL with sort/time range, add EXPLAIN IPC, update store
- [ ] 05-02-PLAN.md — Screen rewrite: dense data table with sortable columns, time range presets, text filter
- [ ] 05-03-PLAN.md — SQL detail panel: slide-out with syntax highlighting, EXPLAIN execution, Analyze subagent launch
**Success Criteria** (what must be TRUE):
  1. Query Activity shows a data table with columns: Username, CPU Time, I/O Count, Elapsed Time, Start Time, SQL Text (~100 chars truncated)
  2. Clicking CPU or I/O column headers re-fetches top 200 from Teradata with the corresponding ORDER BY — server-side sort, not client-side
  3. Preset time range buttons (Last 1h, 4h, Today, Yesterday, 7 days) filter queries via server-side WHERE clause on StartTime; default is Today
  4. Clicking SQL text opens a right slide-out panel (~40% width) with full SQL (syntax highlighted), metadata header, copy button, and action buttons
  5. "Explain Plan" button in the panel runs EXPLAIN against Teradata and shows the output in the panel
  6. "Analyze" button launches the query-performance subagent with full SQL and navigates to chat for streaming results
  7. Panel auto-closes when sort or time range changes; no auto-refresh — manual refresh only
**UI hint**: yes

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Foundation | v1.0 | 5/5 | Complete | 2026-03-24 |
| 2. Chat | v1.0 | 5/5 | Complete | 2026-03-26 |
| 3. Core Subagents | v1.0 | 5/5 | Complete | 2026-03-26 |
| 4. Analysis Expansion | v1.0 | 2/2 | Complete | 2026-03-26 |
| 5. Query Activity Redesign | v1.1 | 1/3 | In Progress|  |
