import { useState, useEffect, type FormEvent } from 'react';
import { Eye, EyeOff } from 'lucide-react';

type FeedbackState =
  | { type: 'none' }
  | { type: 'success'; message: string }
  | { type: 'error'; message: string };

export function ClaudeApiForm(): JSX.Element {
  const [bearerKey, setBearerKey] = useState('');
  const [region, setRegion] = useState('us-west-2');
  const [showKey, setShowKey] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState<FeedbackState>({ type: 'none' });

  useEffect(() => {
    // Load saved region
    const api = (window as any).electronAPI;
    api?.loadBedrockRegion?.().then((r: string | null) => {
      if (r) setRegion(r);
    }).catch(() => {});
  }, []);

  const handleTest = async (): Promise<void> => {
    setIsTesting(true);
    setFeedback({ type: 'none' });
    try {
      const api = (window as any).electronAPI;
      const result = await api?.testClaudeConnection?.();
      if (result?.success) {
        setFeedback({ type: 'success', message: 'Connection successful. Claude API is reachable.' });
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
    if (!bearerKey) return;
    setIsSaving(true);
    setFeedback({ type: 'none' });
    try {
      const api = (window as any).electronAPI;
      await api?.saveClaudeApiKey?.(bearerKey);
      await api?.saveBedrockRegion?.(region);
      setFeedback({ type: 'success', message: 'Bearer key and region saved securely.' });
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
    padding: '8px 40px 8px 12px',
    backgroundColor: '#1A1A1A',
    border: '1px solid #333333',
    borderRadius: '6px',
    color: '#F5F5F5',
    fontSize: '14px',
    outline: 'none',
    boxSizing: 'border-box' as const,
  };

  const selectStyle: React.CSSProperties = {
    width: '100%',
    height: '40px',
    padding: '8px 12px',
    backgroundColor: '#1A1A1A',
    border: '1px solid #333333',
    borderRadius: '6px',
    color: '#F5F5F5',
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
        Claude API (Bedrock)
      </h2>
      <form onSubmit={handleSave}>
        <div style={{ marginBottom: '16px' }}>
          <label style={labelStyle}>AWS Region</label>
          <select
            value={region}
            onChange={(e) => setRegion(e.target.value)}
            style={selectStyle}
          >
            <option value="us-west-2">us-west-2 (Oregon)</option>
            <option value="us-east-1">us-east-1 (N. Virginia)</option>
            <option value="eu-west-1">eu-west-1 (Ireland)</option>
            <option value="ap-southeast-1">ap-southeast-1 (Singapore)</option>
            <option value="ap-northeast-1">ap-northeast-1 (Tokyo)</option>
          </select>
        </div>

        <div style={{ marginBottom: '16px' }}>
          <label style={labelStyle}>Bearer Key</label>
          <div style={{ position: 'relative' }}>
            <input
              type={showKey ? 'text' : 'password'}
              value={bearerKey}
              onChange={(e) => setBearerKey(e.target.value)}
              placeholder="Enter your Bedrock bearer key"
              style={inputStyle}
            />
            <button
              type="button"
              onClick={() => setShowKey((v) => !v)}
              aria-label={showKey ? 'Hide bearer key' : 'Show bearer key'}
              style={{
                position: 'absolute',
                right: 0,
                top: 0,
                height: '40px',
                width: '40px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'none',
                border: 'none',
                color: '#A3A3A3',
                cursor: 'pointer',
              }}
            >
              {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          <p style={{ fontSize: '12px', color: '#A3A3A3', marginTop: '6px' }}>
            Stored securely via OS keychain — never saved in plaintext.
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
