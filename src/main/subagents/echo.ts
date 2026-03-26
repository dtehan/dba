import type { SubagentContext, SubagentRunResult } from '../../shared/subagent-types';

export const echoSubagentDef = {
  id: 'echo',
  name: 'Echo Test',
  description: 'Returns the current schema context status — for testing the subagent framework.',
  icon: 'Terminal',
};

export async function runEchoSubagent(ctx: SubagentContext): Promise<SubagentRunResult> {
  const lines: string[] = [
    '## Echo Subagent Result',
    '',
    `**Schema Context Available:** ${ctx.schemaContext ? 'Yes' : 'No'}`,
    `**Active Database:** ${ctx.activeDatabaseName ?? 'None'}`,
    `**Parameters:** ${Object.keys(ctx.params).length > 0 ? JSON.stringify(ctx.params) : 'None'}`,
    '',
  ];

  if (ctx.schemaContext) {
    lines.push('### Schema Preview (first 500 chars)');
    lines.push('```');
    lines.push(ctx.schemaContext.slice(0, 500));
    lines.push('```');
  }

  lines.push(
    '',
    '*This is a test subagent. Real subagents (Security, MVC, Statistics) will be available in Phase 3.*'
  );

  return { content: lines.join('\n') };
}
