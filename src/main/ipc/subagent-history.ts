import { ipcMain } from 'electron';
import Store from 'electron-store';
import { IpcChannels } from '@shared/types';
import type { SubagentRunHistoryEntry } from '../../shared/subagent-types';

const MAX_RUNS_PER_AGENT = 10;

const historyStore = new Store<{ runs: SubagentRunHistoryEntry[] }>({
  name: 'subagent-history',
  defaults: { runs: [] },
});

/** Add a run entry, trimming to last MAX_RUNS_PER_AGENT per agent */
export function addRunEntry(entry: SubagentRunHistoryEntry): void {
  const runs = historyStore.get('runs') || [];
  runs.push(entry);

  // Trim: keep only last N per agent
  const byAgent = new Map<string, SubagentRunHistoryEntry[]>();
  for (const r of runs) {
    const list = byAgent.get(r.agentId) || [];
    list.push(r);
    byAgent.set(r.agentId, list);
  }
  const trimmed: SubagentRunHistoryEntry[] = [];
  for (const [, list] of byAgent) {
    list.sort((a, b) => b.timestamp - a.timestamp);
    trimmed.push(...list.slice(0, MAX_RUNS_PER_AGENT));
  }
  trimmed.sort((a, b) => b.timestamp - a.timestamp);
  historyStore.set('runs', trimmed);
}

export function registerSubagentHistoryHandlers(): void {
  ipcMain.handle(IpcChannels.SUBAGENT_HISTORY_LIST, async (_event, agentId?: string) => {
    const runs = historyStore.get('runs') || [];
    if (agentId) {
      return runs.filter((r) => r.agentId === agentId).sort((a, b) => b.timestamp - a.timestamp);
    }
    return runs.sort((a, b) => b.timestamp - a.timestamp);
  });

  ipcMain.handle(IpcChannels.SUBAGENT_HISTORY_ADD, async (_event, entry: SubagentRunHistoryEntry) => {
    addRunEntry(entry);
  });

  ipcMain.handle(IpcChannels.SUBAGENT_HISTORY_CLEAR, async () => {
    historyStore.set('runs', []);
  });
}
