import { useRef, useState } from 'react';
import { Send, Square } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getElectronAPI } from '@/lib/ipc';

interface ChatInputProps {
  isStreaming: boolean;
  onSubmit: (content: string) => void;
}

export function ChatInput({ isStreaming, onSubmit }: ChatInputProps): JSX.Element {
  const [value, setValue] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = () => {
    const trimmed = value.trim();
    if (!trimmed || isStreaming) return;
    onSubmit(trimmed);
    setValue('');
    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
    // Shift+Enter: allow default newline behavior
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setValue(e.target.value);
    // Auto-grow textarea
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 200) + 'px';
  };

  const handleStop = () => {
    try {
      getElectronAPI().abortChat();
    } catch {
      // ignore if not in Electron
    }
  };

  return (
    <div
      style={{
        padding: '16px',
        borderTop: '1px solid #333333',
        backgroundColor: '#1A1A1A',
        display: 'flex',
        gap: '8px',
        alignItems: 'flex-end',
      }}
    >
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleInput}
        onKeyDown={handleKeyDown}
        placeholder="Message DBA Agent... (Shift+Enter for new line)"
        rows={1}
        style={{
          flex: 1,
          backgroundColor: '#262626',
          border: '1px solid #333333',
          borderRadius: '12px',
          padding: '12px 16px',
          color: '#F5F5F5',
          resize: 'none',
          width: '100%',
          fontSize: '14px',
          fontFamily: 'inherit',
          outline: 'none',
          lineHeight: '1.5',
          maxHeight: '200px',
          overflowY: 'auto',
        }}
        onFocus={(e) => { e.target.style.borderColor = '#F37440'; }}
        onBlur={(e) => { e.target.style.borderColor = '#333333'; }}
      />
      {isStreaming ? (
        <Button
          type="button"
          onClick={handleStop}
          variant="outline"
          size="icon"
          style={{
            border: '1px solid #EF4444',
            color: '#EF4444',
            backgroundColor: 'transparent',
            flexShrink: 0,
          }}
          aria-label="Stop generation"
        >
          <Square size={16} />
        </Button>
      ) : (
        <Button
          type="button"
          onClick={handleSubmit}
          size="icon"
          disabled={!value.trim()}
          style={{
            backgroundColor: '#F37440',
            color: '#FFFFFF',
            flexShrink: 0,
          }}
          aria-label="Send message"
        >
          <Send size={16} />
        </Button>
      )}
    </div>
  );
}
