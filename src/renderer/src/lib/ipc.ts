import type { ElectronAPI } from '@shared/types';

// Access the preload-exposed API with type safety
export function getElectronAPI(): ElectronAPI {
  const api = (window as { electronAPI?: ElectronAPI }).electronAPI;
  if (!api) {
    throw new Error('electronAPI not available -- are you running outside Electron?');
  }
  return api;
}
