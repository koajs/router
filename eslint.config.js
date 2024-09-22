const js = require('@eslint/js');
const unicorn = require('eslint-plugin-unicorn');
const xolass = require('eslint-config-xo-lass');

module.exports = [
  js.configs.recommended,
  unicorn.configs['flat/recommended'],
  {
    ignores: ['!.*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'commonjs',
      globals: {
        console: true,
        setTimeout: true,

        __dirname: true,
        before: true,
        after: true,
        beforeEach: true,
        describe: true,
        it: true
      }
    },
    rules: {
      ...xolass.rules,
      'promise/prefer-await-to-then': 0,
      'logical-assignment-operators': 0,
      'arrow-body-style': 0
    }
  }
];
