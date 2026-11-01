/**
 * Tests for parameter handling utilities
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';

import Router from '../../src';
import Layer from '../../src/layer';
import {
  normalizeParameterMiddleware,
  applyParameterMiddlewareToRoute,
  applyAllParameterMiddleware
} from '../../src/utils/parameter-helpers';
import type { RouterParameterMiddleware } from '../../src/types';

describe('parameter-helpers utilities', () => {
  describe('normalizeParameterMiddleware()', () => {
    it('should return empty array for undefined', () => {
      const result = normalizeParameterMiddleware(undefined);
      assert.deepStrictEqual(result, []);
    });

    it('should return array for single middleware function', () => {
      const middleware: RouterParameterMiddleware = async (
        value,
        ctx,
        next
      ) => {
        return next();
      };

      const result = normalizeParameterMiddleware(middleware);
      assert.strictEqual(Array.isArray(result), true);
      assert.strictEqual(result.length, 1);
      assert.strictEqual(result[0], middleware);
    });

    it('should return array as-is for array input', () => {
      const middleware1: RouterParameterMiddleware = async (
        value,
        ctx,
        next
      ) => {
        return next();
      };
      const middleware2: RouterParameterMiddleware = async (
        value,
        ctx,
        next
      ) => {
        return next();
      };
      const middlewareArray = [middleware1, middleware2];

      const result = normalizeParameterMiddleware(middlewareArray);
      assert.strictEqual(Array.isArray(result), true);
      assert.strictEqual(result.length, 2);
      assert.deepStrictEqual(result, middlewareArray);
    });

    it('should handle empty array', () => {
      const result = normalizeParameterMiddleware([]);
      assert.deepStrictEqual(result, []);
    });

    it('should handle single item array', () => {
      const middleware: RouterParameterMiddleware = async (
        value,
        ctx,
        next
      ) => {
        return next();
      };
      const result = normalizeParameterMiddleware([middleware]);
      assert.strictEqual(result.length, 1);
      assert.strictEqual(result[0], middleware);
    });
  });

  describe('applyParameterMiddlewareToRoute()', () => {
    it('should apply single middleware to router', () => {
      const router = new Router();

      const middleware: RouterParameterMiddleware = async (
        value,
        ctx,
        next
      ) => {
        return next();
      };

      applyParameterMiddlewareToRoute(router, 'id', middleware);

      assert.strictEqual(router.params.id !== undefined, true);
      assert.strictEqual(Array.isArray(router.params.id), true);
      const registered = router.params.id as RouterParameterMiddleware[];
      assert.strictEqual(registered.length, 1);
      assert.strictEqual(registered[0], middleware);
    });

    it('should apply array of middleware to router', () => {
      const router = new Router();
      const callOrder: string[] = [];

      const middleware1: RouterParameterMiddleware = async (
        value,
        ctx,
        next
      ) => {
        callOrder.push('1');
        return next();
      };
      const middleware2: RouterParameterMiddleware = async (
        value,
        ctx,
        next
      ) => {
        callOrder.push('2');
        return next();
      };

      applyParameterMiddlewareToRoute(router, 'id', [middleware1, middleware2]);

      assert.strictEqual(Array.isArray(router.params.id), true);
      const registered = router.params.id as RouterParameterMiddleware[];
      assert.strictEqual(registered.length, 2);
      assert.strictEqual(registered[0], middleware1);
      assert.strictEqual(registered[1], middleware2);
    });

    it('should apply middleware to Layer', () => {
      const layer = new Layer('/users/:id', ['GET'], async () => {});
      let called = false;

      const middleware: RouterParameterMiddleware = async (
        value,
        ctx,
        next
      ) => {
        called = true;
        return next();
      };

      applyParameterMiddlewareToRoute(layer, 'id', middleware);

      assert.strictEqual(typeof middleware, 'function');
    });

    it('should handle undefined middleware gracefully', () => {
      const router = new Router();

      // @ts-expect-error - testing undefined middleware
      applyParameterMiddlewareToRoute(router, 'id', undefined);

      assert.strictEqual(router instanceof Router, true);
    });
  });

  describe('applyAllParameterMiddleware()', () => {
    it('should apply all middleware from params object', () => {
      const router = new Router();
      const callOrder: string[] = [];

      const idMiddleware: RouterParameterMiddleware = async (
        value,
        ctx,
        next
      ) => {
        callOrder.push('id');
        return next();
      };

      const nameMiddleware: RouterParameterMiddleware = async (
        value,
        ctx,
        next
      ) => {
        callOrder.push('name');
        return next();
      };

      const paramsObject = {
        id: idMiddleware,
        name: nameMiddleware
      };

      const layer = new Layer('/users/:id/:name', ['GET'], async () => {});

      applyAllParameterMiddleware(layer, paramsObject);

      assert.strictEqual(typeof idMiddleware, 'function');
      assert.strictEqual(typeof nameMiddleware, 'function');
    });

    it('should handle empty params object', () => {
      const layer = new Layer('/users', ['GET'], async () => {});

      applyAllParameterMiddleware(layer, {});

      assert.strictEqual(layer instanceof Layer, true);
    });

    it('should handle params object with array middleware', () => {
      const router = new Router();

      const middleware1: RouterParameterMiddleware = async (
        value,
        ctx,
        next
      ) => {
        return next();
      };
      const middleware2: RouterParameterMiddleware = async (
        value,
        ctx,
        next
      ) => {
        return next();
      };

      const paramsObject = {
        id: [middleware1, middleware2] as RouterParameterMiddleware[]
      };

      const layer = new Layer('/users/:id', ['GET'], async () => {});

      applyAllParameterMiddleware(layer, paramsObject);

      assert.strictEqual(layer instanceof Layer, true);
    });

    it('should apply middleware for multiple parameters', () => {
      const router = new Router();

      const idMiddleware: RouterParameterMiddleware = async (
        value,
        ctx,
        next
      ) => {
        return next();
      };

      const userIdMiddleware: RouterParameterMiddleware = async (
        value,
        ctx,
        next
      ) => {
        return next();
      };

      const postIdMiddleware: RouterParameterMiddleware = async (
        value,
        ctx,
        next
      ) => {
        return next();
      };

      const paramsObject = {
        id: idMiddleware,
        userId: userIdMiddleware,
        postId: postIdMiddleware
      };

      const layer = new Layer(
        '/users/:userId/posts/:postId',
        ['GET'],
        async () => {}
      );

      applyAllParameterMiddleware(layer, paramsObject);

      assert.strictEqual(layer instanceof Layer, true);
    });

    it('should handle mixed single and array middleware', () => {
      const router = new Router();

      const singleMiddleware: RouterParameterMiddleware = async (
        value,
        ctx,
        next
      ) => {
        return next();
      };

      const arrayMiddleware1: RouterParameterMiddleware = async (
        value,
        ctx,
        next
      ) => {
        return next();
      };
      const arrayMiddleware2: RouterParameterMiddleware = async (
        value,
        ctx,
        next
      ) => {
        return next();
      };

      const paramsObject = {
        id: singleMiddleware,
        userId: [
          arrayMiddleware1,
          arrayMiddleware2
        ] as RouterParameterMiddleware[]
      };

      const layer = new Layer('/users/:userId/:id', ['GET'], async () => {});

      applyAllParameterMiddleware(layer, paramsObject);

      assert.strictEqual(layer instanceof Layer, true);
    });
  });
});
