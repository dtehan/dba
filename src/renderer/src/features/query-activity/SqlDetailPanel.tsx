import { useState, useEffect } from 'react';
import { X, Copy, Check, Play, Zap, Loader2 } from 'lucide-react';
import { Light as SyntaxHighlighter } from 'react-syntax-highlighter';
import sql from 'react-syntax-highlighter/dist/esm/languages/hljs/sql';
import { atomOneDark } from 'react-syntax-highlighter/dist/esm/styles/hljs';
import { getElectronAPI } from '@/lib/ipc';
import { launchSubagent } from '@/lib/launch-subagent';
import { format } from 'date-fns';

SyntaxHighlighter.registerLanguage('sql', sql);

interface QueryRow {
  queryText: string;
  userName: string;
  cpuTime: number;
  ioCount: number;
  elapsedTime: number;
  startTime: string;
  queryId?: string;
  procId?: string;
}

interface SqlDetailPanelProps {
  query: QueryRow | null;
  onClose: () => void;
}

// Small helper for metadata items
function MetaItem({ label, value, style }: { label: string; value: string; style?: React.CSSProperties }): JSX.Element {
  return (
    <div style={style}>
      <div style={{ fontSize: '10px', color: '#525252', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '2px' }}>{label}</div>
      <div style={{ fontSize: '13px', color: '#D4D4D4', fontVariantNumeric: 'tabular-nums' }}>{value}</div>
    </div>
  );
}

