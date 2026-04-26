# Phase 5: Query Activity Dashboard Redesign - Research

**Researched:** 2026-04-26
**Domain:** React/Electron UI — data table, slide-out panel, server-side sort/filter, IPC extension
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Table Layout (LOCKED)**
- Replace card-style rows with a proper HTML data table
- Columns: #, Username, CPU Time, I/O Count, Elapsed Time, Start Time, SQL Text (~100 char truncated)
- Dense rows to maximize visible queries without scrolling
- Existing text filter (SQL text + username) retained

**Sorting (LOCKED)**
- Clickable column headers on CPU Time and I/O Count columns
- Arrow indicators: up for ascending, down for descending, neutral arrows on inactive sortable columns
- Server-side sort: changing sort column triggers a re-fetch from Teradata with new ORDER BY clause
- Default sort: CPU Time descending
- Rationale: client-side sort only re-sorts the top 200 by CPU — misses the true top 200 by I/O

**Time Range Filtering (LOCKED)**
- Preset button row: Last 1 hour, Last 4 hours, Today, Yesterday, Last 7 days
- Default: Today (midnight to now)
- Each preset triggers server-side re-fetch with WHERE StartTime >= threshold (and StartTime < end for Yesterday)
- No custom date picker

**SQL Detail Slide-Out Panel (LOCKED)**
- Opens when user clicks SQL text in the table
- Slides in from the right side, ~40% of screen width
- Query table stays visible on the left (compressed)
- Contents:
  - Metadata header: username, CPU time, I/O count, elapsed time, start time
  - Full SQL: fetched via existing fetchFullSql IPC, displayed with syntax highlighting and copy button
  - Action buttons: "Explain Plan" and "Analyze"
- Panel auto-closes when sort column or time range changes

**Explain Plan Action (LOCKED)**
- Runs EXPLAIN <the full SQL> against Teradata via MCP
- Displays raw EXPLAIN output in the slide-out panel below the SQL
- New IPC channel needed: QUERY_EXPLAIN → calls callMcpTool('base_readQuery', { sql: 'EXPLAIN ...' })
- No subagent interpretation — raw output only

**Analyze Action (LOCKED)**
- Launches the existing query-performance subagent with the full SQL text as queryText param
- Navigates to chat page to show streaming response
- Uses existing runSubagentInChat IPC pattern
- DBA can then continue the conversation for follow-up questions

**Refresh Behavior (LOCKED)**
- No auto-refresh — manual refresh button only
- Remove the existing 60-second auto-refresh interval

### Claude's Discretion
- Slide-out panel animation style and transition duration
- Exact styling of EXPLAIN output (monospace block vs structured display)
- How to handle EXPLAIN errors (display inline in panel)
- Loading states for full SQL fetch, EXPLAIN execution
- Whether to add Elapsed Time and Start Time to the server query (they should exist in DBC.QryLogV as TotalFirstRespTime and StartTime)

