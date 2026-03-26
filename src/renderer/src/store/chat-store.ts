import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type { ChatMessage, MessageRole } from '@shared/types';

export interface SubagentResultEntry {
  id: string;
  agentName: string;
  content: string;
  timestamp: number;
}

export interface SessionSummary {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messageCount: number;
}

interface ChatState {
  // Current session
  sessionId: string;
  sessionTitle: string;
  messages: ChatMessage[];
  subagentResults: SubagentResultEntry[];
  isStreaming: boolean;
  streamingMessageId: string | null;
  error: string | null;

  // Session history
  sessions: SessionSummary[];

  // Actions
  addUserMessage: (content: string) => string;
  addAssistantMessagePlaceholder: () => string;
  appendToken: (id: string, delta: string) => void;
  finalizeMessage: (id: string) => void;
  setError: (error: string | null) => void;
  addSubagentResult: (result: Omit<SubagentResultEntry, 'id'>) => void;
  newChat: () => void;
  loadSession: (id: string) => Promise<void>;
  deleteSession: (id: string) => Promise<void>;
  refreshSessions: () => Promise<void>;
  saveCurrentSession: () => Promise<void>;
}

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

export const useChatStore = create<ChatState>()(
  immer((set, get) => ({
    sessionId: generateId(),
    sessionTitle: 'New Chat',
    messages: [],
    subagentResults: [],
    isStreaming: false,
    streamingMessageId: null,
    error: null,
    sessions: [],

    addUserMessage: (content) => {
      const id = generateId();
      set((state) => {
        state.messages.push({ id, role: 'user' as MessageRole, content, timestamp: Date.now() });
        // Auto-title from first user message
        if (state.messages.filter((m) => m.role === 'user').length === 1) {
          state.sessionTitle = content.slice(0, 60) + (content.length > 60 ? '...' : '');
        }
      });
      return id;
    },

    addAssistantMessagePlaceholder: () => {
      const id = generateId() + '-a';
      set((state) => {
        state.messages.push({ id, role: 'assistant' as MessageRole, content: '', timestamp: Date.now(), isStreaming: true });
        state.isStreaming = true;
        state.streamingMessageId = id;
        state.error = null;
      });
      return id;
    },

    appendToken: (id, delta) => {
      set((state) => {
        const msg = state.messages.find((m) => m.id === id);
        if (msg) msg.content += delta;
      });
    },

    finalizeMessage: (id) => {
      set((state) => {
        const msg = state.messages.find((m) => m.id === id);
        if (msg) msg.isStreaming = false;
        state.isStreaming = false;
        state.streamingMessageId = null;
      });
      // Auto-save after each completed response
      get().saveCurrentSession();
    },

    setError: (error) => set((state) => {
      state.error = error;
      state.isStreaming = false;
      state.streamingMessageId = null;
    }),

    addSubagentResult: (result) => {
      set((state) => {
        state.subagentResults.push({ ...result, id: generateId() });
      });
    },

    newChat: () => {
      // Save current session before starting new one (if it has messages)
      const current = get();
      if (current.messages.length > 0) {
        current.saveCurrentSession();
      }
      set((state) => {
        state.sessionId = generateId();
        state.sessionTitle = 'New Chat';
        state.messages = [];
        state.subagentResults = [];
        state.error = null;
        state.isStreaming = false;
        state.streamingMessageId = null;
      });
    },

    loadSession: async (id) => {
      try {
        const api = (window as any).electronAPI;
        const session = await api?.loadChatSession?.(id);
        if (session) {
          // Save current session first
          const current = get();
          if (current.messages.length > 0) {
            await current.saveCurrentSession();
          }
          set((state) => {
            state.sessionId = session.id;
            state.sessionTitle = session.title;
            state.messages = session.messages;
            state.subagentResults = [];
            state.error = null;
            state.isStreaming = false;
            state.streamingMessageId = null;
          });
        }
      } catch {
        // ignore load errors
      }
    },

    deleteSession: async (id) => {
      try {
        const api = (window as any).electronAPI;
        await api?.deleteChatSession?.(id);
        // If we deleted the active session, start fresh
        if (get().sessionId === id) {
          get().newChat();
        }
        await get().refreshSessions();
      } catch {
        // ignore
      }
    },

    refreshSessions: async () => {
      try {
        const api = (window as any).electronAPI;
        const sessions = await api?.listChatSessions?.();
        if (sessions) {
          set((state) => { state.sessions = sessions; });
        }
      } catch {
        // ignore
      }
    },

    saveCurrentSession: async () => {
      const state = get();
      if (state.messages.length === 0) return;
      try {
        const api = (window as any).electronAPI;
        await api?.saveChatSession?.({
          id: state.sessionId,
          title: state.sessionTitle,
          createdAt: state.messages[0]?.timestamp ?? Date.now(),
          updatedAt: Date.now(),
          messages: state.messages.map((m) => ({
            id: m.id,
            role: m.role,
            content: m.content,
            timestamp: m.timestamp,
          })),
        });
        await get().refreshSessions();
      } catch {
        // ignore save errors
      }
    },
  }))
);
