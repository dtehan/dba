import store from '../store';

/**
 * Get the configured MCP server URL.
 * Stored as the 'host' field in teradata config (reusing existing store shape).
 */
export function getMcpUrl(): string {
  return store.get('teradata.host') || 'http://127.0.0.1:8001/mcp';
}

/**
 * Test Teradata MCP server connectivity by sending an HTTP request to the endpoint.
 * The MCP server runs externally — we just verify it's reachable.
 */
export async function testTeradataConnection(): Promise<{ success: boolean; error?: string }> {
  try {
    const mcpUrl = getMcpUrl();
    if (!mcpUrl) {
      return { success: false, error: 'MCP server URL not configured' };
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10_000);

    try {
      // Send a simple POST to the MCP endpoint — streamable HTTP MCP servers
      // accept JSON-RPC over POST. We send a simple initialize request.
      const response = await fetch(mcpUrl, {
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

      if (response.ok) {
        return { success: true };
      } else {
        return { success: false, error: `MCP server returned ${response.status}: ${response.statusText}` };
      }
    } catch (err) {
      clearTimeout(timeoutId);
      if (err instanceof Error && err.name === 'AbortError') {
        return { success: false, error: 'Connection timed out after 10 seconds' };
      }
      throw err;
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: message };
  }
}
