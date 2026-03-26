import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { app } from 'electron';
import type { SubagentDefinition } from '../../shared/subagent-types';

export interface SubagentChatConfig {
  systemPrompt: string;
  toolFilter: string[];
  maxToolRounds: number;
  maxTokens: number;
  initialMessage: string;
}

interface ParsedAgent {
  definition: SubagentDefinition;
  body: string; // raw markdown body (system prompt template)
  toolFilter: string[];
  maxToolRounds: number;
  maxTokens: number;
}

let cachedAgents: ParsedAgent[] | null = null;

/** Get the subagents directory — works in both dev and packaged modes */
function getSubagentsDir(): string {
  // In dev: project root / subagents/
  // In packaged: app resources / subagents/
  const isDev = !app.isPackaged;
  if (isDev) {
    return join(app.getAppPath(), 'subagents');
  }
  return join(process.resourcesPath, 'subagents');
}

/** Parse YAML-like frontmatter from a markdown file */
function parseFrontmatter(content: string): { frontmatter: Record<string, unknown>; body: string } {
  const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) return { frontmatter: {}, body: content };

  const raw = match[1];
  const body = match[2].trim();
  const fm: Record<string, unknown> = {};

  // Simple YAML parser for our known fields
  let currentKey = '';
  let currentArray: unknown[] | null = null;

  for (const line of raw.split('\n')) {
    // Array item under a key
    if (line.match(/^\s+-\s/) && currentArray !== null) {
      const value = line.replace(/^\s+-\s/, '').trim();
      // Check if it's a YAML object (has key: value pairs)
      if (value.startsWith('key:') || value.startsWith('{')) {
        // This is a param object - parse inline
        const obj: Record<string, unknown> = {};
        // Could be multi-line, but our params use "- key: xxx" on separate lines
        const kvMatch = value.match(/^(\w+):\s*(.*)$/);
        if (kvMatch) {
          // Start a new object in the array
          obj[kvMatch[1]] = parseValue(kvMatch[2]);
          currentArray.push(obj);
        }
      } else {
        currentArray.push(parseValue(value));
      }
      continue;
    }

    // Object property under array item
    if (line.match(/^\s{4}\w/) && currentArray !== null && currentArray.length > 0) {
      const kvMatch = line.trim().match(/^(\w+):\s*(.*)$/);
      if (kvMatch) {
        const lastObj = currentArray[currentArray.length - 1];
        if (typeof lastObj === 'object' && lastObj !== null) {
          (lastObj as Record<string, unknown>)[kvMatch[1]] = parseValue(kvMatch[2]);
        }
      }
      continue;
    }

    // Top-level key
    const topMatch = line.match(/^(\w[\w_]*)\s*:\s*(.*)$/);
    if (topMatch) {
      // Save previous array
      if (currentArray !== null) {
        fm[currentKey] = currentArray;
      }
      currentKey = topMatch[1];
      const value = topMatch[2].trim();
      if (value === '' || value === '|') {
        // Start of array or block
        currentArray = [];
      } else {
        currentArray = null;
        fm[currentKey] = parseValue(value);
      }
    }
  }

  // Save last array
  if (currentArray !== null) {
    fm[currentKey] = currentArray;
  }

  return { frontmatter: fm, body };
}

function parseValue(v: string): unknown {
  if (v === 'true') return true;
  if (v === 'false') return false;
  const num = Number(v);
  if (!isNaN(num) && v.length > 0) return num;
  return v;
}

/** Scan the subagents directory and parse all .md files */
function loadAgents(): ParsedAgent[] {
  const dir = getSubagentsDir();
  let files: string[];
  try {
    files = readdirSync(dir).filter((f) => f.endsWith('.md')).sort();
  } catch {
    return [];
  }

  const agents: ParsedAgent[] = [];

  for (const file of files) {
    try {
      const content = readFileSync(join(dir, file), 'utf-8');
      const { frontmatter: fm, body } = parseFrontmatter(content);

      const id = file.replace(/\.md$/, '');
      const name = (fm.name as string) || id;
      const description = (fm.description as string) || '';
      const icon = (fm.icon as string) || 'Terminal';
      const category = (fm.category as string) || 'General';
      const toolsRaw = (fm.tools as string) || '';
      const toolFilter = toolsRaw.split(',').map((t) => t.trim()).filter(Boolean);
      const maxToolRounds = (fm.max_tool_rounds as number) || 20;
      const maxTokens = (fm.max_tokens as number) || 8192;

      // Parse params
      const rawParams = fm.params as Array<Record<string, unknown>> | undefined;
      const params = rawParams?.map((p) => ({
        key: String(p.key || ''),
        label: String(p.label || p.key || ''),
        placeholder: String(p.placeholder || ''),
        required: p.required === true,
      })).filter((p) => p.key.length > 0);

      agents.push({
        definition: {
          id,
          name,
          description,
          icon,
          category,
          params: params?.length ? params : undefined,
        },
        body,
        toolFilter,
        maxToolRounds,
        maxTokens,
      });
    } catch (err) {
      console.warn(`[subagent-registry] Failed to parse ${file}:`, err);
    }
  }

  return agents;
}

/** Get or reload the agent registry */
function getAgents(): ParsedAgent[] {
  if (!cachedAgents) {
    cachedAgents = loadAgents();
  }
  return cachedAgents;
}

/** Force reload from disk (e.g., after user adds a new .md file) */
export function refreshRegistry(): void {
  cachedAgents = null;
}

export function getSubagentRegistry(): SubagentDefinition[] {
  return getAgents().map((a) => a.definition);
}

/** Replace {{param}} template variables in the prompt body */
function renderTemplate(template: string, params: Record<string, string>): string {
  let result = template;

  // Replace {{#key}}...{{/key}} conditional blocks (shown when key has a value)
  result = result.replace(/\{\{#(\w+)\}\}([\s\S]*?)\{\{\/\1\}\}/g, (_match, key, content) => {
    return params[key]?.trim() ? content.replace(/\{\{(\w+)\}\}/g, (_m: string, k: string) => params[k] || '') : '';
  });

  // Replace {{^key}}...{{/key}} inverse blocks (shown when key is empty)
  result = result.replace(/\{\{\^(\w+)\}\}([\s\S]*?)\{\{\/\1\}\}/g, (_match, key, content) => {
    return !params[key]?.trim() ? content : '';
  });

  // Replace remaining {{key}} variables
  result = result.replace(/\{\{(\w+)\}\}/g, (_match, key) => params[key] || '');

  return result;
}

export function getSubagentConfig(
  agentId: string,
  ctx: { params: Record<string, string> }
): SubagentChatConfig | null {
  const agent = getAgents().find((a) => a.definition.id === agentId);
  if (!agent) return null;

  const systemPrompt = renderTemplate(agent.body, ctx.params);

  // Build a descriptive initial message from the agent name and params
  const paramDesc = Object.entries(ctx.params)
    .filter(([, v]) => v?.trim())
    .map(([k, v]) => `${k}: ${v}`)
    .join(', ');

  return {
    systemPrompt,
    toolFilter: agent.toolFilter,
    maxToolRounds: agent.maxToolRounds,
    maxTokens: agent.maxTokens,
    initialMessage: `Run the analysis as described in your instructions.${paramDesc ? ` Parameters: ${paramDesc}` : ''}`,
  };
}
