/**
 * Router tests
 */
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const assert = require('node:assert');

const Koa = require('koa');
const methods = require('methods');
const request = require('supertest');

const Router = require('../../lib/router');
const Layer = require('../../lib/layer');

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
            ctx.body.message += ' World';
            resolve(next());
          }, 1);
        });
      },
      (ctx) => {
        ctx.body.message += '!';
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
    app.experimental = true;
    const router = new Router();
    router.get('/async', (ctx) => {
      return new Promise((resolve) => {
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
        ctx.body = { ...ctx.body, all: true };
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
      .get(
        'users_single',
        new RegExp('/users/:id(.*)'), // eslint-disable-line prefer-regex-literals
        (ctx, next) => {
          ctx.body = { single: true };
          next();
        }
      )
      .get('users_all', '/users/all', (ctx, next) => {
        ctx.body = { ...ctx.body, all: true };
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
      () => {
        // no next()
      },
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
      const packagePath = path.join(__dirname, '..', '..', 'package.json');
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
    return next().catch((err) => {
      // assert that the correct HTTPError was thrown
      assert.strictEqual(err.name, 'MethodNotAllowedError');
      assert.strictEqual(err.statusCode, 405);

      // translate the HTTPError to a normal response
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
  // the 'Allow' header is not set when throwing
  assert.strictEqual('allow' in res.header, false);
});

it('responds with user-provided throwable using the "throw" and "methodNotAllowed" options', async () => {
  const app = new Koa();
  const router = new Router();
  app.use(router.routes());
  app.use((ctx, next) => {
    return next().catch((err) => {
      // assert that the correct HTTPError was thrown
      assert.strictEqual(err.message, 'Custom Not Allowed Error');
      assert.strictEqual(err.statusCode, 405);

      // translate the HTTPError to a normal response
      ctx.body = err.body;
      ctx.status = err.statusCode;
    });
  });
  app.use(
    router.allowedMethods({
      throw: true,
      methodNotAllowed() {
        const notAllowedErr = new Error('Custom Not Allowed Error');
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
  // the 'Allow' header is not set when throwing
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
    return next().catch((err) => {
      // assert that the correct HTTPError was thrown
      assert.strictEqual(err.name, 'NotImplementedError');
      assert.strictEqual(err.statusCode, 501);

      // translate the HTTPError to a normal response
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
  // the 'Allow' header is not set when throwing
  assert.strictEqual('allow' in res.header, false);
});

it('responds with user-provided throwable using the "throw" and "notImplemented" options', async () => {
  const app = new Koa();
  const router = new Router();
  app.use(router.routes());
  app.use((ctx, next) => {
    return next().catch((err) => {
      // assert that our custom error was thrown
      assert.strictEqual(err.message, 'Custom Not Implemented Error');
      assert.strictEqual(err.type, 'custom');
      assert.strictEqual(err.statusCode, 501);

      // translate the HTTPError to a normal response
      ctx.body = err.body;
      ctx.status = err.statusCode;
    });
  });
  app.use(
    router.allowedMethods({
      throw: true,
      notImplemented() {
        const notImplementedErr = new Error('Custom Not Implemented Error');
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
  // the 'Allow' header is not set when throwing
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
  // https://tools.ietf.org/html/rfc7231#section-7.4.1
  const app = new Koa();
  const router = new Router();
  app.use(router.routes());
  app.use(router.allowedMethods());

  router.get('/', () => {});

  const res = await request(http.createServer(app.callback()))
    .options('/')
    .expect(200);

  assert.strictEqual(res.header.allow, 'HEAD, GET');
  const allowHeaders = res.res.rawHeaders.filter((item) => item === 'Allow');
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
    // bind helloworld.example.com/users => example.com/helloworld/users
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
      ctx.body = err.message;
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
      ctx.body = err.message;
    }
  });
  router2.get('/echo/:saying', (ctx) => {
    try {
      assert.strictEqual(ctx.params.saying, 'helloWorld');
      assert.strictEqual(ctx.request.params.saying, 'helloWorld');
      ctx.body = { echo: ctx.params.saying };
    } catch (err) {
      ctx.status = 500;
      ctx.body = err.message;
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
      ctx.body = err.message;
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
      assert.strictEqual(typeof router[method], 'function');
      router[method]('/', () => {});
    }

    assert.strictEqual(router.stack.length, methods.length);
  });

  it('registers route with a regexp path', () => {
    const router = new Router();
    for (const method of methods) {
      assert.strictEqual(
        router[method](/^\/\w$/i, () => {}),
        router
      );
    }
  });

  it('registers route with a given name', () => {
    const router = new Router();
    for (const method of methods) {
      assert.strictEqual(
        router[method](method, '/', () => {}),
        router
      );
    }
  });

  it('registers route with with a given name and regexp path', () => {
    const router = new Router();
    for (const method of methods) {
      assert.strictEqual(
        router[method](method, /^\/$/i, () => {}),
        router
      );
    }
  });

  it('enables route chaining', () => {
    const router = new Router();
    for (const method of methods) {
      assert.strictEqual(
        router[method]('/', () => {}),
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
        router[el](() => {});
      } catch (err) {
        assert.strictEqual(
          err.message,
          `You have to provide a path when adding a ${el} handler`
        );
      }
    }
  });

  it('correctly returns an error when not passed a path for "all" registration (gh-147)', () => {
    const router = new Router();
    try {
      router.all(() => {});
    } catch (err) {
      assert.strictEqual(
        err.message,
        'You have to provide a path when adding an all handler'
      );
    }
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
});

it('redirects using symbols as route names', async () => {
  const app = new Koa();
  const router = new Router();
  app.use(router.routes());
  const homeSymbol = Symbol('home');
  const signUpFormSymbol = Symbol('sign-up-form');
  router.get(homeSymbol, '/', () => {});
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
    assert.strictEqual(router.route('child').name, 'child');
  });

  it('supports symbols as names', () => {
    const childSymbol = Symbol('child');
    const subrouter = new Router().get(childSymbol, '/hello', (ctx) => {
      ctx.body = { hello: 'world' };
    });
    const router = new Router().use(subrouter.routes());
    assert.strictEqual(router.route(childSymbol).name, childSymbol);
  });

  it('returns false if no name matches', () => {
    const router = new Router();
    router.get('books', '/books', (ctx) => {
      ctx.status = 204;
    });
    router.get(Symbol('Picard'), '/enterprise', (ctx) => {
      ctx.status = 204;
    });
    assert.strictEqual(Boolean(router.route('Picard')), false);
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
    assert.strictEqual(url, '/books', {});
    url = router.url('books');
    assert.strictEqual(url, '/books', {}, {});
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
    router.get(Symbol('Picard'), '/enterprise', (ctx) => {
      ctx.status = 204;
    });

    assert.strictEqual(router.url('Picard') instanceof Error, true);
    assert.strictEqual(router.url(Symbol('books')) instanceof Error, true);
  });

  it('escapes using encodeURIComponent()', () => {
    const url = Router.url('/:category/:title', {
      category: 'programming',
      title: 'how to node & js/ts'
    });
    assert.strictEqual(url, '/programming/how%20to%20node%20%26%20js%2Fts');
  });
});

describe('Router#param()', () => {
  it('runs parameter middleware', async () => {
    const app = new Koa();
    const router = new Router();
    app.use(router.routes());
    router
      .param('user', (id, ctx, next) => {
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
      .param('user', (id, ctx, next) => {
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
      .param('first', (id, ctx, next) => {
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
      // intentional random order
      .param('a', (id, ctx, next) => {
        ctx.state.loaded = [id];
        return next();
      })
      .param('d', (id, ctx, next) => {
        ctx.state.loaded.push(id);
        return next();
      })
      .param('c', (id, ctx, next) => {
        ctx.state.loaded.push(id);
        return next();
      })
      .param('b', (id, ctx, next) => {
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
      .param('id', (id, ctx, next) => {
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
});

describe('Router#opts', () => {
  it('responds with 200', async () => {
    const app = new Koa();
    const router = new Router({
      trailing: false
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
      trailing: false
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
      trailing: false
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
      trailing: false
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
    const middlewareA = (ctx, next) => {
      middlewareCount++;
      return next();
    };

    const middlewareB = (ctx, next) => {
      middlewareCount++;
      return next();
    };

    router.use(middlewareA, middlewareB);
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
    const middleware = (ctx, next) => {
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

  describe('with trailing slash', testPrefix('/admin/'));
  describe('without trailing slash', testPrefix('/admin'));

  function testPrefix(prefix) {
    return () => {
      let server;
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
});
