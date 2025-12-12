/**
 * Router tests
 */
import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';

import Koa from 'koa';
import methods from 'methods';
import request from 'supertest';

import Router, { RouterMiddleware, RouterParameterMiddleware } from '../src';
import Layer from '../src/layer';

type HttpError = Error & {
  status?: number;
  statusCode?: number;
  body?: unknown;
  type?: string;
};

describe('Router', () => {
  it('creates new router with koa app', () => {
    const router = new Router();
    assert.strictEqual(router instanceof Router, true);
  });

  it('should', () => {
    const router = new Router();
    console.info(router.params);
  });

  it('shares context between routers (gh-205)', async () => {
    const app = new Koa();
    const router1 = new Router();
    const router2 = new Router();
    router1.get('/', (ctx, next) => {
      ctx.foo = 'bar';
      return next();
    });
    router2.get('/', (ctx, next) => {
      ctx.baz = 'qux';
      ctx.body = { foo: ctx.foo };
      return next();
    });
    app.use(router1.routes()).use(router2.routes());
    const res = await request(http.createServer(app.callback()))
      .get('/')
      .expect(200);

    assert.strictEqual(res.body.foo, 'bar');
  });

  it('does not register middleware more than once (gh-184)', async () => {
    const app = new Koa();
    const parentRouter = new Router();
    const nestedRouter = new Router();

    nestedRouter
      .get('/first-nested-route', (ctx) => {
        ctx.body = { n: ctx.n };
      })
      .get('/second-nested-route', (ctx, next) => {
        return next();
      })
      .get('/third-nested-route', (ctx, next) => {
        return next();
      });

    parentRouter.use(
      '/parent-route',
      (ctx, next) => {
        ctx.n = ctx.n ? ctx.n + 1 : 1;
        return next();
      },
      nestedRouter.routes()
    );

    app.use(parentRouter.routes());

    const res = await request(http.createServer(app.callback()))
      .get('/parent-route/first-nested-route')
      .expect(200);

    assert.strictEqual(res.body.n, 1);
  });

  it('router can be accecced with ctx', async () => {
    const app = new Koa();
    const router = new Router();
    router.get('home', '/', (ctx) => {
      ctx.body = {
        url: ctx.router.url('home')
      };
    });
    app.use(router.routes());
    const res = await request(http.createServer(app.callback()))
      .get('/')
      .expect(200);

    assert.strictEqual(res.body.url, '/');
  });

  it('registers multiple middleware for one route', async () => {
    const app = new Koa();
    const router = new Router();

    router.get(
      '/double',
      (ctx, next) => {
        return new Promise((resolve) => {
          setTimeout(() => {
            ctx.body = { message: 'Hello' };
            resolve(next());
          }, 1);
        });
      },
      (ctx, next) => {
        return new Promise((resolve) => {
          setTimeout(() => {
            (ctx.body as { message: string }).message += ' World';
            resolve(next());
          }, 1);
        });
      },
      (ctx) => {
        (ctx.body as { message: string }).message += '!';
      }
    );

    app.use(router.routes());

    const res = await request(http.createServer(app.callback()))
      .get('/double')
      .expect(200);

    assert.strictEqual(res.body.message, 'Hello World!');
  });

  it('does not break when nested-routes use regexp paths', async () => {
    const app = new Koa();
    const parentRouter = new Router();
    const nestedRouter = new Router();

    nestedRouter
      .get(/^\/\w$/i, (ctx, next) => {
        return next();
      })
      .get('/first-nested-route', (ctx, next) => {
        return next();
      })
      .get('/second-nested-route', (ctx, next) => {
        return next();
      });

    parentRouter.use(
      '/parent-route',
      (ctx, next) => {
        return next();
      },
      nestedRouter.routes()
    );

    app.use(parentRouter.routes());
    assert.strictEqual(Boolean(app), true);
  });

  it('exposes middleware factory', async () => {
    const router = new Router();
    assert.strictEqual('routes' in router, true);
    assert.strictEqual(typeof router.routes, 'function');
    const middleware = router.routes();
    assert.strictEqual(Boolean(middleware), true);
    assert.strictEqual(typeof middleware, 'function');
  });

  it('supports promises for async/await', async () => {
    const app = new Koa();
    (app as Koa & { experimental: boolean }).experimental = true;
    const router = new Router();
    router.get('/async', (ctx) => {
      return new Promise<void>((resolve) => {
        setTimeout(() => {
          ctx.body = {
            msg: 'promises!'
          };
          resolve();
        }, 1);
      });
    });

    app.use(router.routes()).use(router.allowedMethods());
    const res = await request(http.createServer(app.callback()))
      .get('/async')
      .expect(200);

    assert.strictEqual(res.body.msg, 'promises!');
  });

  it('matches middleware only if route was matched (gh-182)', async () => {
    const app = new Koa();
    const router = new Router();
    const otherRouter = new Router();

    router.use((ctx, next) => {
      ctx.body = { bar: 'baz' };
      return next();
    });

    otherRouter.get('/bar', (ctx) => {
      ctx.body = ctx.body || { foo: 'bar' };
    });

    app.use(router.routes()).use(otherRouter.routes());

    const res = await request(http.createServer(app.callback()))
      .get('/bar')
      .expect(200);

    assert.strictEqual(res.body.foo, 'bar');
    assert.strictEqual('bar' in res.body, false);
  });

  it('matches first to last', async () => {
    const app = new Koa();
    const router = new Router();

    router
      .get('user_page', '/user/{*any}.jsx', (ctx) => {
        ctx.body = { order: 1 };
      })
      .all('app', '/app/{*any}.jsx', (ctx) => {
        ctx.body = { order: 2 };
      })
      .all('view', '{*any}.jsx', (ctx) => {
        ctx.body = { order: 3 };
      });

    const res = await request(
      http.createServer(app.use(router.routes()).callback())
    )
      .get('/user/account.jsx')
      .expect(200);

    assert.strictEqual(res.body.order, 1);
  });

  it('runs multiple controllers when there are multiple matches', async () => {
    const app = new Koa();
    const router = new Router();

    router
      .get('users_single', '/users/:id{/*path}', (ctx, next) => {
        ctx.body = { single: true };
        next();
      })
      .get('users_all', '/users/all', (ctx, next) => {
        ctx.body = { ...(ctx.body as object), all: true };
        next();
      });

    const res = await request(
      http.createServer(app.use(router.routes()).callback())
    )
      .get('/users/all')
      .expect(200);

    assert.strictEqual('single' in res.body, true);
    assert.strictEqual('all' in res.body, true);
  });

  it("runs only the last match when the 'exclusive' option is enabled", async () => {
    const app = new Koa();
    const router = new Router({ exclusive: true });

    router
      .get('users_single', new RegExp('/users/:id(.*)'), (ctx, next) => {
        ctx.body = { single: true };
        next();
      })
      .get('users_all', '/users/all', (ctx, next) => {
        ctx.body = { ...(ctx.body as object), all: true };
        next();
      });

    const res = await request(
      http.createServer(app.use(router.routes()).callback())
    )
      .get('/users/all')
      .expect(200);

    assert.strictEqual('single' in res.body, false);
    assert.strictEqual('all' in res.body, true);
  });

  it('does not run subsequent middleware without calling next', async () => {
    const app = new Koa();
    const router = new Router();

    router.get(
      'user_page',
      '/user/{*any}.jsx',
      () => {},
      (ctx) => {
        ctx.body = { order: 1 };
      }
    );

    await request(http.createServer(app.use(router.routes()).callback()))
      .get('/user/account.jsx')
      .expect(404);
  });

  it('nests routers with prefixes at root', async () => {
    const app = new Koa();
    const forums = new Router({
      prefix: '/forums'
    });
    const posts = new Router({
      prefix: '/:fid/posts'
    });

    posts
      .get('/', (ctx, next) => {
        ctx.status = 204;
        return next();
      })
      .get('/:pid', (ctx, next) => {
        ctx.body = ctx.params;
        return next();
      });

    forums.use(posts.routes());

    const server = http.createServer(app.use(forums.routes()).callback());

    await request(server).get('/forums/1/posts').expect(204);
    await request(server).get('/forums/1').expect(404);
    const res = await request(server).get('/forums/1/posts/2').expect(200);

    assert.strictEqual(res.body.fid, '1');
    assert.strictEqual(res.body.pid, '2');
  });
});

it('nests routers with prefixes at path', async () => {
  const app = new Koa();
  const forums = new Router({
    prefix: '/api'
  });
  const posts = new Router({
    prefix: '/posts'
  });

  posts
    .get('/', (ctx, next) => {
      ctx.status = 204;
      return next();
    })
    .get('/:pid', (ctx, next) => {
      ctx.body = ctx.params;
      return next();
    });

  forums.use('/forums/:fid', posts.routes());

  const server = http.createServer(app.use(forums.routes()).callback());

  await request(server).get('/api/forums/1/posts').expect(204);

  await request(server).get('/api/forums/1').expect(404);

  const res = await request(server).get('/api/forums/1/posts/2').expect(200);

  assert.strictEqual(res.body.fid, '1');
  assert.strictEqual(res.body.pid, '2');
});

it('runs subrouter middleware after parent', async () => {
  const app = new Koa();
  const subrouter = new Router()
    .use((ctx, next) => {
      ctx.msg = 'subrouter';
      return next();
    })
    .get('/', (ctx) => {
      ctx.body = { msg: ctx.msg };
    });
  const router = new Router()
    .use((ctx, next) => {
      ctx.msg = 'router';
      return next();
    })
    .use(subrouter.routes());
  const res = await request(
    http.createServer(app.use(router.routes()).callback())
  )
    .get('/')
    .expect(200);

  assert.strictEqual(res.body.msg, 'subrouter');
});

it('runs parent middleware for subrouter routes', async () => {
  const app = new Koa();
  const subrouter = new Router().get('/sub', (ctx) => {
    ctx.body = { msg: ctx.msg };
  });
  const router = new Router()
    .use((ctx, next) => {
      ctx.msg = 'router';
      return next();
    })
    .use('/parent', subrouter.routes());
  const res = await request(
    http.createServer(app.use(router.routes()).callback())
  )
    .get('/parent/sub')
    .expect(200);

  assert.strictEqual(res.body.msg, 'router');
});

it('matches corresponding requests', async () => {
  const app = new Koa();
  const router = new Router();
  app.use(router.routes());
  router.get('/:category/:title', (ctx) => {
    assert.strictEqual('params' in ctx, true);
    assert.strictEqual(ctx.params.category, 'programming');
    assert.strictEqual(ctx.params.title, 'how-to-node');
    ctx.status = 204;
  });
  router.post('/:category', (ctx) => {
    assert.strictEqual('params' in ctx, true);
    assert.strictEqual(ctx.params.category, 'programming');
    ctx.status = 204;
  });
  router.put('/:category/not-a-title', (ctx) => {
    assert.strictEqual('params' in ctx, true);
    assert.strictEqual(ctx.params.category, 'programming');
    assert.strictEqual('title' in ctx.params, false);

    ctx.status = 204;
  });
  const server = http.createServer(app.callback());
  await request(server).get('/programming/how-to-node').expect(204);

  await request(server).post('/programming').expect(204);

  await request(server).put('/programming/not-a-title').expect(204);
});

it('matches corresponding requests with optional route parameter', async () => {
  const app = new Koa();
  const router = new Router();
  app.use(router.routes());
  router.get('/resources', (ctx) => {
    assert.strictEqual('params' in ctx, true);
    assert.deepStrictEqual(ctx.params, {});
    ctx.status = 204;
  });
  const id = '10';
  const ext = '.json';
  router.get('/resources/:id{.:ext}', (ctx) => {
    assert.strictEqual('params' in ctx, true);
    assert.strictEqual(ctx.params.id, id);
    if (ctx.params.ext) assert.strictEqual(ctx.params.ext, ext.slice(1));
    ctx.status = 204;
  });
  const server = http.createServer(app.callback());
  await request(server).get('/resources').expect(204);

  await request(server)
    .get('/resources/' + id)
    .expect(204);

  await request(server)
    .get('/resources/' + id + ext)
    .expect(204);
});

it('executes route middleware using `app.context`', async () => {
  const app = new Koa();
  const router = new Router();
  app.use(router.routes());
  router.use((ctx, next) => {
    ctx.bar = 'baz';
    return next();
  });
  router.get(
    '/:category/:title',
    (ctx, next) => {
      ctx.foo = 'bar';
      return next();
    },
    (ctx) => {
      assert.strictEqual(ctx.bar, 'baz');
      assert.strictEqual(ctx.foo, 'bar');
      assert.strictEqual('app' in ctx, true);
      assert.strictEqual('req' in ctx, true);
      assert.strictEqual('res' in ctx, true);
      ctx.status = 204;
    }
  );
  await request(http.createServer(app.callback()))
    .get('/match/this')
    .expect(204);
});

it('does not match after ctx.throw()', async () => {
  const app = new Koa();
  let counter = 0;
  const router = new Router();
  app.use(router.routes());
  router.get('/', (ctx) => {
    counter++;
    ctx.throw(403);
  });
  router.get('/', () => {
    counter++;
  });
  const server = http.createServer(app.callback());
  await request(server).get('/').expect(403);

  assert.strictEqual(counter, 1);
});

