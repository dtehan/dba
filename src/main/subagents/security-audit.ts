import type { SubagentDefinition, SubagentContext, SubagentRunResult } from '../../shared/subagent-types';
import { getBedrockClient, getMcpToolsForClaude, executeTool } from '../services/bedrock-client';

const MAX_TOOL_ROUNDS = 20;

const SECURITY_TOOLS = ['sec_userRoles', 'sec_userDbPermissions', 'sec_rolePermissions', 'base_readQuery'];

export const securityAuditDef: SubagentDefinition = {
  id: 'security-audit',
  name: 'Security Audit',
  description: 'Analyzes access rights, roles, and permissions for security anomalies.',
  icon: 'Shield',
  params: [
    {
      key: 'scope',
      label: 'Audit Scope',
      placeholder: 'Username, database name, or "system-wide"',
      required: true,
    },
  ],
};

function buildSecuritySystemPrompt(scope: string): string {
  return `You are a Teradata Security Auditor. Analyze the security posture of the Teradata environment.

## Audit Scope
${scope} — Determine the scope type:
- If scope contains "@" → treat as a username
- If scope is "system-wide" or "all" → full system audit
- Otherwise → treat as a database name

## Available MCP Tools
- sec_userRoles — List roles assigned to a user
- sec_userDbPermissions — Access rights granted to a user on databases/objects
- sec_rolePermissions — Permissions attached to a role
- base_readQuery — Run arbitrary SQL against Teradata (for DBC views)

## CRITICAL: Query Size Limits
**Every SQL query MUST use TOP 50 or fewer.** Large unbounded queries will fail or overwhelm the system. Always aggregate or limit results.

## Analysis Checklist

### 1. Access Rights & Role Membership (SECU-02)
- For username scope: use sec_userRoles and sec_userDbPermissions tools directly
- For database scope: query users with access to that specific database
- For system-wide: query a summary of non-system users with elevated access

### 2. Overly Permissive Grants (SECU-03)
\`\`\`sql
SELECT TOP 30 UserName, DatabaseName, AccessRight, GrantAuthority
FROM DBC.AllRightsV
WHERE GrantAuthority = 'Y'
  AND UserName NOT IN ('DBC', 'SYSLIB', 'SYSTEMFE', 'TDWM', 'SystemFe', 'Crashdumps', 'dbcmngr', 'SYSUDTLIB', 'SYSBAR', 'SYSJDBC', 'SYSXML')
ORDER BY UserName
\`\`\`

### 3. Logon Anomalies (SECU-04)
If this fails (DBQL not enabled), note it and continue:
\`\`\`sql
SELECT TOP 20 UserName, LogType,
       COUNT(*) AS EventCount,
       MAX(LogDate) AS LastEvent
FROM DBC.LogOnOffV
WHERE LogDate >= DATE - 30
GROUP BY UserName, LogType
HAVING COUNT(*) > 10
ORDER BY EventCount DESC
\`\`\`

### 4. Output Format (SECU-05)
Produce a concise markdown report:

# Security Audit Report
**Scope:** ${scope}

## Executive Summary
Brief overview of findings count by severity.

## Findings
Group by HIGH / MEDIUM / LOW severity. For each finding:
- Title and risk description
- Affected objects/users
- Remediation SQL (copy-paste only)

Cap to **top 10 findings per severity level**.

## Recommendations
Top 5 priority actions.

## Rules
- ALL SQL is for copy-paste only — never auto-execute.
- Every query MUST use TOP to limit results.
- If a query fails, note the error and continue.
- Exclude system users (DBC, SYSLIB, SYSTEMFE, etc.) from findings.
- Keep the report concise — focus on actionable findings.`;
}

export function getSecurityAuditConfig(ctx: SubagentContext) {
  const scope = ctx.params['scope'] || 'system-wide';
  return {
    systemPrompt: buildSecuritySystemPrompt(scope),
    toolFilter: SECURITY_TOOLS,
    maxToolRounds: MAX_TOOL_ROUNDS,
    maxTokens: 8192,
    initialMessage: `Please perform a security audit for scope: ${scope}. Follow the analysis checklist in your instructions and produce a prioritized findings report.`,
  };
}

export async function runSecurityAudit(ctx: SubagentContext): Promise<SubagentRunResult> {
  const scope = ctx.params['scope'] || 'system-wide';

  const { client, modelId } = await getBedrockClient();
  const allTools = await getMcpToolsForClaude();

  // Filter to only security-relevant tools
  const tools = allTools.filter((t) => SECURITY_TOOLS.includes(t.name));

  const systemPrompt = buildSecuritySystemPrompt(scope);

  const conversationMessages: Array<{
    role: 'user' | 'assistant';
    content: string | Array<Record<string, unknown>>;
  }> = [
    {
      role: 'user',
      content: `Please perform a security audit for scope: ${scope}. Follow the analysis checklist in your instructions and produce a prioritized findings report.`,
    },
  ];

  let outputText = '';
  let round = 0;

  while (round < MAX_TOOL_ROUNDS) {
    round++;

    const requestParams: Record<string, unknown> = {
      model: modelId,
      max_tokens: 8192,
      system: systemPrompt,
      messages: conversationMessages,
    };
    if (tools.length > 0) {
      requestParams.tools = tools;
    }

    const response = await (client.messages.create as (params: Record<string, unknown>) => Promise<any>)(requestParams);

    // Collect text from this response
    for (const block of response.content) {
      if (block.type === 'text') {
        outputText += block.text;
      }
    }

    // Check if Claude wants to use tools
    if (response.stop_reason === 'tool_use') {
      const toolUseBlocks = response.content.filter((block: any) => block.type === 'tool_use');
      if (toolUseBlocks.length === 0) break;

      // Add assistant message with tool_use to conversation
      conversationMessages.push({
        role: 'assistant',
        content: response.content,
      });

      // Execute each tool and build tool_result blocks
      const toolResults: Array<Record<string, unknown>> = [];
      for (const toolBlock of toolUseBlocks) {
        const result = await executeTool(toolBlock.name, toolBlock.input as Record<string, unknown>);
        toolResults.push({
          type: 'tool_result',
          tool_use_id: toolBlock.id,
          content: result,
        });
      }

      // Add tool results as user message and loop back
      conversationMessages.push({
        role: 'user',
        content: toolResults,
      });
      continue;
    }

    // No tool use — done
    break;
  }

  return { content: outputText };
}
