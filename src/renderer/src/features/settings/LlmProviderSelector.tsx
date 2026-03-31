import { useState, useEffect } from 'react';

type Provider = 'bedrock' | 'gemini';

interface Props {
  value: Provider;
  onChange: (provider: Provider) => void;
}

export function LlmProviderSelector({ value, onChange }: Props): JSX.Element {
  const handleChange = async (provider: Provider): Promise<void> => {
    onChange(provider);
    const api = (window as any).electronAPI;
    await api?.saveLlmProvider?.(provider);
    await api?.recheckConnections?.();
  };

  const cardStyle: React.CSSProperties = { width: '100%', backgroundColor: '#262626', border: '1px solid #333333', borderRadius: '8px', padding: '24px' };
  const optionStyle = (selected: boolean): React.CSSProperties => ({
    flex: 1,
    padding: '12px 16px',
    border: selected ? '2px solid #F37440' : '2px solid #333333',
    borderRadius: '8px',
    backgroundColor: selected ? 'rgba(243, 116, 64, 0.1)' : '#1A1A1A',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  });

  return (
    <div style={cardStyle}>
      <h2 style={{ fontSize: '18px', fontWeight: 600, color: '#F5F5F5', marginBottom: '16px' }}>LLM Provider</h2>
      <div style={{ display: 'flex', gap: '12px' }}>
        <button type="button" onClick={() => handleChange('bedrock')} style={optionStyle(value === 'bedrock')}>
          <div style={{ fontSize: '14px', fontWeight: 600, color: '#F5F5F5', marginBottom: '4px' }}>Claude (AWS Bedrock)</div>
          <div style={{ fontSize: '12px', color: '#A3A3A3' }}>Anthropic Claude via AWS Bedrock</div>
        </button>
        <button type="button" onClick={() => handleChange('gemini')} style={optionStyle(value === 'gemini')}>
          <div style={{ fontSize: '14px', fontWeight: 600, color: '#F5F5F5', marginBottom: '4px' }}>Google Gemini</div>
          <div style={{ fontSize: '12px', color: '#A3A3A3' }}>Google Gemini via Google AI API</div>
        </button>
      </div>
    </div>
  );
}

export function useLlmProvider(): [Provider, (p: Provider) => void] {
  const [provider, setProvider] = useState<Provider>('bedrock');

  useEffect(() => {
    const api = (window as any).electronAPI;
    api?.loadLlmProvider?.().then((p: Provider) => {
      if (p) setProvider(p);
    }).catch(() => {});
  }, []);

  return [provider, setProvider];
}
