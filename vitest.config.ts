import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['server/**/*.{test,spec}.ts'],
    passWithNoTests: true,
    environment: 'node',
  },
});
