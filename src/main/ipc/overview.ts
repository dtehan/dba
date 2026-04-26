import { ipcMain } from 'electron';
import { IpcChannels } from '../../shared/types';
import { fetchOverviewMetrics } from '../services/overview-metrics';
import { fetchQueryActivityMetrics, fetchFullSql } from '../services/query-activity-metrics';
import { callMcpTool } from '../services/mcp-schema';

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

  ipcMain.handle(IpcChannels.QUERY_ACTIVITY_FETCH, async (_event, sortCol, sortDir, timeRange) => {
    try {
      const metrics = await fetchQueryActivityMetrics(sortCol, sortDir, timeRange);
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

  ipcMain.handle(IpcChannels.QUERY_EXPLAIN, async (_event, sql: string) => {
    try {
      // Strip trailing semicolons to avoid Teradata "only one request" error
      const cleanSql = sql.replace(/;\s*$/, '');
      const result = await callMcpTool('base_readQuery', { sql: `EXPLAIN ${cleanSql}` });
      return { success: true, explain: result };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: message };
    }
  });
}
