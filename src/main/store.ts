import Store from 'electron-store';

interface StoreSchema {
  teradata: {
    host: string;
    encryptedUsername: string;
    encryptedPassword: string;
  };
  claude: {
    encryptedApiKey: string;
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
  },
});

export default store;