### Deferred Ideas (OUT OF SCOPE)
- Custom date picker for arbitrary time ranges
- Additional sort columns (Elapsed Time, Start Time)
- Subagent interpretation of EXPLAIN output
- Export query list to CSV
- Query kill functionality from the panel
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| QADH-01 | Query Activity displays data in a proper table with columns: Username, CPU Time, I/O Count, Elapsed Time, Start Time, SQL Text (~100 char truncated) | Current screen already has a `<table>` skeleton; extend SELECT in query-activity-metrics.ts to include StartTime + ElapsedTime; update QueryActivityMetrics type |
| QADH-02 | Table supports sortable column headers with arrow indicators; CPU and I/O sort trigger server-side re-fetch with new ORDER BY clause | Parameterize fetchQueryActivityMetrics with sortCol + sortDir; store sort state in Zustand; pass through IPC |
| QADH-03 | Time range preset filter buttons (Last 1hr, 4hr, Today, Yesterday, 7 days); each triggers server-side re-fetch with WHERE on StartTime | Add timeRange param to fetch; compute StartTime thresholds in the service; WHERE clause varies by preset |
| QADH-04 | Text filter for SQL text and username search (existing, retained) | Already implemented via useMemo filteredQueries — keep as-is, no server round-trip |
| QADH-05 | Clicking SQL text opens right-side slide-out panel (~40% width) with full SQL, syntax highlighting, copy button | New SqlDetailPanel component; CSS transform slide animation; fetchFullSql IPC already exists |
| QADH-06 | Slide-out panel includes metadata header: username, CPU time, I/O count, elapsed time, start time | Data already on the row object once QADH-01 is done; pass selected row to panel |
| QADH-07 | Panel auto-closes when sort column or time range filter changes | useEffect in QueryActivityScreen watching sortCol + timeRange; call setSelectedQuery(null) |
| QADH-08 | "Explain Plan" button runs EXPLAIN on SQL against Teradata and displays output in panel | New QUERY_EXPLAIN IPC channel calling callMcpTool('base_readQuery', { sql: 'EXPLAIN ...' }); display result as preformatted text in panel |
| QADH-09 | "Analyze" button launches query-performance subagent with full SQL, navigates to chat | Call launchSubagent('query-performance', 'Query Performance', { queryText: fullSql }) — identical to existing SubagentContextMenu flow |
</phase_requirements>

---

## Summary

This phase rewrites `QueryActivityScreen.tsx` from a minimal card-style list into a full data table with server-side sort and time range filtering, plus a new slide-out SQL detail panel. The work is entirely within the existing Electron/React/Zustand stack — no new libraries are required for the core feature set, though `react-syntax-highlighter` must be installed (it is referenced in CLAUDE.md and CONTEXT.md specifics but is not yet in `package.json`).

The current implementation has a functioning `<table>` structure, existing IPC channels for query fetch and full SQL retrieval, and a `launchSubagent` helper that already performs the Analyze action flow. The phase extends these seams rather than introducing new architectural patterns. The largest new concern is the split-pane layout (table compressed left, panel on right) and the EXPLAIN IPC handler — both are straightforward additions.

All six files in scope are understood from direct code inspection. The Zustand store, IPC handler, service layer, shared types, preload bridge, and React screen each have one clear, bounded change. The panel is a new component that lives alongside `QueryActivityScreen.tsx`.

**Primary recommendation:** Implement in this order: (1) SQL/type changes (add StartTime/ElapsedTime to SELECT and types), (2) store + IPC sort/time-range params, (3) table UI rewrite, (4) slide-out panel component, (5) EXPLAIN IPC handler. Each step is independently deployable and testable.

---

## Standard Stack

### Core (already installed)
| Library | Version | Purpose | Notes |
|---------|---------|---------|-------|
| React | 19.2.x | UI rendering | Already installed |
| Zustand | 5.x | State management | Already installed — extend query-activity-store |
| lucide-react | latest | Icons (sort arrows, copy, close, refresh) | Already installed — `ArrowUp`, `ArrowDown`, `ArrowUpDown`, `Copy`, `X` icons available |
| TailwindCSS | 4.2.x | Utility styling | Already installed — use for preset button row and table density |
| date-fns | 4.x | Date formatting for StartTime display | Already installed |

### Needs Installation
| Library | Version | Purpose | Notes |
|---------|---------|---------|-------|
| react-syntax-highlighter | 16.1.1 | SQL syntax highlighting in slide-out panel | Referenced in CLAUDE.md and CONTEXT.md specifics but NOT in package.json. Must install before implementing the panel. |
| @types/react-syntax-highlighter | 15.5.13 | TypeScript types | Install alongside the library |

**Installation:**
```bash
npm install react-syntax-highlighter @types/react-syntax-highlighter
```

