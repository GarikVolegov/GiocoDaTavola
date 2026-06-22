import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';

export default tseslint.config(
  // `scripts/` holds Node tooling/data scripts (CommonJS data-taggers, throwaway
  // debug harnesses) — not app source, so the app's TS lint rules don't apply.
  { ignores: ['**/dist/**', '**/node_modules/**', '.claude/**', '.superpowers/**', 'scripts/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      globals: { ...globals.node, ...globals.browser },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
);
