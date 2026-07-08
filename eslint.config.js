// @ts-check
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

/**
 * Flat ESLint config for the whole monorepo. Type-aware linting is intentionally left off in
 * v1 to keep lint fast and dependency-light; the strict TS compiler is the real type gate.
 */
export default tseslint.config(
  { ignores: ['**/dist/**', '**/node_modules/**', '**/.turbo/**', '**/*.d.ts'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  prettier,
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/no-empty-object-type': 'off',
    },
  },
  {
    // Decorator-heavy backend classes trip base rules that TS handles better.
    files: ['apps/server/**/*.ts', 'apps/collab/**/*.ts'],
    rules: {
      'no-console': 'off',
    },
  },
);