### Not Needed (already exists)
| Problem | Existing Solution |
|---------|-------------------|
| Full SQL fetch | `fetchFullSql` IPC + `QUERY_FULL_SQL` channel already implemented |
| Subagent launch | `launchSubagent()` in `src/renderer/src/lib/launch-subagent.ts` already handles navigate-to-chat |
| MCP query execution | `callMcpTool('base_readQuery', ...)` in `mcp-schema.ts` — EXPLAIN just prefixes the SQL |
| IPC registration | `registerOverviewHandlers()` in `overview.ts` — add EXPLAIN handler there |

---

## Architecture Patterns

### Current File Structure (files in scope)
```
src/
├── renderer/src/features/query-activity/
│   ├── QueryActivityScreen.tsx          # FULL REWRITE — table + panel layout
│   └── SqlDetailPanel.tsx               # NEW — slide-out panel component
├── renderer/src/store/
│   └── query-activity-store.ts          # EXTEND — add sortCol, sortDir, timeRange params
├── main/
│   ├── services/query-activity-metrics.ts  # EXTEND — parameterize SQL
│   └── ipc/overview.ts                     # EXTEND — add QUERY_EXPLAIN handler
├── shared/
│   └── types.ts                            # EXTEND — QueryActivityMetrics + IpcChannels + ElectronAPI
└── preload/index.ts                         # EXTEND — expose explainQuery method
```

### Pattern 1: Server-Side Sort + Time Range via Parameterized IPC

The existing `QUERY_ACTIVITY_FETCH` IPC handler takes no params. The pattern across this codebase is to pass params directly as ipcMain.handle arguments.

**Service layer change** (`query-activity-metrics.ts`):
```typescript
// Source: direct codebase inspection
export type SortColumn = 'AmpCPUTime' | 'TotalIOCount';
export type SortDir = 'ASC' | 'DESC';
export type TimeRange = '1h' | '4h' | 'today' | 'yesterday' | '7d';

export async function fetchQueryActivityMetrics(
  sortCol: SortColumn = 'AmpCPUTime',
  sortDir: SortDir = 'DESC',
  timeRange: TimeRange = 'today',
): Promise<QueryActivityMetrics> {
  const whereClause = buildTimeWhereClause(timeRange);
  const sql = `SELECT TOP 200 SUBSTR(QueryText, 1, 100) AS QueryText, UserName,
    AmpCPUTime, TotalIOCount,
    CAST(TotalFirstRespTime AS DECIMAL(18,4)) AS ElapsedTime,
    StartTime,
    CAST(QueryID AS VARCHAR(30)) AS QueryID, CAST(ProcID AS VARCHAR(30)) AS ProcID
    FROM DBC.QryLogV
    ${whereClause}
    ORDER BY ${sortCol} ${sortDir}`;
  // ...
}

function buildTimeWhereClause(range: TimeRange): string {
  // Uses CURRENT_DATE and interval arithmetic — Teradata SQL date literals
  switch (range) {
    case '1h':  return "WHERE StartTime >= (CURRENT_TIMESTAMP - INTERVAL '1' HOUR)";
    case '4h':  return "WHERE StartTime >= (CURRENT_TIMESTAMP - INTERVAL '4' HOUR)";
    case 'today': return "WHERE StartTime >= CAST(CURRENT_DATE AS TIMESTAMP)";
    case 'yesterday': return "WHERE StartTime >= CAST(CURRENT_DATE - 1 AS TIMESTAMP) AND StartTime < CAST(CURRENT_DATE AS TIMESTAMP)";
    case '7d':  return "WHERE StartTime >= CAST(CURRENT_DATE - 7 AS TIMESTAMP)";
  }
}
```

**IPC handler change** (`overview.ts`):
```typescript
// Source: direct codebase inspection of existing ipcMain.handle pattern
ipcMain.handle(IpcChannels.QUERY_ACTIVITY_FETCH, async (_event, sortCol, sortDir, timeRange) => {
  try {
    const metrics = await fetchQueryActivityMetrics(sortCol, sortDir, timeRange);
    return { success: true, metrics };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: message };
  }
});
```

