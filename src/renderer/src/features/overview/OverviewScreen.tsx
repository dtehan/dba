import { useEffect, useRef } from 'react';
import { RefreshCw, AlertTriangle, User } from 'lucide-react';
import { useOverviewStore } from '@/store/overview-store';
import { useAppStore } from '@/store/app-store';
import { MetricCard } from './MetricCard';
import { formatBytes } from './formatBytes';

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

export function OverviewScreen(): JSX.Element {
  const { metrics, loading, error, fetch } = useOverviewStore();
  const teradataStatus = useAppStore((s) => s.connectionStatus.teradata);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

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
            {metrics?.storageUsage.slice(0, 10).map((s) => {
              const pct = s.maxPerm > 0 ? (s.currentPerm / s.maxPerm) * 100 : 0;
              return (
                <div key={s.databaseName}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '3px' }}>
                    <span style={{ color: '#D4D4D4', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '60%' }}>{s.databaseName}</span>
                    <span style={{ color: '#737373' }}>{formatBytes(s.currentPerm)} ({pct.toFixed(0)}%)</span>
                  </div>
                  <div style={{ height: '6px', backgroundColor: '#1A1A1A', borderRadius: '3px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${(s.currentPerm / maxStoragePerm) * 100}%`, backgroundColor: '#F37440', borderRadius: '3px' }} />
                  </div>
                </div>
              );
            })}
            {(!metrics || metrics.storageUsage.length === 0) && (
              <p style={{ fontSize: '12px', color: '#525252', margin: 0 }}>No storage data</p>
            )}
          </div>
        </MetricCard>

        {/* Largest Tables */}
        <MetricCard title="Largest Tables" loading={loading && !metrics}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {metrics?.largestTables.slice(0, 10).map((t, i) => (
              <div key={`${t.databaseName}.${t.tableName}.${i}`}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '3px' }}>
                  <span style={{ color: '#D4D4D4', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '65%' }}>
                    {t.databaseName}.{t.tableName}
                  </span>
                  <span style={{ color: '#737373' }}>{formatBytes(t.currentPerm)}</span>
                </div>
                <div style={{ height: '6px', backgroundColor: '#1A1A1A', borderRadius: '3px', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${(t.currentPerm / maxTablePerm) * 100}%`, backgroundColor: '#3B82F6', borderRadius: '3px' }} />
                </div>
              </div>
            ))}
            {(!metrics || metrics.largestTables.length === 0) && (
              <p style={{ fontSize: '12px', color: '#525252', margin: 0 }}>No table data</p>
            )}
          </div>
        </MetricCard>

        {/* Top Users by CPU */}
        <MetricCard title="Top Users by CPU" loading={loading && !metrics}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {metrics?.topUsersByCpu.map((u) => (
              <div key={u.userName}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '3px' }}>
                  <span style={{ color: '#D4D4D4' }}>{u.userName}</span>
                  <span style={{ color: '#737373' }}>{formatCpu(u.totalCpu)}</span>
                </div>
                <div style={{ height: '6px', backgroundColor: '#1A1A1A', borderRadius: '3px', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${(u.totalCpu / maxUserCpu) * 100}%`, backgroundColor: '#8B5CF6', borderRadius: '3px' }} />
                </div>
              </div>
            ))}
            {(!metrics || metrics.topUsersByCpu.length === 0) && (
              <p style={{ fontSize: '12px', color: '#525252', margin: 0 }}>No query log data</p>
            )}
          </div>
        </MetricCard>
      </div>
    </div>
  );
}
