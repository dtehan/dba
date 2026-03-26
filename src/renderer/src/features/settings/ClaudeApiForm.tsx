import { useState, useEffect, type FormEvent } from 'react';
import { Eye, EyeOff } from 'lucide-react';

type FeedbackState =
  | { type: 'none' }
  | { type: 'success'; message: string }
  | { type: 'error'; message: string };

export function ClaudeApiForm(): JSX.Element {
  const [accessKeyId, setAccessKeyId] = useState('');
  const [secretKey, setSecretKey] = useState('');
  const [roleArn, setRoleArn] = useState('');
  const [modelId, setModelId] = useState('');
  const [region, setRegion] = useState('us-west-2');
  const [showSecret, setShowSecret] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState<FeedbackState>({ type: 'none' });
  const [hasStoredKeys, setHasStoredKeys] = useState(false);
  const [keysEdited, setKeysEdited] = useState(false);

  useEffect(() => {
    const api = (window as any).electronAPI;
    api?.loadBedrockRegion?.().then((r: string | null) => {
      if (r) setRegion(r);
    }).catch(() => {});
    api?.loadBedrockConfig?.().then((cfg: any) => {
      if (cfg?.roleArn) setRoleArn(cfg.roleArn);
      if (cfg?.modelId) setModelId(cfg.modelId);
    }).catch(() => {});
    api?.loadClaudeKeyHints?.().then((hints: { accessKeyId: string; secretKey: string } | null) => {
      if (hints) {
        setAccessKeyId(hints.accessKeyId);
        setSecretKey(hints.secretKey);
        setHasStoredKeys(true);
      }
    }).catch(() => {});
  }, []);

  const saveAll = async (): Promise<void> => {
    const api = (window as any).electronAPI;
    // Only save keys if user entered new values (not the masked hints)
    if (keysEdited && accessKeyId && secretKey) {
      await api?.saveClaudeApiKey?.(JSON.stringify({ accessKeyId, secretKey }));
    }
    await api?.saveBedrockRegion?.(region);
    await api?.saveBedrockConfig?.({ roleArn, modelId });
  };

  const handleTest = async (): Promise<void> => {
    setIsTesting(true);
    setFeedback({ type: 'none' });
    try {
      await saveAll();
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
    if (!hasStoredKeys && (!accessKeyId || !secretKey)) return;
    setIsSaving(true);
    setFeedback({ type: 'none' });
    try {
      await saveAll();
      setFeedback({ type: 'success', message: 'AWS credentials saved securely.' });
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
      <h2 style={{ fontSize: '18px', fontWeight: 600, color: '#F5F5F5', marginBottom: '16px' }}>Claude API (Bedrock)</h2>
      <form onSubmit={handleSave}>
        <div style={{ marginBottom: '16px' }}>
          <label style={labelStyle}>AWS Region</label>
          <select value={region} onChange={(e) => setRegion(e.target.value)} style={inputStyle}>
            <option value="us-west-2">us-west-2 (Oregon)</option>
            <option value="us-east-1">us-east-1 (N. Virginia)</option>
            <option value="eu-west-1">eu-west-1 (Ireland)</option>
            <option value="ap-southeast-1">ap-southeast-1 (Singapore)</option>
            <option value="ap-northeast-1">ap-northeast-1 (Tokyo)</option>
          </select>
        </div>

        <div style={{ marginBottom: '16px' }}>
          <label style={labelStyle}>AWS Access Key ID</label>
          <input type="text" value={accessKeyId} onFocus={() => { if (hasStoredKeys && !keysEdited) { setAccessKeyId(''); setSecretKey(''); setKeysEdited(true); } }} onChange={(e) => { setAccessKeyId(e.target.value); setKeysEdited(true); }} placeholder="AKIA..." style={inputStyle} />
        </div>

        <div style={{ marginBottom: '16px' }}>
          <label style={labelStyle}>AWS Secret Access Key</label>
          <div style={{ position: 'relative' }}>
            <input type={showSecret ? 'text' : 'password'} value={secretKey} onFocus={() => { if (hasStoredKeys && !keysEdited) { setAccessKeyId(''); setSecretKey(''); setKeysEdited(true); } }} onChange={(e) => { setSecretKey(e.target.value); setKeysEdited(true); }} placeholder="Enter your AWS secret access key" style={{ ...inputStyle, paddingRight: '40px' }} />
            <button type="button" onClick={() => setShowSecret((v) => !v)} aria-label={showSecret ? 'Hide' : 'Show'} style={{ position: 'absolute', right: 0, top: 0, height: '40px', width: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'none', border: 'none', color: '#A3A3A3', cursor: 'pointer' }}>
              {showSecret ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          <p style={helperStyle}>Both keys stored securely via OS keychain.</p>
        </div>

        <div style={{ marginBottom: '16px' }}>
          <label style={labelStyle}>Role ARN (optional)</label>
          <input type="text" value={roleArn} onChange={(e) => setRoleArn(e.target.value)} placeholder="arn:aws:iam::123456789:role/BedrockAccess" style={{ ...inputStyle, fontFamily: 'monospace' }} />
          <p style={helperStyle}>If you need to assume a role to access Bedrock. Leave blank if your keys have direct access.</p>
        </div>

        <div style={{ marginBottom: '16px' }}>
          <label style={labelStyle}>Model / Inference Profile ID</label>
          <input type="text" value={modelId} onChange={(e) => setModelId(e.target.value)} placeholder="arn:aws:bedrock:us-west-2:123456789:inference-profile/..." style={{ ...inputStyle, fontFamily: 'monospace' }} />
          <p style={helperStyle}>Inference profile ARN or cross-region model ID. Required if on-demand invocation is not enabled.</p>
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
