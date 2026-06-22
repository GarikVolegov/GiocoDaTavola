import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['server/**/*.{test,spec}.ts', 'client/src/**/*.{test,spec}.{ts,tsx}'],
    passWithNoTests: true,
    // Node by default (server tests); client component tests opt into jsdom
    // per-file via a `// @vitest-environment jsdom` docblock.
    environment: 'node',
    setupFiles: ['client/vitest.setup.ts'],
  },
});
