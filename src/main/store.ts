import Store from 'electron-store';

export type LlmProvider = 'bedrock' | 'gemini' | 'azure';
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
    azureEncryptedApiKey: string;
    azureEndpoint: string;
    azureApiVersion: string;
    azureDeployment: string;
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
      azureEncryptedApiKey: '',
      azureEndpoint: 'https://danie-m3uu72y9-francecentral.openai.azure.com/',
      azureApiVersion: '2024-12-01-preview',
      azureDeployment: 'gpt-5.4',
    },
  },
});

export default store;
