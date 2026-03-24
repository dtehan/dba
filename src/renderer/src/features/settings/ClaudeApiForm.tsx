import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Eye, EyeOff } from 'lucide-react';
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

const bedrockFormSchema = z.object({
  bearerKey: z.string().min(1, 'Bearer key is required'),
});

type BedrockFormInput = z.infer<typeof bedrockFormSchema>;

type FeedbackState =
  | { type: 'none' }
  | { type: 'test-success' }
  | { type: 'test-error'; message: string }
  | { type: 'save-success' };

export function ClaudeApiForm(): JSX.Element {
  const [showKey, setShowKey] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState<FeedbackState>({ type: 'none' });

  const form = useForm<BedrockFormInput>({
    resolver: zodResolver(bedrockFormSchema),
    defaultValues: { bearerKey: '' },
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

  const handleSave = async (data: BedrockFormInput): Promise<void> => {
    setIsSaving(true);
    setFeedback({ type: 'none' });
    try {
      await getElectronAPI().saveClaudeApiKey(data.bearerKey);
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
        <h2 className="text-lg font-semibold text-[#F5F5F5] mb-4">Claude API (Bedrock)</h2>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSave)} className="space-y-4">
            <FormField
              control={form.control}
              name="bearerKey"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[#F5F5F5]">Bearer Key</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input
                        {...field}
                        type={showKey ? 'text' : 'password'}
                        placeholder="Enter your Bedrock bearer key"
                        className="w-full bg-[#262626] border-[#333333] text-[#F5F5F5] placeholder:text-[#A3A3A3] focus-visible:ring-0 focus-visible:border-[#F37440] pr-12"
                      />
                      <button
                        type="button"
                        onClick={() => setShowKey((v) => !v)}
                        aria-label={showKey ? 'Hide bearer key' : 'Show bearer key'}
                        className="absolute right-0 top-0 h-10 w-10 flex items-center justify-center text-[#A3A3A3] hover:text-[#F5F5F5] transition-colors"
                      >
                        {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </FormControl>
                  <FormMessage />
                  <p className="text-xs text-[#A3A3A3]">
                    Stored securely via OS keychain — never saved in plaintext.
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
                <AlertDescription>Connection successful. Claude API is reachable.</AlertDescription>
              </Alert>
            )}
            {feedback.type === 'test-error' && (
              <Alert variant="destructive">
                <AlertDescription>
                  Connection failed. Check your bearer key and try again.
                </AlertDescription>
              </Alert>
            )}
            {feedback.type === 'save-success' && (
              <Alert className="border-green-500/50 text-green-400 bg-green-500/10">
                <AlertDescription>Bearer key saved securely to your OS keychain.</AlertDescription>
              </Alert>
            )}
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