export function SqlDetailPanel({ query, onClose }: SqlDetailPanelProps): JSX.Element {
  const [fullSql, setFullSql] = useState<string | null>(null);
  const [sqlLoading, setSqlLoading] = useState(false);
  const [sqlError, setSqlError] = useState<string | null>(null);
  const [explainResult, setExplainResult] = useState<string | null>(null);
  const [explainLoading, setExplainLoading] = useState(false);
  const [explainError, setExplainError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Fetch full SQL when query changes
  useEffect(() => {
    if (!query) {
      setFullSql(null);
      setExplainResult(null);
      setExplainError(null);
      setSqlError(null);
      return;
    }
    setSqlLoading(true);
    setSqlError(null);
    setFullSql(null);
    setExplainResult(null);
    setExplainError(null);

    if (!query.queryId || !query.procId) {
      // No IDs — use truncated text as fallback
      setFullSql(query.queryText);
      setSqlLoading(false);
      return;
    }

    getElectronAPI()
      .fetchFullSql(query.queryId, query.procId)
      .then((result) => {
        if (result.success && result.sql) {
          setFullSql(result.sql);
        } else {
          setSqlError(result.error ?? 'Failed to fetch full SQL');
          setFullSql(query.queryText); // fallback to truncated
        }
      })
      .catch((err) => {
        setSqlError(err instanceof Error ? err.message : 'Failed to fetch full SQL');
        setFullSql(query.queryText);
      })
      .finally(() => setSqlLoading(false));
  }, [query?.queryId, query?.procId]);

  // Copy handler
  const handleCopy = async (): Promise<void> => {
    if (!fullSql) return;
    await navigator.clipboard.writeText(fullSql);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  // EXPLAIN handler
  const handleExplain = async (): Promise<void> => {
    if (!fullSql) return;
    setExplainLoading(true);
    setExplainError(null);
    setExplainResult(null);
    try {
      const result = await getElectronAPI().explainQuery(fullSql);
      if (result.success && result.explain) {
        // Parse the JSON result — callMcpTool returns a JSON string
        try {
          const parsed = JSON.parse(result.explain) as unknown;
          const rows =
            parsed !== null && typeof parsed === 'object' && 'results' in (parsed as object)
              ? (parsed as { results: unknown }).results
              : Array.isArray(parsed)
                ? parsed
                : null;
          if (rows && Array.isArray(rows)) {
            setExplainResult(
              rows
                .map((r: Record<string, unknown>) => {
                  const vals = Object.values(r);
                  return vals.join(' ');
                })
                .join('\n'),
            );
          } else if (typeof parsed === 'string') {
            setExplainResult(parsed);
          } else {
            setExplainResult(JSON.stringify(parsed, null, 2));
          }
        } catch {
          // Not JSON — display raw
          setExplainResult(result.explain);
        }
      } else {
        setExplainError(result.error ?? 'EXPLAIN failed');
      }
    } catch (err) {
      setExplainError(err instanceof Error ? err.message : 'EXPLAIN failed');
    } finally {
      setExplainLoading(false);
    }
  };

  // Analyze handler — launches query-performance subagent
  const handleAnalyze = async (): Promise<void> => {
    if (!fullSql) return;
    await launchSubagent('query-performance', 'Query Performance', { queryText: fullSql });
  };

  // Format start time
  const formatStartTime = (st: string): string => {
    if (!st) return '\u2014';
    const d = new Date(st);
    return isNaN(d.getTime()) ? st : format(d, 'MMM d, HH:mm:ss');
  };

  return (
    <div
      style={{
        width: query ? '40%' : '0',
        minWidth: query ? '360px' : '0',
        maxWidth: query ? '560px' : '0',
        overflow: query ? 'auto' : 'hidden',
        transition: 'width 0.2s ease, min-width 0.2s ease, max-width 0.2s ease',
        borderLeft: query ? '1px solid #333' : 'none',
        backgroundColor: '#1A1A1A',
        flexShrink: 0,
      }}
    >
      {query && (
        <div style={{ padding: '16px' }}>
          {/* Close button */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '16px',
            }}
          >
            <span style={{ fontSize: '13px', fontWeight: 600, color: '#F5F5F5' }}>Query Detail</span>
            <button
              type="button"
              onClick={onClose}
              style={{
                background: 'none',
                border: 'none',
                color: '#737373',
                cursor: 'pointer',
                padding: '4px',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <X size={16} />
            </button>
          </div>

          {/* Metadata header (QADH-06) */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '8px',
              marginBottom: '16px',
              padding: '12px',
              backgroundColor: '#262626',
              borderRadius: '6px',
              border: '1px solid #333',
            }}
          >
            <MetaItem label="Username" value={query.userName} />
            <MetaItem label="CPU Time" value={`${query.cpuTime.toFixed(2)}s`} />
            <MetaItem label="I/O Count" value={query.ioCount.toLocaleString()} />
            <MetaItem label="Elapsed" value={`${query.elapsedTime.toFixed(2)}s`} />
            <MetaItem
              label="Start Time"
              value={formatStartTime(query.startTime)}
              style={{ gridColumn: 'span 2' }}
            />
          </div>

          {/* Action buttons (QADH-08, QADH-09) */}
          <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
            <button
              type="button"
              onClick={handleExplain}
              disabled={!fullSql || explainLoading || sqlLoading}
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                padding: '8px 12px',
                borderRadius: '6px',
                border: '1px solid #333',
                backgroundColor: '#262626',
                color: '#D4D4D4',
                fontSize: '12px',
                fontWeight: 500,
                cursor: !fullSql || explainLoading || sqlLoading ? 'not-allowed' : 'pointer',
                opacity: !fullSql || explainLoading || sqlLoading ? 0.5 : 1,
              }}
            >
              {explainLoading ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
              Explain Plan
            </button>
            <button
              type="button"
              onClick={handleAnalyze}
              disabled={!fullSql || sqlLoading}
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                padding: '8px 12px',
                borderRadius: '6px',
                border: '1px solid #F37440',
                backgroundColor: '#F37440',
                color: '#FFFFFF',
                fontSize: '12px',
                fontWeight: 500,
                cursor: !fullSql || sqlLoading ? 'not-allowed' : 'pointer',
                opacity: !fullSql || sqlLoading ? 0.5 : 1,
              }}
            >
              <Zap size={14} />
              Analyze
            </button>
          </div>

          {/* Full SQL (QADH-05) */}
          <div style={{ marginBottom: '16px' }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '8px',
              }}
            >
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  color: '#737373',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}
              >
                SQL
              </span>
              <button
                type="button"
                onClick={handleCopy}
                disabled={!fullSql}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '2px 8px',
                  borderRadius: '4px',
                  border: '1px solid #333',
                  backgroundColor: 'transparent',
                  color: copied ? '#22C55E' : '#737373',
                  fontSize: '11px',
                  cursor: fullSql ? 'pointer' : 'not-allowed',
                }}
              >
                {copied ? <Check size={12} /> : <Copy size={12} />}
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
            {sqlLoading ? (
              <div style={{ padding: '16px', textAlign: 'center', color: '#737373', fontSize: '12px' }}>
                Loading SQL...
              </div>
            ) : sqlError && !fullSql ? (
              <div
                style={{
                  padding: '12px',
                  color: '#EF4444',
                  fontSize: '12px',
                  backgroundColor: '#262626',
                  borderRadius: '6px',
                }}
              >
                {sqlError}
              </div>
            ) : fullSql ? (
              <SyntaxHighlighter
                language="sql"
                style={atomOneDark}
                customStyle={{
                  margin: 0,
                  borderRadius: '6px',
                  fontSize: '12px',
                  background: '#262626',
                  padding: '12px',
                  maxHeight: '300px',
                  overflow: 'auto',
                }}
                wrapLongLines
              >
                {fullSql}
              </SyntaxHighlighter>
            ) : null}
          </div>

          {/* EXPLAIN output (QADH-08) */}
          {(explainResult !== null || explainError !== null || explainLoading) && (
            <div>
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  color: '#737373',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  display: 'block',
                  marginBottom: '8px',
                }}
              >
                Explain Plan
              </span>
              {explainLoading ? (
                <div
                  style={{ padding: '16px', textAlign: 'center', color: '#737373', fontSize: '12px' }}
                >
                  <Loader2
                    size={14}
                    className="animate-spin"
                    style={{ display: 'inline', marginRight: '6px' }}
                  />
                  Running EXPLAIN...
                </div>
              ) : explainError ? (
                <div
                  style={{
                    padding: '12px',
                    color: '#EF4444',
                    fontSize: '12px',
                    backgroundColor: '#262626',
                    borderRadius: '6px',
                    border: '1px solid #333',
                  }}
                >
                  {explainError}
                </div>
              ) : explainResult ? (
                <pre
                  style={{
                    margin: 0,
                    padding: '12px',
                    backgroundColor: '#262626',
                    borderRadius: '6px',
                    border: '1px solid #333',
                    fontSize: '11px',
                    lineHeight: '1.5',
                    color: '#D4D4D4',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    maxHeight: '400px',
                    overflow: 'auto',
                    fontFamily: 'monospace',
                  }}
                >
                  {explainResult}
                </pre>
              ) : null}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