it('supports promises for route middleware', async () => {
  const app = new Koa();
  const router = new Router();
  app.use(router.routes());
  const readVersion = () => {
    return new Promise((resolve, reject) => {
      const packagePath = path.join(__dirname, '..', 'package.json');
      fs.readFile(packagePath, 'utf8', (err, data) => {
        if (err) return reject(err);
        resolve(JSON.parse(data).version);
      });
    });
  };

  router.get(
    '/',
    (_, next) => {
      return next();
    },
    (ctx) => {
      return readVersion().then(() => {
        ctx.status = 204;
      });
    }
  );
  await request(http.createServer(app.callback())).get('/').expect(204);
});

describe('Router#allowedMethods()', () => {
  it('responds to OPTIONS requests', async () => {
    const app = new Koa();
    const router = new Router();
    app.use(router.routes());
    app.use(router.allowedMethods());
    router.get('/users', () => {});
    router.put('/users', () => {});
    const res = await request(http.createServer(app.callback()))
      .options('/users')
      .expect(200);
    assert.strictEqual(res.header['content-length'], '0');
    assert.strictEqual(res.header.allow, 'HEAD, GET, PUT');
  });

  it('should handle requests to non-existent routes without crashing', async () => {
    const app = new Koa();
    const router = new Router();

    router.get('/exists', (ctx) => {
      ctx.body = 'exists';
    });

    app.use(router.routes());
    app.use(router.allowedMethods());

    await request(http.createServer(app.callback()))
      .get('/does-not-exist')
      .expect(404);
  });

  it('should set Allow header with correct methods for 405 responses', async () => {
    const app = new Koa();
    const router = new Router();

    router.get('/resource', (ctx) => {
      ctx.body = 'get';
    });

    router.post('/resource', (ctx) => {
      ctx.body = 'post';
    });

    app.use(router.routes());
    app.use(router.allowedMethods());

    const res = await request(http.createServer(app.callback()))
      .delete('/resource')
      .expect(405);

    assert.ok(res.headers.allow);
    assert.ok(res.headers.allow.includes('GET'));
    assert.ok(res.headers.allow.includes('POST'));
  });

  it('should return uppercase method names in Allow header', async () => {
    const app = new Koa();
    const router = new Router();

    router.get('/test', (ctx) => {
      ctx.body = 'get';
    });
    router.post('/test', (ctx) => {
      ctx.body = 'post';
    });

    app.use(router.routes());
    app.use(router.allowedMethods());

    const res = await request(http.createServer(app.callback()))
      .options('/test')
      .expect(200);

    assert.ok(res.headers.allow.includes('GET'));
    assert.ok(res.headers.allow.includes('POST'));
    assert.ok(res.headers.allow.includes('HEAD'));
  });
});

it('responds with 405 Method Not Allowed', async () => {
  const app = new Koa();
  const router = new Router();
  router.get('/users', () => {});
  router.put('/users', () => {});
  router.post('/events', () => {});
  app.use(router.routes());
  app.use(router.allowedMethods());
  const res = await request(http.createServer(app.callback()))
    .post('/users')
    .expect(405);
  assert.strictEqual(res.header.allow, 'HEAD, GET, PUT');
});

it('responds with 405 Method Not Allowed using the "throw" option', async () => {
  const app = new Koa();
  const router = new Router();
  app.use(router.routes());
  app.use((ctx, next) => {
    return next().catch((err: HttpError) => {
      assert.strictEqual(err.name, 'MethodNotAllowedError');
      assert.strictEqual(err.statusCode, 405);

      ctx.body = err.name;
      ctx.status = err.statusCode;
    });
  });
  app.use(router.allowedMethods({ throw: true }));
  router.get('/users', () => {});
  router.put('/users', () => {});
  router.post('/events', () => {});
  const res = await request(http.createServer(app.callback()))
    .post('/users')
    .expect(405);
  assert.strictEqual('allow' in res.header, false);
});

it('responds with user-provided throwable using the "throw" and "methodNotAllowed" options', async () => {
  const app = new Koa();
  const router = new Router();
  app.use(router.routes());
  app.use((ctx, next) => {
    return next().catch((err: HttpError) => {
      assert.strictEqual(err.message, 'Custom Not Allowed Error');
      assert.strictEqual(err.statusCode, 405);

      ctx.body = err.body;
      ctx.status = err.statusCode;
    });
  });
  app.use(
    router.allowedMethods({
      throw: true,
      methodNotAllowed() {
        const notAllowedErr: HttpError = new Error('Custom Not Allowed Error');
        notAllowedErr.type = 'custom';
        notAllowedErr.statusCode = 405;
        notAllowedErr.body = {
          error: 'Custom Not Allowed Error',
          statusCode: 405,
          otherStuff: true
        };
        return notAllowedErr;
      }
    })
  );
  router.get('/users', () => {});
  router.put('/users', () => {});
  router.post('/events', () => {});
  const res = await request(http.createServer(app.callback()))
    .post('/users')
    .expect(405);
  assert.strictEqual('allow' in res.header, false);
  assert.deepStrictEqual(res.body, {
    error: 'Custom Not Allowed Error',
    statusCode: 405,
    otherStuff: true
  });
});

it('responds with 501 Not Implemented', async () => {
  const app = new Koa();
  const router = new Router();
  app.use(router.routes());
  app.use(router.allowedMethods());
  router.get('/users', () => {});
  router.put('/users', () => {});
  await request(http.createServer(app.callback())).search('/users').expect(501);
});

it('responds with 501 Not Implemented using the "throw" option', async () => {
  const app = new Koa();
  const router = new Router();
  app.use(router.routes());
  app.use((ctx, next) => {
    return next().catch((err: HttpError) => {
      assert.strictEqual(err.name, 'NotImplementedError');
      assert.strictEqual(err.statusCode, 501);

      ctx.body = err.name;
      ctx.status = err.statusCode;
    });
  });
  app.use(router.allowedMethods({ throw: true }));
  router.get('/users', () => {});
  router.put('/users', () => {});
  const res = await request(http.createServer(app.callback()))
    .search('/users')
    .expect(501);
  assert.strictEqual('allow' in res.header, false);
});

it('responds with user-provided throwable using the "throw" and "notImplemented" options', async () => {
  const app = new Koa();
  const router = new Router();
  app.use(router.routes());
  app.use((ctx, next) => {
    return next().catch((err: HttpError) => {
      assert.strictEqual(err.message, 'Custom Not Implemented Error');
      assert.strictEqual(err.type, 'custom');
      assert.strictEqual(err.statusCode, 501);

      ctx.body = err.body;
      ctx.status = err.statusCode;
    });
  });
  app.use(
    router.allowedMethods({
      throw: true,
      notImplemented() {
        const notImplementedErr: HttpError = new Error(
          'Custom Not Implemented Error'
        );
        notImplementedErr.type = 'custom';
        notImplementedErr.statusCode = 501;
        notImplementedErr.body = {
          error: 'Custom Not Implemented Error',
          statusCode: 501,
          otherStuff: true
        };
        return notImplementedErr;
      }
    })
  );
  router.get('/users', () => {});
  router.put('/users', () => {});
  const res = await request(http.createServer(app.callback()))
    .search('/users')
    .expect(501);
  assert.strictEqual('allow' in res.header, false);
  assert.deepStrictEqual(res.body, {
    error: 'Custom Not Implemented Error',
    statusCode: 501,
    otherStuff: true
  });
});

it('does not send 405 if route matched but status is 404', async () => {
  const app = new Koa();
  const router = new Router();
  app.use(router.routes());
  app.use(router.allowedMethods());
  router.get('/users', (ctx) => {
    ctx.status = 404;
  });
  await request(http.createServer(app.callback())).get('/users').expect(404);
});

it('sets the allowed methods to a single Allow header #273', async () => {
  const app = new Koa();
  const router = new Router();
  app.use(router.routes());
  app.use(router.allowedMethods());

  router.get('/', () => {});

  const res = await request(http.createServer(app.callback()))
    .options('/')
    .expect(200);

  assert.strictEqual(res.header.allow, 'HEAD, GET');
  const allowHeaders = (
    res as unknown as { res: { rawHeaders: string[] } }
  ).res.rawHeaders.filter((item: string) => item === 'Allow');
  assert.strictEqual(allowHeaders.length, 1);
});

it('allowedMethods check if flow (allowedArr.length)', async () => {
  const app = new Koa();
  const router = new Router();
  app.use(router.routes());
  app.use(router.allowedMethods());

  router.get('');

  await request(http.createServer(app.callback())).get('/users');
});

it('supports custom routing detect path: ctx.routerPath', async () => {
  const app = new Koa();
  const router = new Router();
  app.use((ctx, next) => {
    const appname = ctx.request.hostname.split('.', 1)[0];
    ctx.newRouterPath = '/' + appname + ctx.path;
    return next();
  });
  app.use(router.routes());
  router.get('/helloworld/users', (ctx) => {
    ctx.body = ctx.method + ' ' + ctx.url;
  });

  await request(http.createServer(app.callback()))
    .get('/users')
    .set('Host', 'helloworld.example.com')
    .expect(200)
    .expect('GET /users');
});

it('parameter added to request in ctx', async () => {
  const app = new Koa();
  const router = new Router();
  router.get('/echo/:saying', (ctx) => {
    try {
      assert.strictEqual(ctx.params.saying, 'helloWorld');
      assert.strictEqual(ctx.request.params.saying, 'helloWorld');
      ctx.body = { echo: ctx.params.saying };
    } catch (err) {
      ctx.status = 500;
      ctx.body = (err as Error).message;
    }
  });
  app.use(router.routes());
  const res = await request(http.createServer(app.callback()))
    .get('/echo/helloWorld')
    .expect(200);

  assert.deepStrictEqual(res.body, { echo: 'helloWorld' });
});

it('two routes with the same path', async () => {
  const app = new Koa();
  const router1 = new Router();
  const router2 = new Router();
  router1.get('/echo/:saying', (ctx, next) => {
    try {
      assert.strictEqual(ctx.params.saying, 'helloWorld');
      assert.strictEqual(ctx.request.params.saying, 'helloWorld');
      next();
    } catch (err) {
      ctx.status = 500;
      ctx.body = (err as Error).message;
    }
  });
  router2.get('/echo/:saying', (ctx) => {
    try {
      assert.strictEqual(ctx.params.saying, 'helloWorld');
      assert.strictEqual(ctx.request.params.saying, 'helloWorld');
      ctx.body = { echo: ctx.params.saying };
    } catch (err) {
      ctx.status = 500;
      ctx.body = (err as Error).message;
    }
  });
  app.use(router1.routes());
  app.use(router2.routes());
  const res = await request(http.createServer(app.callback()))
    .get('/echo/helloWorld')
    .expect(200);

  assert.deepStrictEqual(res.body, { echo: 'helloWorld' });
});

it('parameter added to request in ctx with sub router', async () => {
  const app = new Koa();
  const router = new Router();
  const subrouter = new Router();

  router.use((ctx, next) => {
    ctx.foo = 'boo';
    return next();
  });

  subrouter.get('/:saying', (ctx) => {
    try {
      assert.strictEqual(ctx.params.saying, 'helloWorld');
      assert.strictEqual(ctx.request.params.saying, 'helloWorld');
      ctx.body = { echo: ctx.params.saying };
    } catch (err) {
      ctx.status = 500;
      ctx.body = (err as Error).message;
    }
  });

  router.use('/echo', subrouter.routes());
  app.use(router.routes());
  const res = await request(http.createServer(app.callback()))
    .get('/echo/helloWorld')
    .expect(200);

  assert.deepStrictEqual(res.body, { echo: 'helloWorld' });
});

