import type { SubagentDefinition, SubagentContext, SubagentRunResult } from '../../shared/subagent-types';
import { echoSubagentDef, runEchoSubagent } from './echo';
import { securityAuditDef, runSecurityAudit, getSecurityAuditConfig } from './security-audit';
import { mvcAnalysisDef, runMvcAnalysis, getMvcAnalysisConfig } from './mvc-analysis';
import { statsAnalysisDef, runStatsAnalysis, getStatsAnalysisConfig } from './stats-analysis';

export interface SubagentChatConfig {
  systemPrompt: string;
  toolFilter: string[];
  maxToolRounds: number;
  maxTokens: number;
  initialMessage: string;
}

type ConfigFn = (ctx: SubagentContext) => SubagentChatConfig;

interface SubagentEntry {
  definition: SubagentDefinition;
  run: (ctx: SubagentContext) => Promise<SubagentRunResult>;
  getConfig?: ConfigFn;
}

const registry: SubagentEntry[] = [
  { definition: echoSubagentDef, run: runEchoSubagent },
  { definition: securityAuditDef, run: runSecurityAudit, getConfig: getSecurityAuditConfig },
  { definition: mvcAnalysisDef, run: runMvcAnalysis, getConfig: getMvcAnalysisConfig },
  { definition: statsAnalysisDef, run: runStatsAnalysis, getConfig: getStatsAnalysisConfig },
];

export function getSubagentRegistry(): SubagentDefinition[] {
  return registry.map((e) => e.definition);
}

export function runSubagent(agentId: string, ctx: SubagentContext): Promise<SubagentRunResult> {
  const entry = registry.find((e) => e.definition.id === agentId);
  if (!entry) throw new Error(`Subagent not found: ${agentId}`);
  return entry.run(ctx);
}

export function getSubagentConfig(agentId: string, ctx: SubagentContext): SubagentChatConfig | null {
  const entry = registry.find((e) => e.definition.id === agentId);
  if (!entry?.getConfig) return null;
  return entry.getConfig(ctx);
}
