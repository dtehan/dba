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
} as const;

// Preload API surface exposed to renderer
export interface ElectronAPI {
  saveTeradataCredentials: (creds: TeradataCredentials) => Promise<void>;
  loadTeradataHost: () => Promise<string | null>;
  saveClaudeApiKey: (key: string) => Promise<void>;
  clearAllCredentials: () => Promise<void>;
  hasTeradataCredentials: () => Promise<boolean>;
  hasClaudeKey: () => Promise<boolean>;
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
}
