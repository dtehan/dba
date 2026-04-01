export type ObjectType = 'database' | 'table' | 'user' | 'query';

export interface ObjectContext {
  databaseName?: string;
  tableName?: string;
  userName?: string;
  queryText?: string;
  /** Used to fetch full SQL on demand */
  queryId?: string;
  procId?: string;
}

export interface SubagentOption {
  agentId: string;
  label: string;
  buildParams: (context: ObjectContext) => Record<string, string>;
}

const DATABASE_AGENTS: SubagentOption[] = [
  {
    agentId: 'space-usage',
    label: 'Space Usage',
    buildParams: (ctx) => ({ databaseName: ctx.databaseName ?? '' }),
  },
  {
    agentId: 'security-audit',
    label: 'Security Audit',
    buildParams: (ctx) => ({ scope: ctx.databaseName ?? '' }),
  },
  {
    agentId: 'mvc-analysis',
    label: 'MVC Analysis',
    buildParams: (ctx) => ({ databaseName: ctx.databaseName ?? '' }),
  },
  {
    agentId: 'stats-analysis',
    label: 'Statistics Analysis',
    buildParams: (ctx) => ({ databaseName: ctx.databaseName ?? '' }),
  },
  {
    agentId: 'skew-analysis',
    label: 'Skew Analysis',
    buildParams: (ctx) => ({ databaseName: ctx.databaseName ?? '' }),
  },
  {
    agentId: 'index-advisor',
    label: 'Index Advisor',
    buildParams: (ctx) => ({ databaseName: ctx.databaseName ?? '' }),
  },
  {
    agentId: 'duplicate-detection',
    label: 'Duplicate Detection',
    buildParams: (ctx) => ({ databaseName: ctx.databaseName ?? '' }),
  },
  {
    agentId: 'lock-contention',
    label: 'Lock Contention',
    buildParams: (ctx) => ({ databaseName: ctx.databaseName ?? '' }),
  },
];

const TABLE_AGENTS: SubagentOption[] = [
  {
    agentId: 'mvc-analysis',
    label: 'MVC Analysis',
    buildParams: (ctx) => ({ databaseName: ctx.databaseName ?? '', tableName: ctx.tableName ?? '' }),
  },
  {
    agentId: 'stats-analysis',
    label: 'Statistics Analysis',
    buildParams: (ctx) => ({ databaseName: ctx.databaseName ?? '', tableName: ctx.tableName ?? '' }),
  },
  {
    agentId: 'skew-analysis',
    label: 'Skew Analysis',
    buildParams: (ctx) => ({ databaseName: ctx.databaseName ?? '', tableName: ctx.tableName ?? '' }),
  },
  {
    agentId: 'index-advisor',
    label: 'Index Advisor',
    buildParams: (ctx) => ({ databaseName: ctx.databaseName ?? '', tableName: ctx.tableName ?? '' }),
  },
  {
    agentId: 'duplicate-detection',
    label: 'Duplicate Detection',
    buildParams: (ctx) => ({ databaseName: ctx.databaseName ?? '', tableName: ctx.tableName ?? '' }),
  },
];

const USER_AGENTS: SubagentOption[] = [
  {
    agentId: 'security-audit',
    label: 'Security Audit',
    buildParams: (ctx) => ({ scope: ctx.userName ?? '' }),
  },
];

const QUERY_AGENTS: SubagentOption[] = [
  {
    agentId: 'query-performance',
    label: 'Query Performance',
    buildParams: (ctx) => ({ queryText: ctx.queryText ?? '' }),
  },
];

const SUBAGENT_MAP: Record<ObjectType, SubagentOption[]> = {
  database: DATABASE_AGENTS,
  table: TABLE_AGENTS,
  user: USER_AGENTS,
  query: QUERY_AGENTS,
};

export function getSubagentsForObject(type: ObjectType): SubagentOption[] {
  return SUBAGENT_MAP[type];
}
