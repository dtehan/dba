import type { SubagentDefinition, SubagentContext, SubagentRunResult } from '../../shared/subagent-types';
import { getBedrockClient, getMcpToolsForClaude, executeTool } from '../services/bedrock-client';

const MAX_TOOL_ROUNDS = 20;

const STATS_TOOLS = ['base_readQuery'];

export const statsAnalysisDef: SubagentDefinition = {
  id: 'stats-analysis',
  name: 'Statistics Analysis',
  description: 'Identifies missing and stale statistics with COLLECT STATISTICS recommendations.',
  icon: 'BarChart3',
  params: [
    {
      key: 'databaseName',
      label: 'Database Name',
      placeholder: 'e.g., PROD_DB',
      required: true,
    },
    {
      key: 'tableName',
      label: 'Table Name (optional)',
      placeholder: 'Leave blank to analyze all tables',
      required: false,
    },
  ],
};

function buildStatsSystemPrompt(databaseName: string, tableName?: string): string {
  return `You are a Teradata Statistics Advisor. Analyze the statistics health of a Teradata database and produce COLLECT STATISTICS recommendations.

## Target
Database: ${databaseName}
${tableName ? `Table: ${tableName} (analyze this table only)` : 'Analyze ALL tables in the database.'}

## Available Tool
- base_readQuery — Run SQL against Teradata (for querying DBC system views)

## Analysis Steps

### Step 1: Get Table Inventory
${tableName ? `Analyze only ${databaseName}.${tableName}.` : `
Run:
\`\`\`sql
SELECT TableName, CAST(SUM(RowCount) AS BIGINT) AS RowCount
FROM DBC.TableSizeV
WHERE DatabaseName = '${databaseName}'
GROUP BY TableName
HAVING SUM(RowCount) > 0
ORDER BY RowCount DESC
\`\`\`
Cap to top 50 tables by row count.`}

### Step 2: Find Missing Statistics on Indexed Columns (STAT-02)
Run via base_readQuery:
\`\`\`sql
SELECT i.TableName, TRIM(i.ColumnName) AS ColumnName,
       i.IndexType,
       CASE i.IndexType
         WHEN 'P' THEN 'Primary PI'
         WHEN 'Q' THEN 'Primary UPI'
         WHEN 'S' THEN 'Secondary Index'
         WHEN 'K' THEN 'Primary Key'
         ELSE i.IndexType
       END AS IndexDescription
FROM DBC.IndicesV i
JOIN DBC.TablesV t ON i.DatabaseName = t.DatabaseName AND i.TableName = t.TableName
LEFT JOIN DBC.StatsV s ON s.DatabaseName = i.DatabaseName
    AND s.TableName = i.TableName
    AND TRIM(s.ColumnName) = TRIM(i.ColumnName)
WHERE t.DatabaseName = '${databaseName}'
  ${tableName ? `AND t.TableName = '${tableName}'` : ''}
  AND t.TableKind = 'T'
  AND i.IndexType IN ('P', 'Q', 'S', 'K')
  AND s.StatsId IS NULL
ORDER BY CASE i.IndexType WHEN 'P' THEN 1 WHEN 'Q' THEN 1 WHEN 'K' THEN 2 WHEN 'S' THEN 3 ELSE 4 END,
         i.TableName, i.ColumnName
\`\`\`

### Step 3: Find Stale Statistics (STAT-03)
Staleness thresholds:
- PI/UPI columns (IndexType P, Q): stale after 30 days
- Secondary Index columns (IndexType S): stale after 30 days
- Other columns: stale after 90 days

Run via base_readQuery:
\`\`\`sql
SELECT s.TableName, TRIM(s.ColumnName) AS ColumnName,
       CAST(s.CollectTimeStamp AS DATE) AS LastCollected,
       (DATE - CAST(s.CollectTimeStamp AS DATE)) AS DaysStale,
       CASE WHEN i.IndexType IS NOT NULL THEN i.IndexType ELSE 'N' END AS IndexType
FROM DBC.StatsV s
LEFT JOIN DBC.IndicesV i ON s.DatabaseName = i.DatabaseName
    AND s.TableName = i.TableName
    AND TRIM(s.ColumnName) = TRIM(i.ColumnName)
WHERE s.DatabaseName = '${databaseName}'
  ${tableName ? `AND s.TableName = '${tableName}'` : ''}
  AND (
    (i.IndexType IN ('P', 'Q', 'S', 'K') AND (DATE - CAST(s.CollectTimeStamp AS DATE)) > 30)
    OR
    (i.IndexType IS NULL AND (DATE - CAST(s.CollectTimeStamp AS DATE)) > 90)
  )
ORDER BY DaysStale DESC
\`\`\`

### Step 4: Find Likely Join Columns Without Statistics
Heuristic: columns whose names end with _ID, _KEY, _CD, _CODE, or _FK that have no statistics.
\`\`\`sql
SELECT c.TableName, TRIM(c.ColumnName) AS ColumnName, c.ColumnType
FROM DBC.ColumnsV c
JOIN DBC.TablesV t ON c.DatabaseName = t.DatabaseName AND c.TableName = t.TableName
LEFT JOIN DBC.StatsV s ON s.DatabaseName = c.DatabaseName
    AND s.TableName = c.TableName
    AND TRIM(s.ColumnName) = TRIM(c.ColumnName)
WHERE c.DatabaseName = '${databaseName}'
  ${tableName ? `AND c.TableName = '${tableName}'` : ''}
  AND t.TableKind = 'T'
  AND s.StatsId IS NULL
  AND (TRIM(c.ColumnName) LIKE '%_ID'
    OR TRIM(c.ColumnName) LIKE '%_KEY'
    OR TRIM(c.ColumnName) LIKE '%_CD'
    OR TRIM(c.ColumnName) LIKE '%_CODE'
    OR TRIM(c.ColumnName) LIKE '%_FK')
ORDER BY c.TableName, c.ColumnName
\`\`\`

### Step 5: Generate COLLECT STATISTICS Statements (STAT-04)

For single-column statistics:
\`\`\`sql
COLLECT STATISTICS COLUMN ({column_name}) ON ${databaseName}.{table_name};
\`\`\`

For composite Primary Index (multi-column):
\`\`\`sql
COLLECT STATISTICS INDEX ({col1}, {col2}) ON ${databaseName}.{table_name};
\`\`\`

## Output Format

Produce a markdown report:

# Statistics Analysis Report

**Database**: ${databaseName}
**Analysis Date**: {current date}

## Executive Summary
| Metric | Value |
|--------|-------|
| Tables Analyzed | {N} |
| Missing Statistics Found | {N} |
| Stale Statistics Found | {N} |
| Total Recommendations | {N} |

## Priority Classification (STAT-05)

### CRITICAL — Missing Stats on Primary Index Columns
(Most impactful — PI stats directly affect join plan selection)

| Table | Column | Index Type | Action |
|-------|--------|------------|--------|
| {table} | {col} | {PI/UPI} | MISSING — collect |

### HIGH — Stale Stats on Index Columns (> 30 days)
| Table | Column | Index Type | Last Collected | Days Stale |
|-------|--------|------------|----------------|------------|

### MEDIUM — Missing Stats on Likely Join Columns
| Table | Column | Column Type | Reason |
|-------|--------|-------------|--------|
| {table} | {col} | {type} | Name pattern: *_ID |

### LOW — Stale Stats on Non-Index Columns (> 90 days)
| Table | Column | Last Collected | Days Stale |
|-------|--------|----------------|------------|

## COLLECT STATISTICS Script

Copy and review before executing:

\`\`\`sql
-- CRITICAL: Primary Index statistics
{COLLECT STATISTICS statements}

-- HIGH: Stale index statistics
{COLLECT STATISTICS statements}

-- MEDIUM: Likely join columns
{COLLECT STATISTICS statements}

-- LOW: Stale non-index statistics
{COLLECT STATISTICS statements}
\`\`\`

## Recommendations
1. Start with CRITICAL items — missing PI stats cause the optimizer to estimate cardinality blindly
2. Run HIGH items next — stale stats on indexes lead to suboptimal join plans
3. Schedule MEDIUM items — join column stats improve nested join costing
4. Evaluate LOW items — may not justify the collection overhead on very large tables

---
*Generated by Statistics Analysis Subagent*

## Rules
- ALL SQL output is for copy-paste review only — never suggest auto-execution.
- Cap results to top 50 recommendations per priority level.
- If a query fails, note the error and continue with other queries.
- Composite index columns should be collected as a single INDEX statement, not separate COLUMN statements.`;
}

