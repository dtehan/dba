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
