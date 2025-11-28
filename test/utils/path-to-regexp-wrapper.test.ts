/**
 * Tests for path-to-regexp wrapper utilities
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  compilePathToRegexp,
  compilePath,
  parsePath,
  normalizeLayerOptionsToPathToRegexp,
  type Key
} from '../../src/utils/path-to-regexp-wrapper';
import type { LayerOptions } from '../../src/types';

describe('path-to-regexp-wrapper utilities', () => {
  describe('compilePathToRegexp()', () => {
    it('should compile a simple path without parameters', () => {
      const result = compilePathToRegexp('/users');

      assert.strictEqual(result.regexp instanceof RegExp, true);
      assert.strictEqual(result.keys.length, 0);
      assert.strictEqual(result.regexp.test('/users'), true);
      assert.strictEqual(result.regexp.test('/users/123'), false);
    });

    it('should compile a path with single parameter', () => {
      const result = compilePathToRegexp('/users/:id');

      assert.strictEqual(result.regexp instanceof RegExp, true);
      assert.strictEqual(result.keys.length, 1);
      assert.strictEqual(result.keys[0].name, 'id');
      assert.strictEqual(result.regexp.test('/users/123'), true);
      assert.strictEqual(result.regexp.test('/users'), false);
    });

    it('should compile a path with multiple parameters', () => {
      const result = compilePathToRegexp('/users/:userId/posts/:postId');

      assert.strictEqual(result.regexp instanceof RegExp, true);
      assert.strictEqual(result.keys.length, 2);
      assert.strictEqual(result.keys[0].name, 'userId');
      assert.strictEqual(result.keys[1].name, 'postId');
      assert.strictEqual(result.regexp.test('/users/123/posts/456'), true);
    });

    it('should handle case-sensitive option', () => {
      const result1 = compilePathToRegexp('/Users', { sensitive: false });
      const result2 = compilePathToRegexp('/Users', { sensitive: true });

      assert.strictEqual(result1.regexp.test('/users'), true);
      assert.strictEqual(result2.regexp.test('/users'), false);
      assert.strictEqual(result2.regexp.test('/Users'), true);
    });

    it('should handle strict/trailing option conversion', () => {
      const result1 = compilePathToRegexp('/users/', { strict: true });
      assert.strictEqual(result1.regexp.test('/users/'), true);

      const result2 = compilePathToRegexp('/users/', { strict: false });
      assert.strictEqual(result2.regexp.test('/users/'), true);
    });

    it('should handle trailing option directly', () => {
      const result1 = compilePathToRegexp('/users/', { trailing: false });
      assert.strictEqual(result1.regexp.test('/users/'), true);

      const result2 = compilePathToRegexp('/users/', { trailing: true });
      assert.strictEqual(result2.regexp.test('/users/'), true);
    });

    it('should handle end option', () => {
      const result1 = compilePathToRegexp('/users', { end: true });
      assert.strictEqual(result1.regexp.test('/users'), true);
      assert.strictEqual(result1.regexp.test('/users/123'), false);

      const result2 = compilePathToRegexp('/users', { end: false });
      assert.strictEqual(result2.regexp.test('/users'), true);
      assert.strictEqual(result2.regexp.test('/users/123'), true);
    });

    it('should remove LayerOptions-specific properties', () => {
      const options: LayerOptions = {
        pathAsRegExp: true,
        ignoreCaptures: true,
        prefix: '/api',
        sensitive: true,
        end: true
      };

      const result = compilePathToRegexp('/users/:id', options);
      assert.strictEqual(result.keys.length, 1);
      assert.strictEqual(result.keys[0].name, 'id');
    });

    it('should handle wildcard paths', () => {
      const result = compilePathToRegexp('/files/{/*path}');

      assert.strictEqual(result.regexp instanceof RegExp, true);
      assert.strictEqual(result.regexp.test('/files/'), true);
    });

    it('should handle root path', () => {
      const result = compilePathToRegexp('/');

      assert.strictEqual(result.regexp instanceof RegExp, true);
      assert.strictEqual(result.keys.length, 0);
      assert.strictEqual(result.regexp.test('/'), true);
    });

    it('should handle empty options object', () => {
      const result = compilePathToRegexp('/users/:id', {});

      assert.strictEqual(result.regexp instanceof RegExp, true);
      assert.strictEqual(result.keys.length, 1);
    });
  });

  describe('compilePath()', () => {
    it('should compile a path to a URL generator function', () => {
      const urlGenerator = compilePath('/users/:id');

      assert.strictEqual(typeof urlGenerator, 'function');
      const url = urlGenerator({ id: '123' });
      assert.strictEqual(url, '/users/123');
    });

    it('should handle multiple parameters', () => {
      const urlGenerator = compilePath('/users/:userId/posts/:postId');

      const url = urlGenerator({ userId: '123', postId: '456' });
      assert.strictEqual(url, '/users/123/posts/456');
    });

    it('should handle encode option', () => {
      const urlGenerator = compilePath('/users/:id', {
        encode: encodeURIComponent
      });

      const url = urlGenerator({ id: 'user name' });
      assert.strictEqual(url, '/users/user%20name');
    });

    it('should handle custom encode function', () => {
      const customEncode = (value: string) => value.toUpperCase();
      const urlGenerator = compilePath('/users/:id', { encode: customEncode });

      const url = urlGenerator({ id: 'test' });
      assert.strictEqual(url, '/users/TEST');
    });

    it('should handle paths without parameters', () => {
      const urlGenerator = compilePath('/users');

      const url = urlGenerator();
      assert.strictEqual(url, '/users');
    });

    it('should handle optional parameters', () => {
      const urlGenerator = compilePath('/users{/:id}');

      const url1 = urlGenerator({ id: '123' });
      assert.strictEqual(url1, '/users/123');

      const url2 = urlGenerator({});
      assert.strictEqual(typeof url2, 'string');
      assert.strictEqual(url2, '/users');

      const url3 = urlGenerator();
      assert.strictEqual(typeof url3, 'string');
      assert.strictEqual(url3, '/users');
    });
  });

  describe('parsePath()', () => {
    it('should parse a simple path', () => {
      const result = parsePath('/users');

      const tokens = Array.isArray(result)
        ? result
        : (result as any).tokens || [];
      assert.strictEqual(tokens.length > 0, true);
    });

    it('should parse a path with parameters', () => {
      const result = parsePath('/users/:id');

      const tokens = Array.isArray(result)
        ? result
        : (result as any).tokens || [];
      assert.strictEqual(tokens.length > 0, true);
      const hasParam = tokens.some(
        (token: any) =>
          token &&
          typeof token === 'object' &&
          'name' in token &&
          token.name === 'id'
      );
      assert.strictEqual(hasParam, true);
    });

    it('should parse a path with multiple parameters', () => {
      const result = parsePath('/users/:userId/posts/:postId');

      const tokens = Array.isArray(result)
        ? result
        : (result as any).tokens || [];
      assert.strictEqual(tokens.length > 0, true);
      const userIdToken = tokens.find(
        (token: any) =>
          token &&
          typeof token === 'object' &&
          'name' in token &&
          token.name === 'userId'
      );
      const postIdToken = tokens.find(
        (token: any) =>
          token &&
          typeof token === 'object' &&
          'name' in token &&
          token.name === 'postId'
      );

      assert.strictEqual(userIdToken !== undefined, true);
      assert.strictEqual(postIdToken !== undefined, true);
    });

    it('should parse wildcard paths', () => {
      const result = parsePath('/files/{/*path}');

      const tokens = Array.isArray(result)
        ? result
        : (result as any).tokens || [];
      assert.strictEqual(tokens.length > 0, true);
    });

    it('should parse root path', () => {
      const result = parsePath('/');

      const tokens = Array.isArray(result)
        ? result
        : (result as any).tokens || [];
      assert.strictEqual(tokens.length > 0, true);
    });

    it('should handle options parameter', () => {
      const result = parsePath('/users/:id', {});

      const tokens = Array.isArray(result)
        ? result
        : (result as any).tokens || [];
      assert.strictEqual(tokens.length > 0, true);
    });
  });

  describe('normalizeLayerOptionsToPathToRegexp()', () => {
    it('should normalize basic LayerOptions', () => {
      const options: LayerOptions = {
        sensitive: true,
        end: false,
        strict: true
      };

      const normalized = normalizeLayerOptionsToPathToRegexp(options);

      assert.strictEqual(normalized.sensitive, true);
      assert.strictEqual(normalized.end, false);
      assert.strictEqual('strict' in normalized, true);
      assert.strictEqual(normalized.strict, true);
    });

    it('should convert strict to trailing when trailing is not provided', () => {
      const options1: LayerOptions = { strict: true };
      const normalized1 = normalizeLayerOptionsToPathToRegexp(options1);
      assert.strictEqual('strict' in normalized1, true);
      assert.strictEqual(normalized1.strict, true);

      const options2: LayerOptions = { strict: false };
      const normalized2 = normalizeLayerOptionsToPathToRegexp(options2);
      assert.strictEqual('strict' in normalized2, true);
      assert.strictEqual(normalized2.strict, false);
    });

    it('should preserve trailing when both strict and trailing are provided', () => {
      const options: LayerOptions = {
        strict: true,
        trailing: true
      };

      const normalized = normalizeLayerOptionsToPathToRegexp(options);
      assert.strictEqual(normalized.trailing, true);
    });

    it('should remove undefined values', () => {
      const options: LayerOptions = {
        sensitive: undefined,
        end: true,
        strict: undefined
      };

      const normalized = normalizeLayerOptionsToPathToRegexp(options);
      assert.strictEqual('sensitive' in normalized, false);
      assert.strictEqual(normalized.end, true);
      assert.strictEqual('strict' in normalized, false);
    });

    it('should handle empty options object', () => {
      const normalized = normalizeLayerOptionsToPathToRegexp({});

      assert.strictEqual(typeof normalized, 'object');
      assert.strictEqual(Object.keys(normalized).length, 0);
    });

    it('should handle all LayerOptions properties', () => {
      const options: LayerOptions = {
        sensitive: true,
        strict: false,
        trailing: true,
        end: true,
        name: 'test-route',
        prefix: '/api',
        ignoreCaptures: true,
        pathAsRegExp: false
      };

      const normalized = normalizeLayerOptionsToPathToRegexp(options);

      assert.strictEqual(normalized.sensitive, true);
      assert.strictEqual(normalized.trailing, true);
      assert.strictEqual(normalized.end, true);
      assert.strictEqual('name' in normalized, false);
      assert.strictEqual('prefix' in normalized, false);
      assert.strictEqual('ignoreCaptures' in normalized, false);
      assert.strictEqual('pathAsRegExp' in normalized, false);
    });

    it('should handle undefined options', () => {
      const normalized = normalizeLayerOptionsToPathToRegexp(undefined as any);

      assert.strictEqual(typeof normalized, 'object');
    });
  });

  describe('integration tests', () => {
    it('should work together: compilePathToRegexp + compilePath', () => {
      const path = '/users/:id';

      const { regexp, keys } = compilePathToRegexp(path);
      assert.strictEqual(keys.length, 1);

      const urlGenerator = compilePath(path);
      const url = urlGenerator({ id: '123' });

      assert.strictEqual(regexp.test(url), true);
    });

    it('should work together: parsePath + compilePath', () => {
      const path = '/users/:userId/posts/:postId';

      const parseResult = parsePath(path);
      const tokens = Array.isArray(parseResult)
        ? parseResult
        : (parseResult as any).tokens || [];
      const paramNames = tokens
        .filter(
          (token: any) => token && typeof token === 'object' && 'name' in token
        )
        .map((token: any) => token.name);

      assert.strictEqual(paramNames.includes('userId'), true);
      assert.strictEqual(paramNames.includes('postId'), true);

      const urlGenerator = compilePath(path);
      const url = urlGenerator({ userId: '123', postId: '456' });

      assert.strictEqual(url, '/users/123/posts/456');
    });

    it('should handle complex path with all options', () => {
      const options: LayerOptions = {
        sensitive: true,
        strict: false,
        end: true
      };

      const path = '/Users/:Id';
      const { regexp, keys } = compilePathToRegexp(path, options);

      assert.strictEqual(keys.length, 1);
      assert.strictEqual(regexp.test('/Users/123'), true);
      assert.strictEqual(regexp.test('/users/123'), false);
    });
  });
});
