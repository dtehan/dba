import type { SubagentDefinition, SubagentContext, SubagentRunResult } from '../../shared/subagent-types';
import { echoSubagentDef, runEchoSubagent } from './echo';

interface SubagentEntry {
  definition: SubagentDefinition;
  run: (ctx: SubagentContext) => Promise<SubagentRunResult>;
}

const registry: SubagentEntry[] = [
  { definition: echoSubagentDef, run: runEchoSubagent },
];

export function getSubagentRegistry(): SubagentDefinition[] {
  return registry.map((e) => e.definition);
}

export function runSubagent(agentId: string, ctx: SubagentContext): Promise<SubagentRunResult> {
  const entry = registry.find((e) => e.definition.id === agentId);
  if (!entry) throw new Error(`Subagent not found: ${agentId}`);
  return entry.run(ctx);
}
