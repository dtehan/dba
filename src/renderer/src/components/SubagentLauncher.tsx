import { useState, useEffect, useMemo } from 'react';
import { Terminal, Shield, BarChart3, Database, TrendingUp, Loader2, RotateCcw, Search, X, ArrowLeft } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { getElectronAPI } from '@/lib/ipc';
import { useChatStore } from '@/store/chat-store';
import { useAppStore } from '@/store/app-store';
import { useSubagentStore } from '@/store/subagent-store';

interface AgentDef {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  params?: Array<{ key: string; label: string; placeholder: string; required: boolean }>;
}

const ICON_MAP: Record<string, React.ComponentType<{ size?: number; style?: React.CSSProperties }>> = {
  Terminal, Shield, BarChart3, Database, TrendingUp,
};

// Category → icon mapping
const CATEGORY_ICONS: Record<string, string> = {
  Security: 'Shield',
  Performance: 'BarChart3',
  Storage: 'Database',
  General: 'Terminal',
};

// Category → accent color for card borders
const CATEGORY_COLORS: Record<string, string> = {
  Security: '#F59E0B',
  Performance: '#3B82F6',
  Storage: '#10B981',
  General: '#A3A3A3',
};

function SubagentIcon({ iconName, size = 16, style }: { iconName: string; size?: number; style?: React.CSSProperties }): JSX.Element {
  const Icon = ICON_MAP[iconName] ?? Terminal;
  return <Icon size={size} style={style} />;
}

