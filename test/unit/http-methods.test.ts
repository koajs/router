/**
 * Tests for HTTP methods utilities
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import http from 'node:http';
import {
  getAllHttpMethods,
  COMMON_HTTP_METHODS
} from '../../src/utils/http-methods';

describe('http-methods utilities', () => {
  describe('getAllHttpMethods()', () => {
    it('should return all HTTP methods in lowercase', () => {
      const methods = getAllHttpMethods();

      assert.strictEqual(Array.isArray(methods), true);
      assert.strictEqual(methods.length > 0, true);

      for (const method of methods) {
        assert.strictEqual(typeof method, 'string');
        assert.strictEqual(
          method,
          method.toLowerCase(),
          `Method ${method} should be lowercase`
        );
      }
    });

    it('should return methods from Node.js http.METHODS', () => {
      const methods = getAllHttpMethods();
      const nodeMethods = http.METHODS.map((m) => m.toLowerCase());

      assert.strictEqual(methods.length, nodeMethods.length);
      assert.deepStrictEqual(methods.sort(), nodeMethods.sort());
    });

    it('should include common HTTP methods', () => {
      const methods = getAllHttpMethods();

      assert.strictEqual(methods.includes('get'), true);
      assert.strictEqual(methods.includes('post'), true);
      assert.strictEqual(methods.includes('put'), true);
      assert.strictEqual(methods.includes('patch'), true);
      assert.strictEqual(methods.includes('delete'), true);
      assert.strictEqual(methods.includes('head'), true);
      assert.strictEqual(methods.includes('options'), true);
    });

    it('should include less common HTTP methods', () => {
      const methods = getAllHttpMethods();

      assert.strictEqual(methods.includes('connect'), true);
      assert.strictEqual(methods.includes('trace'), true);
      assert.strictEqual(methods.includes('purge'), true);
      assert.strictEqual(methods.includes('copy'), true);
    });
  });

  describe('COMMON_HTTP_METHODS', () => {
    it('should be an array of strings', () => {
      assert.strictEqual(Array.isArray(COMMON_HTTP_METHODS), true);
      assert.strictEqual(COMMON_HTTP_METHODS.length > 0, true);

      for (const method of COMMON_HTTP_METHODS) {
        assert.strictEqual(typeof method, 'string');
      }
    });

    it('should contain expected common methods', () => {
      const expectedMethods = [
        'get',
        'post',
        'put',
        'patch',
        'delete',
        'del',
        'head',
        'options'
      ];

      for (const expected of expectedMethods) {
        assert.strictEqual(
          COMMON_HTTP_METHODS.includes(expected),
          true,
          `COMMON_HTTP_METHODS should include ${expected}`
        );
      }
    });

    it('should have exactly 8 common methods', () => {
      assert.strictEqual(COMMON_HTTP_METHODS.length, 8);
    });

    it('should include both delete and del', () => {
      assert.strictEqual(COMMON_HTTP_METHODS.includes('delete'), true);
      assert.strictEqual(COMMON_HTTP_METHODS.includes('del'), true);
    });

    it('should not include less common methods (they are dynamically added)', () => {
      assert.strictEqual(COMMON_HTTP_METHODS.includes('connect'), false);
      assert.strictEqual(COMMON_HTTP_METHODS.includes('trace'), false);
      assert.strictEqual(COMMON_HTTP_METHODS.includes('purge'), false);
    });
  });
});
