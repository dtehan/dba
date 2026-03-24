import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
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

const mcpUrlSchema = z.object({
  mcpUrl: z.string().url('Must be a valid URL').min(1, 'MCP Server URL is required'),
});

type McpUrlInput = z.infer<typeof mcpUrlSchema>;

type FeedbackState =
  | { type: 'none' }
  | { type: 'test-success' }
  | { type: 'test-error'; message: string }
  | { type: 'save-success' };

export function TeradataForm(): JSX.Element {
  const [isTesting, setIsTesting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState<FeedbackState>({ type: 'none' });

  const form = useForm<McpUrlInput>({
    resolver: zodResolver(mcpUrlSchema),
    defaultValues: { mcpUrl: 'http://127.0.0.1:8001/mcp' },
  });

  // Load existing MCP URL on mount
  useEffect(() => {
    getElectronAPI()
      .loadTeradataHost()
      .then((url) => {
        if (url) {
          form.setValue('mcpUrl', url);
        }
      })
      .catch(() => {});
  }, [form]);

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
      const result = await getElectronAPI().testTeradataConnection();
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

  const handleSave = async (data: McpUrlInput): Promise<void> => {
    setIsSaving(true);
    setFeedback({ type: 'none' });
    try {
      await getElectronAPI().saveTeradataCredentials({
        host: data.mcpUrl,
        username: '',
        password: '',
      });
      setFeedback({ type: 'save-success' });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save';
      setFeedback({ type: 'test-error', message });
    } finally {
      setIsSaving(false);
    }
  };

  const isOperationInProgress = isTesting || isSaving;

  return (
    <Card className="w-full border-[#333333] bg-[#262626]">
      <CardContent className="p-6">
        <h2 className="text-lg font-semibold text-[#F5F5F5] mb-4">Teradata Connection</h2>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSave)} className="space-y-4">
            <FormField
              control={form.control}
              name="mcpUrl"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[#F5F5F5]">MCP Server URL</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="http://127.0.0.1:8001/mcp"
                      className="w-full font-mono bg-[#262626] border-[#333333] text-[#F5F5F5] placeholder:text-[#A3A3A3] focus-visible:ring-0 focus-visible:border-[#F37440]"
                    />
                  </FormControl>
                  <FormMessage />
                  <p className="text-xs text-[#A3A3A3]">
                    The Teradata MCP server handles database authentication. Run it separately with your credentials.
                  </p>
                </FormItem>
              )}
            />

            <div className="flex gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={handleTestConnection}
                disabled={isOperationInProgress}
                className="border-[#F37440] text-[#F37440] hover:bg-[#F37440]/10 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {isTesting ? 'Testing...' : 'Test Connection'}
              </Button>
              <Button
                type="submit"
                disabled={isOperationInProgress}
                className="bg-[#F37440] text-white hover:bg-[#E55C20] active:bg-[#CC4A10] disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {isSaving ? 'Saving...' : 'Save'}
              </Button>
            </div>

            {feedback.type === 'test-success' && (
              <Alert className="border-green-500/50 text-green-400 bg-green-500/10">
                <AlertDescription>Connection successful. MCP server is reachable.</AlertDescription>
              </Alert>
            )}
            {feedback.type === 'test-error' && (
              <Alert variant="destructive">
                <AlertDescription>
                  Connection failed. Check that the MCP server is running at the specified URL.
                </AlertDescription>
              </Alert>
            )}
            {feedback.type === 'save-success' && (
              <Alert className="border-green-500/50 text-green-400 bg-green-500/10">
                <AlertDescription>MCP server URL saved.</AlertDescription>
              </Alert>
            )}
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
