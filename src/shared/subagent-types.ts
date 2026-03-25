export interface SubagentDefinition {
  id: string;
  name: string;
  description: string;
  icon: string; // lucide-react icon name
}

export interface SubagentContext {
  activeDatabaseName: string | null;
  schemaContext: string | null;
}

export interface SubagentRunResult {
  content: string;
  metadata?: Record<string, unknown>;
}
