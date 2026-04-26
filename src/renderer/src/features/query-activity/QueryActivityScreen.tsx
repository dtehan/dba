import { useState, useEffect, useMemo } from 'react';
import { RefreshCw, AlertTriangle, Search, ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';
import { useQueryActivityStore } from '@/store/query-activity-store';
import { useAppStore } from '@/store/app-store';
import { format, isValid } from 'date-fns';
import type { SortColumn, TimeRange } from '@shared/types';
import { SqlDetailPanel } from './SqlDetailPanel';

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const secs = Math.floor(diff / 1000);
  if (secs < 60) return 'just now';
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  return `${hours}h ago`;
}

function SortIcon({ col, currentSortCol, currentSortDir }: { col: SortColumn; currentSortCol: SortColumn; currentSortDir: string }): JSX.Element {
  if (col !== currentSortCol) return <ArrowUpDown size={12} style={{ color: '#525252' }} />;
  return currentSortDir === 'ASC'
    ? <ArrowUp size={12} style={{ color: '#F37440' }} />
    : <ArrowDown size={12} style={{ color: '#F37440' }} />;
}

const TIME_PRESETS: { label: string; value: TimeRange }[] = [
  { label: 'Last 1 hour', value: '1h' },
  { label: 'Last 4 hours', value: '4h' },
  { label: 'Today', value: 'today' },
  { label: 'Yesterday', value: 'yesterday' },
  { label: 'Last 7 days', value: '7d' },
];

function formatStartTime(raw: string): string {
  const d = new Date(raw);
  if (!isValid(d)) return raw;
  return format(d, 'MMM d, HH:mm');
}

