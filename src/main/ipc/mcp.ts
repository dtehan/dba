import { ipcMain } from 'electron';
import { IpcChannels } from '../../shared/types';
import { testTeradataConnection } from '../services/mcp-manager';

export function registerMcpHandlers(): void {
  ipcMain.handle(IpcChannels.TEST_TERADATA_CONNECTION, async () => {
    return testTeradataConnection();
  });
}
