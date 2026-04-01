import { useState, useEffect, useRef, useMemo } from 'react';
import { RefreshCw, AlertTriangle, User, Search } from 'lucide-react';
import { useOverviewStore } from '@/store/overview-store';
import { useAppStore } from '@/store/app-store';
import { MetricCard } from './MetricCard';
import { formatBytes } from './formatBytes';
import { SubagentContextMenu } from '@/components/SubagentContextMenu';
import { getSubagentsForObject } from '@/lib/subagent-mapping';
import type { SubagentOption, ObjectContext } from '@/lib/subagent-mapping';

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const secs = Math.floor(diff / 1000);
  if (secs < 60) return 'just now';
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  return `${hours}h ago`;
}

function formatCpu(seconds: number): string {
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  if (seconds < 3600) return `${(seconds / 60).toFixed(1)}m`;
  return `${(seconds / 3600).toFixed(1)}h`;
}

interface MenuState {
  options: SubagentOption[];
  context: ObjectContext;
  anchorRect: DOMRect;
}

export function OverviewScreen(): JSX.Element {
  const { metrics, loading, error, fetch } = useOverviewStore();
  const teradataStatus = useAppStore((s) => s.connectionStatus.teradata);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [menuState, setMenuState] = useState<MenuState | null>(null);
  const [storageVisible, setStorageVisible] = useState(10);
  const [tablesVisible, setTablesVisible] = useState(10);
  const [usersVisible, setUsersVisible] = useState(10);
  const [storageFilter, setStorageFilter] = useState('');
  const [tablesFilter, setTablesFilter] = useState('');
  const [usersFilter, setUsersFilter] = useState('');

  const openMenu = (e: React.MouseEvent, type: 'database' | 'table' | 'user', context: ObjectContext): void => {
    e.stopPropagation();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setMenuState({ options: getSubagentsForObject(type), context, anchorRect: rect });
  };

  const isConnected = teradataStatus === 'connected';

  useEffect(() => {
    if (isConnected) {
      fetch();
      intervalRef.current = setInterval(fetch, 60_000);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isConnected]);

  if (!isConnected) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '12px', color: '#737373' }}>
        <AlertTriangle size={32} />
        <p style={{ fontSize: '14px', margin: 0 }}>Connect to Teradata in Settings to view system metrics.</p>
      </div>
    );
  }

  // Compute overall storage utilization for the health card
  const totalUsed = metrics?.storageUsage.reduce((sum, s) => sum + s.currentPerm, 0) ?? 0;
  const totalMax = metrics?.storageUsage.reduce((sum, s) => sum + s.maxPerm, 0) ?? 0;
  const storagePercent = totalMax > 0 ? (totalUsed / totalMax) * 100 : 0;
  const storageColor = storagePercent >= 90 ? '#EF4444' : storagePercent >= 75 ? '#F59E0B' : '#22C55E';

  // CPU skew: ratio of max to average CPU among top users
  const cpuValues = metrics?.topUsersByCpu.map((u) => u.totalCpu) ?? [];
  const maxCpu = cpuValues.length > 0 ? Math.max(...cpuValues) : 0;
  const avgCpu = cpuValues.length > 0 ? cpuValues.reduce((a, b) => a + b, 0) / cpuValues.length : 0;
  const cpuSkewRatio = avgCpu > 0 ? maxCpu / avgCpu : 0;
  const cpuSkewColor = cpuSkewRatio > 5 ? '#EF4444' : cpuSkewRatio > 3 ? '#F59E0B' : '#22C55E';

  const filteredStorage = useMemo(() => {
    if (!metrics) return [];
    if (!storageFilter) return metrics.storageUsage;
    const lower = storageFilter.toLowerCase();
    return metrics.storageUsage.filter((s) => s.databaseName.toLowerCase().includes(lower));
  }, [metrics, storageFilter]);

  const filteredTables = useMemo(() => {
    if (!metrics) return [];
    if (!tablesFilter) return metrics.largestTables;
    const lower = tablesFilter.toLowerCase();
    return metrics.largestTables.filter((t) => t.databaseName.toLowerCase().includes(lower) || t.tableName.toLowerCase().includes(lower));
  }, [metrics, tablesFilter]);

  const filteredUsers = useMemo(() => {
    if (!metrics) return [];
    if (!usersFilter) return metrics.topUsersByCpu;
    const lower = usersFilter.toLowerCase();
    return metrics.topUsersByCpu.filter((u) => u.userName.toLowerCase().includes(lower));
  }, [metrics, usersFilter]);

  // Max bar width reference for charts
  const maxStoragePerm = metrics?.storageUsage[0]?.currentPerm ?? 1;
  const maxTablePerm = metrics?.largestTables[0]?.currentPerm ?? 1;
  const maxUserCpu = metrics?.topUsersByCpu[0]?.totalCpu ?? 1;

  return (
    <div style={{ height: '100%', overflowY: 'auto', padding: '24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
        <h1 style={{ fontSize: '20px', fontWeight: 600, color: '#F5F5F5', margin: 0 }}>System Overview</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {metrics && (
            <span style={{ fontSize: '12px', color: '#737373' }}>Updated {timeAgo(metrics.fetchedAt)}</span>
          )}
          <button
            type="button"
            onClick={fetch}
            disabled={loading}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              borderRadius: '6px',
              border: '1px solid #333',
              backgroundColor: '#262626',
              color: '#D4D4D4',
              fontSize: '12px',
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.6 : 1,
            }}
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {error && !metrics && (
        <p style={{ fontSize: '13px', color: '#EF4444', marginBottom: '16px' }}>{error}</p>
      )}

      {/* Dashboard grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '16px' }}>
        {/* Connected User + Version */}
        <MetricCard title="Connection" loading={loading && !metrics}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '8px', backgroundColor: '#1A1A1A', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <User size={18} style={{ color: '#F37440' }} />
              </div>
              <div>
                <p style={{ fontSize: '15px', fontWeight: 600, color: '#F5F5F5', margin: 0 }}>
                  {metrics?.currentUser ?? '—'}
                </p>
                <p style={{ fontSize: '11px', color: '#737373', margin: 0 }}>Connected user</p>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', paddingTop: '10px', borderTop: '1px solid #333' }}>
              <span style={{ color: '#A3A3A3' }}>Teradata Version</span>
              <span style={{ color: '#F37440', fontWeight: 600 }}>{metrics?.version ?? '—'}</span>
            </div>
          </div>
        </MetricCard>

        {/* System Health */}
        <MetricCard title="System Health" loading={loading && !metrics}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Storage utilization */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '6px' }}>
                <span style={{ color: '#D4D4D4' }}>Storage Utilization</span>
                <span style={{ color: storageColor, fontWeight: 600 }}>{storagePercent.toFixed(1)}%</span>
              </div>
              <div style={{ height: '8px', backgroundColor: '#1A1A1A', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${Math.min(storagePercent, 100)}%`, backgroundColor: storageColor, borderRadius: '4px', transition: 'width 0.3s' }} />
              </div>
              <div style={{ fontSize: '11px', color: '#737373', marginTop: '4px' }}>
                {formatBytes(totalUsed)} / {formatBytes(totalMax)}
              </div>
            </div>
            {/* CPU skew */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                <span style={{ color: '#D4D4D4' }}>CPU Skew (max/avg)</span>
                <span style={{ color: cpuSkewColor, fontWeight: 600 }}>{cpuSkewRatio.toFixed(1)}x</span>
              </div>
              <span style={{ fontSize: '11px', color: '#737373' }}>
                {cpuSkewRatio > 5 ? 'High skew — investigate top consumer' : cpuSkewRatio > 3 ? 'Moderate skew' : 'Healthy distribution'}
              </span>
            </div>
            {/* Total CPU */}
            <div style={{ paddingTop: '8px', borderTop: '1px solid #333' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                <span style={{ color: '#D4D4D4' }}>Total CPU (logged)</span>
                <span style={{ color: '#D4D4D4', fontWeight: 600 }}>{formatCpu(metrics?.totalCpuTime ?? 0)}</span>
              </div>
            </div>
          </div>
        </MetricCard>

        {/* Storage Usage */}
        <MetricCard title="Storage by Database" loading={loading && !metrics}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <FilterInput value={storageFilter} onChange={(v) => { setStorageFilter(v); setStorageVisible(10); }} placeholder="Filter databases..." />
            {filteredStorage.slice(0, storageVisible).map((s) => {
              const pct = s.maxPerm > 0 ? (s.currentPerm / s.maxPerm) * 100 : 0;
              return (
                <div key={s.databaseName}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '3px' }}>
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={(e) => openMenu(e, 'database', { databaseName: s.databaseName })}
                      onKeyDown={(e) => { if (e.key === 'Enter') openMenu(e as unknown as React.MouseEvent, 'database', { databaseName: s.databaseName }); }}
                      style={{ color: '#D4D4D4', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '60%', cursor: 'pointer', borderRadius: '3px', padding: '0 2px', margin: '0 -2px', transition: 'color 0.15s' }}
                      onMouseEnter={(e) => { e.currentTarget.style.color = '#F37440'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.color = '#D4D4D4'; }}
                    >
                      {s.databaseName}
                    </span>
                    <span style={{ color: '#737373' }}>{formatBytes(s.currentPerm)} ({pct.toFixed(0)}%)</span>
                  </div>
                  <div style={{ height: '6px', backgroundColor: '#1A1A1A', borderRadius: '3px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${(s.currentPerm / maxStoragePerm) * 100}%`, backgroundColor: '#F37440', borderRadius: '3px' }} />
                  </div>
                </div>
              );
            })}
            {(!metrics || filteredStorage.length === 0) && (
              <p style={{ fontSize: '12px', color: '#525252', margin: 0 }}>{storageFilter ? 'No matches' : 'No storage data'}</p>
            )}
            {filteredStorage.length > storageVisible && (
              <button type="button" onClick={() => setStorageVisible((v) => v + 20)} style={loadMoreStyle}>
                Load More ({filteredStorage.length - storageVisible} remaining)
              </button>
            )}
          </div>
        </MetricCard>

        {/* Largest Tables */}
        <MetricCard title="Largest Tables" loading={loading && !metrics}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <FilterInput value={tablesFilter} onChange={(v) => { setTablesFilter(v); setTablesVisible(10); }} placeholder="Filter tables..." />
            {filteredTables.slice(0, tablesVisible).map((t, i) => (
              <div key={`${t.databaseName}.${t.tableName}.${i}`}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '3px' }}>
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={(e) => openMenu(e, 'table', { databaseName: t.databaseName, tableName: t.tableName })}
                    onKeyDown={(e) => { if (e.key === 'Enter') openMenu(e as unknown as React.MouseEvent, 'table', { databaseName: t.databaseName, tableName: t.tableName }); }}
                    style={{ color: '#D4D4D4', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '65%', cursor: 'pointer', borderRadius: '3px', padding: '0 2px', margin: '0 -2px', transition: 'color 0.15s' }}
                    onMouseEnter={(e) => { e.currentTarget.style.color = '#F37440'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.color = '#D4D4D4'; }}
                  >
                    {t.databaseName}.{t.tableName}
                  </span>
                  <span style={{ color: '#737373' }}>{formatBytes(t.currentPerm)}</span>
                </div>
                <div style={{ height: '6px', backgroundColor: '#1A1A1A', borderRadius: '3px', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${(t.currentPerm / maxTablePerm) * 100}%`, backgroundColor: '#3B82F6', borderRadius: '3px' }} />
                </div>
              </div>
            ))}
            {(!metrics || filteredTables.length === 0) && (
              <p style={{ fontSize: '12px', color: '#525252', margin: 0 }}>{tablesFilter ? 'No matches' : 'No table data'}</p>
            )}
            {filteredTables.length > tablesVisible && (
              <button type="button" onClick={() => setTablesVisible((v) => v + 20)} style={loadMoreStyle}>
                Load More ({filteredTables.length - tablesVisible} remaining)
              </button>
            )}
          </div>
        </MetricCard>

        {/* Top Users by CPU */}
        <MetricCard title="Top Users by CPU" loading={loading && !metrics}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <FilterInput value={usersFilter} onChange={(v) => { setUsersFilter(v); setUsersVisible(10); }} placeholder="Filter users..." />
            {filteredUsers.slice(0, usersVisible).map((u) => (
              <div key={u.userName}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '3px' }}>
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={(e) => openMenu(e, 'user', { userName: u.userName })}
                    onKeyDown={(e) => { if (e.key === 'Enter') openMenu(e as unknown as React.MouseEvent, 'user', { userName: u.userName }); }}
                    style={{ color: '#D4D4D4', cursor: 'pointer', borderRadius: '3px', padding: '0 2px', margin: '0 -2px', transition: 'color 0.15s' }}
                    onMouseEnter={(e) => { e.currentTarget.style.color = '#F37440'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.color = '#D4D4D4'; }}
                  >
                    {u.userName}
                  </span>
                  <span style={{ color: '#737373' }}>{formatCpu(u.totalCpu)}</span>
                </div>
                <div style={{ height: '6px', backgroundColor: '#1A1A1A', borderRadius: '3px', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${(u.totalCpu / maxUserCpu) * 100}%`, backgroundColor: '#8B5CF6', borderRadius: '3px' }} />
                </div>
              </div>
            ))}
            {(!metrics || filteredUsers.length === 0) && (
              <p style={{ fontSize: '12px', color: '#525252', margin: 0 }}>{usersFilter ? 'No matches' : 'No query log data'}</p>
            )}
            {filteredUsers.length > usersVisible && (
              <button type="button" onClick={() => setUsersVisible((v) => v + 20)} style={loadMoreStyle}>
                Load More ({filteredUsers.length - usersVisible} remaining)
              </button>
            )}
          </div>
        </MetricCard>
      </div>

      {menuState && (
        <SubagentContextMenu
          options={menuState.options}
          context={menuState.context}
          anchorRect={menuState.anchorRect}
          onClose={() => setMenuState(null)}
        />
      )}
    </div>
  );
}

function FilterInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }): JSX.Element {
  return (
    <div style={{ position: 'relative', marginBottom: '4px' }}>
      <Search size={12} style={{ position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)', color: '#525252', pointerEvents: 'none' }} />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          width: '100%',
          padding: '6px 8px 6px 26px',
          fontSize: '11px',
          backgroundColor: '#1A1A1A',
          border: '1px solid #333',
          borderRadius: '4px',
          color: '#D4D4D4',
          outline: 'none',
          boxSizing: 'border-box',
        }}
      />
    </div>
  );
}

const loadMoreStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px',
  marginTop: '4px',
  border: '1px solid #333',
  borderRadius: '6px',
  backgroundColor: 'transparent',
  color: '#A3A3A3',
  fontSize: '12px',
  cursor: 'pointer',
  transition: 'background-color 0.15s, color 0.15s',
};
