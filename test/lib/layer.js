/**
 * Route tests
 */
const http = require('node:http');
const assert = require('node:assert');

const Koa = require('koa');
const request = require('supertest');

const Router = require('../../lib/router');
const Layer = require('../../lib/layer');

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

    it('populates ctx.captures with regexp captures', async () => {
      const app = new Koa();
      const router = new Router();
      app.use(router.routes());
      router.get(
        /^\/api\/([^/]+)\/?/i,
        (ctx, next) => {
          assert.strictEqual(Array.isArray(ctx.captures), true);
          assert.strictEqual(ctx.captures[0], '1');
          return next();
        },
        (ctx) => {
          assert.strictEqual(Array.isArray(ctx.captures), true);
          assert.strictEqual(ctx.captures[0], '1');
          ctx.status = 204;
        }
      );
      await request(http.createServer(app.callback()))
        .get('/api/1')
        .expect(204);
    });

    it('return original ctx.captures when decodeURIComponent throw error', async () => {
      const app = new Koa();
      const router = new Router();
      app.use(router.routes());
      router.get(
        /^\/api\/([^/]+)\/?/i,
        (ctx, next) => {
          assert.strictEqual(typeof ctx.captures, 'object');
          assert.strictEqual(ctx.captures[0], '101%');
          return next();
        },
        (ctx) => {
          assert.strictEqual(typeof ctx.captures, 'object');
          assert.strictEqual(ctx.captures[0], '101%');
          ctx.status = 204;
        }
      );
      await request(http.createServer(app.callback()))
        .get('/api/101%')
        .expect(204);
    });

    it('populates ctx.captures with regexp captures include undefined', async () => {
      const app = new Koa();
      const router = new Router();
      app.use(router.routes());
      router.get(
        /^\/api(\/.+)?/i,
        (ctx, next) => {
          assert.strictEqual(typeof ctx.captures, 'object');
          assert.strictEqual(ctx.captures[0], undefined);
          return next();
        },
        (ctx) => {
          assert.strictEqual(typeof ctx.captures, 'object');
          assert.strictEqual(ctx.captures[0], undefined);
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
        () => router.get('/foo', notexistHandle),
        new Error(
          'get `/foo`: `middleware` must be a function, not `undefined`'
        )
      );

      assert.throws(
        () => router.get('foo router', '/foo', notexistHandle),
        new Error(
          'get `foo router`: `middleware` must be a function, not `undefined`'
        )
      );

      assert.throws(
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
      const router = new Router();
      const route = new Layer(
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
      const router = new Router();
      const route = new Layer(
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
    let route;

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
  });

  describe('Layer#prefix', () => {
    it('setPrefix method checks Layer for path', () => {
      const route = new Layer('/category', ['get'], [() => { }], {
        name: 'books'
      });
      route.path = '/hunter2';
      const prefix = route.setPrefix('/TEST');
      assert.strictEqual(prefix.path, '/TEST/hunter2');
    });
  });
});
