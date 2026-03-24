import { z } from 'zod';

export const teradataCredentialsSchema = z.object({
  host: z.string().min(1, 'Host is required'),
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
});

export const claudeApiKeySchema = z
  .string()
  .min(1, 'API key is required')
  .startsWith('sk-', 'API key must start with sk-');

export type TeradataCredentialsInput = z.infer<typeof teradataCredentialsSchema>;
export type ClaudeApiKeyInput = z.infer<typeof claudeApiKeySchema>;
