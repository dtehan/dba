import { ipcMain } from 'electron';
import { IpcChannels } from '../../shared/types';
import { listDatabases, fetchSchemaContext } from '../services/mcp-schema';

export function registerSchemaHandlers(): void {
  ipcMain.handle(IpcChannels.SCHEMA_LIST_DATABASES, async () => {
    try {
      const databases = await listDatabases();
      return { success: true, databases };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: message };
    }
  });

  ipcMain.handle(IpcChannels.SCHEMA_FETCH, async (_event, databaseName: unknown) => {
    if (typeof databaseName !== 'string' || databaseName.trim().length === 0) {
      return { success: false, error: 'databaseName must be a non-empty string' };
    }

    try {
      const context = await fetchSchemaContext(databaseName.trim());
      return { success: true, context };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: message };
    }
  });
}