**Zustand store change** (`query-activity-store.ts`):
```typescript
// Source: direct codebase inspection of existing store pattern
interface QueryActivityState {
  metrics: QueryActivityMetrics | null;
  loading: boolean;
  error: string | null;
  sortCol: SortColumn;
  sortDir: SortDir;
  timeRange: TimeRange;
  setSortCol: (col: SortColumn) => void;
  setSortDir: (dir: SortDir) => void;
  setTimeRange: (range: TimeRange) => void;
  fetch: () => Promise<void>;
}
```

### Pattern 2: Slide-Out Panel as Sibling Component

No drawer library is installed (shadcn has no Drawer component in the installed set — only alert, badge, button, card, form, input, label, separator, tooltip). Implement as a CSS-transition div anchored inside the screen's flex layout.

**Layout structure** (`QueryActivityScreen.tsx`):
```tsx
// Source: direct codebase inspection — follows inline style convention of entire codebase
<div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
  {/* Table side — shrinks when panel is open */}
  <div style={{ flex: 1, overflowY: 'auto', padding: '24px', minWidth: 0, transition: 'flex 0.2s ease' }}>
    {/* header, filter bar, time presets, table */}
  </div>
  {/* Slide-out panel — 0 width when closed, 40% when open */}
  <SqlDetailPanel
    query={selectedQuery}
    onClose={() => setSelectedQuery(null)}
  />
</div>
```

**Panel animation** (CSS transition on width, no JS animation library):
```tsx
// Source: standard CSS transition approach, consistent with project's inline-style convention
<div style={{
  width: selectedQuery ? '40%' : '0',
  minWidth: selectedQuery ? '360px' : '0',
  overflow: selectedQuery ? 'auto' : 'hidden',
  transition: 'width 0.2s ease, min-width 0.2s ease',
  borderLeft: selectedQuery ? '1px solid #333' : 'none',
  backgroundColor: '#1A1A1A',
}}>
```

### Pattern 3: EXPLAIN IPC Handler

Follows the exact same pattern as existing IPC handlers in `overview.ts`:

```typescript
// Source: direct codebase inspection of callMcpTool pattern in query-activity-metrics.ts
// New IPC channel constant in types.ts:
QUERY_EXPLAIN: 'query-activity:explain',

// New handler in overview.ts:
ipcMain.handle(IpcChannels.QUERY_EXPLAIN, async (_event, sql: string) => {
  try {
    const result = await callMcpTool('base_readQuery', { sql: `EXPLAIN ${sql}` });
    return { success: true, explain: result };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: message };
  }
});
```

### Pattern 4: Analyze Button — Reuse launchSubagent

The "Analyze" button in the panel calls the same function that `SubagentContextMenu` calls. No new infrastructure:

```typescript
// Source: direct codebase inspection of launch-subagent.ts
import { launchSubagent } from '@/lib/launch-subagent';

// Inside SqlDetailPanel onClick handler:
await launchSubagent('query-performance', 'Query Performance', { queryText: fullSql });
// This already: navigates to chat, creates user message, calls runSubagentInChat
```

### Pattern 5: Sort Arrow Indicators

Use `lucide-react` icons that are already installed:
- Active ascending: `ArrowUp` (size 12, colored orange `#F37440`)
- Active descending: `ArrowDown` (size 12, colored orange `#F37440`)
- Inactive sortable: `ArrowUpDown` (size 12, color `#525252`)
- Non-sortable columns: no icon

