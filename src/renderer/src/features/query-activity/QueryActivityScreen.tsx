import { useEffect, useRef } from 'react';
import { RefreshCw, AlertTriangle } from 'lucide-react';
import { useQueryActivityStore } from '@/store/query-activity-store';
import { useAppStore } from '@/store/app-store';

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const secs = Math.floor(diff / 1000);
  if (secs < 60) return 'just now';
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  return `${hours}h ago`;
}

export function QueryActivityScreen(): JSX.Element {
  const { metrics, loading, error, fetch } = useQueryActivityStore();
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
        <p style={{ fontSize: '14px', margin: 0 }}>Connect to Teradata in Settings to view query activity.</p>
      </div>
    );
  }

  return (
    <div style={{ height: '100%', overflowY: 'auto', padding: '24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
        <h1 style={{ fontSize: '20px', fontWeight: 600, color: '#F5F5F5', margin: 0 }}>Query Activity</h1>
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

      {/* Query table */}
      <div style={{ backgroundColor: '#262626', border: '1px solid #333', borderRadius: '8px', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #333' }}>
              <th style={thStyle}>#</th>
              <th style={{ ...thStyle, textAlign: 'left' }}>SQL</th>
              <th style={thStyle}>User</th>
              <th style={thStyle}>CPU</th>
              <th style={thStyle}>I/O</th>
            </tr>
          </thead>
          <tbody>
            {loading && !metrics && (
              <tr>
                <td colSpan={5} style={{ padding: '32px', textAlign: 'center', color: '#737373', fontSize: '13px' }}>
                  Loading...
                </td>
              </tr>
            )}
            {metrics && metrics.topQueries.length === 0 && (
              <tr>
                <td colSpan={5} style={{ padding: '32px', textAlign: 'center', color: '#525252', fontSize: '13px' }}>
                  No query log data available
                </td>
              </tr>
            )}
            {metrics?.topQueries.map((q, i) => (
              <tr key={i} style={{ borderBottom: i < metrics.topQueries.length - 1 ? '1px solid #333' : 'none' }}>
                <td style={{ ...tdStyle, color: '#525252', textAlign: 'center', width: '40px' }}>{i + 1}</td>
                <td style={tdStyle}>
                  <code style={{ fontSize: '11px', color: '#D4D4D4', fontFamily: 'monospace', whiteSpace: 'pre-wrap', wordBreak: 'break-all', lineHeight: '1.4', display: 'block' }}>
                    {q.queryText}
                  </code>
                </td>
                <td style={{ ...tdStyle, color: '#A3A3A3', textAlign: 'center', whiteSpace: 'nowrap', width: '100px' }}>
                  {q.userName}
                </td>
                <td style={{ ...tdStyle, color: '#F59E0B', textAlign: 'right', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums', width: '80px' }}>
                  {q.cpuTime.toFixed(2)}s
                </td>
                <td style={{ ...tdStyle, color: '#737373', textAlign: 'right', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums', width: '90px' }}>
                  {q.ioCount.toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const thStyle: React.CSSProperties = {
  padding: '10px 12px',
  fontSize: '11px',
  fontWeight: 600,
  color: '#737373',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  textAlign: 'right',
};

const tdStyle: React.CSSProperties = {
  padding: '10px 12px',
  fontSize: '12px',
  verticalAlign: 'top',
};
