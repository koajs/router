const js = require('@eslint/js');
const eslintPluginUnicorn = require('eslint-plugin-unicorn');

module.exports = [
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'commonjs',
      globals: {
        console: true,
        setTimeout: true,
        __dirname: true,
        // Mocha globals
        before: true,
        after: true,
        beforeEach: true,
        describe: true,
        it: true
      }
    },
    plugins: {
      unicorn: eslintPluginUnicorn,
    },
    rules: {
      'promise/prefer-await-to-then': 0,
      'logical-assignment-operators': 0,
      'arrow-body-style': 0,
    }
  }
];
