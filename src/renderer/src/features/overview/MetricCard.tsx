import type { ReactNode } from 'react';
import { Loader2 } from 'lucide-react';

interface MetricCardProps {
  title: string;
  loading: boolean;
  error?: string | null;
  children: ReactNode;
}

export function MetricCard({ title, loading, error, children }: MetricCardProps): JSX.Element {
  return (
    <div
      style={{
        backgroundColor: '#262626',
        border: '1px solid #333',
        borderRadius: '8px',
        padding: '20px',
      }}
    >
      <h3 style={{ fontSize: '13px', fontWeight: 600, color: '#A3A3A3', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {title}
      </h3>
      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px 0' }}>
          <Loader2 size={20} className="animate-spin" style={{ color: '#737373' }} />
        </div>
      ) : error ? (
        <p style={{ fontSize: '13px', color: '#EF4444', margin: 0 }}>{error}</p>
      ) : (
        children
      )}
    </div>
  );
}
