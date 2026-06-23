import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['server/**/*.{test,spec}.ts', 'client/src/**/*.{test,spec}.{ts,tsx}'],
    passWithNoTests: true,
    // Node by default (server tests); client component tests opt into jsdom
    // per-file via a `// @vitest-environment jsdom` docblock.
    environment: 'node',
    setupFiles: ['client/vitest.setup.ts'],
    // Coverage runs only under `--coverage` (e.g. `npm run coverage`, CI). Scoped
    // to the game logic + rate limiter: thresholds guard against regression below
    // today's level (server game code is ~93% statements / ~95% lines).
    coverage: {
      provider: 'v8',
      include: ['server/src/game/**', 'server/src/rateLimit.ts'],
      reporter: ['text-summary'],
      thresholds: { statements: 90, branches: 82, functions: 90, lines: 92 },
    },
  },
});
