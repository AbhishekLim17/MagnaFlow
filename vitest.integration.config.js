import { defineConfig } from 'vitest/config';

// Integration tests for the scheduled mail jobs. They run the real scripts as
// child processes against the Firestore emulator (MAIL_TRANSPORT=json, so nothing
// is delivered), via `npm run test:integration`.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['scripts/integration/**/*.itest.js'],
    testTimeout: 60000,
    hookTimeout: 60000,
  },
});