describe('Router#[verb]()', () => {
  it('registers route specific to HTTP verb', () => {
    const app = new Koa();
    const router = new Router();
    app.use(router.routes());
    for (const method of methods) {
      assert.strictEqual(method in router, true);
      assert.strictEqual(
        typeof (router as unknown as Record<string, unknown>)[method],
        'function'
      );
      (router as unknown as Record<string, Function>)[method]('/', () => {});
    }

    assert.strictEqual(router.stack.length, methods.length);
  });

  it('registers route with a regexp path', () => {
    const router = new Router();
    for (const method of methods) {
      assert.strictEqual(
        (router as unknown as Record<string, Function>)[method](
          /^\/\w$/i,
          () => {}
        ),
        router
      );
    }
  });

  it('registers route with a given name', () => {
    const router = new Router();
    for (const method of methods) {
      assert.strictEqual(
        (router as unknown as Record<string, Function>)[method](
          method,
          '/',
          () => {}
        ),
        router
      );
    }
  });

  it('registers route with with a given name and regexp path', () => {
    const router = new Router();
    for (const method of methods) {
      assert.strictEqual(
        (router as unknown as Record<string, Function>)[method](
          method,
          /^\/$/i,
          () => {}
        ),
        router
      );
    }
  });

  it('enables route chaining', () => {
    const router = new Router();
    for (const method of methods) {
      assert.strictEqual(
        (router as unknown as Record<string, Function>)[method]('/', () => {}),
        router
      );
    }
  });

  it('registers array of paths (gh-203)', () => {
    const router = new Router();
    router.get(['/one', '/two'], (ctx, next) => {
      return next();
    });
    assert.strictEqual(router.stack.length, 2);
    assert.strictEqual(router.stack[0].path, '/one');
    assert.strictEqual(router.stack[1].path, '/two');
  });

  it('resolves non-parameterized routes without attached parameters', async () => {
    const app = new Koa();
    const router = new Router();

    router.get('/notparameter', (ctx) => {
      ctx.body = {
        param: ctx.params.parameter
      };
    });

    router.get('/:parameter', (ctx) => {
      ctx.body = {
        param: ctx.params.parameter
      };
    });

    app.use(router.routes());
    const res = await request(http.createServer(app.callback()))
      .get('/notparameter')
      .expect(200);
    assert.strictEqual('param' in res.body, false);
  });

  it('correctly returns an error when not passed a path for verb-specific registration (gh-147)', () => {
    const router = new Router();
    for (const el of methods) {
      try {
        (router as unknown as Record<string, Function>)[el](() => {});
      } catch (err) {
        assert.strictEqual(
          (err as Error).message,
          `You have to provide a path when adding a ${el} handler`
        );
      }
    }
  });

  it('correctly returns an error when not passed a path for "all" registration (gh-147)', () => {
    const router = new Router();
    try {
      // @ts-expect-error - testing invalid call without path
      router.all(() => {});
    } catch (err) {
      assert.strictEqual(
        (err as Error).message,
        'You have to provide a path when adding an all handler'
      );
    }
  });

  it('validates parameters in route handlers (v14 approach for custom regex)', async () => {
    const app = new Koa();
    const router = new Router();

    const uuidRegex =
      /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

    router.get('/user/:id', (ctx) => {
      if (!uuidRegex.test(ctx.params.id)) {
        ctx.status = 400;
        ctx.body = { error: 'Invalid UUID format' };
        return;
      }
      ctx.body = { id: ctx.params.id, valid: true };
    });

    app.use(router.routes());

    const res1 = await request(http.createServer(app.callback()))
      .get('/user/123e4567-e89b-12d3-a456-426614174000')
      .expect(200);
    assert.strictEqual(res1.body.valid, true);
    assert.strictEqual(res1.body.id, '123e4567-e89b-12d3-a456-426614174000');

    const res2 = await request(http.createServer(app.callback()))
      .get('/user/invalid-uuid')
      .expect(400);
    assert.strictEqual(res2.body.error, 'Invalid UUID format');
  });

  it('validates parameters with middleware (v14 approach for custom regex)', async () => {
    const app = new Koa();
    const router = new Router();

    function validateUUID(paramName: string): RouterMiddleware {
      const uuidRegex =
        /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
      return async (ctx, next) => {
        if (!uuidRegex.test(ctx.params[paramName])) {
          ctx.status = 400;
          ctx.body = { error: `Invalid ${paramName} format` };
          return;
        }
        await next();
      };
    }

    router.get('/role/:id', validateUUID('id'), (ctx) => {
      ctx.body = { id: ctx.params.id, valid: true };
    });

    app.use(router.routes());

    const res1 = await request(http.createServer(app.callback()))
      .get('/role/550e8400-e29b-41d4-a716-446655440000')
      .expect(200);
    assert.strictEqual(res1.body.valid, true);

    const res2 = await request(http.createServer(app.callback()))
      .get('/role/not-a-uuid')
      .expect(400);
    assert.strictEqual(res2.body.error, 'Invalid id format');
  });

  it('should support del() method as alias for delete()', async () => {
    const app = new Koa();
    const router = new Router();
    app.use(router.routes());
    router.del('/users/:id', (ctx) => {
      ctx.body = { deleted: ctx.params.id };
    });
    await request(http.createServer(app.callback()))
      .delete('/users/123')
      .expect(200, { deleted: '123' });
  });
});

describe('Router#use()', () => {
  it('uses router middleware without path', async () => {
    const app = new Koa();
    const router = new Router();

    router.use((ctx, next) => {
      ctx.foo = 'baz';
      return next();
    });

    router.use((ctx, next) => {
      ctx.foo = 'foo';
      return next();
    });

    router.get('/foo/bar', (ctx) => {
      ctx.body = {
        foobar: ctx.foo + 'bar'
      };
    });

    app.use(router.routes());
    const res = await request(http.createServer(app.callback()))
      .get('/foo/bar')
      .expect(200);

    assert.strictEqual(res.body.foobar, 'foobar');
  });

  it('uses router middleware at given path', async () => {
    const app = new Koa();
    const router = new Router();

    router.use('/foo/bar', (ctx, next) => {
      ctx.foo = 'foo';
      return next();
    });

    router.get('/foo/bar', (ctx) => {
      ctx.body = {
        foobar: ctx.foo + 'bar'
      };
    });

    app.use(router.routes());
    const res = await request(http.createServer(app.callback()))
      .get('/foo/bar')
      .expect(200);

    assert.strictEqual(res.body.foobar, 'foobar');
  });

  it('runs router middleware before subrouter middleware', async () => {
    const app = new Koa();
    const router = new Router();
    const subrouter = new Router();

    router.use((ctx, next) => {
      ctx.foo = 'boo';
      return next();
    });

    subrouter
      .use((ctx, next) => {
        ctx.foo = 'foo';
        return next();
      })
      .get('/bar', (ctx) => {
        ctx.body = {
          foobar: ctx.foo + 'bar'
        };
      });

    router.use('/foo', subrouter.routes());
    app.use(router.routes());
    const res = await request(http.createServer(app.callback()))
      .get('/foo/bar')
      .expect(200);

    assert.strictEqual(res.body.foobar, 'foobar');
  });

  it('assigns middleware to array of paths', async () => {
    const app = new Koa();
    const router = new Router();

    router.use(['/foo', '/bar'], (ctx, next) => {
      ctx.foo = 'foo';
      ctx.bar = 'bar';
      return next();
    });

    router.get('/foo', (ctx) => {
      ctx.body = {
        foobar: ctx.foo + 'bar'
      };
    });

    router.get('/bar', (ctx) => {
      ctx.body = {
        foobar: 'foo' + ctx.bar
      };
    });

    app.use(router.routes());
    const res = await request(http.createServer(app.callback()))
      .get('/foo')
      .expect(200);
    assert.strictEqual(res.body.foobar, 'foobar');

    const secondRes = await request(http.createServer(app.callback()))
      .get('/bar')
      .expect(200);

    assert.strictEqual(secondRes.body.foobar, 'foobar');
  });

  it('uses router middleware with RegExp path', async () => {
    const app = new Koa();
    const router = new Router();

    router.use(/^\/api\//, (ctx, next) => {
      ctx.apiFlag = 'matched';
      return next();
    });

    router.get('/api/users', (ctx) => {
      ctx.body = {
        flag: ctx.apiFlag || 'none'
      };
    });

    router.get('/public/users', (ctx) => {
      ctx.body = {
        flag: ctx.apiFlag || 'none'
      };
    });

    app.use(router.routes());

    const res1 = await request(http.createServer(app.callback()))
      .get('/api/users')
      .expect(200);
    assert.strictEqual(res1.body.flag, 'matched');

    const res2 = await request(http.createServer(app.callback()))
      .get('/public/users')
      .expect(200);
    assert.strictEqual(res2.body.flag, 'none');
  });

  it('uses router middleware with RegExp matching multiple routes', async () => {
    const app = new Koa();
    const router = new Router();

    router.use(/^\/a/, (ctx, next) => {
      ctx.regexpMatched = true;
      return next();
    });

    router.post('/a1', (ctx) => {
      ctx.body = { route: 'a1', matched: ctx.regexpMatched || false };
    });

    router.post('/a2', (ctx) => {
      ctx.body = { route: 'a2', matched: ctx.regexpMatched || false };
    });

    router.post('/b1', (ctx) => {
      ctx.body = { route: 'b1', matched: ctx.regexpMatched || false };
    });

    app.use(router.routes());

    const res1 = await request(http.createServer(app.callback()))
      .post('/a1')
      .expect(200);
    assert.strictEqual(res1.body.matched, true);
    assert.strictEqual(res1.body.route, 'a1');

    const res2 = await request(http.createServer(app.callback()))
      .post('/a2')
      .expect(200);
    assert.strictEqual(res2.body.matched, true);
    assert.strictEqual(res2.body.route, 'a2');

    const res3 = await request(http.createServer(app.callback()))
      .post('/b1')
      .expect(200);
    assert.strictEqual(res3.body.matched, false);
    assert.strictEqual(res3.body.route, 'b1');
  });

  it('uses router middleware with RegExp and multiple middleware functions', async () => {
    const app = new Koa();
    const router = new Router();

    router.use(
      /^\/admin/,
      (ctx, next) => {
        ctx.step1 = 'done';
        return next();
      },
      ((ctx, next) => {
        ctx.step2 = 'done';
        return next();
      }) as RouterMiddleware
    );

    router.get('/admin/dashboard', (ctx) => {
      ctx.body = {
        step1: ctx.step1 || 'none',
        step2: ctx.step2 || 'none'
      };
    });

    app.use(router.routes());

    const res = await request(http.createServer(app.callback()))
      .get('/admin/dashboard')
      .expect(200);

    assert.strictEqual(res.body.step1, 'done');
    assert.strictEqual(res.body.step2, 'done');
  });

  it('uses nested router with RegExp path', async () => {
    const app = new Koa();
    const router = new Router();
    const subrouter = new Router();

    subrouter.get('/dashboard', (ctx) => {
      ctx.body = {
        auth: ctx.isAuthenticated || false
      };
    });

    router.use(/^\/admin/, (ctx, next) => {
      ctx.isAuthenticated = true;
      return next();
    });

    router.use('/admin', subrouter.routes());

    app.use(router.routes());

    const res = await request(http.createServer(app.callback()))
      .get('/admin/dashboard')
      .expect(200);

    assert.strictEqual(res.body.auth, true);
  });
});

it('without path, does not set params.0 to the matched path - gh-247', async () => {
  const app = new Koa();
  const router = new Router();

  router.use((ctx, next) => {
    return next();
  });

  router.get('/foo/:id', (ctx) => {
    ctx.body = ctx.params;
  });

  app.use(router.routes());
  const res = await request(http.createServer(app.callback()))
    .get('/foo/815')
    .expect(200);

  assert.strictEqual(res.body.id, '815');
  assert.strictEqual('0' in res.body, false);
});

it('does not add an erroneous (.*) to unprefiexed nested routers - gh-369 gh-410', async () => {
  const app = new Koa();
  const router = new Router();
  const nested = new Router();
  let called = 0;

  nested
    .get('/', (ctx, next) => {
      ctx.body = 'root';
      called += 1;
      return next();
    })
    .get('/test', (ctx, next) => {
      ctx.body = 'test';
      called += 1;
      return next();
    });

  router.use(nested.routes());
  app.use(router.routes());

  await request(app.callback()).get('/test').expect(200).expect('test');

  assert.strictEqual(called, 1, 'too many routes matched');
});

it('assigns middleware to array of paths with function middleware and router need to nest. - gh-22', async () => {
  const app = new Koa();
  const base = new Router({ prefix: '/api' });
  const nested = new Router({ prefix: '/qux' });
  const pathList = ['/foo', '/bar'];

  nested.get('/baz', (ctx) => {
    ctx.body = {
      foo: ctx.foo,
      bar: ctx.bar,
      baz: 'baz'
    };
  });

  base.use(
    pathList,
    (ctx, next) => {
      ctx.foo = 'foo';
      ctx.bar = 'bar';

      return next();
    },
    nested.routes()
  );

  app.use(base.routes());

  await Promise.all(
    pathList.map((pathname) =>
      request(http.createServer(app.callback()))
        .get(`/api${pathname}/qux/baz`)
        .expect(200)
    )
  ).then((resList) => {
    for (const res of resList) {
      assert.deepStrictEqual(res.body, { foo: 'foo', bar: 'bar', baz: 'baz' });
    }
  });
});

it('middleware with "/" in path array does not match all routes (gh-46)', async () => {
  const app = new Koa();
  const router = new Router({ prefix: '/account' });
  let middlewareCalled = false;

  router.use(['/signout', '/', '/update'], async (ctx, next) => {
    middlewareCalled = true;
    await next();
  });

  router.post('/signin', (ctx) => {
    ctx.body = 'signin';
  });

  router.delete('/signout', (ctx) => {
    ctx.body = 'signout';
  });

  router.get('/', (ctx) => {
    ctx.body = 'profile';
  });

  app.use(router.routes());

  middlewareCalled = false;
  await request(http.createServer(app.callback()))
    .delete('/account/signout')
    .expect(200);
  assert.strictEqual(
    middlewareCalled,
    true,
    'Middleware should run on /account/signout'
  );

  middlewareCalled = false;
  await request(http.createServer(app.callback())).get('/account/').expect(200);
  assert.strictEqual(
    middlewareCalled,
    true,
    'Middleware should run on /account/'
  );

  middlewareCalled = false;
  await request(http.createServer(app.callback()))
    .post('/account/signin')
    .expect(200);
  assert.strictEqual(
    middlewareCalled,
    false,
    'Middleware should NOT run on /account/signin'
  );
});

