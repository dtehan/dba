import { ipcMain } from 'electron';
import { IpcChannels } from '../../shared/types';
import { getSubagentRegistry, runSubagent } from '../subagents/registry';

export function registerSubagentHandlers(): void {
  ipcMain.handle(IpcChannels.SUBAGENT_LIST, async () => {
    return getSubagentRegistry();
  });

  ipcMain.handle(IpcChannels.SUBAGENT_RUN, async (_event, agentId: unknown) => {
    if (typeof agentId !== 'string' || agentId.trim().length === 0) {
      return { success: false, error: 'agentId must be a non-empty string' };
    }

    // Context is passed as null for now — Phase 3 real subagents will receive schema context
    const context = { activeDatabaseName: null, schemaContext: null };

    try {
      const result = await runSubagent(agentId.trim(), context);
      return { success: true, content: result.content };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: message };
    }
  });
}
