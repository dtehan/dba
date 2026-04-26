import { create } from 'zustand';
import type { QueryActivityMetrics, SortColumn, SortDir, TimeRange } from '@shared/types';

const electronAPI = (window as any).electronAPI;

interface QueryActivityState {
  metrics: QueryActivityMetrics | null;
  loading: boolean;
  error: string | null;
  sortCol: SortColumn;
  sortDir: SortDir;
  timeRange: TimeRange;
  setSortCol: (col: SortColumn) => void;
  setSortDir: (dir: SortDir) => void;
  setTimeRange: (range: TimeRange) => void;
  toggleSort: (col: SortColumn) => void;
  fetch: () => Promise<void>;
}

export const useQueryActivityStore = create<QueryActivityState>((set) => ({
  metrics: null,
  loading: false,
  error: null,
  sortCol: 'AmpCPUTime',
  sortDir: 'DESC',
  timeRange: 'today',
  setSortCol: (col) => set({ sortCol: col }),
  setSortDir: (dir) => set({ sortDir: dir }),
  setTimeRange: (range) => set({ timeRange: range }),
  toggleSort: (col) => {
    const state = useQueryActivityStore.getState();
    if (state.sortCol === col) {
      set({ sortDir: state.sortDir === 'DESC' ? 'ASC' : 'DESC' });
    } else {
      set({ sortCol: col, sortDir: 'DESC' });
    }
  },
  fetch: async () => {
    const { loading, sortCol, sortDir, timeRange } = useQueryActivityStore.getState();
    if (loading) return;
    set({ loading: true, error: null });
    try {
      const result = await electronAPI.fetchQueryActivityMetrics(sortCol, sortDir, timeRange);
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
