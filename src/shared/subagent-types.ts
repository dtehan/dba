export interface SubagentParam {
  key: string;
  label: string;
  placeholder: string;
  required: boolean;
}

export interface SubagentDefinition {
  id: string;
  name: string;
  description: string;
  icon: string; // lucide-react icon name
  category: string; // DBA domain grouping (Security, Performance, Storage, General)
  params?: SubagentParam[]; // input parameters the launcher renders
}

export interface SubagentContext {
  activeDatabaseName: string | null;
  schemaContext: string | null;
  params: Record<string, string>; // key/value from launcher form
}

export interface SubagentRunResult {
  content: string;
  metadata?: Record<string, unknown>;
}

export interface SubagentRunHistoryEntry {
  agentId: string;
  timestamp: number;
  params: Record<string, string>;
  sessionId: string;
  durationMs: number;
  status: 'completed' | 'failed';
}
