import { create } from 'zustand';
import type { ConnectionStatus } from '@shared/types';

type NavPage = 'chat' | 'overview' | 'query-activity' | 'settings';

interface AppState {
  // Navigation
  currentPage: NavPage;
  setCurrentPage: (page: NavPage) => void;

  // Connection status (pushed from main process)
  connectionStatus: ConnectionStatus;
  setConnectionStatus: (status: ConnectionStatus) => void;
}

export const useAppStore = create<AppState>((set) => ({
  currentPage: 'chat',
  setCurrentPage: (page) => set({ currentPage: page }),

  connectionStatus: {
    teradata: 'not-configured',
    claude: 'not-configured',
  },
  setConnectionStatus: (status) => set({ connectionStatus: status }),
}));
