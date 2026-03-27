// Connection status for each service
export type ConnectionState = 'connected' | 'disconnected' | 'checking' | 'not-configured';

export interface ConnectionStatus {
  teradata: ConnectionState;
  claude: ConnectionState;
}

// Credential types
export interface TeradataCredentials {
  host: string;
  username: string;
  password: string;
}

// What gets stored in electron-store (non-secret)
export interface TeradataConfig {
  host: string;
}

// Chat message types
export type MessageRole = 'user' | 'assistant';

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: number;
  isStreaming?: boolean;
}

// IPC channel names as const for type safety
export const IpcChannels = {
  SAVE_TERADATA_CREDENTIALS: 'credentials:save-teradata',
  LOAD_TERADATA_HOST: 'credentials:load-teradata-host',
  SAVE_CLAUDE_KEY: 'credentials:save-claude-key',
  CLEAR_ALL_CREDENTIALS: 'credentials:clear-all',
  HAS_TERADATA_CREDENTIALS: 'credentials:has-teradata',
  HAS_CLAUDE_KEY: 'credentials:has-claude-key',
  LOAD_CLAUDE_KEY_HINTS: 'credentials:load-claude-key-hints',
  TEST_TERADATA_CONNECTION: 'mcp:test-connection',
  TEST_CLAUDE_CONNECTION: 'claude:test-connection',
  CONNECTION_STATUS_UPDATE: 'connection:status-update',
  APP_FOCUS_CHANGE: 'app:focus-change',
  CHAT_SEND: 'chat:send',
  CHAT_ABORT: 'chat:abort',
  CHAT_TOKEN: 'chat:token',
  CHAT_DONE: 'chat:done',
  CHAT_ERROR: 'chat:error',
  SCHEMA_FETCH: 'schema:fetch',
  SCHEMA_LIST_DATABASES: 'schema:list-databases',
  SUBAGENT_LIST: 'subagent:list',
  SUBAGENT_RUN: 'subagent:run',
  CHAT_SEND_SUBAGENT: 'chat:send-subagent',
  CHAT_SESSIONS_LIST: 'chat:sessions-list',
  CHAT_SESSION_SAVE: 'chat:session-save',
  CHAT_SESSION_DELETE: 'chat:session-delete',
  SUBAGENT_HISTORY_LIST: 'subagent:history-list',
  SUBAGENT_HISTORY_ADD: 'subagent:history-add',
  SUBAGENT_HISTORY_CLEAR: 'subagent:history-clear',
  OVERVIEW_FETCH: 'overview:fetch',
  QUERY_ACTIVITY_FETCH: 'query-activity:fetch',
  CONNECTION_RECHECK: 'connection:recheck',
  SYNTAX_CONTEXT: 'syntax:context',
} as const;

// Chat session for persistence
export interface ChatSession {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messages: ChatMessage[];
}

// Overview dashboard metrics
export interface OverviewMetrics {
  version: string | null;
  currentUser: string | null;
  totalCpuTime: number;
  storageUsage: Array<{ databaseName: string; currentPerm: number; maxPerm: number }>;
  largestTables: Array<{ databaseName: string; tableName: string; currentPerm: number }>;
  topUsersByCpu: Array<{ userName: string; totalCpu: number }>;
  fetchedAt: number;
}

// Query Activity dashboard metrics
export interface QueryActivityMetrics {
  topQueries: Array<{ queryText: string; userName: string; cpuTime: number; ioCount: number }>;
  fetchedAt: number;
}

// Preload API surface exposed to renderer
export interface ElectronAPI {
  saveTeradataCredentials: (creds: TeradataCredentials) => Promise<void>;
  loadTeradataHost: () => Promise<string | null>;
  saveClaudeApiKey: (key: string) => Promise<void>;
  clearAllCredentials: () => Promise<void>;
  hasTeradataCredentials: () => Promise<boolean>;
  hasClaudeKey: () => Promise<boolean>;
  loadClaudeKeyHints: () => Promise<{ accessKeyId: string; secretKey: string } | null>;
  testTeradataConnection: () => Promise<{ success: boolean; error?: string }>;
  testClaudeConnection: () => Promise<{ success: boolean; error?: string }>;
  onConnectionStatus: (callback: (status: ConnectionStatus) => void) => void;
  removeConnectionStatusListener: () => void;
  sendChat: (messages: Array<{ role: MessageRole; content: string }>, systemPrompt: string) => Promise<{ success: boolean; error?: string }>;
  abortChat: () => Promise<void>;
  onChatToken: (callback: (delta: string) => void) => void;
  onChatDone: (callback: (result: { stopReason: string }) => void) => void;
  onChatError: (callback: (error: string) => void) => void;
  removeChatListeners: () => void;
  fetchSchemaContext: (databaseName: string) => Promise<{ success: boolean; context?: string; error?: string }>;
  listDatabases: () => Promise<{ success: boolean; databases?: string[]; error?: string }>;
  listSubagents: () => Promise<Array<{ id: string; name: string; description: string; icon: string; category: string; params?: Array<{ key: string; label: string; placeholder: string; required: boolean }> }>>;
  runSubagent: (agentId: string, params?: Record<string, string>) => Promise<{ success: boolean; content?: string; error?: string }>;
  runSubagentInChat: (agentId: string, params: Record<string, string>, sessionId?: string) => Promise<{ success: boolean; error?: string }>;
  listChatSessions: () => Promise<Array<{ id: string; title: string; createdAt: number; updatedAt: number; messageCount: number }>>;
  saveChatSession: (session: ChatSession) => Promise<void>;
  deleteChatSession: (id: string) => Promise<void>;
  listSubagentHistory: (agentId?: string) => Promise<Array<import('./subagent-types').SubagentRunHistoryEntry>>;
  addSubagentHistory: (entry: import('./subagent-types').SubagentRunHistoryEntry) => Promise<void>;
  clearSubagentHistory: () => Promise<void>;
  fetchOverviewMetrics: () => Promise<{ success: boolean; metrics?: OverviewMetrics; error?: string }>;
  fetchQueryActivityMetrics: () => Promise<{ success: boolean; metrics?: QueryActivityMetrics; error?: string }>;
  recheckConnections: () => Promise<void>;
  getSyntaxContext: () => Promise<{ guidelines: string; index: string }>;
}
