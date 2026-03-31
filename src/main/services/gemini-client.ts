import { GoogleGenerativeAI, type GenerativeModel, type Content, type Part, type FunctionDeclaration, type Tool as GeminiTool, SchemaType } from '@google/generative-ai';
import { VertexAI } from '@google-cloud/vertexai';
import { safeStorage } from 'electron';
import store from '../store';
import type { GeminiAuthMethod } from '../store';
import { callMcpTool, discoverMcpTools } from './mcp-schema';

const DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash';

/** Cached MCP tools in Gemini function declaration format */
let cachedGeminiTools: GeminiTool[] | null = null;

// ---------------------------------------------------------------------------
// Auth helpers
// ---------------------------------------------------------------------------

function getAuthMethod(): GeminiAuthMethod {
  return ((store as any).get('llm.geminiAuthMethod') as GeminiAuthMethod) || 'api-key';
}

export function getDecryptedGeminiApiKey(): string {
  const encrypted = (store as any).get('llm.geminiEncryptedApiKey');
  if (!encrypted) throw new Error('Gemini API key not configured');
  return safeStorage.decryptString(Buffer.from(encrypted, 'base64'));
}

/** Get the stored gcloud access token (user-pasted) */
export function getDecryptedGcloudToken(): string {
  const encrypted = (store as any).get('llm.geminiEncryptedGcloudToken');
  if (!encrypted) throw new Error('Google Cloud access token not configured. Paste your token from: gcloud auth print-access-token');
  return safeStorage.decryptString(Buffer.from(encrypted, 'base64'));
}

// ---------------------------------------------------------------------------
// Client factory
// ---------------------------------------------------------------------------

export function getGeminiModel(): { model: GenerativeModel; modelId: string } {
  const authMethod = getAuthMethod();
  const modelId: string = (store as any).get('llm.geminiModel') || DEFAULT_GEMINI_MODEL;

  if (authMethod === 'gcloud') {
    return getGeminiModelViaVertexAI(modelId);
  }

  const apiKey = getDecryptedGeminiApiKey();
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: modelId });
  return { model, modelId };
}

function getGeminiModelViaVertexAI(modelId: string): { model: GenerativeModel; modelId: string } {
  const project: string = (store as any).get('llm.geminiProject') || '';
  const location: string = (store as any).get('llm.geminiLocation') || 'us-central1';

  if (!project) {
    throw new Error('Google Cloud project ID not configured. Set it in Settings.');
  }

  const token = getDecryptedGcloudToken();

  const vertexAI = new VertexAI({
    project,
    location,
    googleAuth: {
      getAccessToken: async () => ({ token }),
      getRequestHeaders: async () => ({ Authorization: `Bearer ${token}` }),
    } as any,
  });

  // VertexAI's getGenerativeModel returns a compatible GenerativeModel
  const model = vertexAI.getGenerativeModel({ model: modelId }) as unknown as GenerativeModel;
  return { model, modelId };
}

// ---------------------------------------------------------------------------
// Tool conversion (Anthropic → Gemini format)
// ---------------------------------------------------------------------------

/** Convert Anthropic-style tool definitions to Gemini function declarations */
export function convertToolsToGemini(
  tools: Array<{ name: string; description: string; input_schema: Record<string, unknown> }>
): GeminiTool[] {
  if (tools.length === 0) return [];

  const functionDeclarations: FunctionDeclaration[] = tools.map((tool) => ({
    name: tool.name,
    description: tool.description,
    parameters: convertSchemaToGemini(tool.input_schema),
  }));

  return [{ functionDeclarations }];
}

/** Convert JSON Schema to Gemini-compatible schema format */
function convertSchemaToGemini(schema: Record<string, unknown>): any {
  if (!schema || typeof schema !== 'object') {
    return { type: SchemaType.OBJECT, properties: {} };
  }

  const result: any = {};

  if (schema.type === 'object') {
    result.type = SchemaType.OBJECT;
    if (schema.properties) {
      result.properties = {};
      for (const [key, value] of Object.entries(schema.properties as Record<string, any>)) {
        result.properties[key] = convertPropertyToGemini(value);
      }
    }
    if (schema.required) {
      result.required = schema.required;
    }
  } else {
    result.type = SchemaType.OBJECT;
    result.properties = {};
  }

  return result;
}

function convertPropertyToGemini(prop: any): any {
  if (!prop) return { type: SchemaType.STRING };

  const result: any = {};

  switch (prop.type) {
    case 'string':
      result.type = SchemaType.STRING;
      break;
    case 'number':
    case 'integer':
      result.type = SchemaType.NUMBER;
      break;
    case 'boolean':
      result.type = SchemaType.BOOLEAN;
      break;
    case 'array':
      result.type = SchemaType.ARRAY;
      if (prop.items) {
        result.items = convertPropertyToGemini(prop.items);
      }
      break;
    case 'object':
      result.type = SchemaType.OBJECT;
      if (prop.properties) {
        result.properties = {};
        for (const [key, value] of Object.entries(prop.properties as Record<string, any>)) {
          result.properties[key] = convertPropertyToGemini(value);
        }
      }
      break;
    default:
      result.type = SchemaType.STRING;
  }

  if (prop.description) result.description = prop.description;
  if (prop.enum) result.enum = prop.enum;

  return result;
}

// ---------------------------------------------------------------------------
// Message conversion
// ---------------------------------------------------------------------------

/** Convert Anthropic-style messages to Gemini Content format */
export function convertMessagesToGemini(
  messages: Array<{ role: string; content: string | Array<Record<string, unknown>> }>
): Content[] {
  const contents: Content[] = [];

  for (const msg of messages) {
    const role = msg.role === 'assistant' ? 'model' : 'user';

    if (typeof msg.content === 'string') {
      contents.push({ role, parts: [{ text: msg.content }] });
    } else if (Array.isArray(msg.content)) {
      const parts: Part[] = [];
      for (const block of msg.content) {
        if (block.type === 'text') {
          parts.push({ text: block.text as string });
        } else if (block.type === 'tool_use') {
          parts.push({
            functionCall: {
              name: block.name as string,
              args: block.input as Record<string, unknown>,
            },
          });
        } else if (block.type === 'tool_result') {
          parts.push({
            functionResponse: {
              name: (block as any).tool_name || 'unknown',
              response: { result: block.content as string },
            },
          });
        }
      }
      if (parts.length > 0) {
        contents.push({ role, parts });
      }
    }
  }

  return contents;
}

// ---------------------------------------------------------------------------
// MCP tool helpers
// ---------------------------------------------------------------------------

/** Fetch MCP tools in Gemini format. Caches after first call. */
export async function getMcpToolsForGemini(): Promise<GeminiTool[]> {
  if (cachedGeminiTools) return cachedGeminiTools;

  try {
    const mcpTools = await discoverMcpTools();
    const anthropicFormat = mcpTools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      input_schema: tool.inputSchema,
    }));
    cachedGeminiTools = convertToolsToGemini(anthropicFormat);
    return cachedGeminiTools;
  } catch {
    return [];
  }
}

/** Execute an MCP tool call (same as bedrock-client — shared) */
export async function executeToolGemini(name: string, input: Record<string, unknown>): Promise<string> {
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

/** Clear the cached Gemini tools — call when MCP config changes */
export function clearGeminiToolsCache(): void {
  cachedGeminiTools = null;
}
