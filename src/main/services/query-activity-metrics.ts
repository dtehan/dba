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
      sql: 'SELECT TOP 25 SUBSTR(QueryText, 1, 300) AS QueryText, UserName, AmpCPUTime, TotalIOCount FROM DBC.QryLogV ORDER BY AmpCPUTime DESC',
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
        }))
        .filter((q) => q.queryText.length > 0);
    }
  } catch (err) {
    console.warn('[query-activity] fetch failed:', err);
  }

  return metrics;
}