```tsx
// Source: lucide-react API, consistent with existing usage in project
import { ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';

function SortIcon({ col, sortCol, sortDir }: SortIconProps): JSX.Element {
  if (col !== sortCol) return <ArrowUpDown size={12} style={{ color: '#525252' }} />;
  return sortDir === 'ASC'
    ? <ArrowUp size={12} style={{ color: '#F37440' }} />
    : <ArrowDown size={12} style={{ color: '#F37440' }} />;
}
```

### Pattern 6: Time Range Preset Buttons

Rendered as a button row below the text filter. Active preset highlighted with Teradata orange border:

```tsx
// Pattern consistent with existing button styling in the codebase
const TIME_PRESETS: { label: string; value: TimeRange }[] = [
  { label: 'Last 1 hour', value: '1h' },
  { label: 'Last 4 hours', value: '4h' },
  { label: 'Today', value: 'today' },
  { label: 'Yesterday', value: 'yesterday' },
  { label: 'Last 7 days', value: '7d' },
];
```

### Anti-Patterns to Avoid

- **Do not add client-side sort on top of server-side sort.** The whole point of server-side sort is to get the true top 200 by the sort metric. A secondary client-side sort would hide this.
- **Do not use TailwindCSS for the slide-out panel layout.** The entire codebase uses inline styles exclusively. Mixing Tailwind layout classes into the main screen would create inconsistency and potential specificity conflicts.
- **Do not reach for a drawer/sheet component library.** There is no shadcn Drawer installed. A CSS width-transition div is sufficient and matches the project's zero-dependency-for-UI ethos.
- **Do not auto-close the panel on refresh.** Panel should only close on sort column or time range change (QADH-07). Refreshing current params should leave the panel open.
- **Do not pass params as object to ipcMain.handle.** The existing pattern passes positional args: `ipcMain.handle(channel, async (_event, arg1, arg2, arg3) => ...)`. Keep this pattern for consistency.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| SQL syntax highlighting | Custom tokenizer/regex | `react-syntax-highlighter` with `atomOneDark` theme | Teradata SQL is a superset of SQL-92; react-syntax-highlighter's `sql` language handles keywords, strings, comments correctly |
| Subagent launch + chat navigation | Custom IPC call sequence | `launchSubagent()` in `lib/launch-subagent.ts` | Already handles: setCurrentPage, newChat, addUserMessage, addAssistantMessagePlaceholder, runSubagentInChat, error handling |
| Full SQL fetch | Re-implement DBQLSqlTbl query | `fetchFullSql` IPC via `QUERY_FULL_SQL` channel | Already handles multi-row concatenation from DBC.DBQLSqlTbl with QryLogV fallback |
| Clipboard copy | `navigator.clipboard.writeText` custom button | Use directly — it is available in Electron renderer | No library needed; `navigator.clipboard.writeText(sql)` works in Electron renderer context |

**Key insight:** This phase is primarily a UI rewrite atop existing infrastructure. The fetch, full-SQL, subagent-launch, and MCP-call patterns are all proven in production. New code is: table column additions, sort/time params threading, the slide-out panel component, and the EXPLAIN IPC handler.

---

## Common Pitfalls

### Pitfall 1: Teradata EXPLAIN on Multi-Statement SQL
**What goes wrong:** If `QueryText` from DBC.QryLogV or DBQLSqlTbl contains multiple SQL statements (semicolons mid-text), prepending `EXPLAIN` will fail with a Teradata parse error.
**Why it happens:** `EXPLAIN` applies to a single statement. Concatenated SQL from DBQLSqlTbl rows may include trailing semicolons or multiple statements.
**How to avoid:** Strip trailing semicolons before prefixing EXPLAIN. If the SQL contains multiple statements (detected by `;` not at the very end), either explain only the first statement or display an error in the panel.
**Warning signs:** EXPLAIN IPC returns an error message containing "only one request".

