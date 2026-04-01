import { useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Terminal, Shield, BarChart3, Database, Activity, Search, Lock, HeartPulse, Copy, ScanSearch } from 'lucide-react';
import { useSubagentStore } from '@/store/subagent-store';
import { launchSubagent } from '@/lib/launch-subagent';
import type { SubagentOption, ObjectContext } from '@/lib/subagent-mapping';

const ICON_MAP: Record<string, React.ComponentType<{ size?: number; style?: React.CSSProperties }>> = {
  Terminal, Shield, BarChart3, Database, Activity, Search, Lock, HeartPulse, Copy, ScanSearch,
};

interface SubagentContextMenuProps {
  options: SubagentOption[];
  context: ObjectContext;
  anchorRect: DOMRect;
  onClose: () => void;
  /** Optional async function to resolve the final context before launching (e.g., fetch full SQL) */
  resolveContext?: (context: ObjectContext) => Promise<ObjectContext>;
}

export function SubagentContextMenu({ options, context, anchorRect, onClose, resolveContext }: SubagentContextMenuProps): JSX.Element {
  const { agents, loaded, load } = useSubagentStore();
  const menuRef = useRef<HTMLDivElement>(null);
  const focusedIndex = useRef(-1);

  useEffect(() => {
    if (!loaded) load();
  }, [loaded, load]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        focusedIndex.current = Math.min(focusedIndex.current + 1, options.length - 1);
        const items = menuRef.current?.querySelectorAll<HTMLButtonElement>('[data-menu-item]');
        items?.[focusedIndex.current]?.focus();
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        focusedIndex.current = Math.max(focusedIndex.current - 1, 0);
        const items = menuRef.current?.querySelectorAll<HTMLButtonElement>('[data-menu-item]');
        items?.[focusedIndex.current]?.focus();
      }
    },
    [onClose, options.length],
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Compute position — prefer below, flip above if near viewport bottom
  const menuHeight = options.length * 36 + 16; // estimate
  const spaceBelow = window.innerHeight - anchorRect.bottom;
  const placeAbove = spaceBelow < menuHeight && anchorRect.top > menuHeight;

  const top = placeAbove ? anchorRect.top - menuHeight : anchorRect.bottom + 4;
  const left = Math.min(anchorRect.left, window.innerWidth - 240);

  const handleSelect = async (option: SubagentOption): Promise<void> => {
    onClose();
    const resolved = resolveContext ? await resolveContext(context) : context;
    const params = option.buildParams(resolved);
    await launchSubagent(option.agentId, option.label, params);
  };

  const getAgentIcon = (agentId: string): string => {
    const agent = agents.find((a) => a.id === agentId);
    return agent?.icon ?? 'Terminal';
  };

  return createPortal(
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 50,
        }}
      />
      {/* Menu */}
      <div
        ref={menuRef}
        style={{
          position: 'fixed',
          top,
          left,
          zIndex: 51,
          minWidth: '200px',
          maxWidth: '280px',
          backgroundColor: '#262626',
          border: '1px solid #404040',
          borderRadius: '8px',
          padding: '4px',
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)',
        }}
      >
        <div style={{ padding: '6px 10px 4px', fontSize: '10px', color: '#737373', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Run Analysis
        </div>
        {options.map((option) => {
          const iconName = getAgentIcon(option.agentId);
          const Icon = ICON_MAP[iconName] ?? Terminal;
          return (
            <button
              key={option.agentId}
              type="button"
              data-menu-item
              onClick={() => handleSelect(option)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                width: '100%',
                padding: '8px 10px',
                background: 'none',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                textAlign: 'left',
                color: '#F5F5F5',
                fontSize: '13px',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#333';
                e.currentTarget.style.color = '#F37440';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
                e.currentTarget.style.color = '#F5F5F5';
              }}
              onFocus={(e) => {
                e.currentTarget.style.backgroundColor = '#333';
                e.currentTarget.style.color = '#F37440';
              }}
              onBlur={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
                e.currentTarget.style.color = '#F5F5F5';
              }}
            >
              <Icon size={14} style={{ flexShrink: 0, opacity: 0.7 }} />
              <span>{option.label}</span>
            </button>
          );
        })}
      </div>
    </>,
    document.body,
  );
}
