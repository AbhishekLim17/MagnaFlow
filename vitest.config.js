import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

// Unit/component tests. The Firestore rules tests live in tests/ and run
// against the emulator via `npm run test:rules`; they're excluded here so a
// plain `npm test` never needs Java.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.js'],
    include: ['src/**/*.{test,spec}.{js,jsx}'],
    exclude: ['node_modules', 'dist', 'tests/**'],
    // Placeholder Firebase config. Tests must not talk to a real project, but
    // a module that merely *imports* src/config/firebase.js runs getAuth() at
    // import time, which throws auth/invalid-api-key when the values are
    // missing. Developers have a .env.local so it passes locally and fails
    // only in CI — a trap that has cost a red build. Pinning dummy values
    // here makes `npm test` behave identically everywhere.
    env: {
      VITE_FIREBASE_API_KEY: 'test-api-key',
      VITE_FIREBASE_AUTH_DOMAIN: 'demo-magnaflow.firebaseapp.com',
      VITE_FIREBASE_PROJECT_ID: 'demo-magnaflow',
      VITE_FIREBASE_STORAGE_BUCKET: 'demo-magnaflow.appspot.com',
      VITE_FIREBASE_MESSAGING_SENDER_ID: '000000000000',
      VITE_FIREBASE_APP_ID: '1:000000000000:web:0000000000000000000000',
    },
  },
});
