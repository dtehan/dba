# Phase 3: Core Subagents — Research

**Researched:** 2026-03-26
**Domain:** Specialized subagent prompt engineering, MCP tool orchestration, UI parameter forms, in-app adaptation of file-output agents
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Subagent Architecture**
- Each subagent is a specialized system prompt + MCP tool calls orchestrated by Claude via the existing agentic tool-use loop in chat.ts. No separate API call chain needed.
- Subagent definitions live in `src/main/subagents/` as TypeScript files exporting a `SubagentDefinition` — same pattern as the echo agent from Phase 2.
- System prompt instructs Claude to cap results (e.g. "show top 20 findings"). MCP tools already return bounded result sets. No additional backend capping needed.
- Each subagent can require input parameters (e.g. database name, username). The launcher UI shows a simple input form before running.

**Security Audit Subagent**
- User provides a username OR database name OR "system-wide" — prompt adapts based on input type.
- Uses existing MCP tools: `sec_userRoles`, `sec_userDbPermissions`, `sec_rolePermissions`, `base_readQuery` (for custom queries like logon history).
- Output: prioritized findings list (High/Medium/Low severity), each with: finding description, affected objects, remediation SQL. Rendered as markdown in the result card.
- Checks: access rights, role membership, overly permissive grants (ALL/WITH GRANT OPTION), orphaned access. Logon anomalies via DBQL if available. Matches SECU-01 through SECU-05.

**MVC Analysis Subagent**
- Database name required, optional table name to narrow scope.
- User has provided complete MVC agent definitions at `/Users/Daniel.Tehan/Code/MVC Agent/.claude/agents/`:
  - `mvc-compression-advisor.md` — Orchestrator: enumerates eligible tables (TableKind='T', >=100 rows), spawns parallel worker analysis per table, aggregates results into compression script, rollback script, and executive report.
  - `mvc-table-analyzer.md` — Worker: analyzes a single table using the Package Bit-Cost Model (Jim Calvert, Teradata/NCR). Determines optimal compression values per column using bit-cost packages, value savings ranking, extended length checks, and cumulative header limits (40KB).
- Key algorithm parameters: min 100 rows, HAVING threshold 0.00055×RowCount, extended length limit 8100, 255 max values/column, sampling at 10% for >10M rows.
- Uses MCP tools: `base_readQuery`, `base_columnDescription`, `base_tableDDL`, `dba_tableSpace`, `base_tableList`.
- Output: three sections per analysis — compression SQL, rollback SQL, executive report. Priority classification: CRITICAL (>=25%), HIGH (10-24%), MEDIUM (5-9%), SKIP (<5%).
- In the DBA Agent app, the MVC subagent should adapt this orchestrator/worker pattern to run within the chat interface, with results rendered as a rich result card.

**Statistics Analysis Subagent**
- Database name required, optional table name. Uses `base_readQuery` with DBC.StatsV and DBC.ColumnsV to find missing/stale stats.
- Output: prioritized list — table, column, status (missing/stale/aged), last collected date, COLLECT STATISTICS statement for copy-paste. Sorted by query plan impact (most-joined columns first).

### Claude's Discretion
- Exact system prompt wording for Security and Statistics subagents
- How to detect "system-wide" vs user vs database scope from Security audit input
- Statistics staleness thresholds (days since last collect)
- Result card visual layout within existing SubagentResultCard component
- How to adapt the MVC orchestrator/worker file-output pattern to in-app result cards

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SECU-01 | User can run a security audit on a database or the full system | Subagent with `scope` param; `sec_*` MCP tools cover this directly |
| SECU-02 | Audit analyzes access rights, roles, and role membership | `sec_userRoles`, `sec_userDbPermissions`, `sec_rolePermissions` tools available |
| SECU-03 | Audit identifies overly permissive grants and orphaned access | System prompt pattern with explicit checks; `sec_userDbPermissions` returns grant details |
| SECU-04 | Audit reviews logon/logoff activity for anomalies | `base_readQuery` against DBC.LogOnOffV / DBQL; graceful fallback if unavailable |
| SECU-05 | Audit produces a prioritized findings summary with remediation steps | Structured output format in system prompt (High/Medium/Low with remediation SQL) |
| MVCA-01 | User can run MVC analysis on a database or specific tables | `databaseName` required param + optional `tableName` param in launcher form |
| MVCA-02 | Analysis identifies columns that are strong MVC candidates | Package bit-cost model algorithm encoded in system prompt (from mvc-table-analyzer.md) |
| MVCA-03 | Analysis estimates space savings from recommended compressions | Algorithm computes TotalNetBenefit / UncompressedSpace per table |
| MVCA-04 | Analysis produces ALTER TABLE statements for copy-paste | System prompt instructs structured SQL output; no auto-execute |
| MVCA-05 | Analysis prioritizes recommendations by space savings impact | Priority classification: CRITICAL/HIGH/MEDIUM/SKIP thresholds in system prompt |
| STAT-01 | User can run statistics analysis on a database or specific tables | `databaseName` required param + optional `tableName` in launcher form |
| STAT-02 | Analysis identifies missing statistics on indexed and frequently joined columns | DBC.StatsV LEFT JOIN DBC.IndicesV pattern; system prompt guides interpretation |
| STAT-03 | Analysis identifies stale statistics that need recollection | DBC.StatsV.CollectTimeStamp comparison; staleness threshold in system prompt |
| STAT-04 | Analysis produces COLLECT STATISTICS statements for copy-paste | Structured output format; `COLLECT STATISTICS COLUMN (col) ON db.table` template |
| STAT-05 | Analysis prioritizes recommendations by query plan impact | Sort strategy: PI columns first, then join columns, then WHERE-clause columns |
</phase_requirements>

