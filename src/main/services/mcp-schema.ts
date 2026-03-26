import { getMcpUrl } from './mcp-manager';

/** Ensure MCP URL has trailing slash (some servers redirect without it) */
function mcpUrl(): string {
  const url = getMcpUrl();
  return url.endsWith('/') ? url : url + '/';
}

/**
 * Tracks MCP session ID if the server provides one.
 * Stateless servers will not set this — we proceed without it.
 */
let mcpSessionId: string | null = null;

/**
 * Initialize an MCP session by sending the JSON-RPC initialize request.
 * Stores the Mcp-Session-Id header value if the server provides one.
 * On failure, sets mcpSessionId to null — stateless servers are fine.
 */
async function initializeMcpSession(): Promise<void> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15_000);

    const response = await fetch(mcpUrl(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/event-stream',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {},
          clientInfo: { name: 'teradata-dba-agent', version: '1.0.0' },
        },
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    const sessionId = response.headers.get('Mcp-Session-Id');
    if (sessionId) {
      mcpSessionId = sessionId;
    } else {
      mcpSessionId = null;
    }
  } catch {
    // Server may be stateless — proceed without session ID
    mcpSessionId = null;
  }
}

/**
 * Call an MCP tool via JSON-RPC tools/call method.
 * Handles session initialization, session ID headers, and retries on 404.
 */
export async function callMcpTool(toolName: string, args: Record<string, string> = {}): Promise<string> {
  if (mcpSessionId === null) {
    await initializeMcpSession();
  }

  const doCall = async (): Promise<Response> => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15_000);

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json, text/event-stream',
    };

    if (mcpSessionId) {
      headers['Mcp-Session-Id'] = mcpSessionId;
    }

    try {
      const response = await fetch(mcpUrl(), {
        method: 'POST',
        headers,
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: Date.now(),
          method: 'tools/call',
          params: { name: toolName, arguments: args },
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      return response;
    } catch (err) {
      clearTimeout(timeoutId);
      throw err;
    }
  };

  let response = await doCall();

  // Session expired — re-initialize and retry once
  if (response.status === 404) {
    mcpSessionId = null;
    await initializeMcpSession();
    response = await doCall();
  }

  if (!response.ok) {
    throw new Error(`MCP server returned ${response.status}: ${response.statusText}`);
  }

  // Server returns SSE text/event-stream — parse data: line
  const text = await response.text();
  const dataLine = text.split('\n').find((line) => line.startsWith('data:'));
  if (!dataLine) throw new Error('No data in MCP response');

  const json = JSON.parse(dataLine.slice(5).trim()) as {
    result?: { content: Array<{ type: string; text: string }> };
    error?: { message: string };
  };

  if (json.error) {
    throw new Error(json.error.message);
  }

  return json.result?.content.map((c) => c.text).join('\n') ?? '';
}

/**
 * List all databases available on the Teradata MCP server.
 * The MCP tool returns JSON with a `results` array of {DatabaseName, DBType, CommentString}.
 */
export async function listDatabases(): Promise<string[]> {
  const raw = await callMcpTool('base_databaseList', { scope: 'user' });
  try {
    const parsed = JSON.parse(raw);
    if (parsed.results && Array.isArray(parsed.results)) {
      return parsed.results
        .map((r: { DatabaseName?: string }) => r.DatabaseName)
        .filter((name: unknown): name is string => typeof name === 'string' && name.length > 0)
        .sort((a: string, b: string) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
    }
  } catch {
    // Fall through to line-based parsing
  }
  // Fallback: if not JSON, try line-based
  return raw
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

/**
 * Fetch schema context for a given database — tables and columns formatted
 * as structured Markdown text suitable for injection into a Claude system prompt.
 * Output is capped at approximately 4000 characters to stay within token budget.
 */
export async function fetchSchemaContext(databaseName: string): Promise<string> {
  // Get table list
  const tableRaw = await callMcpTool('base_tableList', { databaseName });
  const tableNames = tableRaw
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  // Cap at 20 tables to stay within token budget
  const MAX_TABLES = 20;
  const tablesToFetch = tableNames.slice(0, MAX_TABLES);
  const remainingCount = tableNames.length - tablesToFetch.length;

  // Fetch column descriptions in parallel — don't fail all if one table errors
  const columnResults = await Promise.allSettled(
    tablesToFetch.map((tableName) =>
      callMcpTool('base_columnDescription', { databaseName, tableName }).then((raw) => ({
        tableName,
        raw,
      }))
    )
  );

  // Build formatted context block
  const MAX_CHARS = 4000;
  const lines: string[] = [
    `Database: ${databaseName}`,
    `Tables: ${tableNames.length}`,
    '',
  ];

  for (const result of columnResults) {
    if (result.status === 'rejected') continue;

    const { tableName, raw } = result.value;

    const tableBlock: string[] = [
      `### ${tableName}`,
      '| Column | Type |',
      '|--------|------|',
    ];

    // Parse column description lines — expected format: "columnName  TYPE" or similar
    const columnLines = raw
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    for (const colLine of columnLines) {
      // Split on two or more spaces or a tab to separate name and type
      const parts = colLine.split(/\s{2,}|\t/);
      if (parts.length >= 2) {
        tableBlock.push(`| ${parts[0]} | ${parts.slice(1).join(' ')} |`);
      } else {
        // Single token — treat as column name with unknown type
        tableBlock.push(`| ${colLine} | — |`);
      }
    }

    tableBlock.push('');

    const newLines = [...lines, ...tableBlock];
    const projected = newLines.join('\n').length;

    if (projected > MAX_CHARS) {
      // Truncate here — note remaining tables
      const fetchedSoFar = columnResults.indexOf(result);
      const notShown = tablesToFetch.length - fetchedSoFar;
      const extraFromLimit = remainingCount;
      const total = notShown + extraFromLimit;
      if (total > 0) {
        lines.push(`... and ${total} more tables (select a specific table for details)`);
      }
      break;
    }

    lines.push(...tableBlock);
  }

  // If there are remaining tables beyond the 20 fetched, note them
  if (remainingCount > 0) {
    const alreadyNoted = lines.some((l) => l.startsWith('... and'));
    if (!alreadyNoted) {
      lines.push(`... and ${remainingCount} more tables (select a specific table for details)`);
    }
  }

  return lines.join('\n');
}

/**
 * Discover all tools exposed by the MCP server via tools/list.
 * Returns the raw tool definitions from the server.
 */
export async function discoverMcpTools(): Promise<
  Array<{ name: string; description: string; inputSchema: Record<string, unknown> }>
> {
  if (mcpSessionId === null) {
    await initializeMcpSession();
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Accept': 'application/json, text/event-stream',
  };
  if (mcpSessionId) {
    headers['Mcp-Session-Id'] = mcpSessionId;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15_000);

  const response = await fetch(mcpUrl(), {
    method: 'POST',
    headers,
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: Date.now(),
      method: 'tools/list',
      params: {},
    }),
    signal: controller.signal,
  });

  clearTimeout(timeoutId);

  if (!response.ok) {
    throw new Error(`MCP tools/list returned ${response.status}`);
  }

  const text = await response.text();
  // SSE response: extract JSON from "data:" line
  const dataLine = text.split('\n').find((line) => line.startsWith('data:'));
  if (!dataLine) throw new Error('No data in MCP tools/list response');

  const json = JSON.parse(dataLine.slice(5).trim()) as {
    result?: { tools: Array<{ name: string; description: string; inputSchema: Record<string, unknown> }> };
    error?: { message: string };
  };

  if (json.error) throw new Error(json.error.message);

  return json.result?.tools ?? [];
}