### Pitfall 2: StartTime / TotalFirstRespTime Nullability
**What goes wrong:** `StartTime` and `TotalFirstRespTime` can be NULL in `DBC.QryLogV` for in-flight or certain system queries. Null values in the SELECT will break the JS mapping if you try to call `.toFixed()` or format a null date.
**Why it happens:** DBQL logging gaps; some internal queries don't populate all fields.
**How to avoid:** Use `COALESCE(TotalFirstRespTime, 0)` and `COALESCE(CAST(StartTime AS VARCHAR(30)), '')` in the SQL, or guard in the JS mapper with `?? 0` / `?? ''`.

### Pitfall 3: Panel Width on Small Screens
**What goes wrong:** At 40% width with a minimum of 360px, on a 1280px monitor the table gets 768px — acceptable. But if the DBA has a sidebar or Electron chrome, 40% may push the table to < 600px and make the SQL column unreadable.
**Why it happens:** Fixed percentage with a fixed minimum doesn't account for viewport variability.
**How to avoid:** Test at 1280x800 (common laptop resolution). Consider capping panel at `min(40%, 560px)` or using `clamp()` in the width calculation. Keep table's SQL column `overflow: hidden; text-overflow: ellipsis` to prevent horizontal scroll.

### Pitfall 4: Auto-Refresh Interval Not Cleared
**What goes wrong:** The existing `setInterval(fetch, 60_000)` in the `useEffect` will keep firing after the rewrite removes auto-refresh from the design, causing unexpected re-fetches that close the panel (via QADH-07 side effect if sort/time change is detected as the trigger).
**Why it happens:** The interval is stored in `intervalRef` and cleared only on unmount — but if the rewrite forgets to remove `setInterval`, it persists.
**How to avoid:** Remove `intervalRef` entirely. The new `useEffect` should only call `fetch()` once on mount (when connected), with no setInterval.

### Pitfall 5: Panel State Not Reset When Re-Fetching Changes the Row Set
**What goes wrong:** User opens panel for query #3. They change the time range. The fetch returns new results. The panel auto-closes (QADH-07 correct behavior) but the `selectedQuery` state still holds the old row object. If the panel is re-opened and somehow references the stale data, it shows stale SQL.
**Why it happens:** Zustand state for selected query lives in the component's `useState`, separate from the metrics in the store.
**How to avoid:** In the `useEffect` that watches `sortCol` and `timeRange`, set `selectedQuery(null)` before or alongside the re-fetch. The panel close is a visual confirmation that data is fresh.

### Pitfall 6: react-syntax-highlighter Bundle Size in Electron Renderer
**What goes wrong:** `react-syntax-highlighter` ships all language grammars by default — ~800KB. In Vite/Electron builds this adds significant bundle size.
**Why it happens:** Default import `SyntaxHighlighter` from `react-syntax-highlighter` loads every Prism or Highlight.js language.
**How to avoid:** Use the light build with only the SQL language:
```typescript
// Source: react-syntax-highlighter README — light build pattern
import { Light as SyntaxHighlighter } from 'react-syntax-highlighter';
import sql from 'react-syntax-highlighter/dist/esm/languages/hljs/sql';
import { atomOneDark } from 'react-syntax-highlighter/dist/esm/styles/hljs';
SyntaxHighlighter.registerLanguage('sql', sql);
```

---

## Code Examples

Verified patterns from codebase inspection:

### Teradata Date Arithmetic for Time Range WHERE Clauses
```sql
-- Last 1 hour
WHERE StartTime >= (CURRENT_TIMESTAMP - INTERVAL '1' HOUR)

-- Today (midnight to now)
WHERE StartTime >= CAST(CURRENT_DATE AS TIMESTAMP)

-- Yesterday (full day)
WHERE StartTime >= CAST(CURRENT_DATE - 1 AS TIMESTAMP)
  AND StartTime < CAST(CURRENT_DATE AS TIMESTAMP)

-- Last 7 days
WHERE StartTime >= CAST(CURRENT_DATE - 7 AS TIMESTAMP)
```