it('nested router middleware does not affect unrelated routes (gh-90)', async () => {
  const app = new Koa();
  let checkAuthCalled = false;

  const ajaxRouter = new Router({ prefix: '/a' });
  ajaxRouter.use(async (ctx, next) => {
    checkAuthCalled = true;
    await next();
  });
  ajaxRouter.get('/1', (ctx) => {
    ctx.body = 'route-1';
  });

  const indexRouter = new Router();
  indexRouter.get('/', (ctx) => {
    ctx.body = 'index';
  });
  indexRouter.get('/about', (ctx) => {
    ctx.body = 'about';
  });

  const mainRouter = new Router();
  mainRouter.use(ajaxRouter.routes());
  mainRouter.use(indexRouter.routes());

  app.use(mainRouter.routes());

  checkAuthCalled = false;
  await request(http.createServer(app.callback())).get('/a/1').expect(200);
  assert.strictEqual(checkAuthCalled, true, 'Middleware should run on /a/1');

  checkAuthCalled = false;
  await request(http.createServer(app.callback())).get('/about').expect(200);
  assert.strictEqual(
    checkAuthCalled,
    false,
    'Middleware should NOT run on /about'
  );
});

it('nested router middleware has access to parent path parameters', async () => {
  const app = new Koa();
  let capturedUserId = null;

  const usersRouter = new Router();
  usersRouter.use(async (ctx, next) => {
    capturedUserId = ctx.params.userId;
    await next();
  });
  usersRouter.get('/', async (ctx) => {
    ctx.body = {
      id: ctx.params.userId,
      name: 'John Doe'
    };
  });

  const mainRouter = new Router();
  mainRouter.use('/users/:userId', usersRouter.routes());

  app.use(mainRouter.routes());

  const res = await request(http.createServer(app.callback()))
    .get('/users/123')
    .expect(200);

  assert.strictEqual(
    capturedUserId,
    '123',
    'Nested router middleware should have access to parent params'
  );
  assert.strictEqual(res.body.id, '123');
});

it('uses a same router middleware at given paths continuously - ZijianHe/koa-router#gh-244 gh-18', async () => {
  const app = new Koa();
  const base = new Router({ prefix: '/api' });
  const nested = new Router({ prefix: '/qux' });

  nested.get('/baz', (ctx) => {
    ctx.body = {
      foo: ctx.foo,
      bar: ctx.bar,
      baz: 'baz'
    };
  });

  base
    .use(
      '/foo',
      (ctx, next) => {
        ctx.foo = 'foo';
        ctx.bar = 'bar';

        return next();
      },
      nested.routes()
    )
    .use(
      '/bar',
      (ctx, next) => {
        ctx.foo = 'foo';
        ctx.bar = 'bar';

        return next();
      },
      nested.routes()
    );

  app.use(base.routes());

  await Promise.all(
    ['/foo', '/bar'].map((pathname) =>
      request(http.createServer(app.callback()))
        .get(`/api${pathname}/qux/baz`)
        .expect(200)
    )
  ).then((resList) => {
    for (const res of resList) {
      assert.deepStrictEqual(res.body, { foo: 'foo', bar: 'bar', baz: 'baz' });
    }
  });
});

it('should throw error when called without any middleware functions', () => {
  const router = new Router();

  assert.throws(() => {
    // @ts-expect-error - testing runtime error for missing middleware
    router.use('/path');
  }, /You must provide at least one middleware function/);
});

it('should throw error when called with only path array and no middleware', () => {
  const router = new Router();

  assert.throws(() => {
    // @ts-expect-error - testing runtime error for missing middleware
    router.use(['/path1', '/path2']);
  }, /You must provide at least one middleware function/);
});

it('should not share middleware stack between original and nested router layers', () => {
  const router1 = new Router();
  router1.get('/test', (ctx) => {
    ctx.body = 'original';
  });

  const router2 = new Router();
  router2.use(router1.routes());

  const originalLayer = router1.stack[0];
  const clonedLayer = router2.stack[0];

  const testMiddleware: RouterMiddleware = (ctx) => {
    ctx.body = 'modified';
  };
  clonedLayer.stack.push(testMiddleware);

  assert.notStrictEqual(
    originalLayer.stack.length,
    clonedLayer.stack.length,
    'Cloned layer stack should be independent of original'
  );
});

it('should not share methods array between original and nested router layers', () => {
  const router1 = new Router();
  router1.get('/test', (ctx) => {
    ctx.body = 'test';
  });

  const router2 = new Router();
  router2.use(router1.routes());

  const originalLayer = router1.stack[0];
  const clonedLayer = router2.stack[0];

  clonedLayer.methods.push('POST');

  assert.ok(
    !originalLayer.methods.includes('POST'),
    'Original layer methods should not include POST'
  );
});

it('should not share opts between original and nested router layers', () => {
  const router1 = new Router();
  router1.get('/test', (ctx) => {
    ctx.body = 'test';
  });

  const router2 = new Router();
  router2.use(router1.routes());

  const originalLayer = router1.stack[0];
  const clonedLayer = router2.stack[0];

  clonedLayer.opts.sensitive = true;

  assert.strictEqual(
    originalLayer.opts.sensitive,
    false,
    'Original layer opts should not be modified'
  );
});

it('should accept valid string arrays as multiple paths', async () => {
  const app = new Koa();
  const router = new Router();
  const visited: string[] = [];

  router.use(['/path1', '/path2'], (ctx, next) => {
    visited.push(ctx.path);
    return next();
  });

  router.get('/path1', (ctx) => {
    ctx.body = 'path1';
  });
  router.get('/path2', (ctx) => {
    ctx.body = 'path2';
  });

  app.use(router.routes());

  await request(http.createServer(app.callback())).get('/path1').expect(200);
  await request(http.createServer(app.callback())).get('/path2').expect(200);

  assert.deepStrictEqual(visited, ['/path1', '/path2']);
});

describe('Router#register()', () => {
  it('registers new routes', async () => {
    const app = new Koa();
    const router = new Router();
    assert.strictEqual('register' in router, true);
    assert.strictEqual(typeof router.register, 'function');
    router.register('/', ['GET', 'POST'], () => {});
    app.use(router.routes());
    assert.strictEqual(Array.isArray(router.stack), true);
    assert.strictEqual(router.stack.length, 1);
    assert.strictEqual(router.stack[0].path, '/');
  });
});

describe('Router#redirect()', () => {
  it('registers redirect routes', async () => {
    const app = new Koa();
    const router = new Router();
    assert.strictEqual('redirect' in router, true);
    assert.strictEqual(typeof router.redirect, 'function');
    router.redirect('/source', '/destination', 302);
    app.use(router.routes());
    assert.strictEqual(router.stack.length, 1);
    assert.strictEqual(router.stack[0] instanceof Layer, true);
    assert.strictEqual(router.stack[0].path, '/source');
  });

  it('redirects using route names', async () => {
    const app = new Koa();
    const router = new Router();
    app.use(router.routes());
    router.get('home', '/', () => {});
    router.get('sign-up-form', '/sign-up-form', () => {});
    router.redirect('home', 'sign-up-form');
    const res = await request(http.createServer(app.callback()))
      .post('/')
      .expect(301);
    assert.strictEqual(res.header.location, '/sign-up-form');
  });

  it('should redirect correctly when source path starts with /', async () => {
    const app = new Koa();
    const router = new Router();

    router.redirect('/old', '/new');
    router.get('/new', (ctx) => {
      ctx.body = 'new page';
    });

    app.use(router.routes());

    const res = await request(http.createServer(app.callback()))
      .get('/old')
      .expect(301);

    assert.strictEqual(res.headers.location, '/new');
  });

  it('should redirect to named route destination', async () => {
    const app = new Koa();
    const router = new Router();

    router.get('newPage', '/new', (ctx) => {
      ctx.body = 'new page';
    });

    router.redirect('/old', 'newPage');

    app.use(router.routes());

    const res = await request(http.createServer(app.callback()))
      .get('/old')
      .expect(301);

    assert.strictEqual(res.headers.location, '/new');
  });
});

it('redirects using symbols as route names', async () => {
  const app = new Koa();
  const router = new Router();
  app.use(router.routes());
  const homeSymbol = Symbol('home');
  const signUpFormSymbol = Symbol('sign-up-form');
  // @ts-expect-error - testing symbol as route name
  router.get(homeSymbol, '/', () => {});
  // @ts-expect-error - testing symbol as route name
  router.get(signUpFormSymbol, '/sign-up-form', () => {});
  router.redirect(homeSymbol, signUpFormSymbol);
  const res = await request(http.createServer(app.callback()))
    .post('/')
    .expect(301);
  assert.strictEqual(res.header.location, '/sign-up-form');
});

it('throws an error if no route is found for name', () => {
  const router = new Router();
  assert.throws(() => router.redirect('missing', '/destination'));
  assert.throws(() => router.redirect('/source', 'missing'));
  assert.throws(() => router.redirect(Symbol('missing'), '/destination'));
  assert.throws(() => router.redirect('/source', Symbol('missing')));
});

it('redirects to external sites', async () => {
  const app = new Koa();
  const router = new Router();
  app.use(router.routes());
  router.redirect('/', 'https://www.example.com');
  const res = await request(http.createServer(app.callback()))
    .post('/')
    .expect(301);
  assert.strictEqual(res.header.location, 'https://www.example.com/');
});

it('redirects to any external protocol', async () => {
  const app = new Koa();
  const router = new Router();
  app.use(router.routes());
  router.redirect('/', 'my-custom-app-protocol://www.example.com/foo');
  const res = await request(http.createServer(app.callback()))
    .post('/')
    .expect(301);

  assert.strictEqual(
    res.header.location,
    'my-custom-app-protocol://www.example.com/foo'
  );
});

describe('Router#route()', () => {
  it('inherits routes from nested router', () => {
    const subrouter = new Router().get('child', '/hello', (ctx) => {
      ctx.body = { hello: 'world' };
    });
    const router = new Router().use(subrouter.routes());
    const route = router.route('child');
    assert.strictEqual(route && route.name, 'child');
  });

  it('supports symbols as names', () => {
    const childSymbol = Symbol('child');
    // @ts-expect-error - testing symbol as route name
    const subrouter = new Router().get(childSymbol, '/hello', (ctx) => {
      ctx.body = { hello: 'world' };
    });
    const router = new Router().use(subrouter.routes());
    // @ts-expect-error - testing symbol as route name
    const route = router.route(childSymbol);
    assert.strictEqual(route && route.name, childSymbol);
  });

  it('returns false if no name matches', () => {
    const router = new Router();
    router.get('books', '/books', (ctx) => {
      ctx.status = 204;
    });
    // @ts-expect-error - testing symbol as route name
    router.get(Symbol('Picard'), '/enterprise', (ctx) => {
      ctx.status = 204;
    });
    assert.strictEqual(Boolean(router.route('Picard')), false);
    // @ts-expect-error - testing symbol as route name
    assert.strictEqual(Boolean(router.route(Symbol('books'))), false);
  });
});

