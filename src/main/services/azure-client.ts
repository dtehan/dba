import { AzureOpenAI } from 'openai';
import { safeStorage } from 'electron';
import store from '../store';
import { callMcpTool, discoverMcpTools } from './mcp-schema';

const DEFAULT_AZURE_ENDPOINT = 'https://danie-m3uu72y9-francecentral.openai.azure.com/';
const DEFAULT_AZURE_API_VERSION = '2024-12-01-preview';
const DEFAULT_AZURE_DEPLOYMENT = 'gpt-5.4';

/** Cached MCP tools in OpenAI chat-completions tool format. */
let cachedAzureTools:
  | Array<{
      type: 'function';
      function: { name: string; description: string; parameters: Record<string, unknown> };
    }>
  | null = null;

// ---------------------------------------------------------------------------
// Auth helpers
// ---------------------------------------------------------------------------

export function getDecryptedAzureApiKey(): string {
  const encrypted = (store as any).get('llm.azureEncryptedApiKey');
  if (!encrypted) throw new Error('Azure OpenAI API key not configured');
  return safeStorage.decryptString(Buffer.from(encrypted, 'base64'));
}

// ---------------------------------------------------------------------------
// Client factory
// ---------------------------------------------------------------------------

export function getAzureClient(): { client: AzureOpenAI; deployment: string } {
  const apiKey = getDecryptedAzureApiKey();
  const endpoint: string = (store as any).get('llm.azureEndpoint') || DEFAULT_AZURE_ENDPOINT;
  const apiVersion: string = (store as any).get('llm.azureApiVersion') || DEFAULT_AZURE_API_VERSION;
  const deployment: string = (store as any).get('llm.azureDeployment') || DEFAULT_AZURE_DEPLOYMENT;

  const client = new AzureOpenAI({
    apiKey,
    endpoint,
    apiVersion,
    deployment,
  });

  return { client, deployment };
}

// ---------------------------------------------------------------------------
// Tool conversion (Anthropic → OpenAI chat-completions format)
// ---------------------------------------------------------------------------

/** Convert Anthropic-style tool definitions to OpenAI chat-completions tool format. */
export function convertToolsToOpenAI(
  tools: Array<{ name: string; description: string; input_schema: Record<string, unknown> }>
): Array<{
  type: 'function';
  function: { name: string; description: string; parameters: Record<string, unknown> };
}> {
  return tools.map((t) => ({
    type: 'function' as const,
    function: {
      name: t.name,
      description: t.description,
      parameters: t.input_schema,
    },
  }));
}

// ---------------------------------------------------------------------------
// Message conversion (Anthropic-style → OpenAI chat-completions format)
// ---------------------------------------------------------------------------

/**
 * Convert Anthropic-style messages (with optional content-block arrays) to
 * OpenAI chat-completions message format.
 *
 * - text block → { role, content: <text> }
 * - tool_use block (assistant) → assistant message with `tool_calls`
 * - tool_result block (user)   → { role: 'tool', tool_call_id, content }
 * - plain string content       → { role, content }
 */
export function convertMessagesToOpenAI(
  messages: Array<{ role: string; content: string | Array<Record<string, unknown>> }>
): Array<Record<string, unknown>> {
  const out: Array<Record<string, unknown>> = [];

  for (const msg of messages) {
    if (typeof msg.content === 'string') {
      out.push({ role: msg.role, content: msg.content });
      continue;
    }

    if (!Array.isArray(msg.content)) continue;

    // Aggregate blocks by kind
    const textChunks: string[] = [];
    const assistantToolCalls: Array<{
      id: string;
      type: 'function';
      function: { name: string; arguments: string };
    }> = [];
    const toolResultMessages: Array<Record<string, unknown>> = [];

    for (const block of msg.content) {
      const type = block.type as string | undefined;
      if (type === 'text') {
        textChunks.push((block.text as string) ?? '');
      } else if (type === 'tool_use') {
        assistantToolCalls.push({
          id: (block.id as string) ?? '',
          type: 'function',
          function: {
            name: (block.name as string) ?? '',
            arguments: JSON.stringify((block.input as Record<string, unknown>) ?? {}),
          },
        });
      } else if (type === 'tool_result') {
        toolResultMessages.push({
          role: 'tool',
          tool_call_id: (block as any).tool_use_id ?? (block as any).tool_call_id ?? '',
          content:
            typeof block.content === 'string'
              ? block.content
              : JSON.stringify(block.content ?? ''),
        });
      }
    }

    if (msg.role === 'assistant') {
      const text = textChunks.join('');
      if (assistantToolCalls.length > 0) {
        out.push({
          role: 'assistant',
          // OpenAI rejects empty content with tool_calls — must be a non-empty string or null.
          content: text.length > 0 ? text : null,
          tool_calls: assistantToolCalls,
        });
      } else if (text.length > 0) {
        out.push({ role: 'assistant', content: text });
      }
    } else {
      // user-side: tool_result blocks become standalone `role: 'tool'` messages.
      // Any plain text in a user message is preserved as a regular user message.
      const text = textChunks.join('');
      if (text.length > 0) {
        out.push({ role: 'user', content: text });
      }
      for (const trm of toolResultMessages) {
        out.push(trm);
      }
    }
  }

  return out;
}

// ---------------------------------------------------------------------------
// MCP tool helpers
// ---------------------------------------------------------------------------

/** Fetch MCP tools in OpenAI chat-completions format. Caches after first call. */
export async function getMcpToolsForAzure(): Promise<
  Array<{
    type: 'function';
    function: { name: string; description: string; parameters: Record<string, unknown> };
  }>
> {
  if (cachedAzureTools) return cachedAzureTools;

  try {
    const mcpTools = await discoverMcpTools();
    const anthropicFormat = mcpTools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      input_schema: tool.inputSchema,
    }));
    cachedAzureTools = convertToolsToOpenAI(anthropicFormat);
    return cachedAzureTools;
  } catch {
    return [];
  }
}

/** Execute an MCP tool call (mirrors executeToolGemini). */
export async function executeToolAzure(
  name: string,
  input: Record<string, unknown>
): Promise<string> {
  try {
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

/** Clear the cached Azure tools — call when MCP config changes. */
export function clearAzureToolsCache(): void {
  cachedAzureTools = null;
}
