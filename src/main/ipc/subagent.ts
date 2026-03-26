import { ipcMain } from 'electron';
import { IpcChannels } from '../../shared/types';
import { getSubagentRegistry, refreshRegistry } from '../subagents/registry';

export function registerSubagentHandlers(): void {
  ipcMain.handle(IpcChannels.SUBAGENT_LIST, async () => {
    return getSubagentRegistry();
  });

  // Allow renderer to refresh the registry (after user adds new .md files)
  ipcMain.handle('subagent:refresh', async () => {
    refreshRegistry();
    return getSubagentRegistry();
  });
}
