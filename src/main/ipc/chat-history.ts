import { ipcMain } from 'electron';
import Store from 'electron-store';
import { IpcChannels } from '@shared/types';
import type { ChatSession } from '@shared/types';

const historyStore = new Store<{ sessions: ChatSession[] }>({
  name: 'chat-history',
  defaults: { sessions: [] },
});

export function registerChatHistoryHandlers(): void {
  ipcMain.handle(IpcChannels.CHAT_SESSIONS_LIST, async () => {
    const sessions = historyStore.get('sessions') || [];
    return sessions
      .map((s) => ({
        id: s.id,
        title: s.title,
        createdAt: s.createdAt,
        updatedAt: s.updatedAt,
        messageCount: s.messages.length,
      }))
      .sort((a, b) => b.updatedAt - a.updatedAt);
  });

  ipcMain.handle(IpcChannels.CHAT_SESSION_SAVE, async (_event, session: ChatSession) => {
    const sessions = historyStore.get('sessions') || [];
    const idx = sessions.findIndex((s) => s.id === session.id);
    if (idx >= 0) {
      sessions[idx] = session;
    } else {
      sessions.push(session);
    }
    // Keep last 50 sessions
    if (sessions.length > 50) {
      sessions.sort((a, b) => b.updatedAt - a.updatedAt);
      sessions.length = 50;
    }
    historyStore.set('sessions', sessions);
  });

  ipcMain.handle(IpcChannels.CHAT_SESSION_DELETE, async (_event, id: string) => {
    const sessions = historyStore.get('sessions') || [];
    historyStore.set(
      'sessions',
      sessions.filter((s) => s.id !== id)
    );
  });

  // Load a full session (with messages) by ID
  ipcMain.handle('chat:session-load', async (_event, id: string) => {
    const sessions = historyStore.get('sessions') || [];
    return sessions.find((s) => s.id === id) || null;
  });
}
