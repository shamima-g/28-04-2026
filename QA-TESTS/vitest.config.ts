import { defineConfig } from 'vitest/config';
import path from 'node:path';

const repoRoot = path.resolve(__dirname, '..');

export default defineConfig({
  test: {
    environment: 'node',
    globals: false,
    reporters: ['default'],
    include: [
      'tier-1-unit/**/*.test.ts',
      'tier-2-log-replay/**/*.test.ts',
    ],
    exclude: [
      'node_modules/**',
      'tier-1-unit/hooks/powershell/**', // Pester tests run via separate script
    ],
    testTimeout: 15_000,
    hookTimeout: 15_000,
    env: {
      // Point CLAUDE_PROJECT_DIR at each test's temp dir when tests set it.
      // By default, disable the logging hook so tests don't spam the real .claude/logs/.
      CLAUDE_TEST_MODE: '1',
      REPO_ROOT: repoRoot,
    },
    // Each test file gets its own worker — avoids cross-file temp-dir collisions.
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: false,
      },
    },
  },
  resolve: {
    alias: {
      '@helpers': path.resolve(__dirname, 'helpers'),
      '@fixtures': path.resolve(__dirname, 'fixtures'),
    },
  },
});
