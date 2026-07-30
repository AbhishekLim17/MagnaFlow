import { defineConfig } from 'vitest/config';

// Separate config for the Firestore security-rules tests. They run against the
// emulator in a Node environment and must NOT inherit the jsdom setup (or the
// `tests/**` exclusion) used by the component suite in vitest.config.js.
export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['tests/**/*.test.js'],
    testTimeout: 20000,
    hookTimeout: 30000,
  },
});
