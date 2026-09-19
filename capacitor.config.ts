import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.donapaty.tienda',
  appName: 'tienda',
  webDir: 'www',

  server: {
    androidScheme: 'https',
    cleartext: true
  },

  android: {
    allowMixedContent: true,
    webContentsDebuggingEnabled: true
  },
  plugins: {
    CapacitorUpdater: {
      autoUpdate: false,
      resetWhenUpdate: false
    },
    StatusBar: {
      style: 'LIGHT',
      backgroundColor: '#fff7fc'
    },
    SocialLogin: {
      providers: { google: true, facebook: false, apple: false, twitter: false }
    }
  }
};

export default config;
