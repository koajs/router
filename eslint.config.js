const js = require('@eslint/js');
const unicorn = require('eslint-plugin-unicorn');
const tsPlugin = require('@typescript-eslint/eslint-plugin');
const tsParser = require('@typescript-eslint/parser');

const unicornPlugin = unicorn.default || unicorn;

module.exports = [
  {
    ignores: [
      'node_modules/**',
      'coverage/**',
      'dist/**',
      'bench/**',
      'examples/**',
      'recipes/*.ts'
    ]
  },
  // JavaScript files
  {
    files: ['**/*.{js,cjs,mjs}'],
    ...js.configs.recommended,
    plugins: { unicorn: unicornPlugin },
    rules: unicornPlugin.configs.recommended.rules
  },
  // TypeScript source files
  {
    files: ['src/**/*.ts'],
    languageOptions: {
      parser: tsParser,
      parserOptions: { project: './tsconfig.json' }
    },
    plugins: { '@typescript-eslint': tsPlugin, unicorn: unicornPlugin },
    rules: unicornPlugin.configs.recommended.rules
  },
  // TypeScript test files (relaxed)
  {
    files: ['test/**/*.ts', 'recipes/**/*.test.ts', '*.config.ts'],
    languageOptions: { parser: tsParser },
    plugins: { '@typescript-eslint': tsPlugin }
  }
];
