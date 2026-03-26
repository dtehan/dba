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
    <div className="border-t border-surface-border bg-[#1A1A1A] px-4 py-4">
      <div className="max-w-3xl mx-auto w-full flex gap-2 items-end">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          placeholder="Message DBA Agent... (Shift+Enter for new line)"
          rows={1}
          className="flex-1 bg-[#262626] border border-surface-border rounded-xl px-4 py-3 text-text-primary text-sm font-[inherit] leading-relaxed resize-none outline-none max-h-[200px] overflow-y-auto focus:border-td-orange transition-colors duration-200"
        />
        {isStreaming ? (
          <Button
            type="button"
            onClick={handleStop}
            variant="outline"
            size="icon"
            className="shrink-0 border-red-500 text-red-500 bg-transparent hover:bg-red-500/10"
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
            className="shrink-0 bg-td-orange text-white hover:bg-td-orange/90"
            aria-label="Send message"
          >
            <Send size={16} />
          </Button>
        )}
      </div>
    </div>
  );
}