export function SubagentLauncher(): JSX.Element {
  const { loaded, load, agentsByCategory, getLastRun, refreshHistory, agents } = useSubagentStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [selectedAgent, setSelectedAgent] = useState<AgentDef | null>(null);
  const [formValues, setFormValues] = useState<Record<string, string>>({});
  const [runningAgentId, setRunningAgentId] = useState<string | null>(null);

  useEffect(() => { if (!loaded) load(); }, [loaded, load]);

  const categories = agentsByCategory();

  // Search results — flat list across all categories
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return null;
    const q = searchQuery.toLowerCase();
    return agents.filter(
      (a) => a.name.toLowerCase().includes(q) || a.description.toLowerCase().includes(q) || a.category.toLowerCase().includes(q)
    );
  }, [agents, searchQuery]);

  const isSearching = searchResults !== null;

  const handleSelectAgent = (agent: AgentDef): void => {
    setSelectedAgent(agent);
    // Pre-fill from last run
    const lastRun = getLastRun(agent.id);
    if (lastRun && agent.params) {
      const prefilled: Record<string, string> = {};
      for (const p of agent.params) {
        if (lastRun.params[p.key]) prefilled[p.key] = lastRun.params[p.key];
      }
      setFormValues(prefilled);
    } else {
      setFormValues({});
    }
  };

  const handleBack = (): void => {
    if (selectedAgent) {
      setSelectedAgent(null);
      setFormValues({});
    } else {
      setActiveCategory(null);
    }
  };

  const handleRun = async (agent: AgentDef, params: Record<string, string> = {}): Promise<void> => {
    if (runningAgentId !== null) return;
    setRunningAgentId(agent.id);
    setSelectedAgent(null);
    setActiveCategory(null);
    setFormValues({});
    setSearchQuery('');

    useAppStore.getState().setCurrentPage('chat');
    const store = useChatStore.getState();
    store.newChat();

    const paramDesc = Object.entries(params).filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`).join(', ');
    const userMsg = `Run ${agent.name}${paramDesc ? ` (${paramDesc})` : ''}`;
    store.addUserMessage(userMsg);
    const assistantId = store.addAssistantMessagePlaceholder();
    const sessionId = useChatStore.getState().sessionId;

    try {
      const result = await getElectronAPI().runSubagentInChat(agent.id, params, sessionId);
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
      refreshHistory();
    }
  };

  // Active category agents
  const activeCategoryAgents = activeCategory
    ? categories.find((c) => c.category === activeCategory)?.agents ?? []
    : [];

  const lastRun = selectedAgent ? getLastRun(selectedAgent.id) : null;

  return (
    <div style={{ borderBottom: '1px solid #333', background: '#1D1D1D' }}>
      {/* Search bar — always visible */}
      <div style={{ padding: '10px 16px 0' }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: '8px',
          background: '#262626', border: '1px solid #404040', borderRadius: '8px',
          padding: '7px 12px',
        }}>
          <Search size={14} style={{ color: '#595959', flexShrink: 0 }} />
          <input
            type="text"
            placeholder="Search agents..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setActiveCategory(null);
              setSelectedAgent(null);
            }}
            style={{
              background: 'none', border: 'none', outline: 'none',
              color: '#F5F5F5', fontSize: '13px', width: '100%',
            }}
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              style={{ background: 'none', border: 'none', color: '#525252', cursor: 'pointer', padding: '2px', display: 'flex' }}
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Search results */}
      {isSearching && (
        <div style={{ padding: '8px 16px 12px' }}>
          {searchResults.length === 0 ? (
            <p style={{ fontSize: '12px', color: '#525252', margin: '8px 0 0', textAlign: 'center' }}>
              No agents match "{searchQuery}"
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginTop: '6px' }}>
              {searchResults.map((agent) => (
                <AgentListItem
                  key={agent.id}
                  agent={agent}
                  lastRun={getLastRun(agent.id)}
                  isRunning={runningAgentId === agent.id}
                  disabled={runningAgentId !== null}
                  onSelect={() => handleSelectAgent(agent)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Default view: category cards */}
      {!isSearching && !activeCategory && !selectedAgent && (
        <div style={{ display: 'flex', gap: '10px', padding: '10px 16px 12px', flexWrap: 'wrap' }}>
          {categories.map(({ category, agents: catAgents }) => {
            const color = CATEGORY_COLORS[category] || CATEGORY_COLORS.General;
            const iconName = CATEGORY_ICONS[category] || 'Terminal';
            return (
              <button
                key={category}
                type="button"
                onClick={() => setActiveCategory(category)}
                disabled={runningAgentId !== null}
                style={{
                  flex: '1 1 140px',
                  maxWidth: '200px',
                  display: 'flex', alignItems: 'center', gap: '10px',
                  background: '#262626',
                  border: '1px solid #404040',
                  borderLeft: `3px solid ${color}`,
                  borderRadius: '8px',
                  padding: '12px 14px',
                  cursor: runningAgentId !== null ? 'not-allowed' : 'pointer',
                  textAlign: 'left',
                  opacity: runningAgentId !== null ? 0.5 : 1,
                }}
                className="hover:bg-[#2A2A2A]"
              >
                <SubagentIcon iconName={iconName} size={18} style={{ color, flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: '13px', color: '#F5F5F5', fontWeight: 500 }}>{category}</div>
                  <div style={{ fontSize: '11px', color: '#737373' }}>
                    {catAgents.length} agent{catAgents.length !== 1 ? 's' : ''}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Drilled into a category — show agent list */}
      {!isSearching && activeCategory && !selectedAgent && (
        <div style={{ padding: '8px 16px 12px' }}>
          <button
            type="button"
            onClick={handleBack}
            style={{
              display: 'flex', alignItems: 'center', gap: '4px',
              background: 'none', border: 'none', color: '#737373', fontSize: '12px',
              cursor: 'pointer', padding: '2px 0', marginBottom: '6px',
            }}
          >
            <ArrowLeft size={13} /> All categories
          </button>
          <div style={{ fontSize: '14px', color: '#F5F5F5', fontWeight: 500, marginBottom: '8px' }}>
            {activeCategory}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            {activeCategoryAgents.map((agent) => (
              <AgentListItem
                key={agent.id}
                agent={agent}
                lastRun={getLastRun(agent.id)}
                isRunning={runningAgentId === agent.id}
                disabled={runningAgentId !== null}
                onSelect={() => handleSelectAgent(agent)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Selected agent — show params form */}
      {!isSearching && selectedAgent && (
        <div style={{ padding: '8px 16px 12px' }}>
          <button
            type="button"
            onClick={handleBack}
            style={{
              display: 'flex', alignItems: 'center', gap: '4px',
              background: 'none', border: 'none', color: '#737373', fontSize: '12px',
              cursor: 'pointer', padding: '2px 0', marginBottom: '8px',
            }}
          >
            <ArrowLeft size={13} /> {activeCategory || 'Back'}
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <SubagentIcon iconName={selectedAgent.icon} size={16} style={{ color: '#F37440' }} />
            <span style={{ fontSize: '14px', color: '#F5F5F5', fontWeight: 500 }}>{selectedAgent.name}</span>
          </div>
          <p style={{ fontSize: '12px', color: '#A3A3A3', margin: '0 0 10px' }}>{selectedAgent.description}</p>

          {lastRun && (
            <p style={{ fontSize: '11px', color: '#737373', margin: '0 0 10px' }}>
              Last run {formatDistanceToNow(lastRun.timestamp, { addSuffix: true })}
              {lastRun.status === 'failed' && <span style={{ color: '#EF4444', marginLeft: '6px' }}>(failed)</span>}
            </p>
          )}

          <form
            onSubmit={(e) => { e.preventDefault(); handleRun(selectedAgent, formValues); }}
            style={{ display: 'flex', alignItems: 'flex-end', gap: '10px', flexWrap: 'wrap' }}
          >
            {selectedAgent.params?.map((param) => (
              <div key={param.key} style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                <label style={{ fontSize: '10px', color: '#737373', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {param.label}{param.required ? ' *' : ''}
                </label>
                <input
                  type="text"
                  placeholder={param.placeholder}
                  required={param.required}
                  value={formValues[param.key] ?? ''}
                  onChange={(e) => setFormValues((prev) => ({ ...prev, [param.key]: e.target.value }))}
                  style={{
                    background: '#1A1A1A', border: '1px solid #404040', borderRadius: '6px',
                    padding: '6px 10px', color: '#F5F5F5', fontSize: '13px',
                    width: '200px', outline: 'none',
                  }}
                />
              </div>
            ))}

            <div style={{ display: 'flex', gap: '6px' }}>
              {lastRun && (
                <button
                  type="button"
                  onClick={() => handleRun(selectedAgent, lastRun.params)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '4px',
                    background: '#262626', color: '#D4D4D4', border: '1px solid #404040',
                    borderRadius: '6px', padding: '6px 12px', fontSize: '12px', fontWeight: 500, cursor: 'pointer',
                  }}
                >
                  <RotateCcw size={11} /> Re-run last
                </button>
              )}
              <button
                type="submit"
                style={{
                  background: '#F37440', color: 'white', border: 'none', borderRadius: '6px',
                  padding: '6px 16px', fontSize: '13px', fontWeight: 600, cursor: 'pointer',
                }}
              >
                Run Analysis
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Running indicator */}
      {runningAgentId && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '8px',
          padding: '0 16px 10px', fontSize: '12px', color: '#A3A3A3',
        }}>
          <Loader2 size={14} style={{ color: '#F37440', animation: 'spin 1s linear infinite' }} />
          <span>Running {agents.find((a) => a.id === runningAgentId)?.name}...</span>
        </div>
      )}
    </div>
  );
}

// Reusable agent list item for category drill-down and search results
function AgentListItem({
  agent,
  lastRun,
  isRunning,
  disabled,
  onSelect,
}: {
  agent: AgentDef;
  lastRun: { timestamp: number; params: Record<string, string>; status: string } | null;
  isRunning: boolean;
  disabled: boolean;
  onSelect: () => void;
}): JSX.Element {
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={disabled}
      style={{
        display: 'flex', alignItems: 'center', gap: '10px',
        width: '100%', padding: '8px 10px',
        background: 'none', border: 'none', borderRadius: '6px',
        cursor: disabled ? 'not-allowed' : 'pointer', textAlign: 'left',
        opacity: disabled && !isRunning ? 0.5 : 1,
      }}
      className="hover:bg-[#262626]"
    >
      <SubagentIcon iconName={agent.icon} size={14} style={{ color: '#F37440', flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '13px', color: '#F5F5F5' }}>{agent.name}</div>
        <div style={{ fontSize: '11px', color: '#737373', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {agent.description}
        </div>
      </div>
      {isRunning && <Loader2 size={13} style={{ color: '#F37440', animation: 'spin 1s linear infinite', flexShrink: 0 }} />}
      {!isRunning && lastRun && (
        <span style={{ fontSize: '10px', color: '#525252', flexShrink: 0, whiteSpace: 'nowrap' }}>
          {formatDistanceToNow(lastRun.timestamp, { addSuffix: false })}
        </span>
      )}
    </button>
  );
}
