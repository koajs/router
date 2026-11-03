import { appendFileSync, writeFileSync } from 'node:fs';

appendFileSync(
  'dist/index.js',
  `
Object.assign(module.exports.default, module.exports);
module.exports = module.exports.default;
`
);

writeFileSync(
  'dist/index.mjs',
  `export { Router, RouterEvents, createParameterValidationMiddleware } from './index.js'; export { default } from './index.js';
`
);

writeFileSync(
  'dist/index.d.mts',
  `export * from './index.js'; export { Router as default } from './index.js';
`
);
