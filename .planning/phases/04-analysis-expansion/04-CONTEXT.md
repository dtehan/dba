# Phase 4: Analysis Expansion - Context

**Gathered:** 2026-03-26 (assumptions mode)
**Status:** Ready for planning

<domain>
## Phase Boundary

Users can run Skew Analysis and Space Usage analysis to identify silent performance killers and proactively manage capacity — completing the full v1 DBA analysis toolkit. Both subagents follow the convention-based markdown pattern established in Phase 3. No new infrastructure, IPC, or UI framework changes needed.

</domain>

<decisions>
## Implementation Decisions

### Subagent Creation Pattern
- **D-01:** Both subagents are markdown files in `subagents/` with frontmatter — zero TypeScript infrastructure changes. The registry auto-discovers them, the agent loop executes them, the launcher displays them.
- **D-02:** Follow the exact frontmatter schema used by security-audit.md, mvc-analysis.md, and stats-analysis.md (name, description, icon, category, tools, params, max_tool_rounds, max_tokens, system prompt with `{{param}}` templates).

### MCP Tool Strategy
- **D-03:** Both subagents use `base_readQuery` as their primary tool to query DBC system views. No new MCP tools required.
- **D-04:** Skew analysis queries: `DBC.TableSizeV` for per-AMP row distribution, `DBC.IndicesV` for primary index metadata, `DBC.ColumnsV` for column cardinality.
- **D-05:** Space analysis queries: `DBC.DiskSpaceV` or `DBC.AllSpaceV` for perm space usage vs allocation, grouped by database and table.
- **D-06:** System prompts must instruct Claude to handle access-denied errors gracefully — if a DBC view is inaccessible, report what's available rather than failing silently.

### Category and Icon Placement
- **D-07:** Skew Analysis → "Performance" category (BarChart3 icon, blue). Consistent with its nature as a query performance concern.
- **D-08:** Space Usage → "Storage" category (Database icon, green). Consistent with its nature as a capacity/storage concern.
- **D-09:** No UI code changes needed — both categories and their icons already exist in SubagentLauncher.tsx.

### Token and Tool Round Limits
- **D-10:** Skew Analysis: 20 max tool rounds, 8192 max tokens. Similar complexity to stats-analysis (a few aggregate queries per database).
- **D-11:** Space Analysis: 30 max tool rounds, 8192 max tokens. System-wide scope may need more rounds than database-scoped analysis.
- **D-12:** Space analysis prompt must cap output to top-N databases/tables by usage (like security-audit's TOP 50 pattern) to keep results bounded regardless of system size.

### Skew Analysis Specifics
- **D-13:** Input parameters: database name (required), optional table name to narrow scope.
- **D-14:** Skew severity ranking: calculate skew factor as `(MAX_AMP_rows - AVG_AMP_rows) / AVG_AMP_rows`. Classify: >0.5 CRITICAL, 0.2-0.5 HIGH, 0.1-0.2 MEDIUM, <0.1 LOW.
- **D-15:** Output includes: ranked table list by skew severity, identified skew cause (PI choice, data pattern, NUPI vs UPI), suggested primary index alternatives with rationale, ALTER TABLE statements for copy-paste.

### Space Usage Specifics
- **D-16:** Input parameters: database name (optional — omit for system-wide). System-wide shows all databases; database-scoped drills into tables.
- **D-17:** Output includes: perm space used vs allocated per database, percent utilization, databases >80% flagged as approaching limits, top space-consuming tables, recommendations for space recovery (drop unused tables, compress, archive).
- **D-18:** System-wide mode caps to top 30 databases by usage. Database-scoped mode caps to top 50 tables.

### Claude's Discretion
- Exact system prompt wording and query sequencing
- Skew threshold tuning (the 0.5/0.2/0.1 cutoffs in D-14 are starting points)
- Space recovery recommendation specifics beyond the general categories in D-17
- How to handle edge cases (empty databases, single-AMP systems, etc.)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Existing subagent patterns (copy these)
- `subagents/security-audit.md` — Frontmatter schema, tool filtering, parameter templates, result capping pattern
- `subagents/mvc-analysis.md` — Complex multi-step analysis prompt, tool round limits for iterative work
- `subagents/stats-analysis.md` — DBC view query pattern, statistics-focused analysis, simpler scope

### Infrastructure (do not modify)
- `src/main/subagents/registry.ts` — Convention-based .md discovery, frontmatter parsing, registry API
- `src/main/ipc/chat.ts` — Agent loop with tool filtering, streaming, max round cap (line 59)
- `src/main/services/bedrock-client.ts` — Shared Bedrock client with AssumeRole
- `src/shared/subagent-types.ts` — SubagentDefinition, SubagentContext, SubagentRunResult types

### UI (do not modify)
- `src/renderer/src/components/SubagentLauncher.tsx` — Category definitions (line 23-36), icon map (line 18)
- `src/renderer/src/features/chat/SubagentResultCard.tsx` — Result card rendering

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `subagents/*.md` — Three working subagent markdown files as templates
- `registry.ts` auto-discovers new .md files — just drop files in `subagents/`
- `CATEGORY_ICONS` and `CATEGORY_COLORS` in SubagentLauncher already include Performance (blue) and Storage (green)

### Established Patterns
- Frontmatter-driven subagent definition (no TypeScript per subagent)
- `base_readQuery` as the universal DBC query tool
- Prompt-level result capping (TOP N in SQL, "limit to top X" in instructions)
- Non-streaming `messages.create` for subagent execution
- Results rendered as markdown in SubagentResultCard

### Integration Points
- New .md files in `subagents/` — auto-registered by convention
- No registry.ts changes needed
- No IPC changes needed
- No UI component changes needed

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches. Follow the Phase 3 subagent patterns exactly.

</specifics>

<deferred>
## Deferred Ideas

None — analysis stayed within phase scope.

</deferred>

---

*Phase: 04-analysis-expansion*
*Context gathered: 2026-03-26*
