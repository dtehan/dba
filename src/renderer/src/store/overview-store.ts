import { create } from 'zustand';
import type { OverviewMetrics } from '@shared/types';

const electronAPI = (window as any).electronAPI;

interface OverviewState {
  metrics: OverviewMetrics | null;
  loading: boolean;
  error: string | null;
  fetch: () => Promise<void>;
}

export const useOverviewStore = create<OverviewState>((set) => ({
  metrics: null,
  loading: false,
  error: null,
  fetch: async () => {
    if (useOverviewStore.getState().loading) return;
    set({ loading: true, error: null });
    try {
      const result = await electronAPI.fetchOverviewMetrics();
      if (result.success && result.metrics) {
        set({ metrics: result.metrics, loading: false });
      } else {
        set({ error: result.error ?? 'Failed to fetch metrics', loading: false });
      }
    } catch (err) {
      set({ error: err instanceof Error ? err.message : String(err), loading: false });
    }
  },
}));
