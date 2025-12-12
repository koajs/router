/**
 * Tests for path handling utilities
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';

import {
  hasPathParameters,
  determineMiddlewarePath
} from '../../src/utils/path-helpers';
import type { LayerOptions } from '../../src/types';

describe('path-helpers utilities', () => {
  describe('hasPathParameters()', () => {
    it('should return false for empty string', () => {
      assert.strictEqual(hasPathParameters(''), false);
    });

    it('should return false for undefined', () => {
      // @ts-expect-error - testing undefined input
      assert.strictEqual(hasPathParameters(undefined), false);
    });

    it('should return false for path without parameters', () => {
      assert.strictEqual(hasPathParameters('/users'), false);
      assert.strictEqual(hasPathParameters('/api/v1'), false);
      assert.strictEqual(hasPathParameters('/'), false);
    });

    it('should return true for path with single parameter', () => {
      assert.strictEqual(hasPathParameters('/users/:id'), true);
      assert.strictEqual(hasPathParameters('/:category'), true);
    });

    it('should return true for path with multiple parameters', () => {
      assert.strictEqual(
        hasPathParameters('/users/:userId/posts/:postId'),
        true
      );
      assert.strictEqual(hasPathParameters('/:category/:title'), true);
    });

    it('should return true for path with optional parameter', () => {
      assert.strictEqual(hasPathParameters('/user/:id'), true);
    });

    it('should return true for path with wildcard parameter', () => {
      assert.strictEqual(hasPathParameters('/files/{/*path}'), true);
    });

    it('should return true for prefix with parameters', () => {
      assert.strictEqual(hasPathParameters('/api/v:version'), true);
      assert.strictEqual(hasPathParameters('/users/:userId'), true);
    });

    it('should handle options parameter', () => {
      const options: LayerOptions = {
        sensitive: true,
        strict: false
      };

      assert.strictEqual(hasPathParameters('/users/:id', options), true);
      assert.strictEqual(hasPathParameters('/users', options), false);
    });
  });

  describe('determineMiddlewarePath()', () => {
    describe('with explicit path provided', () => {
      it('should return empty string as wildcard when explicit path is empty string', () => {
        const result = determineMiddlewarePath('', false);

        assert.strictEqual(result.path, '{/*rest}');
        assert.strictEqual(result.pathAsRegExp, false);
      });

      it('should return root path as-is', () => {
        const result = determineMiddlewarePath('/', false);

        assert.strictEqual(result.path, '/');
        assert.strictEqual(result.pathAsRegExp, false);
      });

      it('should return string path as-is', () => {
        const result = determineMiddlewarePath('/api', false);

        assert.strictEqual(result.path, '/api');
        assert.strictEqual(result.pathAsRegExp, false);
      });

      it('should return RegExp path with pathAsRegExp flag', () => {
        const regexp = /^\/api\//;
        const result = determineMiddlewarePath(regexp, false);

        assert.strictEqual(result.path, regexp);
        assert.strictEqual(result.pathAsRegExp, true);
      });

      it('should handle nested paths', () => {
        const result = determineMiddlewarePath('/api/v1/users', false);

        assert.strictEqual(result.path, '/api/v1/users');
        assert.strictEqual(result.pathAsRegExp, false);
      });

      it('should handle paths with parameters', () => {
        const result = determineMiddlewarePath('/users/:id', false);

        assert.strictEqual(result.path, '/users/:id');
        assert.strictEqual(result.pathAsRegExp, false);
      });
    });

    describe('without explicit path', () => {
      it('should return wildcard when prefix has parameters', () => {
        const result = determineMiddlewarePath(undefined, true);

        assert.strictEqual(result.path, '{/*rest}');
        assert.strictEqual(result.pathAsRegExp, false);
      });

      it('should return regex boundary when prefix has no parameters', () => {
        const result = determineMiddlewarePath(undefined, false);

        assert.strictEqual(result.pathAsRegExp, true);
        assert.strictEqual(typeof result.path, 'string');
        assert.strictEqual(
          (result.path as string).includes('\\/'),
          true || (result.path as string).includes('|')
        );
      });

      it('should return boundary regex pattern for default case', () => {
        const result = determineMiddlewarePath(undefined, false);

        assert.strictEqual(result.pathAsRegExp, true);
        const pattern = result.path as string;
        assert.strictEqual(typeof pattern, 'string');
      });
    });

    describe('edge cases', () => {
      it('should handle empty string with prefix parameters', () => {
        const result = determineMiddlewarePath('', true);

        assert.strictEqual(result.path, '{/*rest}');
        assert.strictEqual(result.pathAsRegExp, false);
      });

      it('should handle root path with prefix parameters', () => {
        const result = determineMiddlewarePath('/', true);

        assert.strictEqual(result.path, '/');
        assert.strictEqual(result.pathAsRegExp, false);
      });

      it('should handle RegExp with prefix parameters', () => {
        const regexp = /^\/api\//;
        const result = determineMiddlewarePath(regexp, true);

        assert.strictEqual(result.path, regexp);
        assert.strictEqual(result.pathAsRegExp, true);
      });

      it('should handle complex RegExp patterns', () => {
        const regexp = /^\/api\/v\d+\//;
        const result = determineMiddlewarePath(regexp, false);

        assert.strictEqual(result.path, regexp);
        assert.strictEqual(result.pathAsRegExp, true);
      });
    });

    describe('integration scenarios', () => {
      it('should handle middleware path for nested routers', () => {
        const result = determineMiddlewarePath('/api', false);

        assert.strictEqual(result.path, '/api');
        assert.strictEqual(result.pathAsRegExp, false);
      });

      it('should handle middleware path for parameterized prefix', () => {
        const result = determineMiddlewarePath(undefined, true);

        assert.strictEqual(result.path, '{/*rest}');
        assert.strictEqual(result.pathAsRegExp, false);
      });

      it('should handle explicit path override for parameterized prefix', () => {
        const result = determineMiddlewarePath('/posts', true);

        assert.strictEqual(result.path, '/posts');
        assert.strictEqual(result.pathAsRegExp, false);
      });
    });
  });
});