describe('Router#url()', () => {
  it('generates URL for given route name', () => {
    const app = new Koa();
    const router = new Router();
    app.use(router.routes());
    router.get('books', '/:category/:title', (ctx) => {
      ctx.status = 204;
    });
    let url = router.url(
      'books',
      { category: 'programming', title: 'how to node' },
      { encode: encodeURIComponent }
    );
    assert.strictEqual(url, '/programming/how%20to%20node');
    url = router.url('books', 'programming', 'how to node', {
      encode: encodeURIComponent
    });
    assert.strictEqual(url, '/programming/how%20to%20node');
  });

  it('generates URL for given route name within embedded routers', () => {
    const app = new Koa();
    const router = new Router({
      prefix: '/books'
    });

    const embeddedRouter = new Router({
      prefix: '/chapters'
    });
    embeddedRouter.get('chapters', '/:chapterName/:pageNumber', (ctx) => {
      ctx.status = 204;
    });
    router.use(embeddedRouter.routes());
    app.use(router.routes());
    let url = router.url(
      'chapters',
      { chapterName: 'Learning ECMA6', pageNumber: 123 },
      { encode: encodeURIComponent }
    );
    assert.strictEqual(url, '/books/chapters/Learning%20ECMA6/123');
    url = router.url('chapters', 'Learning ECMA6', 123, {
      encode: encodeURIComponent
    });
    assert.strictEqual(url, '/books/chapters/Learning%20ECMA6/123');
  });

  it('generates URL for given route name within two embedded routers', () => {
    const app = new Koa();
    const router = new Router({
      prefix: '/books'
    });
    const embeddedRouter = new Router({
      prefix: '/chapters'
    });
    const embeddedRouter2 = new Router({
      prefix: '/:chapterName/pages'
    });
    embeddedRouter2.get('chapters', '/:pageNumber', (ctx) => {
      ctx.status = 204;
    });
    embeddedRouter.use(embeddedRouter2.routes());
    router.use(embeddedRouter.routes());
    app.use(router.routes());
    const url = router.url(
      'chapters',
      { chapterName: 'Learning ECMA6', pageNumber: 123 },
      { encode: encodeURIComponent }
    );
    assert.strictEqual(url, '/books/chapters/Learning%20ECMA6/pages/123');
  });

  it('generates URL for given route name with params and query params', () => {
    const router = new Router();
    const query = { page: 3, limit: 10 };

    router.get('books', '/books/:category/:id', (ctx) => {
      ctx.status = 204;
    });
    let url = router.url('books', 'programming', 4, { query });
    assert.strictEqual(url, '/books/programming/4?page=3&limit=10');
    url = router.url('books', { category: 'programming', id: 4 }, { query });
    assert.strictEqual(url, '/books/programming/4?page=3&limit=10');
    url = router.url(
      'books',
      { category: 'programming', id: 4 },
      { query: 'page=3&limit=10' }
    );
    assert.strictEqual(url, '/books/programming/4?page=3&limit=10');
  });

  it('generates URL for given route name without params and query params', () => {
    let url;
    const router = new Router();
    router.get('books', '/books', (ctx) => {
      ctx.status = 204;
    });
    url = router.url('books');
    assert.strictEqual(url, '/books');
    url = router.url('books');
    assert.strictEqual(url, '/books');
    url = router.url('books');
    assert.strictEqual(url, '/books');
    url = router.url('books', {}, { query: { page: 3, limit: 10 } });
    assert.strictEqual(url, '/books?page=3&limit=10');
    url = router.url('books', {}, { query: 'page=3&limit=10' });
    assert.strictEqual(url, '/books?page=3&limit=10');
  });

  it('generates URL for given route name without params and query params', () => {
    const router = new Router();
    router.get('category', '/category', (ctx) => {
      ctx.status = 204;
    });
    const url = router.url('category', {
      query: { page: 3, limit: 10 }
    });
    assert.strictEqual(url, '/category?page=3&limit=10');
  });

  it('returns an Error if no route is found for name', () => {
    const app = new Koa();
    const router = new Router();
    app.use(router.routes());
    router.get('books', '/books', (ctx) => {
      ctx.status = 204;
    });
    // @ts-expect-error - testing symbol as route name
    router.get(Symbol('Picard'), '/enterprise', (ctx) => {
      ctx.status = 204;
    });

    assert.strictEqual(router.url('Picard') instanceof Error, true);
    // @ts-expect-error - testing symbol as route name
    assert.strictEqual(router.url(Symbol('books')) instanceof Error, true);
  });

  it('escapes using encodeURIComponent()', () => {
    const url = Router.url('/:category/:title', {
      category: 'programming',
      title: 'how to node & js/ts'
    });
    assert.strictEqual(url, '/programming/how%20to%20node%20%26%20js%2Fts');
  });

  it('should preserve route params when query option is also provided', () => {
    const router = new Router();
    router.get('user', '/users/:id', (ctx) => {
      ctx.body = 'user';
    });

    const url = router.url('user', { id: 123, query: { page: 1 } });

    assert.ok(typeof url === 'string');
    assert.ok(url.includes('/users/123'));
    assert.ok(url.includes('page=1'));
  });

  it('should handle query-only options object without route params', () => {
    const router = new Router();
    router.get('home', '/', (ctx) => {
      ctx.body = 'home';
    });

    const url = router.url('home', { query: { sort: 'asc' } });

    assert.ok(typeof url === 'string');
    assert.strictEqual(url, '/?sort=asc');
  });

  it('should handle separate params object and options object with query', () => {
    const router = new Router();
    router.get('user', '/users/:id', (ctx) => {
      ctx.body = 'user';
    });

    const url = router.url('user', { id: 456 }, { query: { detail: 'full' } });

    assert.ok(typeof url === 'string');
    assert.ok(url.includes('/users/456'));
    assert.ok(url.includes('detail=full'));
  });

  it('should handle positional params with query options', () => {
    const router = new Router();
    router.get('user', '/users/:id/:action', (ctx) => {
      ctx.body = 'user';
    });

    const url = router.url('user', 789, 'edit', { query: { confirm: 'yes' } });

    assert.ok(typeof url === 'string');
    assert.ok(url.includes('/users/789/edit'));
    assert.ok(url.includes('confirm=yes'));
  });

  it('should throw error when generating URL for RegExp routes via router.url()', () => {
    const router = new Router();
    router.get('regexpRoute', /\/test\/\d+/, (ctx) => {
      ctx.body = 'test';
    });

    assert.throws(
      () => router.url('regexpRoute', { id: 1 }),
      /Cannot generate URL for routes defined with RegExp paths/
    );
  });
});

describe('Router#param()', () => {
  it('runs parameter middleware', async () => {
    const app = new Koa();
    const router = new Router();
    app.use(router.routes());
    router
      .param('user', (id: string, ctx, next) => {
        ctx.user = { name: 'alex' };
        if (!id) {
          ctx.status = 404;
          return;
        }

        return next();
      })
      .get('/users/:user', (ctx) => {
        ctx.body = ctx.user;
      });
    const res = await request(http.createServer(app.callback()))
      .get('/users/3')
      .expect(200);
    assert.strictEqual('body' in res, true);
    assert.strictEqual(res.body.name, 'alex');
  });

  it('runs parameter middleware in order of URL appearance', async () => {
    const app = new Koa();
    const router = new Router();
    router
      .param('user', (id: string, ctx, next) => {
        ctx.user = { name: 'alex' };
        if (ctx.ranFirst) {
          ctx.user.ordered = 'parameters';
        }

        if (!id) {
          ctx.status = 404;
          return;
        }

        return next();
      })
      .param('first', (id: string, ctx, next) => {
        ctx.ranFirst = true;
        if (ctx.user) {
          ctx.ranFirst = false;
        }

        if (!id) {
          ctx.status = 404;
          return;
        }

        return next();
      })
      .get('/:first/users/:user', (ctx) => {
        ctx.body = ctx.user;
      });

    const res = await request(
      http.createServer(app.use(router.routes()).callback())
    )
      .get('/first/users/3')
      .expect(200);
    assert.deepStrictEqual(res.body, {
      name: 'alex',
      ordered: 'parameters'
    });
  });

  it('runs parameter middleware in order of URL appearance even when added in random order', async () => {
    const app = new Koa();
    const router = new Router();
    router
      .param('a', (id: string, ctx, next) => {
        ctx.state.loaded = [id];
        return next();
      })
      .param('d', (id: string, ctx, next) => {
        ctx.state.loaded.push(id);
        return next();
      })
      .param('c', (id: string, ctx, next) => {
        ctx.state.loaded.push(id);
        return next();
      })
      .param('b', (id: string, ctx, next) => {
        ctx.state.loaded.push(id);
        return next();
      })
      .get('/:a/:b/:c/:d', (ctx) => {
        ctx.body = ctx.state.loaded;
      });

    const res = await request(
      http.createServer(app.use(router.routes()).callback())
    )
      .get('/1/2/3/4')
      .expect(200);
    assert.strictEqual('body' in res, true);
    assert.deepStrictEqual(res.body, ['1', '2', '3', '4']);
  });

  it('runs parent parameter middleware for subrouter', async () => {
    const app = new Koa();
    const router = new Router();
    const subrouter = new Router();
    subrouter.get('/:cid', (ctx) => {
      ctx.body = {
        id: ctx.params.id,
        cid: ctx.params.cid
      };
    });
    router
      .param('id', (id: string, ctx, next) => {
        ctx.params.id = 'ran';
        if (!id) {
          ctx.status = 404;
          return;
        }

        return next();
      })
      .use('/:id/children', subrouter.routes());

    const res = await request(
      http.createServer(app.use(router.routes()).callback())
    )
      .get('/did-not-run/children/2')
      .expect(200);
    assert.deepStrictEqual(res.body, {
      id: 'ran',
      cid: '2'
    });
  });

  it('supports multiple param handlers for the same parameter', async () => {
    const app = new Koa();
    const router = new Router();
    const calls: string[] = [];

    router
      .param('id', (id: string, ctx, next) => {
        calls.push('param1');
        ctx.state.param1 = true;
        return next();
      })
      .param('id', (id: string, ctx, next) => {
        calls.push('param2');
        ctx.state.param2 = true;
        return next();
      })
      .param('id', (id: string, ctx, next) => {
        calls.push('param3');
        ctx.state.param3 = true;
        return next();
      })
      .get('/:id', (ctx) => {
        calls.push('get');
        ctx.body = {
          param1: ctx.state.param1,
          param2: ctx.state.param2,
          param3: ctx.state.param3
        };
      });

    app.use(router.routes());

    const res = await request(http.createServer(app.callback()))
      .get('/test')
      .expect(200);

    assert.deepStrictEqual(calls, ['param1', 'param2', 'param3', 'get']);
    assert.strictEqual(res.body.param1, true);
    assert.strictEqual(res.body.param2, true);
    assert.strictEqual(res.body.param3, true);
  });

  it('does not call param handlers multiple times with multiple matching routes', async () => {
    const app = new Koa();
    const router = new Router();
    const calls: string[] = [];

    router
      .param('id', (id: string, ctx, next) => {
        calls.push('param1');
        return next();
      })
      .get('/:id', (ctx, next) => {
        calls.push('get1');
        return next();
      })
      .param('id', (id: string, ctx, next) => {
        calls.push('param2');
        return next();
      })
      .get('/:id', (ctx) => {
        calls.push('get2');
        ctx.body = { calls: [...calls] };
      });

    app.use(router.routes());

    const res = await request(http.createServer(app.callback()))
      .get('/test')
      .expect(200);

    assert.deepStrictEqual(calls, ['param1', 'param2', 'get1', 'get2']);
    assert.strictEqual(
      calls.filter((c) => c === 'param1').length,
      1,
      'param1 should only be called once'
    );
    assert.strictEqual(
      calls.filter((c) => c === 'param2').length,
      1,
      'param2 should only be called once'
    );
  });

  it('does not call param handler multiple times with use middleware', async () => {
    const app = new Koa();
    const router = new Router();
    const calls: string[] = [];

    router
      .use('/:id', (ctx, next) => {
        calls.push('use1');
        return next();
      })
      .param('id', (id: string, ctx, next) => {
        calls.push('param1');
        return next();
      })
      .get('/:id', (ctx) => {
        calls.push('get1');
        ctx.body = { calls: [...calls] };
      });

    app.use(router.routes());

    const res = await request(http.createServer(app.callback()))
      .get('/test')
      .expect(200);

    assert.strictEqual(
      calls.filter((c) => c === 'param1').length,
      1,
      'param1 should only be called once'
    );
    assert.strictEqual(
      calls.filter((c) => c === 'use1').length,
      1,
      'use1 should only be called once'
    );
    assert.strictEqual(
      calls.filter((c) => c === 'get1').length,
      1,
      'get1 should only be called once'
    );
    assert.strictEqual(calls.length, 3, 'Should have exactly 3 calls total');
  });

  it('calls param handlers for routes added after param() is called', async () => {
    const app = new Koa();
    const router = new Router();
    const calls: string[] = [];

    router
      .param('id', (id: string, ctx, next) => {
        calls.push('param1');
        ctx.state.id = id;
        return next();
      })
      .get('/:id/first', (ctx) => {
        calls.push('get1');
        ctx.body = { route: 'first', id: ctx.state.id };
      });

    router.get('/:id/second', (ctx) => {
      calls.push('get2');
      ctx.body = { route: 'second', id: ctx.state.id };
    });

    app.use(router.routes());

    const res1 = await request(http.createServer(app.callback()))
      .get('/123/first')
      .expect(200);
    assert.deepStrictEqual(calls, ['param1', 'get1']);
    assert.strictEqual(res1.body.id, '123');

    calls.length = 0;
    const res2 = await request(http.createServer(app.callback()))
      .get('/456/second')
      .expect(200);
    assert.deepStrictEqual(calls, ['param1', 'get2']);
    assert.strictEqual(res2.body.id, '456');
  });

  it('should convert single middleware to array when adding second param handler', async () => {
    const app = new Koa();
    const router = new Router();
    const calls: string[] = [];

    const firstParamHandler: RouterParameterMiddleware = (
      id: string,
      ctx,
      next
    ) => {
      calls.push('param1');
      ctx.state.param1 = true;
      return next();
    };
    router.params['id'] = firstParamHandler;

    router.param('id', (id: string, ctx, next) => {
      calls.push('param2');
      ctx.state.param2 = true;
      return next();
    });

    router.get('/:id', (ctx) => {
      calls.push('get');
      ctx.body = {
        param1: ctx.state.param1,
        param2: ctx.state.param2
      };
    });

    app.use(router.routes());

    const res = await request(http.createServer(app.callback()))
      .get('/test')
      .expect(200);

    assert.deepStrictEqual(calls, ['param1', 'param2', 'get']);
    assert.strictEqual(res.body.param1, true);
    assert.strictEqual(res.body.param2, true);
  });

  it('should insert param middleware when all existing middleware have .param property', async () => {
    const app = new Koa();
    const router = new Router();
    const callOrder: string[] = [];

    router.param('id', (id: string, ctx, next) => {
      callOrder.push(`param-id:${id}`);
      return next();
    });

    router.param('subId', (subId: string, ctx, next) => {
      callOrder.push(`param-subId:${subId}`);
      return next();
    });

    router.get('/:id/:subId', (ctx) => {
      callOrder.push('handler');
      ctx.body = 'ok';
    });

    app.use(router.routes());

    await request(http.createServer(app.callback()))
      .get('/123/456')
      .expect(200);

    assert.deepStrictEqual(callOrder, [
      'param-id:123',
      'param-subId:456',
      'handler'
    ]);
  });

  it('should call param middleware in URL parameter order regardless of registration order', async () => {
    const app = new Koa();
    const router = new Router();
    const callOrder: string[] = [];

    router.param('c', (val: string, ctx, next) => {
      callOrder.push(`c:${val}`);
      return next();
    });

    router.param('a', (val: string, ctx, next) => {
      callOrder.push(`a:${val}`);
      return next();
    });

    router.param('b', (val: string, ctx, next) => {
      callOrder.push(`b:${val}`);
      return next();
    });

    router.get('/:a/:b/:c', (ctx) => {
      callOrder.push('handler');
      ctx.body = 'ok';
    });

    app.use(router.routes());

    await request(http.createServer(app.callback())).get('/1/2/3').expect(200);

    assert.deepStrictEqual(callOrder, ['a:1', 'b:2', 'c:3', 'handler']);
  });
});

