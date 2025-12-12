import { defineConfig } from 'tsup';

const tsupConfig = defineConfig({
  name: '@koa/router',
  entry: ['src/index.ts'],
  target: 'esnext',
  format: ['cjs', 'esm'],
  dts: true,
  splitting: false,
  sourcemap: false,
  clean: true,
  platform: 'node',
  footer: ({ format }) => {
    // Ensure CommonJS default export works as expected for backwards compatibility
    // This allows `const Router = require('@koa/router')` to work
    if (format === 'cjs') {
      return {
        js: `if (module.exports.default) {
  Object.assign(module.exports.default, module.exports);
  module.exports = module.exports.default;
}`
      };
    }
    return {};
  }
});

export default tsupConfig;
