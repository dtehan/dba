import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type { ChatMessage, MessageRole } from '@shared/types';

export interface SubagentResultEntry {
  id: string;
  agentName: string;
  content: string;
  timestamp: number;
}

interface ChatState {
  messages: ChatMessage[];
  subagentResults: SubagentResultEntry[];
  isStreaming: boolean;
  streamingMessageId: string | null;
  schemaContext: string | null;
  activeDatabaseName: string | null;
  error: string | null;

  addUserMessage: (content: string) => string;
  addAssistantMessagePlaceholder: () => string;
  appendToken: (id: string, delta: string) => void;
  finalizeMessage: (id: string) => void;
  setError: (error: string | null) => void;
  setSchemaContext: (ctx: string | null) => void;
  setActiveDatabaseName: (name: string | null) => void;
  addSubagentResult: (result: Omit<SubagentResultEntry, 'id'>) => void;
  clearMessages: () => void;
}

export const useChatStore = create<ChatState>()(
  immer((set) => ({
    messages: [],
    subagentResults: [],
    isStreaming: false,
    streamingMessageId: null,
    schemaContext: null,
    activeDatabaseName: null,
    error: null,

    addUserMessage: (content) => {
      const id = Date.now().toString();
      set((state) => {
        state.messages.push({ id, role: 'user' as MessageRole, content, timestamp: Date.now() });
      });
      return id;
    },

    addAssistantMessagePlaceholder: () => {
      const id = Date.now().toString() + '-a';
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
    },

    setError: (error) => set((state) => { state.error = error; state.isStreaming = false; state.streamingMessageId = null; }),
    setSchemaContext: (ctx) => set((state) => { state.schemaContext = ctx; }),
    setActiveDatabaseName: (name) => set((state) => { state.activeDatabaseName = name; }),

    addSubagentResult: (result) => {
      set((state) => {
        state.subagentResults.push({ ...result, id: Date.now().toString() });
      });
    },

    clearMessages: () => set((state) => {
      state.messages = [];
      state.subagentResults = [];
      state.error = null;
    }),
  }))
);