describe('Router#opts', () => {
  it('responds with 200', async () => {
    const app = new Koa();
    const router = new Router({
      strict: true
    });
    router.get('/info', (ctx) => {
      ctx.body = 'hello';
    });
    const res = await request(
      http.createServer(app.use(router.routes()).callback())
    )
      .get('/info')
      .expect(200);
    assert.strictEqual(res.text, 'hello');
  });

  it('should allow setting a prefix', async () => {
    const app = new Koa();
    const routes = new Router({ prefix: '/things/:thing_id' });

    routes.get('/list', (ctx) => {
      ctx.body = ctx.params;
    });

    app.use(routes.routes());

    const res = await request(http.createServer(app.callback()))
      .get('/things/1/list')
      .expect(200);
    assert.strictEqual(res.body.thing_id, '1');
  });

  it('responds with 404 when has a trailing slash', async () => {
    const app = new Koa();
    const router = new Router({
      strict: true
    });
    router.get('/info', (ctx) => {
      ctx.body = 'hello';
    });
    await request(http.createServer(app.use(router.routes()).callback()))
      .get('/info/')
      .expect(404);
  });
});

describe('use middleware with opts', () => {
  it('responds with 200', async () => {
    const app = new Koa();
    const router = new Router({
      strict: true
    });
    router.get('/info', (ctx) => {
      ctx.body = 'hello';
    });
    const res = await request(
      http.createServer(app.use(router.routes()).callback())
    )
      .get('/info')
      .expect(200);
    assert.strictEqual(res.text, 'hello');
  });

  it('responds with 404 when has a trailing slash', async () => {
    const app = new Koa();
    const router = new Router({
      strict: true
    });
    router.get('/info', (ctx) => {
      ctx.body = 'hello';
    });
    await request(http.createServer(app.use(router.routes()).callback()))
      .get('/info/')
      .expect(404);
  });
});

describe('router.routes()', () => {
  it('should return composed middleware', async () => {
    const app = new Koa();
    const router = new Router();
    let middlewareCount = 0;

    router.use(
      (ctx, next) => {
        middlewareCount++;
        return next();
      },
      ((ctx, next) => {
        middlewareCount++;
        return next();
      }) as RouterMiddleware
    );
    router.get('/users/:id', (ctx) => {
      assert.strictEqual(Boolean(ctx.params.id), true);
      ctx.body = { hello: 'world' };
    });

    const routerMiddleware = router.routes();

    assert.strictEqual(typeof routerMiddleware, 'function');

    const res = await request(
      http.createServer(app.use(routerMiddleware).callback())
    )
      .get('/users/1')
      .expect(200);
    assert.strictEqual(typeof res.body, 'object');
    assert.strictEqual(res.body.hello, 'world');
    assert.strictEqual(middlewareCount, 2);
  });

  it('places a `_matchedRoute` value on context', async () => {
    const app = new Koa();
    const router = new Router();
    const middleware: RouterMiddleware = (ctx, next) => {
      next();
      assert.strictEqual(ctx._matchedRoute, '/users/:id');
    };

    router.use(middleware);
    router.get('/users/:id', (ctx) => {
      assert.strictEqual(ctx._matchedRoute, '/users/:id');
      assert.strictEqual(Boolean(ctx.params.id), true);
      ctx.body = { hello: 'world' };
    });

    const routerMiddleware = router.routes();

    await request(http.createServer(app.use(routerMiddleware).callback()))
      .get('/users/1')
      .expect(200);
  });

  it('places a `_matchedRouteName` value on the context for a named route', async () => {
    const app = new Koa();
    const router = new Router();

    router.get('users#show', '/users/:id', (ctx) => {
      assert.strictEqual(ctx._matchedRouteName, 'users#show');
      ctx.status = 200;
    });

    await request(http.createServer(app.use(router.routes()).callback()))
      .get('/users/1')
      .expect(200);
  });

  it('does not place a `_matchedRouteName` value on the context for unnamed routes', async () => {
    const app = new Koa();
    const router = new Router();

    router.get('/users/:id', (ctx) => {
      assert.strictEqual(ctx._matchedRouteName, undefined);
      ctx.status = 200;
    });

    await request(http.createServer(app.use(router.routes()).callback()))
      .get('/users/1')
      .expect(200);
  });

  it('sets correct `_matchedRouteName` with nested routers and middleware (gh-105)', async () => {
    const app = new Koa();
    const router = new Router();
    const nestedRouter = new Router();

    router.get('main#info', '/info', (ctx) => {
      assert.strictEqual(ctx._matchedRouteName, 'main#info');
      ctx.body = { route: 'main' };
    });

    nestedRouter.get('nested#updates', '/updates', (ctx) => {
      assert.strictEqual(ctx._matchedRouteName, 'nested#updates');
      ctx.body = { route: 'nested' };
    });

    router.use('/v1/api', nestedRouter.routes());
    app.use(router.routes());

    await request(http.createServer(app.callback()))
      .get('/v1/api/updates')
      .expect(200);
  });

  it('places a `routerPath` value on the context for current route', async () => {
    const app = new Koa();
    const router = new Router();

    router.get('/users/:id', (ctx) => {
      assert.strictEqual(ctx.routerPath, '/users/:id');
      ctx.status = 200;
    });

    await request(http.createServer(app.use(router.routes()).callback()))
      .get('/users/1')
      .expect(200);
  });

  it('places a `_matchedRoute` value on the context for current route', async () => {
    const app = new Koa();
    const router = new Router();

    router.get('/users/list', (ctx) => {
      assert(ctx._matchedRoute, '/users/list');
      ctx.status = 200;
    });
    router.get('/users/:id', (ctx) => {
      assert.strictEqual(ctx._matchedRoute, '/users/:id');
      ctx.status = 200;
    });

    await request(http.createServer(app.use(router.routes()).callback()))
      .get('/users/list')
      .expect(200);
  });
});

describe('If no HEAD method, default to GET', () => {
  it('should default to GET', async () => {
    const app = new Koa();
    const router = new Router();
    router.get('/users/:id', (ctx) => {
      assert.strictEqual(Boolean(ctx.params.id), true);
      ctx.body = 'hello';
    });
    const res = await request(
      http.createServer(app.use(router.routes()).callback())
    )
      .head('/users/1')
      .expect(200);
    assert.deepStrictEqual(res.body, {});
  });

  it('should work with middleware', async () => {
    const app = new Koa();
    const router = new Router();
    router.get('/users/:id', (ctx) => {
      assert.strictEqual(Boolean(ctx.params.id), true);
      ctx.body = 'hello';
    });
    const res = await request(
      http.createServer(app.use(router.routes()).callback())
    )
      .head('/users/1')
      .expect(200);
    assert.deepStrictEqual(res.body, {});
  });

  it('should return empty body for HEAD requests on GET routes', async () => {
    const app = new Koa();
    const router = new Router();

    router.get('/api/data', (ctx) => {
      ctx.body = { message: 'This is a large response', data: [1, 2, 3, 4, 5] };
    });

    app.use(router.routes());

    const getRes = await request(http.createServer(app.callback()))
      .get('/api/data')
      .expect(200);
    assert.strictEqual(typeof getRes.body, 'object');
    assert.strictEqual(getRes.body.message, 'This is a large response');

    const headRes = await request(http.createServer(app.callback()))
      .head('/api/data')
      .expect(200);
    assert.deepStrictEqual(headRes.body, {});
    assert.strictEqual(
      headRes.headers['content-type'],
      'application/json; charset=utf-8'
    );
  });

  it('should preserve headers for HEAD requests', async () => {
    const app = new Koa();
    const router = new Router();

    router.get('/api/resource', (ctx) => {
      ctx.set('X-Custom-Header', 'custom-value');
      ctx.set('X-Resource-Count', '42');
      ctx.body = 'Response body';
    });

    app.use(router.routes());

    const res = await request(http.createServer(app.callback()))
      .head('/api/resource')
      .expect(200);

    assert.strictEqual(res.headers['x-custom-header'], 'custom-value');
    assert.strictEqual(res.headers['x-resource-count'], '42');
    assert.deepStrictEqual(res.body, {});
  });

  it('should work with allowedMethods middleware', async () => {
    const app = new Koa();
    const router = new Router();

    router.get('/resource', (ctx) => {
      ctx.body = 'success';
    });

    app.use(router.routes());
    app.use(router.allowedMethods());

    await request(http.createServer(app.callback()))
      .head('/resource')
      .expect(200);
  });

  it('should not automatically support HEAD for POST routes', async () => {
    const app = new Koa();
    const router = new Router();

    router.post('/users', (ctx) => {
      ctx.body = { created: true };
    });

    app.use(router.routes());
    app.use(router.allowedMethods());

    await request(http.createServer(app.callback())).head('/users').expect(405);
  });

  it('should not automatically support HEAD for PUT routes', async () => {
    const app = new Koa();
    const router = new Router();

    router.put('/users/:id', (ctx) => {
      ctx.body = { updated: true };
    });

    app.use(router.routes());
    app.use(router.allowedMethods());

    await request(http.createServer(app.callback()))
      .head('/users/123')
      .expect(405);
  });

  it('should support explicit HEAD routes', async () => {
    const app = new Koa();
    const router = new Router();

    let headCalled = false;

    router.head('/check', (ctx) => {
      headCalled = true;
      ctx.status = 200;
    });

    router.get('/check', (ctx) => {
      ctx.body = { message: 'GET handler' };
    });

    app.use(router.routes());

    await request(http.createServer(app.callback())).head('/check').expect(200);

    assert.strictEqual(headCalled, true);
  });

  it('should handle HEAD requests with route parameters', async () => {
    const app = new Koa();
    const router = new Router();

    router.get('/users/:id/posts/:postId', (ctx) => {
      ctx.body = {
        userId: ctx.params.id,
        postId: ctx.params.postId
      };
    });

    app.use(router.routes());

    await request(http.createServer(app.callback()))
      .head('/users/123/posts/456')
      .expect(200);
  });

  it('should handle HEAD requests with query parameters', async () => {
    const app = new Koa();
    const router = new Router();

    router.get('/search', (ctx) => {
      ctx.body = {
        query: ctx.query.q,
        results: []
      };
    });

    app.use(router.routes());

    await request(http.createServer(app.callback()))
      .head('/search?q=test')
      .expect(200);
  });
});

