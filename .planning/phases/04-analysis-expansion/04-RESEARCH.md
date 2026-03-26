# Phase 4: Analysis Expansion - Research

**Researched:** 2026-03-26
**Domain:** Teradata DBC system views — skew analysis and space usage; markdown subagent authoring
**Confidence:** HIGH

## Summary

Phase 4 is a pure content phase. Two new subagent markdown files are dropped into `subagents/` and auto-discovered by the existing registry. No TypeScript infrastructure, no IPC changes, no UI changes are required. All integration points already exist.

The research task is to establish correct Teradata SQL for the two new subagents, verify that `DBC.TableSizeV`, `DBC.DiskSpaceV`, `DBC.AllSpaceV`, `DBC.IndicesV`, and `DBC.ColumnsV` are the right views for each analysis, confirm the exact frontmatter schema the registry parser expects, and document pitfalls in system prompt design for DBC view queries.

The pattern is established by three working subagents. Skew Analysis closely mirrors `stats-analysis.md` in scope and tool round budget. Space Usage mirrors `security-audit.md` in its system-wide vs. database-scoped dual mode and its TOP-N capping pattern.

**Primary recommendation:** Author both new files exactly like the existing subagents — same frontmatter schema, same `base_readQuery` tool, same markdown output format. No other work is required for Phase 4.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Both subagents are markdown files in `subagents/` with frontmatter — zero TypeScript infrastructure changes. The registry auto-discovers them, the agent loop executes them, the launcher displays them.
- **D-02:** Follow the exact frontmatter schema used by security-audit.md, mvc-analysis.md, and stats-analysis.md (name, description, icon, category, tools, params, max_tool_rounds, max_tokens, system prompt with `{{param}}` templates).
- **D-03:** Both subagents use `base_readQuery` as their primary tool to query DBC system views. No new MCP tools required.
- **D-04:** Skew analysis queries: `DBC.TableSizeV` for per-AMP row distribution, `DBC.IndicesV` for primary index metadata, `DBC.ColumnsV` for column cardinality.
- **D-05:** Space analysis queries: `DBC.DiskSpaceV` or `DBC.AllSpaceV` for perm space usage vs allocation, grouped by database and table.
- **D-06:** System prompts must instruct Claude to handle access-denied errors gracefully — if a DBC view is inaccessible, report what's available rather than failing silently.
- **D-07:** Skew Analysis → "Performance" category (BarChart3 icon, blue).
- **D-08:** Space Usage → "Storage" category (Database icon, green).
- **D-09:** No UI code changes needed — both categories and their icons already exist in SubagentLauncher.tsx.
- **D-10:** Skew Analysis: 20 max tool rounds, 8192 max tokens.
- **D-11:** Space Analysis: 30 max tool rounds, 8192 max tokens.
- **D-12:** Space analysis prompt must cap output to top-N databases/tables by usage (like security-audit's TOP 50 pattern).
- **D-13:** Skew input parameters: database name (required), optional table name.
- **D-14:** Skew severity: `(MAX_AMP_rows - AVG_AMP_rows) / AVG_AMP_rows`. CRITICAL >0.5, HIGH 0.2–0.5, MEDIUM 0.1–0.2, LOW <0.1.
- **D-15:** Skew output: ranked table list, identified cause, PI alternatives, ALTER TABLE statements.
- **D-16:** Space input parameters: database name (optional — omit for system-wide).
- **D-17:** Space output: perm used vs allocated per database, percent utilization, >80% flagged, top tables, space recovery recommendations.
- **D-18:** System-wide mode caps to top 30 databases. Database-scoped caps to top 50 tables.

### Claude's Discretion

- Exact system prompt wording and query sequencing
- Skew threshold tuning (the 0.5/0.2/0.1 cutoffs in D-14 are starting points)
- Space recovery recommendation specifics beyond the general categories in D-17
- How to handle edge cases (empty databases, single-AMP systems, etc.)

### Deferred Ideas (OUT OF SCOPE)

None — analysis stayed within phase scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SKEW-01 | User can run skew analysis on a database or specific tables | Frontmatter `params` with `databaseName` (required) and `tableName` (optional); registry discovers file automatically |
| SKEW-02 | Analysis identifies tables with significant data distribution skew | `DBC.TableSizeV` exposes per-AMP `RowCount` — MAX/AVG/COUNT aggregate gives skew factor per table |
| SKEW-03 | Analysis explains the cause of skew (PI choice, data patterns) | `DBC.IndicesV` (IndexType P/Q) reveals PI column(s); `DBC.ColumnsV` reveals column type and cardinality hints |
| SKEW-04 | Analysis suggests primary index alternatives to reduce skew | Prompt instructs Claude to reason about column cardinality and propose UPI/NUPI alternatives |
| SKEW-05 | Analysis ranks tables by skew severity | SQL ORDER BY skew factor DESC; prompt maps severity bands CRITICAL/HIGH/MEDIUM/LOW |
| SPAC-01 | User can run space analysis on a database or the full system | `databaseName` param is optional; conditional Mustache blocks `{{#databaseName}}` / `{{^databaseName}}` switch between modes |
| SPAC-02 | Analysis shows current perm space usage vs allocation per database | `DBC.AllSpaceV` exposes `CurrentPerm` (used) and `MaxPerm` (allocated) per database |
| SPAC-03 | Analysis identifies databases approaching space limits | Percent utilization `(CurrentPerm / NULLIF(MaxPerm,0)) * 100`; flag >80% |
| SPAC-04 | Analysis surfaces the largest tables consuming space | `DBC.TableSizeV` grouped by table within the target database, ordered by `CurrentPerm DESC` |
| SPAC-05 | Analysis provides recommendations for space recovery | Prompt instructs Claude to categorize by table age/type (staging, temp, archive candidates) and recommend drop/compress/archive actions |
</phase_requirements>

---

## Standard Stack

### Core
| Library / View | Version | Purpose | Why Standard |
|----------------|---------|---------|--------------|
| `DBC.TableSizeV` | Teradata system view | Per-AMP row and perm space counts per table | Only DBC view with per-AMP `RowCount` — essential for skew calculation |
| `DBC.IndicesV` | Teradata system view | Primary index columns and type (P=NUPI, Q=UPI) | Used by stats-analysis.md already; proven pattern |
| `DBC.ColumnsV` | Teradata system view | Column metadata (type, cardinality hints, nullable) | Used by mvc-analysis.md already; proven pattern |
| `DBC.AllSpaceV` | Teradata system view | Perm space used vs MaxPerm per database | Preferred over `DBC.DiskSpaceV` — already aggregated at database level |
| `base_readQuery` MCP tool | Phase 3 implementation | Execute arbitrary SQL against Teradata | The only tool all subagents use; already implemented and tested |

### DBC View Quick Reference

**`DBC.TableSizeV` columns relevant to skew:**
```sql
-- One row per AMP per table
DatabaseName, TableName, RowCount, CurrentPerm, PeakPerm
-- Aggregate to get skew:
SELECT TableName,
       COUNT(*) AS AMPCount,
       SUM(RowCount) AS TotalRows,
       MAX(RowCount) AS MaxAMPRows,
       AVG(RowCount) AS AvgAMPRows,
       CAST((MAX(RowCount) - AVG(RowCount)) / NULLIF(AVG(RowCount), 0) AS DECIMAL(10,4)) AS SkewFactor
FROM DBC.TableSizeV
WHERE DatabaseName = '{db}'
GROUP BY TableName
HAVING TotalRows > 0
ORDER BY SkewFactor DESC
```

**`DBC.AllSpaceV` columns relevant to space:**
```sql
-- One row per database
DatabaseName, CurrentPerm, PeakPerm, MaxPerm, CurrentSpool, CurrentTemp
-- Percent utilization:
SELECT DatabaseName,
       CurrentPerm,
       MaxPerm,
       CAST(CurrentPerm AS DECIMAL(18,2)) / NULLIF(MaxPerm, 0) * 100 AS PctUsed
FROM DBC.AllSpaceV
ORDER BY CurrentPerm DESC
```

**`DBC.IndicesV` columns relevant to skew cause:**
```sql
-- PI columns for a table
SELECT TRIM(ColumnName) AS ColumnName, IndexType, ColumnPosition
FROM DBC.IndicesV
WHERE DatabaseName = '{db}' AND TableName = '{tbl}'
  AND IndexType IN ('P', 'Q')  -- P=NUPI, Q=UPI
ORDER BY ColumnPosition
```

### Installation
No new packages to install. Phase 4 is markdown files only.

## Architecture Patterns

### Recommended Project Structure
```
subagents/
├── security-audit.md      # existing
├── mvc-analysis.md        # existing
├── stats-analysis.md      # existing
├── skew-analysis.md       # NEW — Phase 4
└── space-usage.md         # NEW — Phase 4
```

### Pattern 1: Frontmatter Schema (from registry.ts source)

The frontmatter parser in `registry.ts` expects this exact structure. Deviating from it will cause silent field omission.

```yaml
---
name: Human-readable name
description: One-sentence description shown in launcher
icon: LucideIconName        # Must be in ICON_MAP: Terminal|Shield|BarChart3|Database|TrendingUp
category: CategoryName      # Must be in CATEGORY_ICONS: Security|Performance|Storage|General
tools: tool1, tool2         # Comma-separated; controls what MCP tools Claude can call
max_tool_rounds: 20         # Integer; per-agent override of the agent loop cap
max_tokens: 8192            # Integer; max response tokens
params:
  - key: paramKey           # Used in {{paramKey}} template substitution
    label: Human Label      # Shown above the form input
    placeholder: e.g., ...  # Input placeholder
    required: true          # or false for optional
---
```

**CRITICAL frontmatter parser constraint:** The YAML parser in `registry.ts` is hand-rolled and simple. It handles the above structure only. Do not use YAML anchors, multi-line values, quoted strings with special characters, or nested objects beyond the `params` array structure.

### Pattern 2: Mustache-style Conditional Blocks

The registry `renderTemplate` function supports three template constructs:

```
{{paramKey}}            — simple substitution
{{#paramKey}}...{{/paramKey}}   — shown only when paramKey has a non-empty value
{{^paramKey}}...{{/paramKey}}   — shown only when paramKey is empty/absent
```

Space Usage uses all three for its dual-mode behavior:
```
{{#databaseName}}Table: {{databaseName}}{{/databaseName}}
{{^databaseName}}Mode: system-wide (all databases){{/databaseName}}
```

### Pattern 3: Result Capping in SQL

Every SQL query must include `TOP N` or aggregate limits. Never issue unbounded queries. This is enforced by convention in all three existing subagents:

```sql
-- System-wide: top 30 databases by usage
SELECT TOP 30 DatabaseName, CurrentPerm, MaxPerm ...
FROM DBC.AllSpaceV
ORDER BY CurrentPerm DESC

-- Database-scoped: top 50 tables
SELECT TOP 50 TableName, SUM(CurrentPerm) AS TotalPerm ...
FROM DBC.TableSizeV
WHERE DatabaseName = '{{databaseName}}'
GROUP BY TableName
ORDER BY TotalPerm DESC
```

### Pattern 4: Graceful Error Continuation

All existing subagents instruct Claude to continue on query failure, not abort:

```
## Rules
- If a query fails, note the error and continue with available data.
- If a DBC view is inaccessible (access denied), report what was accessible rather than failing.
```

This is especially important for DBC views where DBA access permissions vary by site.

### Pattern 5: Output Format Convention

All subagents produce a `# Report Title` markdown document with:
1. Executive Summary table
2. Findings grouped by severity (CRITICAL / HIGH / MEDIUM / LOW)
3. SQL statements in a separate section labeled for copy-paste
4. Rules section at the end

### Anti-Patterns to Avoid
- **Unbounded queries:** Never omit `TOP N` on any DBC query. DBC views can return millions of rows on large systems.
- **Auto-execute SQL:** All ALTER TABLE, COLLECT STATISTICS, and DDL statements must be labeled "copy-paste only."
- **Hard PI suggestions without checking cardinality:** Skew prompt must ask Claude to query `DBC.ColumnsV` for column type before suggesting PI alternatives — recommending a FLOAT or low-cardinality column as PI is worse than the original.
- **DivisionByZero in skew formula:** `AVG(RowCount)` can be 0 for tables with 0 rows. Always use `NULLIF(AVG(RowCount), 0)` in the denominator.
- **MaxPerm = 0 for unbounded databases:** Teradata allows databases with `MaxPerm = 0` (no limit set). Calculating `CurrentPerm / MaxPerm` on these yields a division by zero or misleading 100%. Use `NULLIF(MaxPerm, 0)` and report "no limit set" instead of a percentage.
- **Single-AMP systems:** On a single-AMP dev system, skew factor is always 0. The prompt should detect `AMPCount = 1` and note this as "cannot assess skew on single-AMP system" rather than reporting all tables as LOW skew.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Subagent registration | TypeScript registry entry per agent | Drop `.md` file in `subagents/` | `registry.ts` auto-discovers all `.md` files — no code required |
| Skew calculation math | TypeScript skew formula | Encode formula in system prompt as SQL + instructions | Claude executes SQL via MCP; TypeScript never sees raw AMP data |
| Space utilization % | TypeScript arithmetic | SQL `(CurrentPerm / NULLIF(MaxPerm,0)) * 100` in prompt | Computed in the DB where the data lives |
| PI recommendation engine | TypeScript column cardinality analysis | System prompt instructs Claude to reason about column suitability | Claude already has Teradata PI design knowledge in training |
| New category or icon | TypeScript changes to SubagentLauncher | None — "Performance" (BarChart3, blue) and "Storage" (Database, green) already registered | Both categories are in `CATEGORY_ICONS` and `CATEGORY_COLORS` maps at line 23–36 |

**Key insight:** Phase 4 is prompt engineering, not application engineering. The infrastructure already handles everything.

## Common Pitfalls

### Pitfall 1: `DBC.DiskSpaceV` vs `DBC.AllSpaceV` Confusion
**What goes wrong:** Using `DBC.DiskSpaceV` for space analysis returns one row per AMP per database — thousands of rows on large systems — rather than one row per database.
**Why it happens:** Both views exist; `DiskSpaceV` is often cited first in documentation but is the per-AMP detail view.
**How to avoid:** Use `DBC.AllSpaceV` for database-level summaries (already aggregated). Use `DBC.TableSizeV` for table-level detail.
**Warning signs:** Query returns unexpectedly large result sets when targeting a few databases.

### Pitfall 2: Skew Formula on Tables with Zero Rows
**What goes wrong:** `(MAX(RowCount) - AVG(RowCount)) / AVG(RowCount)` divides by zero for empty tables.
**Why it happens:** `DBC.TableSizeV` includes tables that have been truncated but not dropped.
**How to avoid:** Add `HAVING SUM(RowCount) > 0` to filter empty tables before calculating skew. Use `NULLIF(AVG(RowCount), 0)` as the denominator.
**Warning signs:** SQL errors "Division by zero" from Teradata.

### Pitfall 3: MaxPerm = 0 Misinterpretation
**What goes wrong:** Databases with no space limit (`MaxPerm = 0`) produce a division-by-zero or appear as 0% utilized.
**Why it happens:** Teradata allows `MaxPerm = 0` to mean "unlimited" (or "inherits from parent database space").
**How to avoid:** In the prompt, instruct Claude to check for `MaxPerm = 0` and report "no explicit limit" rather than calculating a percentage.
**Warning signs:** Some databases show 0% utilization even though they have significant `CurrentPerm`.

### Pitfall 4: Frontmatter Parser Limits
**What goes wrong:** The hand-rolled YAML parser in `registry.ts` fails silently on special characters, quoted strings, or anything beyond its supported subset.
**Why it happens:** `parseFrontmatter` is a simple line-by-line parser, not a full YAML parser. See `registry.ts` lines 36–106.
**How to avoid:** Keep all frontmatter values unquoted plain text. No colons in values, no special YAML characters. Use the existing subagents as exact templates.
**Warning signs:** Subagent appears in launcher with empty name or missing params.

### Pitfall 5: `DBC.IndicesV` IndexType Values
**What goes wrong:** Querying IndexType = 'P' alone misses UPI tables, giving incomplete PI metadata for skew cause analysis.
**Why it happens:** Teradata uses 'P' = NUPI (non-unique PI) and 'Q' = UPI (unique PI). Both are primary indexes.
**How to avoid:** Always filter `IndexType IN ('P', 'Q')` for primary index queries. This is already the pattern in `stats-analysis.md`.
**Warning signs:** Tables with UPI show "no primary index found" in output.

### Pitfall 6: Recommending Low-Cardinality PI Alternatives
**What goes wrong:** Skew prompt suggests replacing a skewed DATE column PI with a STATUS column (e.g., 'Y'/'N' values) — which would create even worse skew.
**Why it happens:** Without column cardinality data, Claude's suggestion may not account for value distribution.
**How to avoid:** Instruct Claude to query `DBC.ColumnsV` for column type and note high-cardinality columns (numeric IDs, timestamps) as better PI candidates over low-cardinality categorical columns.
**Warning signs:** PI alternative suggestions name VARCHAR(1) or CHAR(1) columns.

## Code Examples

### Skew Analysis Core Query
```sql
-- Source: D-04 decision + DBC.TableSizeV documentation
-- One row per table with skew factor
SELECT TOP 50
    TableName,
    COUNT(*) AS AMPCount,
    CAST(SUM(RowCount) AS BIGINT) AS TotalRows,
    MAX(RowCount) AS MaxAMPRows,
    CAST(AVG(RowCount) AS BIGINT) AS AvgAMPRows,
    CAST(
        (MAX(RowCount) - AVG(RowCount)) / NULLIF(CAST(AVG(RowCount) AS FLOAT), 0)
    AS DECIMAL(10,4)) AS SkewFactor
FROM DBC.TableSizeV
WHERE DatabaseName = '{{databaseName}}'
GROUP BY TableName
HAVING SUM(RowCount) > 0
ORDER BY SkewFactor DESC
```

### Space Usage — System-Wide Database Summary
```sql
-- Source: D-05 decision + DBC.AllSpaceV
-- Top 30 databases by current perm usage
SELECT TOP 30
    DatabaseName,
    CAST(CurrentPerm AS BIGINT) AS CurrentPermBytes,
    CAST(MaxPerm AS BIGINT) AS MaxPermBytes,
    CASE
        WHEN MaxPerm = 0 THEN NULL
        ELSE CAST((CAST(CurrentPerm AS FLOAT) / MaxPerm * 100) AS DECIMAL(5,2))
    END AS PctUsed
FROM DBC.AllSpaceV
ORDER BY CurrentPerm DESC
```

### Space Usage — Table Detail Within a Database
```sql
-- Source: D-18 decision + DBC.TableSizeV
-- Top 50 tables by space within target database
SELECT TOP 50
    TableName,
    CAST(SUM(CurrentPerm) AS BIGINT) AS TotalPerm,
    CAST(SUM(RowCount) AS BIGINT) AS TotalRows
FROM DBC.TableSizeV
WHERE DatabaseName = '{{databaseName}}'
GROUP BY TableName
ORDER BY TotalPerm DESC
```

### Skew Cause — Primary Index Lookup
```sql
-- Source: stats-analysis.md pattern (proven in Phase 3)
SELECT TRIM(ColumnName) AS ColumnName,
       IndexType,
       ColumnPosition
FROM DBC.IndicesV
WHERE DatabaseName = '{{databaseName}}'
  AND TableName = '{TABLE_NAME}'
  AND IndexType IN ('P', 'Q')
ORDER BY ColumnPosition
```

### Skew Cause — Column Cardinality Hint
```sql
-- Source: DBC.ColumnsV — used in mvc-analysis.md
SELECT TRIM(ColumnName) AS ColumnName,
       ColumnType,
       ColumnLength,
       Nullable
FROM DBC.ColumnsV
WHERE DatabaseName = '{{databaseName}}'
  AND TableName = '{TABLE_NAME}'
ORDER BY ColumnId
```

### Recommended Skew Analysis Frontmatter
```yaml
---
name: Skew Analysis
description: Identifies data distribution skew by table and suggests primary index alternatives.
icon: BarChart3
category: Performance
tools: base_readQuery
max_tool_rounds: 20
max_tokens: 8192
params:
  - key: databaseName
    label: Database Name
    placeholder: e.g., PROD_DB
    required: true
  - key: tableName
    label: Table Name (optional)
    placeholder: Leave blank to analyze all tables
    required: false
---
```

### Recommended Space Usage Frontmatter
```yaml
---
name: Space Usage
description: Analyzes perm space utilization by database and table with capacity recommendations.
icon: Database
category: Storage
tools: base_readQuery
max_tool_rounds: 30
max_tokens: 8192
params:
  - key: databaseName
    label: Database Name (optional)
    placeholder: Leave blank for system-wide analysis
    required: false
---
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `DBC.DiskSpaceV` for DB-level space | `DBC.AllSpaceV` for aggregated summary | Always available | AllSpaceV is already aggregated; DiskSpaceV requires GROUP BY on thousands of AMP rows |
| Custom TypeScript subagent registration | Markdown file drop in `subagents/` | Phase 3 | Zero TypeScript for new subagents |
| Separate streaming vs. non-streaming agent paths | Unified `runAgentLoop` with streaming in `chat.ts` | Phase 3 | All subagents use the same loop |

## Open Questions

1. **Single-AMP dev environments**
   - What we know: Skew cannot be measured on a 1-AMP system (all rows on 1 AMP = no distribution to skew)
   - What's unclear: Should the subagent detect this and skip gracefully, or warn the user?
   - Recommendation: Instruct Claude to check `COUNT(DISTINCT AMPNum)` from `DBC.TableSizeV` before proceeding and report "single-AMP environment detected — skew analysis not applicable" if count = 1

2. **`MaxPerm = 0` semantic**
   - What we know: In Teradata, `MaxPerm = 0` can mean either "unlimited" (inherits from parent) or "no space assigned"
   - What's unclear: Whether this varies by Teradata version or configuration
   - Recommendation: Display raw `MaxPerm` value and note "no explicit limit" rather than computing a percentage when MaxPerm = 0; let the DBA interpret

3. **Table-scoped mode for skew — extra PI query cost**
   - What we know: When `tableName` is specified, the analysis narrows to one table. The skew calculation still requires aggregating `DBC.TableSizeV` per-AMP data, then querying `DBC.IndicesV` and `DBC.ColumnsV`.
   - What's unclear: Whether 20 tool rounds is sufficient for a highly partitioned or column-partitioned table with many PI combinations.
   - Recommendation: 20 rounds is sufficient — a single table needs at most 4-5 queries (table size, skew aggregate, PI lookup, column metadata, one cardinality check). This matches the stats-analysis.md budget.

## Environment Availability

Step 2.6: SKIPPED — Phase 4 is purely markdown file authoring. No new external dependencies. All required tools (`base_readQuery`, Bedrock client, MCP) were validated in Phase 3.

## Sources

### Primary (HIGH confidence)
- `subagents/security-audit.md` — Canonical frontmatter schema, result capping pattern, graceful error handling
- `subagents/stats-analysis.md` — `DBC.IndicesV`, `DBC.ColumnsV`, and `DBC.TableSizeV` query patterns already verified against running Teradata
- `subagents/mvc-analysis.md` — Complex multi-step prompt structure, `base_readQuery` tool, column metadata patterns
- `src/main/subagents/registry.ts` — Authoritative source on frontmatter parsing limits, template syntax, tool filter mechanics
- `src/renderer/src/components/SubagentLauncher.tsx` lines 18–36 — ICON_MAP and CATEGORY_COLORS confirming Performance/BarChart3 and Storage/Database already registered
- `src/shared/subagent-types.ts` — SubagentDefinition, SubagentParam type shapes

### Secondary (MEDIUM confidence)
- `src/main/ipc/chat.ts` — `runAgentLoop` confirms streaming subagent execution path, `maxToolRounds` and `maxTokens` per-subagent config wiring
- `.planning/phases/04-analysis-expansion/04-CONTEXT.md` — Decision record for all locked choices

### Tertiary (LOW confidence)
- General Teradata DBC view documentation (training knowledge) — `DBC.AllSpaceV` column names `CurrentPerm`, `MaxPerm`; `DBC.TableSizeV` per-AMP structure. Confidence is MEDIUM in practice since these views are long-stable in Teradata, but cannot be verified without a live Teradata connection in this environment.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — verified directly from existing subagent source files and registry.ts
- Architecture: HIGH — frontmatter schema derived from registry.ts parser source, not documentation
- Pitfalls: HIGH — DiskSpaceV vs AllSpaceV, NULLIF patterns, and IndexType values derived from existing working queries in stats-analysis.md and mvc-analysis.md
- DBC view columns: MEDIUM — training knowledge for Teradata system views; consistent with how they are used in Phase 3 subagents

**Research date:** 2026-03-26
**Valid until:** 2026-06-26 (stable — no external dependencies, Teradata DBC views are long-stable APIs)
