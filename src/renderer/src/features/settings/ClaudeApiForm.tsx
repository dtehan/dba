import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Eye, EyeOff } from 'lucide-react';
import { claudeApiKeySchema } from '@shared/schemas';
import { getElectronAPI } from '@/lib/ipc';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';

// Wrap scalar schema in an object for react-hook-form compatibility
const claudeApiKeyFormSchema = z.object({
  apiKey: claudeApiKeySchema,
});

type ClaudeApiKeyFormInput = z.infer<typeof claudeApiKeyFormSchema>;

type FeedbackState =
  | { type: 'none' }
  | { type: 'test-success' }
  | { type: 'test-error'; message: string }
  | { type: 'save-success' };

export function ClaudeApiForm(): JSX.Element {
  const [showApiKey, setShowApiKey] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState<FeedbackState>({ type: 'none' });

  const form = useForm<ClaudeApiKeyFormInput>({
    resolver: zodResolver(claudeApiKeyFormSchema),
    defaultValues: { apiKey: '' },
  });

  // Auto-dismiss success alerts after 3 seconds
  useEffect(() => {
    if (feedback.type === 'test-success' || feedback.type === 'save-success') {
      const timer = setTimeout(() => setFeedback({ type: 'none' }), 3000);
      return () => clearTimeout(timer);
    }
  }, [feedback]);

  const handleTestConnection = async (): Promise<void> => {
    setIsTesting(true);
    setFeedback({ type: 'none' });
    try {
      const result = await getElectronAPI().testClaudeConnection();
      if (result.success) {
        setFeedback({ type: 'test-success' });
      } else {
        setFeedback({ type: 'test-error', message: result.error ?? 'Unknown error' });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setFeedback({ type: 'test-error', message });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSaveCredentials = async (data: ClaudeApiKeyFormInput): Promise<void> => {
    setIsSaving(true);
    setFeedback({ type: 'none' });
    try {
      await getElectronAPI().saveClaudeApiKey(data.apiKey);
      setFeedback({ type: 'save-success' });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save API key';
      setFeedback({ type: 'test-error', message });
    } finally {
      setIsSaving(false);
    }
  };

  const isOperationInProgress = isTesting || isSaving;
  const isFormInvalid = !form.formState.isValid && form.formState.isSubmitted;

  return (
    <Card className="border-border bg-surface-card">
      <CardContent className="p-6">
        <h2 className="text-lg font-semibold text-text-primary mb-4">Claude API</h2>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSaveCredentials)} className="space-y-4">
            {/* API Key field */}
            <FormField
              control={form.control}
              name="apiKey"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-text-primary">API Key</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input
                        {...field}
                        type={showApiKey ? 'text' : 'password'}
                        placeholder="sk-ant-..."
                        className="bg-surface-card border-border text-text-primary placeholder:text-text-muted focus-visible:ring-0 focus-visible:border-td-orange pr-12"
                      />
                      <button
                        type="button"
                        onClick={() => setShowApiKey((v) => !v)}
                        aria-label={showApiKey ? 'Hide API key' : 'Show API key'}
                        className="absolute right-0 top-0 h-12 w-12 flex items-center justify-center text-text-muted hover:text-text-primary transition-colors focus-visible:outline-2 focus-visible:outline-td-orange focus-visible:outline-offset-2"
                      >
                        {showApiKey ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </FormControl>
                  <FormMessage />
                  <p className="text-xs text-text-muted">
                    Stored securely via OS keychain — never saved in plaintext.
                  </p>
                </FormItem>
              )}
            />

            {/* Action buttons */}
            <div className="flex gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={handleTestConnection}
                disabled={isOperationInProgress}
                className="border-td-orange text-td-orange hover:bg-td-orange/10 focus-visible:outline-2 focus-visible:outline-td-orange focus-visible:outline-offset-2 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {isTesting ? 'Testing...' : 'Test Connection'}
              </Button>
              <Button
                type="submit"
                disabled={isOperationInProgress || isFormInvalid}
                className="bg-td-orange text-white hover:bg-td-orange-hover active:bg-td-orange-active focus-visible:outline-2 focus-visible:outline-td-orange focus-visible:outline-offset-2 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {isSaving ? 'Saving...' : 'Save Credentials'}
              </Button>
            </div>

            {/* Feedback alerts */}
            {feedback.type === 'test-success' && (
              <Alert className="border-green-500/50 text-green-400 bg-green-500/10">
                <AlertDescription>Connection successful. Ready to use.</AlertDescription>
              </Alert>
            )}
            {feedback.type === 'test-error' && (
              <Alert variant="destructive">
                <AlertDescription>
                  Connection failed. Check your host and credentials, then try again.
                </AlertDescription>
              </Alert>
            )}
            {feedback.type === 'save-success' && (
              <Alert className="border-green-500/50 text-green-400 bg-green-500/10">
                <AlertDescription>
                  Credentials saved securely to your OS keychain.
                </AlertDescription>
              </Alert>
            )}
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
