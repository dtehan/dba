import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { getElectronAPI } from '@/lib/ipc';
import type { SubagentRunHistoryEntry } from '@shared/subagent-types';

interface SubagentDef {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  params?: Array<{ key: string; label: string; placeholder: string; required: boolean }>;
}

const CATEGORY_ORDER = ['Security', 'Performance', 'Storage', 'General'];

interface SubagentState {
  agents: SubagentDef[];
  history: SubagentRunHistoryEntry[];
  loaded: boolean;

  // Computed-like accessors
  agentsByCategory: () => Array<{ category: string; agents: SubagentDef[] }>;
  getLastRun: (agentId: string) => SubagentRunHistoryEntry | null;

  // Actions
  load: () => Promise<void>;
  refreshHistory: () => Promise<void>;
}

export const useSubagentStore = create<SubagentState>()(
  immer((set, get) => ({
    agents: [],
    history: [],
    loaded: false,

    agentsByCategory: () => {
      const { agents } = get();
      const grouped = new Map<string, SubagentDef[]>();
      for (const agent of agents) {
        const cat = agent.category || 'General';
        const list = grouped.get(cat) || [];
        list.push(agent);
        grouped.set(cat, list);
      }
      // Sort by fixed order, unknown categories go at the end
      const result: Array<{ category: string; agents: SubagentDef[] }> = [];
      for (const cat of CATEGORY_ORDER) {
        const list = grouped.get(cat);
        if (list?.length) {
          result.push({ category: cat, agents: list });
          grouped.delete(cat);
        }
      }
      // Any remaining categories
      for (const [cat, list] of grouped) {
        result.push({ category: cat, agents: list });
      }
      return result;
    },

    getLastRun: (agentId: string) => {
      const { history } = get();
      return history.find((r) => r.agentId === agentId) ?? null;
    },

    load: async () => {
      try {
        const api = getElectronAPI();
        const [agents, history] = await Promise.all([
          api.listSubagents(),
          api.listSubagentHistory(),
        ]);
        set((state) => {
          state.agents = agents;
          state.history = history;
          state.loaded = true;
        });
      } catch (err) {
        console.warn('[subagent-store] Failed to load:', err);
      }
    },

    refreshHistory: async () => {
      try {
        const history = await getElectronAPI().listSubagentHistory();
        set((state) => {
          state.history = history;
        });
      } catch {
        // ignore
      }
    },
  }))
);
