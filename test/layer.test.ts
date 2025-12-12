/**
 * Route tests
 */
import { describe, it, before } from 'node:test';
import assert from 'node:assert';
import http from 'node:http';

import Koa from 'koa';
import request from 'supertest';

import Router, { RouterContext } from '../src';
import Layer from '../src/layer';

type TestState = {
  user?: { name: string };
  [key: string]: unknown;
};

type TestContext = RouterContext<TestState> & {
  user?: { name: string };
  captures?: string[];
};

describe('Layer', () => {
  it('composes multiple callbacks/middleware', async () => {
    const app = new Koa();
    const router = new Router();
    app.use(router.routes());
    router.get(
      '/:category/:title',
      (ctx, next) => {
        ctx.status = 500;
        return next();
      },
      (ctx, next) => {
        ctx.status = 204;
        return next();
      }
    );

    await request(http.createServer(app.callback()))
      .get('/programming/how-to-node')
      .expect(204);
  });

  describe('Layer#match()', () => {
    it('captures URL path parameters', async () => {
      const app = new Koa();
      const router = new Router();
      app.use(router.routes());
      router.get('/:category/:title', (ctx) => {
        assert.strictEqual(typeof ctx.params, 'object');
        assert.strictEqual(ctx.params.category, 'match');
        assert.strictEqual(ctx.params.title, 'this');
        ctx.status = 204;
      });
      await request(http.createServer(app.callback()))
        .get('/match/this')
        .expect(204);
    });

    it('return original path parameters when decodeURIComponent throw error', async () => {
      const app = new Koa();
      const router = new Router();
      app.use(router.routes());
      router.get('/:category/:title', (ctx) => {
        assert.strictEqual(typeof ctx.params, 'object');
        assert.strictEqual(ctx.params.category, '100%');
        assert.strictEqual(ctx.params.title, '101%');
        ctx.status = 204;
      });
      await request(http.createServer(app.callback()))
        .get('/100%/101%')
        .expect(204);
    });

    it('preserves plus signs in URL path parameters', async () => {
      const app = new Koa();
      const router = new Router();
      app.use(router.routes());
      router.get('/users/:username', (ctx) => {
        assert.strictEqual(ctx.params.username, 'john+doe');
        ctx.status = 200;
        ctx.body = { username: ctx.params.username };
      });
      const res = await request(http.createServer(app.callback()))
        .get('/users/john%2Bdoe')
        .expect(200);
      assert.strictEqual(res.body.username, 'john+doe');
    });

    it('populates ctx.captures with regexp captures', async () => {
      const app = new Koa();
      const router = new Router<TestState, TestContext>();
      app.use(router.routes());
      router.get(
        /^\/api\/([^/]+)\/?/i,
        (ctx, next) => {
          assert.strictEqual(Array.isArray(ctx.captures), true);
          assert.strictEqual(ctx.captures?.[0], '1');
          return next();
        },
        (ctx) => {
          assert.strictEqual(Array.isArray(ctx.captures), true);
          assert.strictEqual(ctx.captures?.[0], '1');
          ctx.status = 204;
        }
      );
      await request(http.createServer(app.callback()))
        .get('/api/1')
        .expect(204);
    });

    it('return original ctx.captures when decodeURIComponent throw error', async () => {
      const app = new Koa();
      const router = new Router<TestState, TestContext>();
      app.use(router.routes());
      router.get(
        /^\/api\/([^/]+)\/?/i,
        (ctx, next) => {
          assert.strictEqual(typeof ctx.captures, 'object');
          assert.strictEqual(ctx.captures?.[0], '101%');
          return next();
        },
        (ctx) => {
          assert.strictEqual(typeof ctx.captures, 'object');
          assert.strictEqual(ctx.captures?.[0], '101%');
          ctx.status = 204;
        }
      );
      await request(http.createServer(app.callback()))
        .get('/api/101%')
        .expect(204);
    });

    it('populates ctx.captures with regexp captures include undefined', async () => {
      const app = new Koa();
      const router = new Router<TestState, TestContext>();
      app.use(router.routes());
      router.get(
        /^\/api(\/.+)?/i,
        (ctx, next) => {
          assert.strictEqual(typeof ctx.captures, 'object');
          assert.strictEqual(ctx.captures?.[0], undefined);
          return next();
        },
        (ctx) => {
          assert.strictEqual(typeof ctx.captures, 'object');
          assert.strictEqual(ctx.captures?.[0], undefined);
          ctx.status = 204;
        }
      );
      await request(http.createServer(app.callback())).get('/api').expect(204);
    });

    it('should throw friendly error message when handle not exists', () => {
      const app = new Koa();
      const router = new Router();
      app.use(router.routes());
      const notexistHandle = undefined;
      assert.throws(
        // @ts-expect-error - testing invalid input
        () => router.get('/foo', notexistHandle),
        new Error(
          'get `/foo`: `middleware` must be a function, not `undefined`'
        )
      );

      assert.throws(
        // @ts-expect-error - testing invalid input
        () => router.get('foo router', '/foo', notexistHandle),
        new Error(
          'get `foo router`: `middleware` must be a function, not `undefined`'
        )
      );

      assert.throws(
        // @ts-expect-error - testing invalid input
        () => router.post('/foo', () => {}, notexistHandle),
        new Error(
          'post `/foo`: `middleware` must be a function, not `undefined`'
        )
      );
    });
  });

  describe('Layer#param()', () => {
    it('composes middleware for param fn', async () => {
      const app = new Koa();
      const router = new Router<TestState, TestContext>();
      const route = new Layer<TestState, TestContext>(
        '/users/:user',
        ['GET'],
        [
          (ctx) => {
            ctx.body = ctx.user;
          }
        ]
      );
      route.param('user', (id, ctx, next) => {
        ctx.user = { name: 'alex' };
        if (!id) {
          ctx.status = 404;
          return;
        }

        return next();
      });
      router.stack.push(route);
      app.use(router.middleware());
      const res = await request(http.createServer(app.callback()))
        .get('/users/3')
        .expect(200);
      assert.strictEqual(res.body.name, 'alex');
    });

    it('ignores params which are not matched', async () => {
      const app = new Koa();
      const router = new Router<TestState, TestContext>();
      const route = new Layer<TestState, TestContext>(
        '/users/:user',
        ['GET'],
        [
          (ctx) => {
            ctx.body = ctx.user;
          }
        ]
      );
      route.param('user', (id, ctx, next) => {
        ctx.user = { name: 'alex' };
        if (!id) {
          ctx.status = 404;
          return;
        }

        return next();
      });
      route.param('title', (id, ctx, next) => {
        ctx.user = { name: 'mark' };
        if (!id) {
          ctx.status = 404;
          return;
        }

        return next();
      });
      router.stack.push(route);
      app.use(router.middleware());
      const res = await request(http.createServer(app.callback()))
        .get('/users/3')
        .expect(200);

      assert.strictEqual(res.body.name, 'alex');
    });
  });

  describe('Layer#params()', () => {
    let route: Layer;

    before(() => {
      route = new Layer('/:category', ['GET'], [() => {}]);
    });

    it('should return an empty object if params were not pass', () => {
      const params = route.params('', []);

      assert.deepStrictEqual(params, {});
    });

    it('should return empty object if params is empty string', () => {
      const params = route.params('', ['']);

      assert.deepStrictEqual(params, {});
    });

    it('should return an object with escaped params', () => {
      const params = route.params('', ['how%20to%20node']);

      assert.deepStrictEqual(params, { category: 'how to node' });
    });

    it('should preserve plus signs in path parameters (not convert to spaces)', () => {
      const route = new Layer('/users/:username', ['GET'], [() => {}]);
      const params = route.params('', ['john%2Bdoe']);

      assert.deepStrictEqual(params, { username: 'john+doe' });
    });

    it('should return an object with the same params if an error occurs', () => {
      const params = route.params('', ['%E0%A4%A']);

      assert.deepStrictEqual(params, { category: '%E0%A4%A' });
    });

    it('should return an object with data if params were pass', () => {
      const params = route.params('', ['programming']);

      assert.deepStrictEqual(params, { category: 'programming' });
    });

    it('should return empty object if params were not pass', () => {
      route.paramNames = [];
      const params = route.params('', ['programming']);

      assert.deepStrictEqual(params, {});
    });
  });

  describe('Layer#url()', () => {
    it('generates route URL', () => {
      const route = new Layer('/:category/:title', ['get'], [() => {}], {
        name: 'books'
      });
      let url = route.url({ category: 'programming', title: 'how-to-node' });
      assert.strictEqual(url, '/programming/how-to-node');
      url = route.url('programming', 'how-to-node');
      assert.strictEqual(url, '/programming/how-to-node');
    });

    it('escapes using encodeURIComponent()', () => {
      const route = new Layer('/:category/:title', ['get'], [() => {}], {
        name: 'books'
      });
      const url = route.url({
        category: 'programming',
        title: 'how to node & js/ts'
      });
      assert.strictEqual(url, '/programming/how%20to%20node%20%26%20js%2Fts');
    });

    it('setPrefix method checks Layer for path', () => {
      const route = new Layer('/category', ['get'], [() => {}], {
        name: 'books'
      });
      route.path = '/hunter2';
      const prefix = route.setPrefix('TEST');
      assert.strictEqual(prefix.path, 'TEST/hunter2');
    });

    it('should throw TypeError when attempting to generate URL for RegExp path', () => {
      const route = new Layer(/\/users\/\d+/, ['GET'], [() => {}], {
        pathAsRegExp: true
      });

      assert.throws(
        () => route.url({ id: 123 }),
        /Cannot generate URL for routes defined with RegExp paths/
      );
    });

    it('should generate URL correctly for string path with named parameters', () => {
      const route = new Layer('/users/:id', ['GET'], [() => {}]);
      const url = route.url({ id: 123 });
      assert.strictEqual(url, '/users/123');
    });
  });

  describe('Layer#prefix', () => {
    it('setPrefix method passes check Layer for path', () => {
      const route = new Layer('/category', ['get'], [() => {}], {
        name: 'books'
      });
      route.path = '/hunter2';
      const prefix = route.setPrefix('/TEST');
      assert.strictEqual(prefix.path, '/TEST/hunter2');
    });

    it('setPrefix method fails check Layer for path', () => {
      // @ts-expect-error - testing invalid input
      const route = new Layer(false, ['get'], [() => {}], {
        name: 'books'
      });
      // @ts-expect-error - testing invalid input
      route.path = false;
      const prefix = route.setPrefix('/TEST');
      assert.strictEqual(prefix.path, false);
    });
  });

  describe('Layer#_reconfigurePathMatching()', () => {
    it('should use path-to-regexp when prefix has parameters and pathAsRegExp is true', async () => {
      const app = new Koa();
      const router = new Router();
      app.use(router.routes());

      const route = new Layer(
        '/users/:id',
        ['GET'],
        [
          (ctx) => {
            ctx.body = { userId: ctx.params.id };
          }
        ],
        {
          pathAsRegExp: true
        }
      );

      route.setPrefix('/api/:version');

      router.stack.push(route);

      const res = await request(http.createServer(app.callback()))
        .get('/api/v1/users/123')
        .expect(200);

      assert.strictEqual(res.body.userId, '123');
      assert.strictEqual(route.opts.pathAsRegExp, false);
    });

    it('should handle RegExp path when pathAsRegExp is true and prefix has no parameters', () => {
      const route = new Layer('/api/users/\\d+', ['GET'], [() => {}], {
        pathAsRegExp: true
      });

      route.setPrefix('/v1');

      assert.strictEqual(route.regexp instanceof RegExp, true);
    });
  });

  describe('Layer#captures()', () => {
    it('should return empty array when regexp does not match', () => {
      const route = new Layer('/api/users/:id', ['GET'], [() => {}]);

      route.regexp = /^\/api\/users\/\d+$/;

      const captures = route.captures('/api/users/abc');

      assert.deepStrictEqual(captures, []);
    });
  });
});
