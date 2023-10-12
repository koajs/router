module.exports = {
  prettier: true,
  space: true,
  extends: ['xo-lass'],
  overrides: [
    {
      files: ['test/**/*.js'],
      env: ['mocha']
    }
  ],
  rules: {
    'array-callback-return': 'warn',
    'func-names': 'warn',
    'import/order': 'warn',
    'n/no-deprecated-api': 'warn',
    'n/prefer-global/process': 'warn',
    'n/prefer-promises/fs': 'warn',
    'new-cap': 'warn',
    'no-bitwise': 'warn',
    'no-implicit-coercion': 'warn',
    'no-inner-declarations': 'warn',
    'no-multi-assign': 'warn',
    'no-redeclare': 'warn',
    'no-return-assign': 'warn',
    'no-unused-vars': 'warn',
    'no-use-extend-native/no-use-extend-native': 'warn',
    'no-useless-call': 'warn',
    'no-var': 'warn',
    'prefer-const': 'warn',
    'prefer-rest-params': 'warn',
    'prefer-spread': 'warn',
    'unicorn/explicit-length-check': 'warn',
    'unicorn/no-array-reduce': 'warn',
    'unicorn/prefer-spread': 'warn',
    'unicorn/prefer-node-protocol': 'off'
  }
};
