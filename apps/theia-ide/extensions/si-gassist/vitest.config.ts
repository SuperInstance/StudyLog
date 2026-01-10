/**
 * Vitest Configuration for si-gassist Extension
 *
 * Configures the test environment for the G-Assist widget tests.
 * Uses jsdom to simulate browser environment for React component testing.
 */

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['**/__tests__/**/*.test.ts', '**/__tests__/**/*.test.tsx'],
    exclude: ['node_modules', 'lib'],
    setupFiles: [],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        '**/__tests__/**',
        '**/node_modules/**',
        '**/lib/**',
      ],
    },
  },
});
