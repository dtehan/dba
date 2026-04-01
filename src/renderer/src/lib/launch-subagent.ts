import { getElectronAPI } from '@/lib/ipc';
import { useChatStore } from '@/store/chat-store';
import { useAppStore } from '@/store/app-store';
import { useSubagentStore } from '@/store/subagent-store';

export async function launchSubagent(
  agentId: string,
  agentName: string,
  params: Record<string, string>,
): Promise<void> {
  useAppStore.getState().setCurrentPage('chat');
  const store = useChatStore.getState();
  store.newChat();

  const paramDesc = Object.entries(params)
    .filter(([, v]) => v)
    .map(([k, v]) => `${k}: ${v}`)
    .join(', ');
  const userMsg = `Run ${agentName}${paramDesc ? ` (${paramDesc})` : ''}`;
  store.addUserMessage(userMsg);
  const assistantId = store.addAssistantMessagePlaceholder();
  const sessionId = useChatStore.getState().sessionId;

  try {
    const result = await getElectronAPI().runSubagentInChat(agentId, params, sessionId);
    if (!result.success && result.error) {
      useChatStore.getState().setError(result.error);
      useChatStore.getState().finalizeMessage(assistantId);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Subagent run failed';
    useChatStore.getState().setError(message);
    useChatStore.getState().finalizeMessage(assistantId);
  } finally {
    useSubagentStore.getState().refreshHistory();
  }
}
