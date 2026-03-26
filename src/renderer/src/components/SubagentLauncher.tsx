import { useState, useEffect } from 'react';
import { ChevronDown, ChevronRight, Terminal, Shield, BarChart3, Loader2 } from 'lucide-react';
import { getElectronAPI } from '@/lib/ipc';
import { useChatStore } from '@/store/chat-store';

interface SubagentDef {
  id: string;
  name: string;
  description: string;
  icon: string;
}

const ICON_MAP: Record<string, React.ComponentType<{ size?: number; style?: React.CSSProperties }>> = {
  Terminal,
  Shield,
  BarChart3,
};

function SubagentIcon({ iconName, size = 16, style }: { iconName: string; size?: number; style?: React.CSSProperties }): JSX.Element {
  const Icon = ICON_MAP[iconName] ?? Terminal;
  return <Icon size={size} style={style} />;
}

export function SubagentLauncher(): JSX.Element {
  const [agents, setAgents] = useState<SubagentDef[]>([]);
  const [isOpen, setIsOpen] = useState(true);
  const [runningAgentId, setRunningAgentId] = useState<string | null>(null);

  useEffect(() => {
    getElectronAPI()
      .listSubagents()
      .then((list) => setAgents(list))
      .catch((err) => console.warn('[SubagentLauncher] Failed to load subagents:', err));
  }, []);

  const handleRun = async (agent: SubagentDef): Promise<void> => {
    if (runningAgentId !== null) return;
    setRunningAgentId(agent.id);
    try {
      const result = await getElectronAPI().runSubagent(agent.id);
      if (result.success && result.content) {
        useChatStore.getState().addSubagentResult({
          agentName: agent.name,
          content: result.content,
          timestamp: Date.now(),
        });
      } else {
        console.warn('[SubagentLauncher] Subagent error:', result.error);
      }
    } catch (err) {
      console.warn('[SubagentLauncher] Subagent run failed:', err);
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
          <button
            key={agent.id}
            type="button"
            onClick={() => handleRun(agent)}
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
