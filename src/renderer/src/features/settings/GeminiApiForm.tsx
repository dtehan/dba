import { useState, useEffect, type FormEvent } from 'react';
import { Eye, EyeOff } from 'lucide-react';

type AuthMethod = 'api-key' | 'gcloud';

type FeedbackState =
  | { type: 'none' }
  | { type: 'success'; message: string }
  | { type: 'error'; message: string };

export function GeminiApiForm(): JSX.Element {
  const [authMethod, setAuthMethod] = useState<AuthMethod>('api-key');
  const [apiKey, setApiKey] = useState('');
  const [modelId, setModelId] = useState('gemini-2.5-flash');
  const [project, setProject] = useState('');
  const [location, setLocation] = useState('us-central1');
  const [accessToken, setAccessToken] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState<FeedbackState>({ type: 'none' });
  const [hasStoredKey, setHasStoredKey] = useState(false);
  const [keyEdited, setKeyEdited] = useState(false);
  const [hasStoredToken, setHasStoredToken] = useState(false);
  const [tokenEdited, setTokenEdited] = useState(false);

  useEffect(() => {
    const api = (window as any).electronAPI;
    api?.loadGeminiModel?.().then((m: string) => {
      if (m) setModelId(m);
    }).catch(() => {});
    api?.loadGeminiKeyHint?.().then((hint: string | null) => {
      if (hint) {
        setApiKey(hint);
        setHasStoredKey(true);
      }
    }).catch(() => {});
    api?.loadGeminiAuthMethod?.().then((m: AuthMethod) => {
      if (m) setAuthMethod(m);
    }).catch(() => {});
    api?.loadGeminiGcloudConfig?.().then((cfg: { project: string; location: string }) => {
      if (cfg?.project) setProject(cfg.project);
      if (cfg?.location) setLocation(cfg.location);
    }).catch(() => {});
    api?.loadGeminiGcloudTokenHint?.().then((hint: string | null) => {
      if (hint) {
        setAccessToken(hint);
        setHasStoredToken(true);
      }
    }).catch(() => {});
  }, []);

  const handleAuthMethodChange = async (method: AuthMethod): Promise<void> => {
    setAuthMethod(method);
    setFeedback({ type: 'none' });
    const api = (window as any).electronAPI;
    await api?.saveGeminiAuthMethod?.(method);
    await api?.recheckConnections?.();
  };

  const saveAll = async (): Promise<void> => {
    const api = (window as any).electronAPI;
    await api?.saveGeminiAuthMethod?.(authMethod);
    await api?.saveGeminiModel?.(modelId);

    if (authMethod === 'api-key') {
      if (keyEdited && apiKey) {
        await api?.saveGeminiApiKey?.(apiKey);
      }
    } else {
      await api?.saveGeminiGcloudConfig?.({ project, location });
      if (tokenEdited && accessToken) {
        await api?.saveGeminiGcloudToken?.(accessToken);
      }
    }
  };

  const handleTest = async (): Promise<void> => {
    setIsTesting(true);
    setFeedback({ type: 'none' });
    try {
      await saveAll();
      const api = (window as any).electronAPI;
      const result = authMethod === 'gcloud'
        ? await api?.testGeminiGcloud?.()
        : await api?.testGeminiConnection?.();

      if (result?.success) {
        setFeedback({ type: 'success', message: 'Connection successful. Gemini API is reachable.' });
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
    if (authMethod === 'api-key' && !hasStoredKey && !apiKey) return;
    if (authMethod === 'gcloud' && (!project || (!hasStoredToken && !accessToken))) return;
    setIsSaving(true);
    setFeedback({ type: 'none' });
    try {
      await saveAll();
      setFeedback({ type: 'success', message: 'Gemini configuration saved.' });
      setTimeout(() => setFeedback({ type: 'none' }), 3000);
    } catch (err) {
      setFeedback({ type: 'error', message: err instanceof Error ? err.message : 'Failed to save' });
    } finally {
      setIsSaving(false);
    }
  };

  const cardStyle: React.CSSProperties = { width: '100%', backgroundColor: '#262626', border: '1px solid #333333', borderRadius: '8px', padding: '24px' };
  const inputStyle: React.CSSProperties = { width: '100%', height: '40px', padding: '8px 12px', backgroundColor: '#1A1A1A', border: '1px solid #333333', borderRadius: '6px', color: '#F5F5F5', fontSize: '14px', outline: 'none', boxSizing: 'border-box' as const };
  const labelStyle: React.CSSProperties = { display: 'block', fontSize: '14px', fontWeight: 500, color: '#F5F5F5', marginBottom: '6px' };
  const helperStyle: React.CSSProperties = { fontSize: '12px', color: '#A3A3A3', marginTop: '4px' };
  const btnOutline: React.CSSProperties = { height: '36px', padding: '0 16px', border: '1px solid #F37440', borderRadius: '6px', backgroundColor: 'transparent', color: '#F37440', fontSize: '14px', cursor: 'pointer' };
  const btnFilled: React.CSSProperties = { height: '36px', padding: '0 16px', border: 'none', borderRadius: '6px', backgroundColor: '#F37440', color: 'white', fontSize: '14px', cursor: 'pointer' };
  const tabStyle = (active: boolean): React.CSSProperties => ({
    flex: 1,
    padding: '8px 12px',
    border: active ? '1px solid #F37440' : '1px solid #333333',
    borderRadius: '6px',
    backgroundColor: active ? 'rgba(243, 116, 64, 0.1)' : 'transparent',
    color: active ? '#F37440' : '#A3A3A3',
    fontSize: '13px',
    fontWeight: 500,
    cursor: 'pointer',
    textAlign: 'center' as const,
  });

  return (
    <div style={cardStyle}>
      <h2 style={{ fontSize: '18px', fontWeight: 600, color: '#F5F5F5', marginBottom: '16px' }}>Google Gemini</h2>
      <form onSubmit={handleSave}>
        {/* Auth method toggle */}
        <div style={{ marginBottom: '16px' }}>
          <label style={labelStyle}>Authentication Method</label>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button type="button" onClick={() => handleAuthMethodChange('api-key')} style={tabStyle(authMethod === 'api-key')}>API Key</button>
            <button type="button" onClick={() => handleAuthMethodChange('gcloud')} style={tabStyle(authMethod === 'gcloud')}>Google Cloud (gcloud)</button>
          </div>
        </div>

        {/* API Key fields */}
        {authMethod === 'api-key' && (
          <div style={{ marginBottom: '16px' }}>
            <label style={labelStyle}>API Key</label>
            <div style={{ position: 'relative' }}>
              <input
                type={showKey ? 'text' : 'password'}
                value={apiKey}
                onFocus={() => { if (hasStoredKey && !keyEdited) { setApiKey(''); setKeyEdited(true); } }}
                onChange={(e) => { setApiKey(e.target.value); setKeyEdited(true); }}
                placeholder="AIzaSy..."
                style={{ ...inputStyle, paddingRight: '40px' }}
              />
              <button type="button" onClick={() => setShowKey((v) => !v)} aria-label={showKey ? 'Hide' : 'Show'} style={{ position: 'absolute', right: 0, top: 0, height: '40px', width: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'none', border: 'none', color: '#A3A3A3', cursor: 'pointer' }}>
                {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            <p style={helperStyle}>Stored securely via OS keychain. Get your key from Google AI Studio.</p>
          </div>
        )}

        {/* gcloud fields */}
        {authMethod === 'gcloud' && (
          <>
            <div style={{ marginBottom: '12px', padding: '12px', backgroundColor: '#1A1A1A', border: '1px solid #333333', borderRadius: '6px' }}>
              <p style={{ fontSize: '13px', color: '#A3A3A3', margin: 0, marginBottom: '8px' }}>
                Run these commands in your terminal, then paste the access token below:
              </p>
              <pre style={{ fontSize: '13px', color: '#F37440', fontFamily: 'monospace', lineHeight: 1.6, margin: 0, whiteSpace: 'pre' }}>{'gcloud auth login\ngcloud auth print-access-token'}</pre>
              <p style={{ fontSize: '12px', color: '#A3A3A3', margin: 0, marginTop: '8px' }}>
                Note: Access tokens expire after ~60 minutes. Re-paste a new token when it expires.
              </p>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={labelStyle}>Access Token</label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showToken ? 'text' : 'password'}
                  value={accessToken}
                  onFocus={() => { if (hasStoredToken && !tokenEdited) { setAccessToken(''); setTokenEdited(true); } }}
                  onChange={(e) => { setAccessToken(e.target.value); setTokenEdited(true); }}
                  placeholder="ya29.a0ARrdaM..."
                  style={{ ...inputStyle, paddingRight: '40px', fontFamily: 'monospace' }}
                />
                <button type="button" onClick={() => setShowToken((v) => !v)} aria-label={showToken ? 'Hide' : 'Show'} style={{ position: 'absolute', right: 0, top: 0, height: '40px', width: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'none', border: 'none', color: '#A3A3A3', cursor: 'pointer' }}>
                  {showToken ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <p style={helperStyle}>Output of <code style={{ color: '#F37440' }}>gcloud auth print-access-token</code>. Stored securely via OS keychain.</p>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={labelStyle}>GCP Project ID</label>
              <input
                type="text"
                value={project}
                onChange={(e) => setProject(e.target.value)}
                placeholder="my-gcp-project-id"
                style={{ ...inputStyle, fontFamily: 'monospace' }}
              />
              <p style={helperStyle}>Your Google Cloud project with Vertex AI API enabled.</p>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={labelStyle}>Location</label>
              <select value={location} onChange={(e) => setLocation(e.target.value)} style={inputStyle}>
                <option value="us-central1">us-central1 (Iowa)</option>
                <option value="us-east4">us-east4 (N. Virginia)</option>
                <option value="us-west1">us-west1 (Oregon)</option>
                <option value="us-west4">us-west4 (Las Vegas)</option>
                <option value="europe-west1">europe-west1 (Belgium)</option>
                <option value="europe-west4">europe-west4 (Netherlands)</option>
                <option value="asia-northeast1">asia-northeast1 (Tokyo)</option>
                <option value="asia-southeast1">asia-southeast1 (Singapore)</option>
              </select>
            </div>
          </>
        )}

        {/* Model selector (shared) */}
        <div style={{ marginBottom: '16px' }}>
          <label style={labelStyle}>Model</label>
          <select value={modelId} onChange={(e) => setModelId(e.target.value)} style={inputStyle}>
            <option value="gemini-2.5-flash">Gemini 2.5 Flash (fast, recommended)</option>
            <option value="gemini-2.5-pro">Gemini 2.5 Pro (most capable)</option>
            <option value="gemini-2.0-flash">Gemini 2.0 Flash</option>
          </select>
        </div>

        <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
          <button type="button" onClick={handleTest} disabled={isTesting} style={btnOutline}>{isTesting ? 'Testing...' : 'Test Connection'}</button>
          <button type="submit" disabled={isSaving} style={btnFilled}>{isSaving ? 'Saving...' : 'Save'}</button>
        </div>
        {feedback.type === 'success' && <p style={{ marginTop: '12px', color: '#22C55E', fontSize: '14px' }}>{feedback.message}</p>}
        {feedback.type === 'error' && <p style={{ marginTop: '12px', color: '#EF4444', fontSize: '14px' }}>{feedback.message}</p>}
      </form>
    </div>
  );
}