These are standard Teradata SQL-99 date functions. `CURRENT_DATE` and `CURRENT_TIMESTAMP` are Teradata keywords. `INTERVAL '1' HOUR` is Teradata interval literal syntax.

### Existing IPC Call Pattern (preload → main)
```typescript
// Source: src/preload/index.ts — positional args pattern
fetchQueryActivityMetrics: (sortCol: string, sortDir: string, timeRange: string) =>
  ipcRenderer.invoke(IpcChannels.QUERY_ACTIVITY_FETCH, sortCol, sortDir, timeRange),
explainQuery: (sql: string) =>
  ipcRenderer.invoke(IpcChannels.QUERY_EXPLAIN, sql),
```

### Zustand Fetch with Params (extend existing store pattern)
```typescript
// Source: src/renderer/src/store/query-activity-store.ts — extend existing create() call
fetch: async () => {
  const { loading, sortCol, sortDir, timeRange } = useQueryActivityStore.getState();
  if (loading) return;
  set({ loading: true, error: null });
  try {
    const result = await electronAPI.fetchQueryActivityMetrics(sortCol, sortDir, timeRange);
    if (result.success && result.metrics) {
      set({ metrics: result.metrics, loading: false });
    } else {
      set({ error: result.error ?? 'Failed to fetch', loading: false });
    }
  } catch (err) {
    set({ error: err instanceof Error ? err.message : String(err), loading: false });
  }
},
```

### Clipboard Copy Button Pattern (Electron renderer)
```typescript
// navigator.clipboard is available in Electron renderer with default security settings
// No external library required
const handleCopy = async (): Promise<void> => {
  await navigator.clipboard.writeText(fullSql);
  setCopied(true);
  setTimeout(() => setCopied(false), 1500);
};
```

### react-syntax-highlighter (light build, SQL)
```typescript
// Source: react-syntax-highlighter README + CLAUDE.md recommendation
import { Light as SyntaxHighlighter } from 'react-syntax-highlighter';
import sql from 'react-syntax-highlighter/dist/esm/languages/hljs/sql';
import { atomOneDark } from 'react-syntax-highlighter/dist/esm/styles/hljs';

SyntaxHighlighter.registerLanguage('sql', sql);

// Usage in SqlDetailPanel:
<SyntaxHighlighter
  language="sql"
  style={atomOneDark}
  customStyle={{ margin: 0, borderRadius: '6px', fontSize: '12px', background: '#1A1A1A' }}
  wrapLongLines
>
  {fullSql}
</SyntaxHighlighter>
```

---

## IPC Contract Summary

All new IPC touchpoints for this phase:

| What | IpcChannel key | Channel string | Args (main) | Return |
|------|---------------|----------------|-------------|--------|
| Parameterized fetch (extend) | `QUERY_ACTIVITY_FETCH` | `query-activity:fetch` | `sortCol, sortDir, timeRange` | `{ success, metrics? }` |
| Full SQL (existing, no change) | `QUERY_FULL_SQL` | `query-activity:full-sql` | `queryId, procId` | `{ success, sql? }` |
| EXPLAIN plan (new) | `QUERY_EXPLAIN` | `query-activity:explain` | `sql` | `{ success, explain?, error? }` |
| Subagent in chat (existing) | `CHAT_SEND_SUBAGENT` | `chat:send-subagent` | `agentId, params, sessionId?` | `{ success, error? }` |

**ElectronAPI additions needed** in `src/shared/types.ts`:
```typescript
fetchQueryActivityMetrics: (sortCol: string, sortDir: string, timeRange: string) =>
  Promise<{ success: boolean; metrics?: QueryActivityMetrics; error?: string }>;
explainQuery: (sql: string) =>
  Promise<{ success: boolean; explain?: string; error?: string }>;
```

