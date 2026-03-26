import AnthropicBedrock from '@anthropic-ai/bedrock-sdk';
import { STSClient, AssumeRoleCommand } from '@aws-sdk/client-sts';
import { getDecryptedAwsCredentials } from '../ipc/claude';
import { callMcpTool, discoverMcpTools } from './mcp-schema';
import store from '../store';

const DEFAULT_MODEL = 'us.anthropic.claude-sonnet-4-20250514-v1:0';

/** Cached MCP tools in Anthropic tool format */
let cachedTools: Array<{ name: string; description: string; input_schema: Record<string, unknown> }> | null = null;

export async function getBedrockClient(): Promise<{ client: AnthropicBedrock; modelId: string }> {
  const { accessKeyId, secretKey } = getDecryptedAwsCredentials();
  const region: string = (store as any).get('claude.region') || 'us-west-2';
  const roleArn: string = (store as any).get('claude.roleArn') || '';
  const modelId: string = (store as any).get('claude.modelId') || DEFAULT_MODEL;

  let finalAccessKey = accessKeyId;
  let finalSecretKey = secretKey;
  let sessionToken: string | undefined;

  if (roleArn) {
    const sts = new STSClient({
      region,
      credentials: {
        accessKeyId,
        secretAccessKey: secretKey,
      },
    });

    const assumed = await sts.send(
      new AssumeRoleCommand({
        RoleArn: roleArn,
        RoleSessionName: 'teradata-dba-agent-chat',
        DurationSeconds: 3600,
      })
    );

    if (!assumed.Credentials) {
      throw new Error('AssumeRole succeeded but returned no credentials');
    }

    finalAccessKey = assumed.Credentials.AccessKeyId!;
    finalSecretKey = assumed.Credentials.SecretAccessKey!;
    sessionToken = assumed.Credentials.SessionToken;
  }

  const client = new AnthropicBedrock({
    awsRegion: region,
    awsAccessKey: finalAccessKey,
    awsSecretKey: finalSecretKey,
    ...(sessionToken ? { awsSessionToken: sessionToken } : {}),
  });

  return { client, modelId };
}

/** Fetch MCP tools and convert to Anthropic tool format. Caches after first call. */
export async function getMcpToolsForClaude(): Promise<
  Array<{ name: string; description: string; input_schema: Record<string, unknown> }>
> {
  if (cachedTools) return cachedTools;

  try {
    const mcpTools = await discoverMcpTools();
    cachedTools = mcpTools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      input_schema: tool.inputSchema,
    }));
    return cachedTools;
  } catch {
    // MCP not available — return empty, chat works without tools
    return [];
  }
}

/** Execute an MCP tool call by forwarding to the MCP server */
export async function executeTool(name: string, input: Record<string, unknown>): Promise<string> {
  try {
    // Convert all input values to strings for callMcpTool
    const stringArgs: Record<string, string> = {};
    for (const [key, value] of Object.entries(input)) {
      if (value !== null && value !== undefined) {
        stringArgs[key] = typeof value === 'string' ? value : JSON.stringify(value);
      }
    }
    return await callMcpTool(name, stringArgs);
  } catch (err) {
    return `Error: ${err instanceof Error ? err.message : String(err)}`;
  }
}

/** Clear the cached MCP tools — call when MCP config changes */
export function clearToolsCache(): void {
  cachedTools = null;
}
