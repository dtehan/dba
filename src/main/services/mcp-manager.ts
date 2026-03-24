import { spawn, ChildProcess } from 'child_process';
import { getDecryptedTeradataCredentials } from '../ipc/credentials';

let mcpProcess: ChildProcess | null = null;

export function spawnMcpServer(): void {
  if (mcpProcess) return; // already running

  const { host, username, password } = getDecryptedTeradataCredentials();

  // Percent-encode password to handle special chars (@, /, #, %)
  const encodedPassword = encodeURIComponent(password);
  const encodedUsername = encodeURIComponent(username);
  const DATABASE_URI = `teradata://${encodedUsername}:${encodedPassword}@${host}:1025/${encodedUsername}`;

  mcpProcess = spawn('uvx', ['teradata-mcp-server'], {
    env: {
      ...process.env,
      DATABASE_URI,
      // No MCP_TRANSPORT set -- defaults to stdio
    },
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  mcpProcess.on('error', (err) => {
    console.error('[MCP] process error:', err);
    mcpProcess = null;
  });

  mcpProcess.on('exit', (code) => {
    console.log(`[MCP] process exited with code ${code}`);
    mcpProcess = null;
  });

  // Log stderr for debugging
  mcpProcess.stderr?.on('data', (data: Buffer) => {
    console.error('[MCP stderr]', data.toString());
  });
}

export function killMcpServer(): void {
  if (mcpProcess) {
    mcpProcess.kill('SIGTERM');
    mcpProcess = null;
  }
}

export function isMcpRunning(): boolean {
  return mcpProcess !== null && !mcpProcess.killed;
}

/**
 * Test Teradata connectivity by spawning the MCP server and checking it stays alive.
 * If the process exits immediately with a non-zero code, the connection failed.
 * If it stays running for 5 seconds, the connection is presumed good.
 *
 * Note: Full MCP JSON-RPC query protocol (SELECT 1) will be implemented in Phase 2
 * when we need actual query results from the running server.
 */
export async function testTeradataConnection(): Promise<{ success: boolean; error?: string }> {
  try {
    const { host, username, password } = getDecryptedTeradataCredentials();
    if (!host || !username || !password) {
      return { success: false, error: 'Credentials not configured' };
    }

    // If MCP server is already running, connection is confirmed good
    if (isMcpRunning()) {
      return { success: true };
    }

    // Spawn a fresh attempt and check if it stays alive
    spawnMcpServer();

    return new Promise((resolve) => {
      const currentProcess = mcpProcess;

      const timeout = setTimeout(() => {
        if (isMcpRunning()) {
          resolve({ success: true });
        } else {
          resolve({ success: false, error: 'MCP server failed to start within timeout' });
        }
      }, 5000); // 5s startup check

      currentProcess?.on('exit', (code) => {
        clearTimeout(timeout);
        if (code !== 0 && code !== null) {
          resolve({ success: false, error: `MCP server exited with code ${code}` });
        }
      });

      currentProcess?.on('error', (err) => {
        clearTimeout(timeout);
        resolve({ success: false, error: err.message });
      });
    });
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}