describe('Router#prefix', () => {
  it('should set opts.prefix', () => {
    const router = new Router();
    assert.strictEqual('prefix' in router.opts, false);
    router.prefix('/things/:thing_id');
    assert.strictEqual(router.opts.prefix, '/things/:thing_id');
  });

  it('should prefix existing routes', () => {
    const router = new Router();
    router.get('/users/:id', (ctx) => {
      ctx.body = 'test';
    });
    router.prefix('/things/:thing_id');
    const route = router.stack[0];
    assert.strictEqual(route.path, '/things/:thing_id/users/:id');
    assert.strictEqual(route.paramNames.length, 2);
    assert.strictEqual(route.paramNames[0].name, 'thing_id');
    assert.strictEqual(route.paramNames[1].name, 'id');
  });

  it('populates ctx.params correctly for router prefix (including use)', async () => {
    const app = new Koa();
    const router = new Router({ prefix: '/:category' });
    app.use(router.routes());
    router
      .use((ctx, next) => {
        assert.strictEqual('params' in ctx, true);
        assert.strictEqual(typeof ctx.params, 'object');
        assert.strictEqual(ctx.params.category, 'cats');
        return next();
      })
      .get('/suffixHere', (ctx) => {
        assert.strictEqual('params' in ctx, true);
        assert.strictEqual(typeof ctx.params, 'object');
        assert.strictEqual(ctx.params.category, 'cats');
        ctx.status = 204;
      });
    await request(http.createServer(app.callback()))
      .get('/cats/suffixHere')
      .expect(204);
  });

  it('populates ctx.params correctly for more complex router prefix (including use)', async () => {
    const app = new Koa();
    const router = new Router({ prefix: '/:category/:color' });
    app.use(router.routes());
    router
      .use((ctx, next) => {
        assert.strictEqual('params' in ctx, true);
        assert.strictEqual(typeof ctx.params, 'object');
        assert.strictEqual(ctx.params.category, 'cats');
        assert.strictEqual(ctx.params.color, 'gray');
        return next();
      })
      .get('/:active/suffixHere', (ctx) => {
        assert.strictEqual('params' in ctx, true);
        assert.strictEqual(typeof ctx.params, 'object');
        assert.strictEqual(ctx.params.category, 'cats');
        assert.strictEqual(ctx.params.color, 'gray');
        assert.strictEqual(ctx.params.active, 'true');
        ctx.status = 204;
      });
    await request(http.createServer(app.callback()))
      .get('/cats/gray/true/suffixHere')
      .expect(204);
  });

  it('populates ctx.params correctly for dynamic and static prefix (including async use)', async () => {
    const app = new Koa();
    const router = new Router({ prefix: '/:ping/pong' });
    app.use(router.routes());
    router
      .use(async (ctx, next) => {
        assert.strictEqual('params' in ctx, true);
        assert.strictEqual(typeof ctx.params, 'object');
        assert.strictEqual(ctx.params.ping, 'pingKey');
        await next();
      })
      .get('/', (ctx) => {
        assert.strictEqual('params' in ctx, true);
        assert.strictEqual(typeof ctx.params, 'object');
        assert.strictEqual(ctx.params.ping, 'pingKey');
        ctx.body = ctx.params;
      });
    await request(http.createServer(app.callback()))
      .get('/pingKey/pong')
      .expect(200, /{"ping":"pingKey"}/);
  });

  it('executes middleware for routes when prefix contains path parameters (complex)', async () => {
    const app = new Koa();

    const appSettingsRouter = new Router({
      prefix: '/api/apps/:appId/settings'
    });

    let middlewareExecuted = false;

    appSettingsRouter
      .use((ctx, next) => {
        middlewareExecuted = true;
        ctx.state.authorized = 'AUTHORIZED';
        return next();
      })
      .get('/', (ctx) => {
        ctx.body = {
          authorized: ctx.state.authorized,
          middlewareRan: middlewareExecuted,
          appId: ctx.params.appId
        };
      })
      .get('/:settingId', (ctx) => {
        ctx.body = {
          authorized: ctx.state.authorized,
          middlewareRan: middlewareExecuted,
          appId: ctx.params.appId,
          settingId: ctx.params.settingId
        };
      });

    app.use(appSettingsRouter.routes());

    middlewareExecuted = false;
    const res1 = await request(http.createServer(app.callback()))
      .get('/api/apps/123/settings')
      .expect(200);

    assert.strictEqual(
      res1.body.authorized,
      'AUTHORIZED',
      'Middleware should set authorized state'
    );
    assert.strictEqual(
      res1.body.middlewareRan,
      true,
      'Middleware should have executed'
    );
    assert.strictEqual(res1.body.appId, '123', 'Should capture appId param');

    middlewareExecuted = false;
    const res2 = await request(http.createServer(app.callback()))
      .get('/api/apps/456/settings/theme')
      .expect(200);

    assert.strictEqual(
      res2.body.authorized,
      'AUTHORIZED',
      'Middleware should set authorized state'
    );
    assert.strictEqual(
      res2.body.middlewareRan,
      true,
      'Middleware should have executed'
    );
    assert.strictEqual(res2.body.appId, '456', 'Should capture appId param');
    assert.strictEqual(
      res2.body.settingId,
      'theme',
      'Should capture settingId param'
    );
  });

  it('populates ctx.params correctly for static prefix', async () => {
    const app = new Koa();
    const router = new Router({ prefix: '/all' });
    app.use(router.routes());
    router
      .use((ctx, next) => {
        assert.strictEqual('params' in ctx, true);
        assert.strictEqual(typeof ctx.params, 'object');
        assert.deepStrictEqual(ctx.params, {});
        return next();
      })
      .get('/:active/suffixHere', (ctx) => {
        assert.strictEqual('params' in ctx, true);
        assert.strictEqual(typeof ctx.params, 'object');
        assert.strictEqual(ctx.params.active, 'true');
        ctx.status = 204;
      });
    await request(http.createServer(app.callback()))
      .get('/all/true/suffixHere')
      .expect(204);
  });

  describe('when used with .use(fn) - gh-247', () => {
    it('does not set params.0 to the matched path', async () => {
      const app = new Koa();
      const router = new Router();

      router.use((ctx, next) => {
        return next();
      });

      router.get('/foo/:id', (ctx) => {
        ctx.body = ctx.params;
      });

      router.prefix('/things');

      app.use(router.routes());
      const res = await request(http.createServer(app.callback()))
        .get('/things/foo/108')
        .expect(200);

      assert.strictEqual(res.body.id, '108');
      assert.strictEqual('0' in res.body, false);
    });
  });

  it('should replace prefix instead of stacking when called multiple times', async () => {
    const app = new Koa();
    const router = new Router();

    router.get('/test', (ctx) => {
      ctx.body = { path: ctx.path };
    });

    router.prefix('/api/v1');
    router.prefix('/api/v2');

    app.use(router.routes());

    const res = await request(http.createServer(app.callback()))
      .get('/api/v2/test')
      .expect(200);

    assert.strictEqual(res.body.path, '/api/v2/test');

    await request(http.createServer(app.callback()))
      .get('/api/v1/test')
      .expect(404);

    await request(http.createServer(app.callback()))
      .get('/api/v2/api/v1/test')
      .expect(404);
  });

  it('should handle raw regex middleware patterns with parameterized prefix', async () => {
    const app = new Koa();
    const router = new Router({ prefix: '/:version' });

    router.use((ctx, next) => {
      ctx.state.middlewareRan = true;
      return next();
    });

    router.get('/test', (ctx) => {
      ctx.body = { middlewareRan: ctx.state.middlewareRan };
    });

    app.use(router.routes());

    const res = await request(http.createServer(app.callback()))
      .get('/v1/test')
      .expect(200);

    assert.strictEqual(res.body.middlewareRan, true);
  });

  describe('with trailing slash', testPrefix('/admin/'));
  describe('without trailing slash', testPrefix('/admin'));

  function testPrefix(prefix: string) {
    return () => {
      let server: http.Server;
      let middlewareCount = 0;

      before(() => {
        const app = new Koa();
        const router = new Router();

        router.use((ctx, next) => {
          middlewareCount++;
          ctx.thing = 'worked';
          return next();
        });

        router.get('/', (ctx) => {
          middlewareCount++;
          ctx.body = { name: ctx.thing };
        });

        router.prefix(prefix);
        server = http.createServer(app.use(router.routes()).callback());
      });

      after(() => {
        server.close();
      });

      beforeEach(() => {
        middlewareCount = 0;
      });

      it('should support root level router middleware', async () => {
        const res = await request(server).get(prefix).expect(200);

        assert.strictEqual(middlewareCount, 2);
        assert.strictEqual(typeof res.body, 'object');
        assert.strictEqual(res.body.name, 'worked');
      });

      it('should support requests with a trailing path slash', async () => {
        const res = await request(server).get('/admin/').expect(200);

        assert.strictEqual(middlewareCount, 2);
        assert.strictEqual(typeof res.body, 'object');
        assert.strictEqual(res.body.name, 'worked');
      });

      it('should support requests without a trailing path slash', async () => {
        const res = await request(server).get('/admin').expect(200);

        assert.strictEqual(middlewareCount, 2);
        assert.strictEqual(typeof res.body, 'object');
        assert.strictEqual(res.body.name, 'worked');
      });
    };
  }

  it(`prefix and '/' route behavior`, async () => {
    const app = new Koa();
    const router = new Router({
      strict: false,
      prefix: '/foo'
    });

    const strictRouter = new Router({
      strict: true,
      prefix: '/bar'
    });

    router.get('/', (ctx) => {
      ctx.body = '';
    });

    strictRouter.get('/', (ctx) => {
      ctx.body = '';
    });

    app.use(router.routes());
    app.use(strictRouter.routes());

    const server = http.createServer(app.callback());

    await request(server).get('/foo').expect(200);
    await request(server).get('/foo/').expect(200);
    await request(server).get('/bar').expect(404);
    await request(server).get('/bar/').expect(200);
  });
});

describe('Static Router#url()', () => {
  it('generates route URL', () => {
    const url = Router.url('/:category/:title', {
      category: 'programming',
      title: 'how-to-node'
    });
    assert.strictEqual(url, '/programming/how-to-node');
  });

  it('escapes using encodeURIComponent()', () => {
    const url = Router.url(
      '/:category/:title',
      { category: 'programming', title: 'how to node' },
      { encode: encodeURIComponent }
    );
    assert.strictEqual(url, '/programming/how%20to%20node');
  });

  it('generates route URL with params and query params', async () => {
    const query = { page: 3, limit: 10 };
    let url = Router.url('/books/:category/:id', 'programming', 4, { query });
    assert.strictEqual(url, '/books/programming/4?page=3&limit=10');
    url = Router.url(
      '/books/:category/:id',
      { category: 'programming', id: 4 },
      { query }
    );
    assert.strictEqual(url, '/books/programming/4?page=3&limit=10');
    url = Router.url(
      '/books/:category/:id',
      { category: 'programming', id: 4 },
      { query: 'page=3&limit=10' }
    );
    assert.strictEqual(url, '/books/programming/4?page=3&limit=10');
  });

  it('generates router URL without params and with with query params', async () => {
    const url = Router.url('/category', {
      query: { page: 3, limit: 10 }
    });
    assert.strictEqual(url, '/category?page=3&limit=10');
  });
});

describe('Support host', () => {
  it('should support host match', async () => {
    const app = new Koa();
    const router = new Router({
      host: 'test.domain'
    });
    router.get('/', (ctx) => {
      ctx.body = {
        url: '/'
      };
    });
    app.use(router.routes());

    const server = http.createServer(app.callback());

    await request(server).get('/').set('Host', 'test.domain').expect(200);
    await request(server).get('/').set('Host', 'a.domain').expect(404);
  });

  it('should support host match regexp', async () => {
    const app = new Koa();
    const router = new Router({
      host: /^(.*\.)?test\.domain/
    });
    router.get('/', (ctx) => {
      ctx.body = {
        url: '/'
      };
    });
    app.use(router.routes());
    const server = http.createServer(app.callback());

    await request(server).get('/').set('Host', 'test.domain').expect(200);

    await request(server).get('/').set('Host', 'www.test.domain').expect(200);

    await request(server)
      .get('/')
      .set('Host', 'any.sub.test.domain')
      .expect(200);

    await request(server)
      .get('/')
      .set('Host', 'sub.anytest.domain')
      .expect(404);
  });

  it('should support host match with array of strings', async () => {
    const app = new Koa();
    const router = new Router({
      host: ['some-domain.com', 'www.some-domain.com', 'some.other-domain.com']
    });
    router.get('/', (ctx) => {
      ctx.body = { host: ctx.host };
    });
    app.use(router.routes());
    const server = http.createServer(app.callback());

    await request(server).get('/').set('Host', 'some-domain.com').expect(200);
    await request(server)
      .get('/')
      .set('Host', 'www.some-domain.com')
      .expect(200);
    await request(server)
      .get('/')
      .set('Host', 'some.other-domain.com')
      .expect(200);
    await request(server).get('/').set('Host', 'other-domain.com').expect(404);
  });

  it('should return false for invalid host type (neither string, array, nor RegExp)', () => {
    const router = new Router();
    // @ts-expect-error - testing invalid host type
    router.host = 123;
    assert.strictEqual(router.matchHost('test.domain'), false);

    // @ts-expect-error - testing invalid host type
    router.host = {};
    assert.strictEqual(router.matchHost('test.domain'), false);
  });

  it('should return false when input is empty or falsy', () => {
    const router = new Router({
      host: 'test.domain'
    });

    assert.strictEqual(router.matchHost(''), false);
    // @ts-expect-error
    assert.strictEqual(router.matchHost(null), false);
    assert.strictEqual(router.matchHost(undefined), false);
  });

  it('should handle empty array for host', () => {
    const router = new Router({
      host: []
    });
    assert.strictEqual(router.matchHost('test.domain'), false);
  });

  it('should handle array host matching with matchHost method', () => {
    const router = new Router({
      host: ['example.com', 'www.example.com', 'api.example.com']
    });
    assert.strictEqual(router.matchHost('example.com'), true);
    assert.strictEqual(router.matchHost('www.example.com'), true);
    assert.strictEqual(router.matchHost('api.example.com'), true);
    assert.strictEqual(router.matchHost('other.com'), false);
    assert.strictEqual(router.matchHost(''), false);
  });
});

describe('Less Common HTTP Methods', () => {
  it('should support PATCH method', async () => {
    const app = new Koa();
    const router = new Router();

    router.patch('/users/:id', async (ctx) => {
      ctx.body = {
        id: ctx.params.id,
        message: 'User partially updated',
        method: 'PATCH'
      };
    });

    app.use(router.routes());
    app.use(router.allowedMethods());

    const res = await request(http.createServer(app.callback()))
      .patch('/users/123')
      .expect(200);

    assert.strictEqual(res.body.id, '123');
    assert.strictEqual(res.body.method, 'PATCH');
    assert.strictEqual(res.body.message, 'User partially updated');
  });

  it('should support PURGE method', async () => {
    const app = new Koa();
    const router = new Router({
      methods: ['GET', 'PURGE'] as const
    });
    let cacheCleared = false;

    router.purge('/cache/:key', async (ctx) => {
      cacheCleared = true;
      ctx.body = {
        key: ctx.params.key,
        message: 'Cache cleared',
        method: 'PURGE'
      };
    });

    app.use(router.routes());
    app.use(router.allowedMethods());

    const res = await request(http.createServer(app.callback()))
      .purge('/cache/mykey')
      .expect(200);

    assert.strictEqual(cacheCleared, true);
    assert.strictEqual(res.body.key, 'mykey');
    assert.strictEqual(res.body.method, 'PURGE');
  });

  it('should support COPY method', async () => {
    const app = new Koa();
    const router = new Router({
      methods: ['GET', 'COPY'] as const
    });

    router.copy('/files/:source', async (ctx) => {
      ctx.body = {
        source: ctx.params.source,
        message: 'File copied',
        method: 'COPY'
      };
    });

    app.use(router.routes());
    app.use(router.allowedMethods());

    const res = await request(http.createServer(app.callback()))
      .copy('/files/document.pdf')
      .expect(200);

    assert.strictEqual(res.body.source, 'document.pdf');
    assert.strictEqual(res.body.method, 'COPY');
  });

  it('should support CONNECT method', async () => {
    const app = new Koa();
    const router = new Router({
      methods: ['GET', 'CONNECT'] as const
    });

    router.connect('/proxy/:host', async (ctx) => {
      ctx.body = {
        host: ctx.params.host,
        message: 'Connection established',
        method: 'CONNECT'
      };
    });

    app.use(router.routes());
    app.use(router.allowedMethods());

    assert.strictEqual(typeof router.connect, 'function');
  });

  it('should support TRACE method', async () => {
    const app = new Koa();
    const router = new Router({
      methods: ['GET', 'TRACE'] as const
    });

    router.trace('/debug/:path', async (ctx) => {
      ctx.body = {
        path: ctx.params.path,
        message: 'Trace completed',
        method: 'TRACE'
      };
    });

    app.use(router.routes());
    app.use(router.allowedMethods());

    const res = await request(http.createServer(app.callback()))
      .trace('/debug/test')
      .expect(200);

    assert.strictEqual(res.body.path, 'test');
    assert.strictEqual(res.body.method, 'TRACE');
  });
});

