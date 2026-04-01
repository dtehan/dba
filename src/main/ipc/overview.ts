import { ipcMain } from 'electron';
import { IpcChannels } from '../../shared/types';
import { fetchOverviewMetrics } from '../services/overview-metrics';
import { fetchQueryActivityMetrics, fetchFullSql } from '../services/query-activity-metrics';

export function registerOverviewHandlers(): void {
  ipcMain.handle(IpcChannels.OVERVIEW_FETCH, async () => {
    try {
      const metrics = await fetchOverviewMetrics();
      return { success: true, metrics };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: message };
    }
  });

  ipcMain.handle(IpcChannels.QUERY_ACTIVITY_FETCH, async () => {
    try {
      const metrics = await fetchQueryActivityMetrics();
      return { success: true, metrics };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: message };
    }
  });

  ipcMain.handle(IpcChannels.QUERY_FULL_SQL, async (_event, queryId: string, procId: string) => {
    try {
      const sql = await fetchFullSql(queryId, procId);
      return { success: true, sql };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: message };
    }
  });
}
