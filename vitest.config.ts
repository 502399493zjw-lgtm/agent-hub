import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['__tests__/**/*.test.ts'],
    exclude: ['node_modules', '.next'],
    setupFiles: ['__tests__/helpers/setup.ts'],
    testTimeout: 15000,
    pool: 'forks', // Use forks for better isolation with SQLite
    coverage: {
      provider: 'v8',
      include: ['src/lib/db.ts', 'src/lib/api-auth.ts'],
      reporter: ['text', 'text-summary'],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
});
