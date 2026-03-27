import { callMcpTool } from './mcp-schema';
import type { OverviewMetrics } from '../../shared/types';

interface QuerySpec {
  name: string;
  query: string;
}

const QUERIES: QuerySpec[] = [
  {
    name: 'version',
    query: "SELECT InfoData FROM DBC.DBCInfoV WHERE InfoKey = 'VERSION'",
  },
  {
    name: 'currentUser',
    query: 'SELECT USER AS CurrentUser, DATABASE AS DefaultDB',
  },
  {
    name: 'storage',
    query:
      'SELECT DatabaseName, CurrentPerm, MaxPerm FROM (SELECT DatabaseName, SUM(CurrentPerm) AS CurrentPerm, SUM(MaxPerm) AS MaxPerm FROM DBC.DiskSpaceV GROUP BY DatabaseName) t QUALIFY ROW_NUMBER() OVER (ORDER BY CurrentPerm DESC) <= 20',
  },
  {
    name: 'tables',
    query:
      'SELECT DataBaseName, TableName, CurrentPerm FROM (SELECT DataBaseName, TableName, SUM(CurrentPerm) AS CurrentPerm FROM DBC.TableSizeV GROUP BY DataBaseName, TableName) t QUALIFY ROW_NUMBER() OVER (ORDER BY CurrentPerm DESC) <= 20',
  },
  {
    name: 'users',
    query:
      'SELECT TOP 15 UserName, SUM(AmpCPUTime) AS TotalCPU FROM DBC.QryLogV GROUP BY UserName ORDER BY TotalCPU DESC',
  },
];

/** Safely run a single MCP query, returning null on failure */
async function safeQuery(spec: QuerySpec): Promise<string | null> {
  try {
    return await callMcpTool('base_readQuery', { sql: spec.query });
  } catch (err) {
    console.warn(`[overview] ${spec.name} query failed:`, err);
    return null;
  }
}

/** Try to extract rows array from MCP response text */
function parseRows(raw: string): Record<string, unknown>[] | null {
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;
    if (parsed.results && Array.isArray(parsed.results)) return parsed.results;
    if (parsed.data && Array.isArray(parsed.data)) return parsed.data;
    if (typeof parsed === 'object' && parsed !== null) return [parsed];
  } catch {
    // Not JSON
  }
  return null;
}

/** Case-insensitive field lookup */
function field(row: Record<string, unknown>, ...names: string[]): unknown {
  for (const name of names) {
    if (row[name] !== undefined) return row[name];
    const lower = name.toLowerCase();
    if (row[lower] !== undefined) return row[lower];
    const upper = name.toUpperCase();
    if (row[upper] !== undefined) return row[upper];
  }
  const keys = Object.keys(row);
  for (const name of names) {
    const lower = name.toLowerCase();
    const match = keys.find((k) => k.toLowerCase() === lower);
    if (match !== undefined) return row[match];
  }
  return undefined;
}

export async function fetchOverviewMetrics(): Promise<OverviewMetrics> {
  const results = new Map<string, string | null>();
  for (const spec of QUERIES) {
    results.set(spec.name, await safeQuery(spec));
  }

  const metrics: OverviewMetrics = {
    version: null,
    currentUser: null,
    totalCpuTime: 0,
    storageUsage: [],
    largestTables: [],
    topUsersByCpu: [],
    fetchedAt: Date.now(),
  };

  // Parse version
  const versionRaw = results.get('version');
  if (versionRaw) {
    const rows = parseRows(versionRaw);
    if (rows && rows.length > 0) {
      const val = field(rows[0], 'InfoData');
      if (val != null) metrics.version = String(val).trim();
    }
    if (!metrics.version) {
      const text = versionRaw.trim();
      if (text.length > 0 && text.length < 200) metrics.version = text;
    }
  }

  // Parse current user
  const userRaw = results.get('currentUser');
  if (userRaw) {
    const rows = parseRows(userRaw);
    if (rows && rows.length > 0) {
      const user = field(rows[0], 'CurrentUser', 'User');
      const db = field(rows[0], 'DefaultDB', 'Database');
      if (user != null) {
        metrics.currentUser = String(user).trim();
        if (db != null) metrics.currentUser += ` (${String(db).trim()})`;
      }
    }
  }

  // Parse storage usage
  const storageRaw = results.get('storage');
  if (storageRaw) {
    const rows = parseRows(storageRaw);
    if (rows) {
      metrics.storageUsage = rows
        .map((r) => ({
          databaseName: String(field(r, 'DatabaseName') ?? ''),
          currentPerm: Number(field(r, 'CurrentPerm') ?? 0),
          maxPerm: Number(field(r, 'MaxPerm') ?? 0),
        }))
        .filter((s) => s.databaseName.length > 0);
    }
  }

  // Parse largest tables
  const tablesRaw = results.get('tables');
  if (tablesRaw) {
    const rows = parseRows(tablesRaw);
    if (rows) {
      metrics.largestTables = rows
        .map((r) => ({
          databaseName: String(field(r, 'DataBaseName', 'DatabaseName') ?? ''),
          tableName: String(field(r, 'TableName') ?? ''),
          currentPerm: Number(field(r, 'CurrentPerm') ?? 0),
        }))
        .filter((t) => t.tableName.length > 0);
    }
  }

  // Parse top users by CPU
  const usersRaw = results.get('users');
  if (usersRaw) {
    const rows = parseRows(usersRaw);
    if (rows) {
      metrics.topUsersByCpu = rows
        .map((r) => ({
          userName: String(field(r, 'UserName') ?? ''),
          totalCpu: Number(field(r, 'TotalCPU', 'TotalCpu') ?? 0),
        }))
        .filter((u) => u.userName.length > 0);
      // Derive total CPU from all users
      metrics.totalCpuTime = metrics.topUsersByCpu.reduce((sum, u) => sum + u.totalCpu, 0);
    }
  }

  return metrics;
}
