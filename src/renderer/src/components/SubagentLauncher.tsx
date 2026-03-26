import { useState, useEffect } from 'react';
import { ChevronDown, ChevronRight, Terminal, Shield, BarChart3, Database, TrendingUp, Loader2 } from 'lucide-react';
import { getElectronAPI } from '@/lib/ipc';
import { useChatStore } from '@/store/chat-store';
import { useAppStore } from '@/store/app-store';

interface SubagentDef {
  id: string;
  name: string;
  description: string;
  icon: string;
  params?: Array<{ key: string; label: string; placeholder: string; required: boolean }>;
}

const ICON_MAP: Record<string, React.ComponentType<{ size?: number; style?: React.CSSProperties }>> = {
  Terminal,
  Shield,
  BarChart3,
  Database,
  TrendingUp,
};

function SubagentIcon({ iconName, size = 16, style }: { iconName: string; size?: number; style?: React.CSSProperties }): JSX.Element {
  const Icon = ICON_MAP[iconName] ?? Terminal;
  return <Icon size={size} style={style} />;
}

export function SubagentLauncher(): JSX.Element {
  const [agents, setAgents] = useState<SubagentDef[]>([]);
  const [isOpen, setIsOpen] = useState(true);
  const [runningAgentId, setRunningAgentId] = useState<string | null>(null);
  const [pendingAgent, setPendingAgent] = useState<SubagentDef | null>(null);
  const [formValues, setFormValues] = useState<Record<string, string>>({});

  useEffect(() => {
    getElectronAPI()
      .listSubagents()
      .then((list) => setAgents(list))
      .catch((err) => console.warn('[SubagentLauncher] Failed to load subagents:', err));
  }, []);

  const handleRun = async (agent: SubagentDef, params: Record<string, string> = {}): Promise<void> => {
    if (runningAgentId !== null) return;
    setRunningAgentId(agent.id);
    setPendingAgent(null);
    setFormValues({});

    // Navigate to chat and start a new conversation for this subagent
    useAppStore.getState().setCurrentPage('chat');
    const store = useChatStore.getState();
    store.newChat();

    // Build a descriptive user message
    const paramDesc = Object.entries(params).filter(([,v]) => v).map(([k,v]) => `${k}: ${v}`).join(', ');
    const userMsg = `Run ${agent.name}${paramDesc ? ` (${paramDesc})` : ''}`;
    store.addUserMessage(userMsg);
    const assistantId = store.addAssistantMessagePlaceholder();

    try {
      const result = await getElectronAPI().runSubagentInChat(agent.id, params);
      if (!result.success && result.error) {
        useChatStore.getState().setError(result.error);
        useChatStore.getState().finalizeMessage(assistantId);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Subagent run failed';
      useChatStore.getState().setError(message);
      useChatStore.getState().finalizeMessage(assistantId);
    } finally {
      setRunningAgentId(null);
    }
  };

  return (
    <div>
      {/* Section toggle */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          width: '100%',
          padding: '8px 16px',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          color: '#A3A3A3',
          fontSize: '12px',
          fontWeight: 600,
          letterSpacing: '0.05em',
          textTransform: 'uppercase',
        }}
        className="hover:bg-[#262626]"
      >
        {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        <span>Subagents</span>
      </button>

      {/* Agent cards */}
      {isOpen && agents.map((agent) => {
        const isRunning = runningAgentId === agent.id;
        return (
          <div key={agent.id}>
            <button
              type="button"
              onClick={() => {
                if (agent.params?.length) {
                  setPendingAgent(pendingAgent?.id === agent.id ? null : agent);
                  setFormValues({});
                } else {
                  handleRun(agent);
                }
              }}
              disabled={runningAgentId !== null}
              style={{
                display: 'block',
                width: 'calc(100% - 16px)',
                margin: '0 8px',
                padding: '8px 16px',
                background: 'none',
                border: 'none',
                borderRadius: '8px',
                cursor: runningAgentId !== null ? 'not-allowed' : 'pointer',
                textAlign: 'left',
                opacity: runningAgentId !== null && !isRunning ? 0.6 : 1,
              }}
              className="hover:bg-[#262626]"
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <SubagentIcon
                  iconName={agent.icon}
                  size={14}
                  style={{ color: '#F37440', flexShrink: 0 }}
                />
                <span style={{ fontSize: '14px', color: '#F5F5F5', flex: 1 }}>
                  {agent.name}
                </span>
                {isRunning && (
                  <Loader2 size={14} style={{ color: '#A3A3A3', animation: 'spin 1s linear infinite' }} />
                )}
              </div>
              <p style={{ fontSize: '12px', color: '#A3A3A3', marginTop: '2px', marginBottom: 0, paddingLeft: '22px' }}>
                {isRunning ? 'Running...' : agent.description}
              </p>
            </button>

            {pendingAgent?.id === agent.id && agent.params && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleRun(agent, formValues);
                }}
                style={{
                  padding: '8px 16px 12px 38px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                }}
              >
                {agent.params.map((param) => (
                  <div key={param.key}>
                    <label
                      style={{
                        display: 'block',
                        fontSize: '11px',
                        color: '#A3A3A3',
                        marginBottom: '3px',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                      }}
                    >
                      {param.label}{param.required ? ' *' : ''}
                    </label>
                    <input
                      type="text"
                      placeholder={param.placeholder}
                      required={param.required}
                      value={formValues[param.key] ?? ''}
                      onChange={(e) =>
                        setFormValues((prev) => ({ ...prev, [param.key]: e.target.value }))
                      }
                      style={{
                        background: '#1A1A1A',
                        border: '1px solid #404040',
                        borderRadius: '6px',
                        padding: '6px 10px',
                        color: '#F5F5F5',
                        fontSize: '13px',
                        width: '100%',
                        boxSizing: 'border-box' as const,
                        outline: 'none',
                      }}
                    />
                  </div>
                ))}
                <button
                  type="submit"
                  style={{
                    background: '#F37440',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '6px 12px',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    marginTop: '4px',
                  }}
                >
                  Run Analysis
                </button>
              </form>
            )}
          </div>
        );
      })}

      {isOpen && agents.length === 0 && (
        <p style={{ fontSize: '12px', color: '#A3A3A3', padding: '4px 16px', margin: 0 }}>
          No subagents available
        </p>
      )}
    </div>
  );
}
