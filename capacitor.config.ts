import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.ebr.modmanager',
  appName: 'EBR Mod Manager',
  webDir: 'build',
  plugins: {
    CapacitorHttp: {
      enabled: true,
    },
  },
  server: {
    // During development, point the native app at the Vite dev server
    // so you get hot-reload on the phone. Comment this out for production builds.
    // url: 'http://10.0.2.2:5173',  // Android emulator -> host machine
    // cleartext: true,
  },
};

export default config;
