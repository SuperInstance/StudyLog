/**
 * Vitest Configuration
 *
 * Test configuration for backend workers
 */

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['**/__tests__/**/*.test.ts', '**/tests/**/*.test.ts'],
    exclude: ['node_modules', 'lib', 'dist'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['**/__tests__/**', '**/node_modules/**', '**/lib/**'],
    },
  },
});
