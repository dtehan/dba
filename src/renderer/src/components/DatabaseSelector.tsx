import { useState, useEffect } from 'react';
import { Database, ChevronDown, Loader2, AlertCircle } from 'lucide-react';
import { getElectronAPI } from '@/lib/ipc';
import { useChatStore } from '@/store/chat-store';

export function DatabaseSelector(): JSX.Element {
  const [databases, setDatabases] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activeDatabaseName = useChatStore((s) => s.activeDatabaseName);

  useEffect(() => {
    getElectronAPI()
      .listDatabases()
      .then((result) => {
        if (result.success && result.databases) {
          setDatabases(result.databases);
        } else if (!result.success) {
          setError(result.error ?? 'Failed to load databases');
        }
      })
      .catch(() => {
        setError('MCP server unavailable');
      });
  }, []);

  const handleSelectDatabase = async (db: string): Promise<void> => {
    setIsOpen(false);
    setIsLoading(true);
    setError(null);

    useChatStore.getState().setActiveDatabaseName(db);

    try {
      const result = await getElectronAPI().fetchSchemaContext(db);
      if (result.success && result.context) {
        useChatStore.getState().setSchemaContext(result.context);
      } else {
        useChatStore.getState().setSchemaContext(null);
        setError(result.error ?? 'Failed to fetch schema');
      }
    } catch {
      useChatStore.getState().setSchemaContext(null);
      setError('Failed to fetch schema context');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div>
      {/* Section header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          padding: '8px 16px',
          color: '#A3A3A3',
          fontSize: '12px',
          fontWeight: 600,
          letterSpacing: '0.05em',
          textTransform: 'uppercase',
        }}
      >
        <Database size={14} />
        <span>Database</span>
      </div>

      {/* Selector button */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          width: 'calc(100% - 16px)',
          margin: '0 8px',
          padding: '8px 12px',
          backgroundColor: '#262626',
          border: '1px solid #333333',
          borderRadius: '8px',
          cursor: 'pointer',
          color: activeDatabaseName ? '#F5F5F5' : '#A3A3A3',
          fontSize: '13px',
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: 1, minWidth: 0 }}>
          {isLoading && (
            <Loader2 size={13} style={{ flexShrink: 0, animation: 'spin 1s linear infinite', color: '#A3A3A3' }} />
          )}
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {activeDatabaseName ?? 'Select database...'}
          </span>
        </span>
        <ChevronDown size={14} style={{ color: '#A3A3A3', flexShrink: 0 }} />
      </button>

      {/* Dropdown list */}
      {isOpen && (
        <div
          style={{
            backgroundColor: '#262626',
            border: '1px solid #333333',
            borderRadius: '8px',
            margin: '4px 8px 0',
            maxHeight: '200px',
            overflowY: 'auto',
          }}
        >
          {databases.length === 0 && !error && (
            <p style={{ fontSize: '13px', color: '#A3A3A3', padding: '8px 12px', margin: 0 }}>
              No databases found
            </p>
          )}
          {databases.map((db) => (
            <button
              key={db}
              type="button"
              onClick={() => handleSelectDatabase(db)}
              style={{
                display: 'block',
                width: '100%',
                padding: '6px 12px',
                cursor: 'pointer',
                fontSize: '13px',
                color: activeDatabaseName === db ? '#F37440' : '#F5F5F5',
                fontWeight: activeDatabaseName === db ? 600 : 400,
                background: 'none',
                border: 'none',
                textAlign: 'left',
              }}
              className="hover:bg-[#333333]"
            >
              {db}
            </button>
          ))}
        </div>
      )}

      {/* Error message */}
      {error && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            fontSize: '11px',
            color: '#EF4444',
            padding: '4px 8px',
            margin: '0 8px',
          }}
        >
          <AlertCircle size={12} style={{ flexShrink: 0 }} />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
