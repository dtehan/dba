import { create } from 'zustand';
import type { QueryActivityMetrics } from '@shared/types';

const electronAPI = (window as any).electronAPI;

interface QueryActivityState {
  metrics: QueryActivityMetrics | null;
  loading: boolean;
  error: string | null;
  fetch: () => Promise<void>;
}

export const useQueryActivityStore = create<QueryActivityState>((set) => ({
  metrics: null,
  loading: false,
  error: null,
  fetch: async () => {
    if (useQueryActivityStore.getState().loading) return;
    set({ loading: true, error: null });
    try {
      const result = await electronAPI.fetchQueryActivityMetrics();
      if (result.success && result.metrics) {
        set({ metrics: result.metrics, loading: false });
      } else {
        set({ error: result.error ?? 'Failed to fetch query activity', loading: false });
      }
    } catch (err) {
      set({ error: err instanceof Error ? err.message : String(err), loading: false });
    }
  },
}));
