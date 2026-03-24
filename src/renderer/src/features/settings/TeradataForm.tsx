import { useState, type FormEvent } from 'react';

type FeedbackState =
  | { type: 'none' }
  | { type: 'success'; message: string }
  | { type: 'error'; message: string };

export function TeradataForm(): JSX.Element {
  const [mcpUrl, setMcpUrl] = useState('http://127.0.0.1:8001/mcp');
  const [isTesting, setIsTesting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState<FeedbackState>({ type: 'none' });

  const handleTest = async (): Promise<void> => {
    setIsTesting(true);
    setFeedback({ type: 'none' });
    try {
      const api = (window as any).electronAPI;
      const result = await api?.testTeradataConnection?.();
      if (result?.success) {
        setFeedback({ type: 'success', message: 'Connection successful. MCP server is reachable.' });
        setTimeout(() => setFeedback({ type: 'none' }), 3000);
      } else {
        setFeedback({ type: 'error', message: result?.error ?? 'Connection failed' });
      }
    } catch (err) {
      setFeedback({ type: 'error', message: err instanceof Error ? err.message : 'Unknown error' });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSave = async (e: FormEvent): Promise<void> => {
    e.preventDefault();
    if (!mcpUrl) return;
    setIsSaving(true);
    setFeedback({ type: 'none' });
    try {
      const api = (window as any).electronAPI;
      await api?.saveTeradataCredentials?.({ host: mcpUrl, username: '', password: '' });
      setFeedback({ type: 'success', message: 'MCP server URL saved.' });
      setTimeout(() => setFeedback({ type: 'none' }), 3000);
    } catch (err) {
      setFeedback({ type: 'error', message: err instanceof Error ? err.message : 'Failed to save' });
    } finally {
      setIsSaving(false);
    }
  };

  const cardStyle: React.CSSProperties = {
    width: '100%',
    backgroundColor: '#262626',
    border: '1px solid #333333',
    borderRadius: '8px',
    padding: '24px',
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    height: '40px',
    padding: '8px 12px',
    backgroundColor: '#1A1A1A',
    border: '1px solid #333333',
    borderRadius: '6px',
    color: '#F5F5F5',
    fontFamily: '"Cascadia Code", ui-monospace, Menlo, Monaco, monospace',
    fontSize: '14px',
    outline: 'none',
    boxSizing: 'border-box' as const,
  };

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: '14px',
    fontWeight: 500,
    color: '#F5F5F5',
    marginBottom: '6px',
  };

  const btnOutline: React.CSSProperties = {
    height: '36px',
    padding: '0 16px',
    border: '1px solid #F37440',
    borderRadius: '6px',
    backgroundColor: 'transparent',
    color: '#F37440',
    fontSize: '14px',
    cursor: 'pointer',
  };

  const btnFilled: React.CSSProperties = {
    height: '36px',
    padding: '0 16px',
    border: 'none',
    borderRadius: '6px',
    backgroundColor: '#F37440',
    color: 'white',
    fontSize: '14px',
    cursor: 'pointer',
  };

  return (
    <div style={cardStyle}>
      <h2 style={{ fontSize: '18px', fontWeight: 600, color: '#F5F5F5', marginBottom: '16px' }}>
        Teradata Connection
      </h2>
      <form onSubmit={handleSave}>
        <div style={{ marginBottom: '16px' }}>
          <label style={labelStyle}>MCP Server URL</label>
          <input
            type="text"
            value={mcpUrl}
            onChange={(e) => setMcpUrl(e.target.value)}
            placeholder="http://127.0.0.1:8001/mcp"
            style={inputStyle}
          />
          <p style={{ fontSize: '12px', color: '#A3A3A3', marginTop: '6px' }}>
            The Teradata MCP server handles database authentication. Run it separately with your credentials.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
          <button type="button" onClick={handleTest} disabled={isTesting} style={btnOutline}>
            {isTesting ? 'Testing...' : 'Test Connection'}
          </button>
          <button type="submit" disabled={isSaving} style={btnFilled}>
            {isSaving ? 'Saving...' : 'Save'}
          </button>
        </div>
        {feedback.type === 'success' && (
          <p style={{ marginTop: '12px', color: '#22C55E', fontSize: '14px' }}>{feedback.message}</p>
        )}
        {feedback.type === 'error' && (
          <p style={{ marginTop: '12px', color: '#EF4444', fontSize: '14px' }}>{feedback.message}</p>
        )}
      </form>
    </div>
  );
}
