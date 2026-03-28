import type { StreamdownProps } from 'streamdown';

export const sharedStreamdownProps = {
  shikiTheme: ['github-light', 'github-dark'] as StreamdownProps['shikiTheme'],
  controls: {
    code: { copy: true, download: true },
    table: { copy: true, fullscreen: true },
  },
  lineNumbers: true,
  className: 'assistant-prose',
} satisfies Partial<StreamdownProps>;
