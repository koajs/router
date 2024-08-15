/**
 * Module tests
 */
const assert = require('node:assert');

describe('module', () => {
  it('should expose Router', () => {
    const Router = require('..');
    assert.strictEqual(Boolean(Router), true);
    assert.strictEqual(typeof Router, 'function');
  });
});