export function QueryActivityScreen(): JSX.Element {
  const { metrics, loading, error, fetch, sortCol, sortDir, timeRange, toggleSort, setTimeRange } = useQueryActivityStore();
  const teradataStatus = useAppStore((s) => s.connectionStatus.teradata);
  const [queryFilter, setQueryFilter] = useState('');
  const [selectedQuery, setSelectedQuery] = useState<{ queryText: string; userName: string; cpuTime: number; ioCount: number; elapsedTime: number; startTime: string; queryId?: string; procId?: string } | null>(null);

  const filteredQueries = useMemo(() => {
    if (!metrics) return [];
    if (!queryFilter) return metrics.topQueries;
    const lower = queryFilter.toLowerCase();
    return metrics.topQueries.filter(
      (q) => q.queryText.toLowerCase().includes(lower) || q.userName.toLowerCase().includes(lower)
    );
  }, [metrics, queryFilter]);

  const isConnected = teradataStatus === 'connected';

  // Initial fetch when connected
  useEffect(() => {
    if (isConnected) fetch();
  }, [isConnected]);

  // Re-fetch when sort or time range changes
  useEffect(() => {
    if (isConnected) fetch();
  }, [sortCol, sortDir, timeRange]);

  // Auto-close panel when sort column or time range changes
  useEffect(() => {
    setSelectedQuery(null);
  }, [sortCol, timeRange]);

  if (!isConnected) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '12px', color: '#737373' }}>
        <AlertTriangle size={32} />
        <p style={{ fontSize: '14px', margin: 0 }}>Connect to Teradata in Settings to view query activity.</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
      {/* Table side */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '24px', minWidth: 0, transition: 'flex 0.2s ease' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
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

        {/* Text filter */}
        <div style={{ position: 'relative', marginBottom: '10px' }}>
          <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#525252', pointerEvents: 'none' }} />
          <input
            type="text"
            value={queryFilter}
            onChange={(e) => setQueryFilter(e.target.value)}
            placeholder="Filter by SQL or username..."
            style={{
              width: '100%',
              padding: '8px 12px 8px 30px',
              fontSize: '12px',
              backgroundColor: '#262626',
              border: '1px solid #333',
              borderRadius: '6px',
              color: '#D4D4D4',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
        </div>

        {/* Time range preset buttons */}
        <div style={{ display: 'flex', gap: '6px', marginBottom: '14px', flexWrap: 'wrap' }}>
          {TIME_PRESETS.map((preset) => (
            <button
              key={preset.value}
              type="button"
              onClick={() => setTimeRange(preset.value)}
              style={{
                backgroundColor: '#262626',
                padding: '4px 12px',
                borderRadius: '4px',
                fontSize: '11px',
                cursor: 'pointer',
                border: timeRange === preset.value ? '1px solid #F37440' : '1px solid #333',
                color: timeRange === preset.value ? '#F37440' : '#A3A3A3',
              }}
            >
              {preset.label}
            </button>
          ))}
        </div>

        {/* Data table */}
        <div style={{ backgroundColor: '#262626', border: '1px solid #333', borderRadius: '8px', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #333' }}>
                <th style={{ ...thStyle, textAlign: 'center', width: '40px' }}>#</th>
                <th style={{ ...thStyle, textAlign: 'left', width: '100px' }}>Username</th>
                <th
                  style={{ ...thStyle, cursor: 'pointer', userSelect: 'none' }}
                  onClick={() => toggleSort('AmpCPUTime')}
                >
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                    CPU Time <SortIcon col="AmpCPUTime" currentSortCol={sortCol} currentSortDir={sortDir} />
                  </span>
                </th>
                <th
                  style={{ ...thStyle, cursor: 'pointer', userSelect: 'none' }}
                  onClick={() => toggleSort('TotalIOCount')}
                >
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                    I/O Count <SortIcon col="TotalIOCount" currentSortCol={sortCol} currentSortDir={sortDir} />
                  </span>
                </th>
                <th style={{ ...thStyle, width: '90px' }}>Elapsed</th>
                <th style={{ ...thStyle, textAlign: 'left', width: '140px' }}>Start Time</th>
                <th style={{ ...thStyle, textAlign: 'left' }}>SQL</th>
              </tr>
            </thead>
            <tbody>
              {loading && !metrics && (
                <tr>
                  <td colSpan={7} style={{ padding: '32px', textAlign: 'center', color: '#737373', fontSize: '13px' }}>
                    Loading...
                  </td>
                </tr>
              )}
              {metrics && filteredQueries.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ padding: '32px', textAlign: 'center', color: '#525252', fontSize: '13px' }}>
                    {queryFilter ? 'No matches' : 'No query log data available'}
                  </td>
                </tr>
              )}
              {filteredQueries.map((q, i) => {
                const isSelected =
                  selectedQuery !== null &&
                  ((q.queryId !== undefined && q.procId !== undefined && q.queryId === selectedQuery.queryId && q.procId === selectedQuery.procId) ||
                    (q.queryText === selectedQuery.queryText && q.userName === selectedQuery.userName && i === filteredQueries.indexOf(selectedQuery as typeof q)));
                return (
                  <tr
                    key={i}
                    style={{
                      borderBottom: i < filteredQueries.length - 1 ? '1px solid #333' : 'none',
                      backgroundColor: isSelected ? '#2A2A2A' : 'transparent',
                      cursor: 'pointer',
                      transition: 'background-color 0.15s',
                    }}
                    onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.backgroundColor = '#2A2A2A'; }}
                    onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.backgroundColor = 'transparent'; }}
                  >
                    <td style={{ ...tdStyle, color: '#525252', textAlign: 'center', width: '40px' }}>{i + 1}</td>
                    <td style={{ ...tdStyle, color: '#A3A3A3', whiteSpace: 'nowrap', width: '100px' }}>
                      {q.userName}
                    </td>
                    <td style={{ ...tdStyle, color: '#F59E0B', textAlign: 'right', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums', width: '90px' }}>
                      {q.cpuTime.toFixed(2)}s
                    </td>
                    <td style={{ ...tdStyle, color: '#737373', textAlign: 'right', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums', width: '90px' }}>
                      {q.ioCount.toLocaleString()}
                    </td>
                    <td style={{ ...tdStyle, color: '#737373', textAlign: 'right', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums', width: '90px' }}>
                      {q.elapsedTime.toFixed(2)}s
                    </td>
                    <td style={{ ...tdStyle, color: '#737373', whiteSpace: 'nowrap', width: '140px' }}>
                      {formatStartTime(q.startTime)}
                    </td>
                    <td
                      style={{ ...tdStyle, cursor: 'pointer' }}
                      onClick={() => setSelectedQuery(q)}
                    >
                      <code style={{
                        fontSize: '11px',
                        color: isSelected ? '#F37440' : '#D4D4D4',
                        fontFamily: 'monospace',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        display: 'block',
                        maxWidth: '100%',
                        lineHeight: '1.4',
                      }}>
                        {q.queryText}
                      </code>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      <SqlDetailPanel
        query={selectedQuery}
        onClose={() => setSelectedQuery(null)}
      />
    </div>
  );
}

const thStyle: React.CSSProperties = {
  padding: '8px 12px',
  fontSize: '11px',
  fontWeight: 600,
  color: '#737373',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  textAlign: 'right',
  whiteSpace: 'nowrap',
};

const tdStyle: React.CSSProperties = {
  padding: '6px 12px',
  fontSize: '12px',
  verticalAlign: 'middle',
};
