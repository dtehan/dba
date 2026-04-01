import { callMcpTool } from './mcp-schema';
import type { QueryActivityMetrics } from '../../shared/types';

/** Case-insensitive field lookup */
function field(row: Record<string, unknown>, ...names: string[]): unknown {
  for (const name of names) {
    if (row[name] !== undefined) return row[name];
  }
  const keys = Object.keys(row);
  for (const name of names) {
    const lower = name.toLowerCase();
    const match = keys.find((k) => k.toLowerCase() === lower);
    if (match !== undefined) return row[match];
  }
  return undefined;
}

export async function fetchQueryActivityMetrics(): Promise<QueryActivityMetrics> {
  const metrics: QueryActivityMetrics = {
    topQueries: [],
    fetchedAt: Date.now(),
  };

  try {
    const raw = await callMcpTool('base_readQuery', {
      sql: 'SELECT TOP 200 SUBSTR(QueryText, 1, 300) AS QueryText, UserName, AmpCPUTime, TotalIOCount, CAST(QueryID AS VARCHAR(30)) AS QueryID, CAST(ProcID AS VARCHAR(30)) AS ProcID FROM DBC.QryLogV ORDER BY AmpCPUTime DESC',
    });

    const parsed = JSON.parse(raw);
    const rows = parsed.results ?? (Array.isArray(parsed) ? parsed : null);
    if (rows && Array.isArray(rows)) {
      metrics.topQueries = rows
        .map((r: Record<string, unknown>) => ({
          queryText: String(field(r, 'QueryText') ?? ''),
          userName: String(field(r, 'UserName') ?? ''),
          cpuTime: Number(field(r, 'AmpCPUTime') ?? 0),
          ioCount: Number(field(r, 'TotalIOCount') ?? 0),
          queryId: String(field(r, 'QueryID') ?? ''),
          procId: String(field(r, 'ProcID') ?? ''),
        }))
        .filter((q) => q.queryText.length > 0);
    }
  } catch (err) {
    console.warn('[query-activity] fetch failed:', err);
  }

  return metrics;
}

/**
 * Fetch full SQL text for a query from DBC.DBQLSqlTbl.
 * Long queries may span multiple rows (ordered by SqlRowNo); we concatenate them.
 * Falls back to DBC.QryLogV QueryText if DBQLSqlTbl is unavailable.
 */
export async function fetchFullSql(queryId: string, procId: string): Promise<string> {
  try {
    const raw = await callMcpTool('base_readQuery', {
      sql: `SELECT SqlTextInfo FROM DBC.DBQLSqlTbl WHERE QueryID = ${queryId} AND ProcID = ${procId} ORDER BY SqlRowNo`,
    });
    const parsed = JSON.parse(raw);
    const rows = parsed.results ?? (Array.isArray(parsed) ? parsed : null);
    if (rows && Array.isArray(rows) && rows.length > 0) {
      return rows.map((r: Record<string, unknown>) => String(field(r, 'SqlTextInfo') ?? '')).join('');
    }
  } catch {
    // Fall through to fallback
  }

  // Fallback: get from QryLogV (may still be truncated at column limit but better than 300 chars)
  const raw = await callMcpTool('base_readQuery', {
    sql: `SELECT QueryText FROM DBC.QryLogV WHERE QueryID = ${queryId} AND ProcID = ${procId}`,
  });
  const parsed = JSON.parse(raw);
  const rows = parsed.results ?? (Array.isArray(parsed) ? parsed : null);
  if (rows && Array.isArray(rows) && rows.length > 0) {
    return String(field(rows[0], 'QueryText') ?? '');
  }
  return '';
}
