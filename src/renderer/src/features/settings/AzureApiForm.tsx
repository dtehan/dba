import { useState, useEffect, type FormEvent } from 'react';
import { Eye, EyeOff } from 'lucide-react';

type FeedbackState =
  | { type: 'none' }
  | { type: 'success'; message: string }
  | { type: 'error'; message: string };

const DEFAULT_ENDPOINT = 'https://danie-m3uu72y9-francecentral.openai.azure.com/';
const DEFAULT_API_VERSION = '2024-12-01-preview';
const DEFAULT_DEPLOYMENT = 'gpt-5.4';

export function AzureApiForm(): JSX.Element {
  const [endpoint, setEndpoint] = useState(DEFAULT_ENDPOINT);
  const [apiVersion, setApiVersion] = useState(DEFAULT_API_VERSION);
  const [deployment, setDeployment] = useState(DEFAULT_DEPLOYMENT);
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState<FeedbackState>({ type: 'none' });
  const [hasStoredKey, setHasStoredKey] = useState(false);
  const [keyEdited, setKeyEdited] = useState(false);

  useEffect(() => {
    const api = (window as any).electronAPI;
    api?.loadAzureConfig?.().then((cfg: { endpoint: string; apiVersion: string; deployment: string }) => {
      if (cfg?.endpoint) setEndpoint(cfg.endpoint);
      if (cfg?.apiVersion) setApiVersion(cfg.apiVersion);
      if (cfg?.deployment) setDeployment(cfg.deployment);
    }).catch(() => {});
    api?.loadAzureKeyHint?.().then((hint: string | null) => {
      if (hint) {
        setApiKey(hint);
        setHasStoredKey(true);
      }
    }).catch(() => {});
  }, []);

  const saveAll = async (): Promise<void> => {
    const api = (window as any).electronAPI;
    await api?.saveAzureConfig?.({ endpoint, apiVersion, deployment });
    if (keyEdited && apiKey) {
      await api?.saveAzureApiKey?.(apiKey);
    }
  };

  const handleTest = async (): Promise<void> => {
    setIsTesting(true);
    setFeedback({ type: 'none' });
    try {
      await saveAll();
      const api = (window as any).electronAPI;
      const result = await api?.testAzureConnection?.();

      if (result?.success) {
        setFeedback({ type: 'success', message: 'Connection successful. Azure OpenAI is reachable.' });
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
    if (!hasStoredKey && !apiKey) return;
    setIsSaving(true);
    setFeedback({ type: 'none' });
    try {
      await saveAll();
      setFeedback({ type: 'success', message: 'Azure configuration saved.' });
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

  return (
    <div style={cardStyle}>
      <h2 style={{ fontSize: '18px', fontWeight: 600, color: '#F5F5F5', marginBottom: '16px' }}>Microsoft Azure OpenAI</h2>
      <form onSubmit={handleSave}>
        <div style={{ marginBottom: '16px' }}>
          <label style={labelStyle}>Azure Endpoint</label>
          <input
            type="text"
            value={endpoint}
            onChange={(e) => setEndpoint(e.target.value)}
            placeholder="https://your-resource.openai.azure.com/"
            style={inputStyle}
          />
          <p style={helperStyle}>Your Azure OpenAI resource endpoint. Found in the Azure Portal under Keys and Endpoint.</p>
        </div>

        <div style={{ marginBottom: '16px' }}>
          <label style={labelStyle}>API Version</label>
          <input
            type="text"
            value={apiVersion}
            onChange={(e) => setApiVersion(e.target.value)}
            placeholder="2024-12-01-preview"
            style={inputStyle}
          />
          <p style={helperStyle}>Azure OpenAI REST API version. Use a preview version to access newer features.</p>
        </div>

        <div style={{ marginBottom: '16px' }}>
          <label style={labelStyle}>Deployment Name</label>
          <input
            type="text"
            value={deployment}
            onChange={(e) => setDeployment(e.target.value)}
            placeholder="gpt-5.4"
            style={{ ...inputStyle, fontFamily: 'monospace' }}
          />
          <p style={helperStyle}>The Azure deployment name (not a model ID). Azure routes requests by deployment.</p>
        </div>

        <div style={{ marginBottom: '16px' }}>
          <label style={labelStyle}>API Key</label>
          <div style={{ position: 'relative' }}>
            <input
              type={showKey ? 'text' : 'password'}
              value={apiKey}
              onFocus={() => { if (hasStoredKey && !keyEdited) { setApiKey(''); setKeyEdited(true); } }}
              onChange={(e) => { setApiKey(e.target.value); setKeyEdited(true); }}
              placeholder="Paste your Azure OpenAI API key"
              style={{ ...inputStyle, paddingRight: '40px' }}
            />
            <button
              type="button"
              onClick={() => setShowKey((v) => !v)}
              aria-label={showKey ? 'Hide' : 'Show'}
              style={{ position: 'absolute', right: 0, top: 0, height: '40px', width: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'none', border: 'none', color: '#A3A3A3', cursor: 'pointer' }}
            >
              {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          <p style={helperStyle}>Stored securely via OS keychain. Get your key from Azure Portal -&gt; your Azure OpenAI resource -&gt; Keys and Endpoint.</p>
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