---

## Summary

Phase 3 builds three specialized subagents — Security Audit, MVC Analysis, and Statistics Analysis — all using the existing agentic tool-use loop established in Phase 2. The architecture is already proven: a `SubagentDefinition` (id, name, description, icon) registered in `registry.ts`, paired with a `run(ctx: SubagentContext)` function that calls the Bedrock/Claude API with a specialized system prompt.

The primary engineering work is: (1) porting/adapting the existing MVC agent definitions (complete algorithm already authored) into the in-app system prompt format, (2) authoring system prompts for Security and Statistics subagents using established Teradata SQL patterns, (3) extending the `SubagentContext` and `SUBAGENT_RUN` IPC channel to pass input parameters from launcher forms, and (4) updating `SubagentLauncher.tsx` to show an inline parameter form before launch.

The MVC subagent is the most algorithmically complex but least prompt-engineering uncertain — the Package Bit-Cost Model is fully documented in the existing agent definitions. Security and Statistics are simpler algorithmically but require careful prompt engineering for the severity/staleness thresholds (left to Claude's discretion per CONTEXT.md).

**Primary recommendation:** Extend `SubagentContext` with a `params` map, wire it through IPC and the preload, then implement the three subagent files using specialized system prompts that call the existing MCP tools via the chat.ts tool-use loop pattern.

---

## Standard Stack

### Core (already in project — no new installs)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@anthropic-ai/bedrock-sdk` | current | Claude API via Bedrock for subagent execution | Already wired in chat.ts; same client reused for subagents |
| Electron `ipcMain` / `ipcRenderer` | Electron 41 built-in | Parameter passing from renderer to main process | Established IPC pattern from Phase 2 |
| `streamdown` | current | Markdown rendering in SubagentResultCard | Already integrated for chat; handles markdown tables and code blocks from subagent output |
| lucide-react | current | Icons in SubagentLauncher | Already in ICON_MAP |

### No New Dependencies Required

All Phase 3 capabilities use libraries already installed. The subagent run function reuses `getBedrockClient()` and the tool-use loop logic from `chat.ts`. The parameter form uses existing React + inline styles pattern (Tailwind v4 token issues already worked around).

---

## Architecture Patterns

### Recommended Project Structure (additions only)

```
src/
├── main/
│   └── subagents/
│       ├── echo.ts              # exists — template
│       ├── registry.ts          # exists — add new registrations
│       ├── security-audit.ts    # NEW: Security subagent
│       ├── mvc-analysis.ts      # NEW: MVC subagent (orchestrator+worker merged)
│       └── stats-analysis.ts   # NEW: Statistics subagent
├── shared/
│   └── subagent-types.ts        # EXTEND: add params to SubagentContext
└── renderer/src/
    └── components/
        └── SubagentLauncher.tsx # EXTEND: add param form before launch
```

### Pattern 1: Subagent Definition Structure

Each new subagent file exports two things: a definition object and a run function. The run function receives an extended `SubagentContext` with parameters.

```typescript
// src/main/subagents/security-audit.ts
import type { SubagentContext, SubagentRunResult } from '../../shared/subagent-types';

export const securityAuditDef = {
  id: 'security-audit',
  name: 'Security Audit',
  description: 'Analyzes access rights, roles, and permissions for anomalies.',
  icon: 'Shield',
  params: [
    {
      key: 'scope',
      label: 'Audit Scope',
      placeholder: 'Username, database name, or "system-wide"',
      required: true,
    },
  ],
};

export async function runSecurityAudit(ctx: SubagentContext): Promise<SubagentRunResult> {
  // Uses ctx.params.scope to tailor the system prompt
  // Calls the Bedrock client with specialized system prompt + MCP tools
}
```

### Pattern 2: SubagentContext Extension

The current `SubagentContext` has `activeDatabaseName` and `schemaContext`. Phase 3 requires `params` for user-supplied inputs.

```typescript
// src/shared/subagent-types.ts — EXTEND
export interface SubagentDefinition {
  id: string;
  name: string;
  description: string;
  icon: string;
  params?: SubagentParam[];       // NEW — input parameters the launcher form renders
}

export interface SubagentParam {
  key: string;
  label: string;
  placeholder: string;
  required: boolean;
}

export interface SubagentContext {
  activeDatabaseName: string | null;
  schemaContext: string | null;
  params: Record<string, string>;  // NEW — key/value from launcher form
}
```

### Pattern 3: IPC Extension for Parameters

`SUBAGENT_RUN` currently takes only `agentId`. It must be extended to pass params.

```typescript
// shared/types.ts IpcChannels (no change to channel name, change to handler signature)
// ipc/subagent.ts
ipcMain.handle(IpcChannels.SUBAGENT_RUN, async (_event, agentId: unknown, params: unknown) => {
  const safeParams = (typeof params === 'object' && params !== null)
    ? params as Record<string, string>
    : {};
  const context: SubagentContext = {
    activeDatabaseName: null,
    schemaContext: null,
    params: safeParams,
  };
  const result = await runSubagent(agentId.trim(), context);
  return { success: true, content: result.content };
});
```

Preload extension:
```typescript
// src/preload/index.ts
runSubagent: (agentId: string, params?: Record<string, string>) =>
  ipcRenderer.invoke(IpcChannels.SUBAGENT_RUN, agentId, params ?? {}),
```

### Pattern 4: Subagent Run Function — Tool-Use Loop Reuse

Each subagent's `run()` function should reuse the same `getBedrockClient()` + tool-use loop from `chat.ts`. The key difference is the system prompt content — not the execution mechanism. The run function is a self-contained async function that:

1. Calls `getBedrockClient()` (imported from `ipc/claude.ts` or a shared service)
2. Calls `getMcpToolsForClaude()` for the relevant MCP tools
3. Runs the tool-use loop (same MAX_TOOL_ROUNDS = 10 pattern)
4. Returns the accumulated assistant text as `SubagentRunResult.content`

Since `getBedrockClient()` is currently inside `ipc/chat.ts`, it should be extracted to a shared service `src/main/services/bedrock-client.ts` so both `chat.ts` and subagent files can import it.

```typescript
// src/main/services/bedrock-client.ts  (NEW — extracted from chat.ts)
export async function getBedrockClient(): Promise<{ client: AnthropicBedrock; modelId: string }>
```

### Pattern 5: MVC In-App Adaptation Strategy

The existing `mvc-compression-advisor.md` spawns parallel Claude `Agent` tool calls — a capability specific to Claude Code's agent framework. Inside the Electron app, there is no `Agent` tool available. The in-app MVC subagent must implement the orchestrator/worker pattern as a single Claude conversation with a multi-step tool-use loop:

**Approach — Sequential with progress updates:**
- System prompt embeds the full Package Bit-Cost Model algorithm from `mvc-table-analyzer.md`
- Claude enumerates eligible tables (Step 2 SQL query)
- Claude analyzes each table sequentially within the same conversation (Step 3-12 per table)
- Output is accumulated markdown (compression SQL blocks + executive summary) returned as a single `SubagentRunResult.content`
- Priority classification (CRITICAL/HIGH/MEDIUM/SKIP) rendered in the result card

**Why not parallel:** The Electron app's tool-use loop is single-threaded per subagent run. Spawning parallel workers would require multiple concurrent Bedrock API calls — significant added complexity for v1. Sequential analysis with progress tokens is the correct v1 approach.

**MAX_TOOL_ROUNDS for MVC:** The default 10 rounds is insufficient for a database with many tables (each table requires multiple tool calls: row count, column metadata, PI query, value distribution queries per column). The MVC subagent should use a higher limit — recommend 50 rounds.

### Pattern 6: Launcher Parameter Form

`SubagentLauncher.tsx` currently calls `handleRun(agent)` directly on click. For parameterized subagents, clicking should expand an inline form. On submit, form values are passed via `runSubagent(agent.id, params)`.

```tsx
// Conceptual flow — exact wording at Claude's discretion
const [pendingAgent, setPendingAgent] = useState<SubagentDef | null>(null);
const [formValues, setFormValues] = useState<Record<string, string>>({});

// On agent click: if agent has params, show form; else run directly
onClick={() => {
  if (agent.params?.length) {
    setPendingAgent(agent);
  } else {
    handleRun(agent, {});
  }
}}

// Inline form renders below the agent card when pendingAgent === agent
```

### Anti-Patterns to Avoid

- **Hardcoding MCP tool schemas:** The chat.ts `getMcpToolsForClaude()` already discovers tools dynamically. Subagents should use the same discovery — never hardcode tool `input_schema` objects in subagent files.
- **Duplicating the Bedrock client factory:** `getBedrockClient()` must be extracted to a shared service before Phase 3, not copy-pasted into each subagent file.
- **Calling tools directly from TypeScript:** The subagent run function should not call `callMcpTool()` directly. Claude calls the tools via the tool-use loop — TypeScript just executes them when Claude requests it. This preserves the correct agentic pattern.
- **Auto-executing SQL:** REQUIREMENTS.md `AGEN-05` and out-of-scope list are explicit: SQL surfaces for copy-paste only, never auto-executed. System prompts must reinforce this.
- **nodeIntegration: true in renderer:** Established constraint from CLAUDE.md. All MCP calls remain in main process.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead |
|---------|-------------|-------------|
| Package Bit-Cost Model for MVC | Custom TypeScript implementation | Encode algorithm as system prompt instructions — Claude executes it using the MCP data, just like the existing mvc-table-analyzer agent |
| Tool discovery for subagents | Hardcoded tool list per subagent | `getMcpToolsForClaude()` from `mcp-schema.ts` — same dynamic discovery used in chat |
| Streaming status in result card | Custom WebSocket or polling | Extend existing `CHAT_TOKEN` IPC pattern to emit tool-call status tokens from subagent run, just as chat.ts already does |
| Input validation for launcher form | Custom validation logic | Standard React controlled inputs with `required` attribute; Zod validation only if complexity warrants it (v1 forms are simple) |
| Markdown rendering of results | Custom renderer | `streamdown` in `SubagentResultCard` — already handles markdown tables, code fences, headers |

---

## Security Audit Subagent — System Prompt Design

### Scope Detection Logic (Claude's discretion area — guidance only)

The system prompt should instruct Claude to determine scope from the `scope` parameter:
- Contains `@` → treat as username pattern
- Starts with known system DB prefix (DBC, SYSLIB, SYSTEMFE, TDWM, etc.) → system-wide alert
- Otherwise → treat as database name
- Literal "system-wide" or "all" → full system audit

### MCP Tools for Security Audit

Based on the MCP tool naming convention `sec_*` (confirmed in CONTEXT.md and chat.ts tool discovery):

| Tool | Purpose |
|------|---------|
| `sec_userRoles` | List roles assigned to a user |
| `sec_userDbPermissions` | Access rights granted to a user on databases/objects |
| `sec_rolePermissions` | Permissions attached to a role |
| `base_readQuery` | Custom SQL for DBQL logon analysis, DBC.LogOnOffV, DBC.AccessRightsV |

### Teradata SQL for Logon Anomaly Detection (SECU-04)

```sql
-- Recent logon failures (if DBQL enabled)
SELECT UserName, COUNT(*) AS FailedAttempts, MAX(LogDate) AS LastAttempt
FROM DBC.LogOnOffV
WHERE LogType = 'L' AND AccType = 'F'
  AND LogDate >= DATE - 30
GROUP BY UserName
HAVING COUNT(*) > 5
ORDER BY FailedAttempts DESC;
```

If DBC.LogOnOffV returns an error (DBQL not enabled), the prompt should instruct Claude to note this gracefully and skip the logon section rather than failing the entire audit.

### Overly Permissive Grant Detection (SECU-03)

Teradata-specific SQL patterns for finding dangerous grants:

```sql
-- Users/roles with ALL privileges
SELECT UserName, DatabaseName, AccessRight, GrantAuthority
FROM DBC.AccessRightsV
WHERE AccessRight = 'ALL'
   OR GrantAuthority = 'Y'  -- WITH GRANT OPTION
ORDER BY DatabaseName, UserName;

-- Users with direct access bypassing roles (orphaned grants)
SELECT a.UserName, a.DatabaseName, a.AccessRight
FROM DBC.AccessRightsV a
LEFT JOIN DBC.RoleMembersV rm ON a.UserName = rm.RoleName
WHERE rm.RoleName IS NULL  -- not assigned via role
  AND a.UserName NOT IN ('DBC', 'SYSLIB', 'SYSTEMFE')
ORDER BY a.DatabaseName;
```

---

## Statistics Analysis Subagent — System Prompt Design

### Core SQL Patterns (STAT-02, STAT-03)

```sql
-- Missing stats: indexed columns with no stats collected
SELECT t.DatabaseName, t.TableName, i.ColumnName,
       'MISSING' AS Status,
       NULL AS LastCollected,
       i.IndexType
FROM DBC.IndicesV i
JOIN DBC.TablesV t ON i.DatabaseName = t.DatabaseName AND i.TableName = t.TableName
LEFT JOIN DBC.StatsV s ON s.DatabaseName = i.DatabaseName
    AND s.TableName = i.TableName
    AND s.ColumnName = i.ColumnName
WHERE t.DatabaseName = '{DB}'
  AND t.TableKind = 'T'
  AND i.IndexType IN ('P', 'Q', 'S')  -- PI, UPI, SI
  AND s.StatsId IS NULL
ORDER BY t.TableName, i.ColumnName;

-- Stale stats: last collected more than N days ago
SELECT DatabaseName, TableName, ColumnName,
       CAST(CollectTimeStamp AS DATE) AS LastCollected,
       (DATE - CAST(CollectTimeStamp AS DATE)) AS DaysStale
FROM DBC.StatsV
WHERE DatabaseName = '{DB}'
  AND (DATE - CAST(CollectTimeStamp AS DATE)) > {THRESHOLD_DAYS}
ORDER BY DaysStale DESC;
```

**Staleness threshold** is left to Claude's discretion per CONTEXT.md. Recommended guidance for system prompt: 30 days for PI/join columns, 90 days for other columns — but the prompt should allow Claude to calibrate based on what it finds.

### Priority Ordering for Query Plan Impact (STAT-05)

System prompt should instruct sort order:
1. Primary Index columns (IndexType = 'P' or 'Q') — highest impact
2. Secondary Index columns (IndexType = 'S') — high impact
3. Columns referenced in known join conditions (heuristic: columns named `*_ID`, `*_KEY`, `*_CD`) — medium impact
4. All other columns — lower impact

### COLLECT STATISTICS Template (STAT-04)

```sql
-- Single column
COLLECT STATISTICS COLUMN ({column_name}) ON {database_name}.{table_name};

-- Multi-column index (for composite PI)
COLLECT STATISTICS INDEX ({col1}, {col2}) ON {database_name}.{table_name};
```

---

## MVC Analysis Subagent — System Prompt Design

### Adaptation from File-Output to In-App Output

The original `mvc-compression-advisor.md` writes three files. The in-app adaptation renders equivalent content as structured markdown in the result card:

| Original File | In-App Equivalent |
|--------------|-------------------|
| `{db}_mvc_report.md` | Executive summary section in markdown |
| `{db}_mvc_compression.sql` | SQL code block(s) in markdown |
| `{db}_mvc_rollback.sql` | Rollback SQL code block in markdown |

The system prompt for the in-app MVC subagent should be structured as:

1. Include the full Package Bit-Cost Model algorithm from `mvc-table-analyzer.md` (Steps A-I verbatim or paraphrased)
2. Include the table eligibility rules from `mvc-compression-advisor.md` (TableKind='T', >=100 rows)
3. Instruct output format as markdown sections (not file Write calls)
4. Include priority classification rules (CRITICAL/HIGH/MEDIUM/SKIP thresholds)
5. Instruct to show top 20 tables maximum if database is large

### MVC MAX_TOOL_ROUNDS Calculation

For a database with N eligible tables, each table requires approximately:
- 1 call: row count query
- 1 call: column metadata (`base_columnDescription`)
- 1 call: PI query (`base_readQuery`)
- 1 call: DDL for existing compression (`base_tableDDL`)
- N_columns calls: value distribution (1 per eligible column, typically 3-15 columns)

For a typical 10-table database with ~8 columns each: ~10 × (4 + 8) = 120 tool calls. This exceeds 10 rounds significantly. The MVC subagent should set `MAX_TOOL_ROUNDS = 60` or higher. The subagent run function should have its own rounds limit, separate from the chat.ts constant.

### Sampling Instruction in System Prompt

The system prompt must include the sampling rule verbatim:
- Tables with RowCount > 10,000,000: use `SAMPLE 0.10`, multiply counts by 10
- Adjust HAVING threshold: `FLOOR(CountThreshold / 10)` when sampling

---

## Common Pitfalls

### Pitfall 1: Insufficient Tool Rounds for MVC
**What goes wrong:** MVC analysis on a real database hits `MAX_TOOL_ROUNDS = 10` and returns incomplete results — Claude's last message says "I was unable to analyze all tables."
**Why it happens:** Each table requires multiple sequential tool calls; 10 rounds is sized for chat use, not multi-table analysis.
**How to avoid:** Subagent run functions define their own rounds limit. MVC uses 60. Security and Statistics use 20.
**Warning signs:** Results mention "unable to complete" or stop mid-analysis.

### Pitfall 2: MCP Tool Discovery vs. Subagent Tool Filtering
**What goes wrong:** Security subagent is given all MCP tools (including `dba_*`, `qlty_*`) — Claude tries to use irrelevant tools, wasting token budget on failed calls.
**Why it happens:** `getMcpToolsForClaude()` returns ALL discovered tools. No filtering by subagent type.
**How to avoid:** Each subagent run function filters the discovered tools to only the ones its system prompt references. Pass `tools: relevantTools` to the Bedrock API call.
**Warning signs:** Claude's tool calls include `qlty_*` tools in a security audit.

### Pitfall 3: runSubagent IPC Signature Mismatch
**What goes wrong:** `SubagentLauncher.tsx` calls `runSubagent(agentId, params)` but preload only forwards `agentId` — params are silently dropped.
**Why it happens:** Phase 2 preload signature is `runSubagent: (agentId: string)` with no second argument.
**How to avoid:** Update preload, `ElectronAPI` type in `shared/types.ts`, and IPC handler in the same plan — all three must change together.
**Warning signs:** Subagent runs but ignores user-provided database name.

### Pitfall 4: BYTEINT Columns in MVC Analysis
**What goes wrong:** Claude attempts to compress BYTEINT columns and generates ALTER TABLE statements with zero net benefit.
**Why it happens:** BYTEINT has ColumnLength = 1, so `ValueSavings = 1 × ValueCount`, but the compression bit costs the same — net benefit is always 0.
**How to avoid:** System prompt must explicitly list BYTEINT (type code I1) in the exclusion list. Copy from `mvc-table-analyzer.md` Data Type Reference table.
**Warning signs:** ALTER TABLE statements for BYTEINT columns appear in output.

### Pitfall 5: NULL in COMPRESS Value List
**What goes wrong:** Claude generates `COMPRESS (NULL, 'ACTIVE', 'CLOSED')` — Teradata rejects this syntax.
**Why it happens:** Mistaking NULL frequency for a compressible value.
**How to avoid:** System prompt must state: "Never include NULL in the COMPRESS value list. For nullable columns, NULL is auto-compressed by Teradata when other values are present. Use bare `COMPRESS` (no arguments) only for NULL-only compression."
**Warning signs:** ALTER TABLE statements contain NULL in the value list.

### Pitfall 6: DBQL Unavailability for Security Audit
**What goes wrong:** Security audit fails entirely because `base_readQuery` on DBC.LogOnOffV returns an access denied error.
**Why it happens:** DBQL may not be enabled or the MCP service account may lack DBC access.
**How to avoid:** System prompt instructs Claude to wrap DBQL queries in try/catch logic conceptually — if the query returns an error, note "DBQL logging unavailable" in findings and continue with the non-DBQL checks.
**Warning signs:** Audit result is empty or returns an error message instead of findings.

### Pitfall 7: Tailwind v4 Class Issues in Launcher Form
**What goes wrong:** New input form elements in SubagentLauncher.tsx use Tailwind utility classes that render incorrectly.
**Why it happens:** Tailwind v4 `@theme` custom spacing tokens are broken (documented in MEMORY.md).
**How to avoid:** Use inline styles for all new form elements — consistent with existing SubagentLauncher.tsx pattern which already uses inline styles exclusively.
**Warning signs:** Form inputs appear unstyled or with incorrect sizing.

---

## Code Examples

### Subagent Run Function Skeleton

```typescript
// Source: Derived from chat.ts pattern — getBedrockClient + tool-use loop
// src/main/subagents/security-audit.ts

import AnthropicBedrock from '@anthropic-ai/bedrock-sdk';
import { getBedrockClient } from '../services/bedrock-client';
import { getMcpToolsForClaude, executeTool } from '../services/mcp-tools';
import type { SubagentContext, SubagentRunResult } from '../../shared/subagent-types';

const MAX_TOOL_ROUNDS = 20;

const SECURITY_TOOLS = ['sec_userRoles', 'sec_userDbPermissions', 'sec_rolePermissions', 'base_readQuery'];

export async function runSecurityAudit(ctx: SubagentContext): Promise<SubagentRunResult> {
  const scope = ctx.params['scope'] ?? 'system-wide';
  const { client, modelId } = await getBedrockClient();

  const allTools = await getMcpToolsForClaude();
  const tools = allTools.filter((t) => SECURITY_TOOLS.includes(t.name));

  const systemPrompt = buildSecuritySystemPrompt(scope);
  const userMessage = `Perform a security audit. Scope: ${scope}`;

  const conversationMessages: Array<{ role: 'user' | 'assistant'; content: any }> = [
    { role: 'user', content: userMessage },
  ];

  let outputText = '';
  let round = 0;

  while (round < MAX_TOOL_ROUNDS) {
    round++;
    const resp = await client.messages.create({
      model: modelId,
      max_tokens: 8192,
      system: systemPrompt,
      messages: conversationMessages,
      tools,
    });

    // Collect text
    for (const block of resp.content) {
      if (block.type === 'text') outputText += block.text;
    }

    if (resp.stop_reason !== 'tool_use') break;

    // Handle tool calls
    const toolBlocks = resp.content.filter((b: any) => b.type === 'tool_use');
    conversationMessages.push({ role: 'assistant', content: resp.content });

    const toolResults = await Promise.all(
      toolBlocks.map(async (tb: any) => ({
        type: 'tool_result',
        tool_use_id: tb.id,
        content: await executeTool(tb.name, tb.input),
      }))
    );
    conversationMessages.push({ role: 'user', content: toolResults });
  }

  return { content: outputText };
}
```

### Launcher Form Pattern

```tsx
// SubagentLauncher.tsx — inline form expansion
{pendingAgent?.id === agent.id && agent.params?.length && (
  <form
    onSubmit={(e) => {
      e.preventDefault();
      handleRun(agent, formValues);
      setPendingAgent(null);
      setFormValues({});
    }}
    style={{ padding: '8px 16px 12px', display: 'flex', flexDirection: 'column', gap: '8px' }}
  >
    {agent.params.map((param) => (
      <input
        key={param.key}
        type="text"
        placeholder={param.placeholder}
        required={param.required}
        value={formValues[param.key] ?? ''}
        onChange={(e) => setFormValues((prev) => ({ ...prev, [param.key]: e.target.value }))}
        style={{
          background: '#1A1A1A',
          border: '1px solid #404040',
          borderRadius: '6px',
          padding: '6px 10px',
          color: '#F5F5F5',
          fontSize: '13px',
          width: '100%',
          boxSizing: 'border-box',
        }}
      />
    ))}
    <button
      type="submit"
      style={{
        background: '#F37440',
        color: 'white',
        border: 'none',
        borderRadius: '6px',
        padding: '6px 12px',
        fontSize: '13px',
        fontWeight: 600,
        cursor: 'pointer',
      }}
    >
      Run Analysis
    </button>
  </form>
)}
```

### Statistics Query Pattern

```typescript
// System prompt will direct Claude to run this via base_readQuery
// Source: Teradata DBC.StatsV documentation (standard DBA practice)
const STATS_SYSTEM_PROMPT_QUERY_GUIDANCE = `
Run this query to find missing statistics on PI/SI columns:
SELECT t.DatabaseName, t.TableName, i.ColumnName, i.IndexType,
       CASE WHEN s.StatsId IS NULL THEN 'MISSING' ELSE 'HAS_STATS' END AS StatsStatus,
       CAST(s.CollectTimeStamp AS DATE) AS LastCollected,
       (DATE - CAST(s.CollectTimeStamp AS DATE)) AS DaysStale
FROM DBC.IndicesV i
JOIN DBC.TablesV t ON i.DatabaseName = t.DatabaseName AND i.TableName = t.TableName
LEFT JOIN DBC.StatsV s ON s.DatabaseName = i.DatabaseName
    AND s.TableName = i.TableName
    AND s.ColumnName = i.ColumnName
WHERE t.DatabaseName = '{DATABASE_NAME}'
  AND t.TableKind = 'T'
ORDER BY StatsStatus, DaysStale DESC NULLS LAST;
`;
```

---

## Environment Availability

Step 2.6: SKIPPED — Phase 3 is purely TypeScript/prompt engineering work within the existing Electron app. All external dependencies (Bedrock, MCP server) were established and validated in Phase 2. No new external services or CLI tools required.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Separate API chain per subagent | Reuse existing chat.ts tool-use loop | Phase 2 decision | No new backend infrastructure; subagents are system prompts + params |
| File-output agent (Write tool) | In-app markdown result card | Phase 3 adaptation | MVC output rendered inline instead of writing files to disk |
| Agent SDK `query()` / subagent spawning | Raw Bedrock SDK with tool-use loop | Phase 1/2 decision | App uses Bedrock, not direct Anthropic API; Agent SDK not compatible with Bedrock endpoint |

**Note on Agent SDK:** The CLAUDE.md recommends `@anthropic-ai/claude-agent-sdk` for subagent orchestration, but the project uses AWS Bedrock (decision logged in STATE.md). The Agent SDK connects to `api.anthropic.com` not Bedrock. The correct approach for this project is the manual tool-use loop in `chat.ts` — not the Agent SDK. This is consistent with Phase 2 decisions.

---

## Open Questions

1. **MVC parallel vs. sequential analysis**
   - What we know: Electron app cannot spawn true parallel Claude calls without significant complexity; sequential is correct for v1.
   - What's unclear: For a large database (50+ tables), sequential MVC will run for several minutes. The result card has no streaming progress — it just shows "Running..." until done.
   - Recommendation: Emit tool-call status tokens via the existing `CHAT_TOKEN`-style IPC pattern to show progress. OR accept that MVC is long-running and the spinner is sufficient for v1.

2. **MVC subagent tool count feasibility**
   - What we know: For N tables × M columns, tool call count grows O(N×M). MAX_TOOL_ROUNDS = 60 may be insufficient for large databases.
   - What's unclear: Whether a 60-round limit is enough for typical DBA databases (5-30 tables, 10-50 columns each).
   - Recommendation: Set MAX_TOOL_ROUNDS = 100 for MVC. Add optional `tableName` param to limit scope to a single table for large databases.

3. **`sec_*` tool exact names and schemas**
   - What we know: CONTEXT.md confirms `sec_userRoles`, `sec_userDbPermissions`, `sec_rolePermissions` are available on the MCP server.
   - What's unclear: Exact input parameter names for each tool (e.g., is the param `username` or `user_name`?). These are discovered dynamically by `discoverMcpTools()` so the system prompt cannot assume parameter names.
   - Recommendation: System prompt instructs Claude to use the tool descriptions (discovered dynamically) to determine correct parameter names. The tool-use loop handles this correctly since Claude reads the `input_schema` from the tool definition.

---

## Project Constraints (from CLAUDE.md)

These directives apply to all Phase 3 work:

| Directive | Implication for Phase 3 |
|-----------|------------------------|
| LLM Provider: Claude API via AWS Bedrock (not direct Anthropic) | Subagent run functions use `@anthropic-ai/bedrock-sdk` — Agent SDK cannot be used |
| `nodeIntegration: false` in renderer | Parameter forms collect input in renderer; all MCP calls stay in main process via IPC |
| Credentials via `safeStorage` only | No new credential storage needed; Bedrock credentials already in safeStorage |
| No auto-execution of SQL | System prompts must explicitly state: "Surface SQL for copy-paste only. Never suggest the user will execute automatically." |
| Teradata brand colors: `#F37440` (orange), `#1D1D1D` (charcoal) | Launcher form submit button uses `#F37440`; form inputs use dark background consistent with existing UI |
| Inline styles (not Tailwind custom tokens) | All new UI elements in SubagentLauncher.tsx use inline styles — Tailwind v4 `@theme` tokens broken |
| No DDL/DML execution from chat | Same applies to subagents — ALTER TABLE statements shown for copy-paste, never executed |
| `teradatasql` deprecated; use MCP server | Subagents call MCP tools via existing `callMcpTool()` — never direct DB connection |

---

## Sources

### Primary (HIGH confidence)
- Codebase: `src/main/ipc/chat.ts` — tool-use loop pattern, `getBedrockClient()`, `getMcpToolsForClaude()`
- Codebase: `src/main/subagents/echo.ts` + `registry.ts` — SubagentDefinition pattern
- Codebase: `src/shared/subagent-types.ts` — current type contracts
- Codebase: `src/renderer/src/components/SubagentLauncher.tsx` — launcher UI pattern, inline styles
- Codebase: `src/renderer/src/features/chat/SubagentResultCard.tsx` — result rendering with Streamdown
- Agent definition: `/Users/Daniel.Tehan/Code/MVC Agent/.claude/agents/mvc-compression-advisor.md` — complete MVC orchestrator algorithm
- Agent definition: `/Users/Daniel.Tehan/Code/MVC Agent/.claude/agents/mvc-table-analyzer.md` — complete Package Bit-Cost Model, SQL queries, output format
- `.planning/phases/03-core-subagents/03-CONTEXT.md` — locked architecture decisions, tool names
- `CLAUDE.md` — stack constraints, security rules, brand guidelines

### Secondary (MEDIUM confidence)
- Teradata DBC.StatsV, DBC.IndicesV, DBC.AccessRightsV, DBC.LogOnOffV — standard Teradata system views (well-documented, patterns from industry-standard DBA practice)

### Tertiary (LOW confidence)
- Exact `sec_*` MCP tool parameter schemas — tool descriptions available dynamically at runtime via `discoverMcpTools()`, not inspected directly during research

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries already installed, no new dependencies
- Architecture: HIGH — pattern established in Phase 2, extensions are incremental
- Pitfalls: HIGH — derived from codebase inspection and existing agent definitions
- System prompt content (Security/Statistics): MEDIUM — wording at Claude's discretion per CONTEXT.md; SQL patterns are standard Teradata practice

**Research date:** 2026-03-26
**Valid until:** 2026-04-26 (stable stack, no fast-moving dependencies)