describe('RouterOptions: methods', () => {
  it('should limit router to specified methods only', async () => {
    const app = new Koa();
    const router = new Router({
      methods: ['GET', 'POST', 'PATCH']
    });

    router.get('/users', (ctx) => {
      ctx.body = { method: 'GET' };
    });

    router.post('/users', (ctx) => {
      ctx.body = { method: 'POST' };
    });

    router.patch('/users/:id', (ctx) => {
      ctx.body = { method: 'PATCH', id: ctx.params.id };
    });

    app.use(router.routes());
    app.use(router.allowedMethods());

    const res1 = await request(http.createServer(app.callback()))
      .get('/users')
      .expect(200);
    assert.strictEqual(res1.body.method, 'GET');

    const res2 = await request(http.createServer(app.callback()))
      .post('/users')
      .expect(200);
    assert.strictEqual(res2.body.method, 'POST');

    const res3 = await request(http.createServer(app.callback()))
      .patch('/users/123')
      .expect(200);
    assert.strictEqual(res3.body.method, 'PATCH');

    await request(http.createServer(app.callback()))
      .put('/users/123')
      .expect(501);

    await request(http.createServer(app.callback()))
      .delete('/users/123')
      .expect(501);
  });

  it('should allow PURGE when included in methods array', async () => {
    const app = new Koa();
    const router = new Router({
      methods: ['GET', 'POST', 'PURGE'] as const
    });

    router.purge('/cache/:key', (ctx) => {
      ctx.body = { key: ctx.params.key, cleared: true };
    });

    app.use(router.routes());
    app.use(router.allowedMethods());

    const res = await request(http.createServer(app.callback()))
      .purge('/cache/test')
      .expect(200);

    assert.strictEqual(res.body.key, 'test');
    assert.strictEqual(res.body.cleared, true);
  });

  it('should return 501 when method not in methods array', async () => {
    const app = new Koa();
    const router = new Router({
      methods: ['GET', 'POST', 'PUT', 'DELETE']
    });

    router.get('/cache/:key', (ctx) => {
      ctx.body = { key: ctx.params.key, method: 'GET' };
    });

    router.register(
      '/cache/:key',
      ['PURGE'],
      [
        (ctx) => {
          ctx.body = { key: ctx.params.key, method: 'PURGE' };
        }
      ]
    );

    app.use(router.routes());
    app.use(router.allowedMethods());

    const res1 = await request(http.createServer(app.callback()))
      .get('/cache/test')
      .expect(200);
    assert.strictEqual(res1.body.method, 'GET');

    const res2 = await request(http.createServer(app.callback()))
      .purge('/nonexistent')
      .expect(501);
  });
});

describe('RouterOptions: sensitive', () => {
  it('should enable case-sensitive routing when sensitive is true', async () => {
    const app = new Koa();
    const router = new Router({
      sensitive: true
    });

    router.get('/Users', (ctx) => {
      ctx.body = { path: '/Users', caseSensitive: true };
    });

    router.get('/users', (ctx) => {
      ctx.body = { path: '/users', caseSensitive: true };
    });

    app.use(router.routes());

    const res1 = await request(http.createServer(app.callback()))
      .get('/Users')
      .expect(200);
    assert.strictEqual(res1.body.path, '/Users');

    const res2 = await request(http.createServer(app.callback()))
      .get('/users')
      .expect(200);
    assert.strictEqual(res2.body.path, '/users');

    await request(http.createServer(app.callback())).get('/USERS').expect(404);
  });

  it('should use case-insensitive routing by default', async () => {
    const app = new Koa();
    const router = new Router();

    router.get('/Users', (ctx) => {
      ctx.body = { path: '/Users' };
    });

    app.use(router.routes());

    const res1 = await request(http.createServer(app.callback()))
      .get('/Users')
      .expect(200);
    assert.strictEqual(res1.body.path, '/Users');

    const res2 = await request(http.createServer(app.callback()))
      .get('/users')
      .expect(200);
    assert.strictEqual(res2.body.path, '/Users');

    const res3 = await request(http.createServer(app.callback()))
      .get('/USERS')
      .expect(200);
    assert.strictEqual(res3.body.path, '/Users');
  });

  it('should apply sensitive option to nested routers', async () => {
    const app = new Koa();
    const parentRouter = new Router({
      sensitive: true
    });

    const nestedRouter = new Router({
      sensitive: true
    });

    nestedRouter.get('/Items', (ctx) => {
      ctx.body = { path: '/Items' };
    });

    parentRouter.use('/Api', nestedRouter.routes());
    app.use(parentRouter.routes());

    await request(http.createServer(app.callback()))
      .get('/Api/Items')
      .expect(200);

    await request(http.createServer(app.callback()))
      .get('/api/items')
      .expect(404);
  });
});

describe('RouterOptions: strict (comprehensive)', () => {
  it('should require trailing slash when strict is true', async () => {
    const app = new Koa();
    const router = new Router({
      strict: true
    });

    router.get('/info', (ctx) => {
      ctx.body = { path: '/info', strict: true };
    });

    app.use(router.routes());

    const res1 = await request(http.createServer(app.callback()))
      .get('/info')
      .expect(200);
    assert.strictEqual(res1.body.path, '/info');

    await request(http.createServer(app.callback())).get('/info/').expect(404);
  });

  it('should allow trailing slash when strict is false', async () => {
    const app = new Koa();
    const router = new Router({ strict: false });

    router.get('/info', (ctx) => {
      ctx.body = { path: '/info', strict: false };
    });

    app.use(router.routes());

    const res1 = await request(http.createServer(app.callback()))
      .get('/info')
      .expect(200);
    assert.strictEqual(res1.body.path, '/info');

    const res2 = await request(http.createServer(app.callback()))
      .get('/info/')
      .expect(200);
    assert.strictEqual(res2.body.path, '/info');
  });

  it('should apply strict option to routes with parameters', async () => {
    const app = new Koa();
    const router = new Router({
      strict: true
    });

    router.get('/users/:id', (ctx) => {
      ctx.body = { id: ctx.params.id };
    });

    app.use(router.routes());

    const res1 = await request(http.createServer(app.callback()))
      .get('/users/123')
      .expect(200);
    assert.strictEqual(res1.body.id, '123');

    await request(http.createServer(app.callback()))
      .get('/users/123/')
      .expect(404);
  });

  it('should apply strict option to nested routers', async () => {
    const app = new Koa();
    const parentRouter = new Router({
      strict: true
    });

    const nestedRouter = new Router({
      strict: true
    });

    nestedRouter.get('/items', (ctx) => {
      ctx.body = { path: '/items' };
    });

    parentRouter.use('/api', nestedRouter.routes());
    app.use(parentRouter.routes());

    await request(http.createServer(app.callback()))
      .get('/api/items')
      .expect(200);

    await request(http.createServer(app.callback()))
      .get('/api/items/')
      .expect(404);
  });

  it('should handle strict option with prefix', async () => {
    const app = new Koa();
    const router = new Router({
      prefix: '/v1',
      strict: true
    });

    router.get('/users', (ctx) => {
      ctx.body = { path: '/v1/users' };
    });

    app.use(router.routes());

    const res1 = await request(http.createServer(app.callback()))
      .get('/v1/users')
      .expect(200);
    assert.strictEqual(res1.body.path, '/v1/users');

    await request(http.createServer(app.callback()))
      .get('/v1/users/')
      .expect(404);
  });

  describe('middleware prefix matching', () => {
    it('should not match middleware from other routers with same prefix in path', async () => {
      const app = new Koa();

      const accountsRouter = new Router({ prefix: '/accounts' });
      accountsRouter.use(async (ctx, next) => {
        ctx.state.isAccount = true;
        return next();
      });
      accountsRouter.get('/', async (ctx) => {
        ctx.body = { route: 'accounts', isAccount: ctx.state.isAccount };
      });

      const usersRouter = new Router({ prefix: '/users' });
      usersRouter.get('/', async (ctx) => {
        ctx.body = { route: 'users', isAccount: ctx.state.isAccount };
      });
      usersRouter.get('/:userId/accounts', async (ctx) => {
        ctx.body = {
          route: 'user-accounts',
          isAccount: ctx.state.isAccount,
          userId: ctx.params.userId
        };
      });

      app.use(accountsRouter.routes());
      app.use(usersRouter.routes());

      const server = http.createServer(app.callback());

      const accountsRes = await request(server).get('/accounts').expect(200);
      assert.strictEqual(accountsRes.body.route, 'accounts');
      assert.strictEqual(accountsRes.body.isAccount, true);

      const usersRes = await request(server).get('/users').expect(200);
      assert.strictEqual(usersRes.body.route, 'users');
      assert.strictEqual(usersRes.body.isAccount, undefined);

      const userAccountsRes = await request(server)
        .get('/users/12345/accounts')
        .expect(200);
      assert.strictEqual(userAccountsRes.body.route, 'user-accounts');
      assert.strictEqual(userAccountsRes.body.isAccount, undefined);
      assert.strictEqual(userAccountsRes.body.userId, '12345');
    });

    it('should match middleware with explicit empty path', async () => {
      const app = new Koa();

      const accountsRouter = new Router({ prefix: '/accounts' });
      accountsRouter.use('', async (ctx, next) => {
        ctx.state.isAccount = true;
        return next();
      });
      accountsRouter.get('/', async (ctx) => {
        ctx.body = { isAccount: ctx.state.isAccount };
      });
      accountsRouter.get('/:id', async (ctx) => {
        ctx.body = { isAccount: ctx.state.isAccount, id: ctx.params.id };
      });

      app.use(accountsRouter.routes());

      const server = http.createServer(app.callback());

      const res1 = await request(server).get('/accounts').expect(200);
      assert.strictEqual(res1.body.isAccount, true);

      const res2 = await request(server).get('/accounts/123').expect(200);
      assert.strictEqual(res2.body.isAccount, true);
      assert.strictEqual(res2.body.id, '123');
    });

    it('should match middleware with explicit "/" path only on root', async () => {
      const app = new Koa();

      const accountsRouter = new Router({ prefix: '/accounts' });
      accountsRouter.use('/', async (ctx, next) => {
        ctx.state.isAccount = true;
        return next();
      });
      accountsRouter.get('/', async (ctx) => {
        ctx.body = { isAccount: ctx.state.isAccount };
      });
      accountsRouter.get('/:id', async (ctx) => {
        ctx.body = { isAccount: ctx.state.isAccount, id: ctx.params.id };
      });

      app.use(accountsRouter.routes());

      const server = http.createServer(app.callback());

      const res1 = await request(server).get('/accounts').expect(200);
      assert.strictEqual(res1.body.isAccount, true);

      const res2 = await request(server).get('/accounts/123').expect(200);
      assert.strictEqual(res2.body.isAccount, undefined);
      assert.strictEqual(res2.body.id, '123');
    });

    it('should work correctly with nested subrouters', async () => {
      const app = new Koa();

      const accountsRouter = new Router({ prefix: '/accounts' });
      accountsRouter.use(async (ctx, next) => {
        ctx.state.isAccount = true;
        return next();
      });
      accountsRouter.get('/', async (ctx) => {
        ctx.body = { route: 'accounts', isAccount: ctx.state.isAccount };
      });

      const usersRouter = new Router({ prefix: '/users' });
      usersRouter.get('/:userId/accounts', async (ctx) => {
        ctx.body = {
          route: 'user-accounts',
          isAccount: ctx.state.isAccount,
          userId: ctx.params.userId
        };
      });

      const apiRouter = new Router({ prefix: '/api' });
      apiRouter.use(accountsRouter.routes());
      apiRouter.use(usersRouter.routes());

      app.use(apiRouter.routes());

      const server = http.createServer(app.callback());

      const accountsRes = await request(server)
        .get('/api/accounts')
        .expect(200);
      assert.strictEqual(accountsRes.body.route, 'accounts');
      assert.strictEqual(accountsRes.body.isAccount, true);

      const userAccountsRes = await request(server)
        .get('/api/users/12345/accounts')
        .expect(200);
      assert.strictEqual(userAccountsRes.body.route, 'user-accounts');
      assert.strictEqual(userAccountsRes.body.isAccount, undefined);
    });
  });
});
