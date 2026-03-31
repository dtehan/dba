import Store from 'electron-store';

export type LlmProvider = 'bedrock' | 'gemini';
export type GeminiAuthMethod = 'api-key' | 'gcloud';

interface StoreSchema {
  teradata: {
    host: string;
    encryptedUsername: string;
    encryptedPassword: string;
  };
  claude: {
    encryptedApiKey: string;
  };
  llm: {
    provider: LlmProvider;
    geminiEncryptedApiKey: string;
    geminiModel: string;
    geminiAuthMethod: GeminiAuthMethod;
    geminiProject: string;
    geminiLocation: string;
    geminiEncryptedGcloudToken: string;
  };
}

const store = new Store<StoreSchema>({
  name: 'teradata-dba-agent',
  defaults: {
    teradata: {
      host: '',
      encryptedUsername: '',
      encryptedPassword: '',
    },
    claude: {
      encryptedApiKey: '',
    },
    llm: {
      provider: 'bedrock',
      geminiEncryptedApiKey: '',
      geminiModel: '',
      geminiAuthMethod: 'api-key',
      geminiProject: '',
      geminiLocation: 'us-central1',
      geminiEncryptedGcloudToken: '',
    },
  },
});

export default store;
