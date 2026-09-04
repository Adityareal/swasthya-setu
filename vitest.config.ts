import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

/**
 * `environment: 'node'`, single project. No jsdom, no database mock, no fetch
 * mock, no MSW — every module under test is pure, which is the whole reason the
 * architecture pushes logic into `lib/`.
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('.', import.meta.url)),
    },
  },
});