**QueryActivityMetrics type extension** in `src/shared/types.ts`:
```typescript
export interface QueryActivityMetrics {
  topQueries: Array<{
    queryText: string;
    userName: string;
    cpuTime: number;
    ioCount: number;
    elapsedTime: number;    // NEW: from TotalFirstRespTime
    startTime: string;      // NEW: from StartTime, formatted as ISO string or empty
    queryId?: string;
    procId?: string;
  }>;
  fetchedAt: number;
}
```

---

## Environment Availability

Step 2.6: SKIPPED — this phase has no external tool dependencies beyond what is already operational (Electron, Node, Teradata MCP). The one package installation (`react-syntax-highlighter`) is an npm install, not a system dependency.

---

## Validation Architecture

nyquist_validation is explicitly `false` in `.planning/config.json`. This section is omitted per config.

---

## Open Questions

1. **Teradata EXPLAIN on logged queries**
   - What we know: `EXPLAIN <sql>` is standard Teradata syntax and works via `base_readQuery` MCP tool (same tool used for all other queries)
   - What's unclear: Whether every SQL text from DBC.QryLogV / DBQLSqlTbl is syntactically complete enough to EXPLAIN — some queries may be truncated even after DBQLSqlTbl concatenation if DBQL row size limits are hit
   - Recommendation: Display EXPLAIN errors inline in the panel ("Could not EXPLAIN: [error]"). This is the same UX for any Teradata error returned by IPC.

2. **StartTime display format**
   - What we know: DBC.QryLogV returns StartTime as a Teradata TIMESTAMP value; when returned via JSON from MCP it will be a string (ISO-like or Teradata format)
   - What's unclear: Exact string format returned by the MCP JSON serializer (could be "YYYY-MM-DD HH:MM:SS.ffffff" Teradata format or ISO 8601)
   - Recommendation: Defensively parse with `new Date(startTime)` and fall back to displaying raw string if invalid. The display in the panel metadata header can be `date-fns format(date, 'MMM d, HH:mm:ss')`.

3. **"Load More" pagination vs. fixed 200-row cap**
   - What we know: The current implementation shows top 10 then loads more. With server-side sort returning the true top 200, all rows are already the most relevant.
   - What's unclear: Should the new table retain "Load More" or show all 200 rows in a scrollable table?
   - Recommendation: Remove "Load More" pagination from the new table. A dense, scrollable table showing all server-returned rows is more useful than paginating within an already-limited dataset. The ~200 row cap keeps scroll manageable.

---

## Sources

### Primary (HIGH confidence)
- Direct codebase inspection — `QueryActivityScreen.tsx`, `query-activity-store.ts`, `query-activity-metrics.ts`, `overview.ts`, `types.ts`, `preload/index.ts`, `launch-subagent.ts`, `subagent-mapping.ts`, `mcp-schema.ts` — all read directly
- `package.json` — confirmed installed packages and versions; confirmed `react-syntax-highlighter` is NOT installed
- `.planning/config.json` — confirmed `nyquist_validation: false`

### Secondary (MEDIUM confidence)
- react-syntax-highlighter light build pattern: documented in the library's README (MEDIUM — not verified via live fetch, but consistent with CLAUDE.md recommendation and widely used pattern)
- Teradata INTERVAL and CAST date arithmetic: standard Teradata SQL-99 syntax (MEDIUM — confirmed by DBA domain knowledge, not verified against live Teradata instance)

### Tertiary (LOW confidence)
- Exact string format of StartTime from Teradata MCP JSON serialization — not verified (flagged in Open Questions)

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages verified via direct package.json inspection
- Architecture patterns: HIGH — all patterns derived from reading actual codebase files
- Pitfalls: MEDIUM-HIGH — Teradata-specific pitfalls based on domain knowledge; EXPLAIN multi-statement risk is well-known
- IPC contract: HIGH — derived from existing working IPC implementations in the codebase

**Research date:** 2026-04-26
**Valid until:** 2026-05-26 (stable stack, no fast-moving dependencies)
