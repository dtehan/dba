import { ipcMain } from 'electron';
import { IpcChannels } from '../../shared/types';
import { getSubagentRegistry, runSubagent } from '../subagents/registry';

export function registerSubagentHandlers(): void {
  ipcMain.handle(IpcChannels.SUBAGENT_LIST, async () => {
    return getSubagentRegistry();
  });

  ipcMain.handle(IpcChannels.SUBAGENT_RUN, async (_event, agentId: unknown, params: unknown) => {
    if (typeof agentId !== 'string' || agentId.trim().length === 0) {
      return { success: false, error: 'agentId must be a non-empty string' };
    }

    const safeParams: Record<string, string> =
      typeof params === 'object' && params !== null
        ? Object.fromEntries(
            Object.entries(params as Record<string, unknown>)
              .filter(([, v]) => typeof v === 'string')
              .map(([k, v]) => [k, v as string])
          )
        : {};

    const context = {
      activeDatabaseName: safeParams['databaseName'] ?? null,
      schemaContext: null,
      params: safeParams,
    };

    try {
      const result = await runSubagent(agentId.trim(), context);
      return { success: true, content: result.content };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: message };
    }
  });
}