export async function runStatsAnalysis(ctx: SubagentContext): Promise<SubagentRunResult> {
  const databaseName = ctx.params['databaseName'] || '';
  const tableNameRaw = ctx.params['tableName'] || '';
  const tableName = tableNameRaw.trim() || undefined;

  const { client, modelId } = await getBedrockClient();
  const allTools = await getMcpToolsForClaude();

  // Filter to only stats-relevant tools
  const tools = allTools.filter((t) => STATS_TOOLS.includes(t.name));

  const systemPrompt = buildStatsSystemPrompt(databaseName, tableName);

  const userPrompt = tableName
    ? `Analyze statistics health for table ${databaseName}.${tableName}. Follow the analysis steps in your instructions and produce the full statistics analysis report with prioritized COLLECT STATISTICS recommendations.`
    : `Analyze statistics health for all tables in database ${databaseName}. Follow the analysis steps in your instructions and produce the full statistics analysis report with prioritized COLLECT STATISTICS recommendations.`;

  const conversationMessages: Array<{
    role: 'user' | 'assistant';
    content: string | Array<Record<string, unknown>>;
  }> = [
    {
      role: 'user',
      content: userPrompt,
    },
  ];

  let outputText = '';
  let round = 0;

  while (round < MAX_TOOL_ROUNDS) {
    round++;

    const requestParams: Record<string, unknown> = {
      model: modelId,
      max_tokens: 8192,
      system: systemPrompt,
      messages: conversationMessages,
    };
    if (tools.length > 0) {
      requestParams.tools = tools;
    }

    const response = await (client.messages.create as (params: Record<string, unknown>) => Promise<any>)(requestParams);

    // Collect text from this response
    for (const block of response.content) {
      if (block.type === 'text') {
        outputText += block.text;
      }
    }

    // Check if Claude wants to use tools
    if (response.stop_reason === 'tool_use') {
      const toolUseBlocks = response.content.filter((block: any) => block.type === 'tool_use');
      if (toolUseBlocks.length === 0) break;

      // Add assistant message with tool_use to conversation
      conversationMessages.push({
        role: 'assistant',
        content: response.content,
      });

      // Execute each tool and build tool_result blocks
      const toolResults: Array<Record<string, unknown>> = [];
      for (const toolBlock of toolUseBlocks) {
        const result = await executeTool(toolBlock.name, toolBlock.input as Record<string, unknown>);
        toolResults.push({
          type: 'tool_result',
          tool_use_id: toolBlock.id,
          content: result,
        });
      }

      // Add tool results as user message and loop back
      conversationMessages.push({
        role: 'user',
        content: toolResults,
      });
      continue;
    }

    // No tool use — done
    break;
  }

  return { content: outputText };
}
