/**
 * Module tests
 */
import { describe, it } from 'node:test';
import assert from 'node:assert';
import Router from '../src';

describe('module', () => {
  it('should expose Router', () => {
    assert.strictEqual(Boolean(Router), true);
    assert.strictEqual(typeof Router, 'function');
  });
});
