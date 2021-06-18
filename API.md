# API Reference


## Table of Contents

* [Router ⏏](#router-)
  * [new Router(\[opts\])](#new-routeropts)
  * [router.get|put|post|patch|delete|del ⇒ <code>Router</code>](#routergetputpostpatchdeletedel--coderoutercode)
  * [Named routes](#named-routes)
  * [Match host](#match-host)
  * [Multiple middleware](#multiple-middleware)
* [Nested routers](#nested-routers)
  * [Router prefixes](#router-prefixes)
  * [URL parameters](#url-parameters)
  * [router.routes ⇒ <code>function</code>](#routerroutes--codefunctioncode)
  * [router.use(\[path\], middleware) ⇒ <code>Router</code>](#routerusepath-middleware--coderoutercode)
  * [router.prefix(prefix) ⇒ <code>Router</code>](#routerprefixprefix--coderoutercode)
  * [router.allowedMethods(\[options\]) ⇒ <code>function</code>](#routerallowedmethodsoptions--codefunctioncode)
  * [router.redirect(source, destination, \[code\]) ⇒ <code>Router</code>](#routerredirectsource-destination-code--coderoutercode)
  * [router.route(name) ⇒ <code>Layer</code> | <code>false</code>](#routerroutename--codelayercode--codefalsecode)
  * [router.url(name, params, \[options\]) ⇒ <code>String</code> | <code>Error</code>](#routerurlname-params-options--codestringcode--codeerrorcode)
  * [router.param(param, middleware) ⇒ <code>Router</code>](#routerparamparam-middleware--coderoutercode)
  * [Router.url(path, params) ⇒ <code>String</code>](#routerurlpath-params--codestringcode)


## Router ⏏

**Kind**: Exported class

### new Router(\[opts])

Create a new router.

| Param            | Type                       | Description                                                              |
| ---------------- | -------------------------- | ------------------------------------------------------------------------ |
| [opts]           | <code>Object</code>        |                                                                          |
| [opts.prefix]    | <code>String</code>        | prefix router paths                                                      |
| [opts.exclusive] | <code>Boolean</code>       | only run last matched route's controller when there are multiple matches |
| [opts.host]      | <code>String/Regexp</code> | hostname to match for all routes                                         |

**Example**
Basic usage:

```javascript
const Koa = require('koa');
const Router = require('@koa/router');

const app = new Koa();
const router = new Router();

router.get('/', (ctx, next) => {
  // ctx.router available
});

app
  .use(router.routes())
  .use(router.allowedMethods());
```

### router.get|put|post|patch|delete|del ⇒ <code>Router</code>

Create `router.verb()` methods, where *verb* is one of the HTTP verbs, such
as `router.get()` or `router.post()`.

Match URL patterns to callback functions or controller actions using `router.verb()`,
where **verb** is one of the HTTP verbs such as `router.get()` or `router.post()`.

Additionally, `router.all()` can be used to match against all methods.

```javascript
router
  .get('/', (ctx, next) => {
    ctx.body = 'Hello World!';
  })
  .post('/users', (ctx, next) => {
    // ...
  })
  .put('/users/:id', (ctx, next) => {
    // ...
  })
  .del('/users/:id', (ctx, next) => {
    // ...
  })
  .all('/users/:id', (ctx, next) => {
    // ...
  });
```

When a route is matched, its path is available at `ctx._matchedRoute` and if named,
the name is available at `ctx._matchedRouteName`

Route paths will be translated to regular expressions using
[path-to-regexp](https://github.com/pillarjs/path-to-regexp).

Query strings will not be considered when matching requests.

### Named routes

Routes can optionally have names. This allows generation of URLs and easy
renaming of URLs during development.

```javascript
router.get('user', '/users/:id', (ctx, next) => {
 // ...
});

router.url('user', 3);
// => "/users/3"
```

### Match host

Routers can match against a specific host by using the `host` property.

```javascript
const routerA = new Router({
  host: 'hosta.com' // only match if request host exactly equal `hosta.com`
});

router.get('/', (ctx, next) => {
  // Response for hosta.com
});

const routerB = new Router({
  host: /^(.*\.)?hostb\.com$/ // match all subdomains of hostb.com, including hostb.com, www.hostb.com, etc.
});

router.get('/', (ctx, next) => {
  // Response index for matched hosts
});
```

### Multiple middleware

Multiple middleware may be given:

```javascript
router.get(
  '/users/:id',
  (ctx, next) => {
    return User.findOne(ctx.params.id).then(function(user) {
      ctx.user = user;
      next();
    });
  },
  ctx => {
    console.log(ctx.user);
    // => { id: 17, name: "Alex" }
  }
);
```


## Nested routers

Nesting routers is supported:

```javascript
const forums = new Router();
const posts = new Router();

posts.get('/', (ctx, next) => {...});
posts.get('/:pid', (ctx, next) => {...});
forums.use('/forums/:fid/posts', posts.routes(), posts.allowedMethods());

// responds to "/forums/123/posts" and "/forums/123/posts/123"
app.use(forums.routes());
```

### Router prefixes

Route paths can be prefixed at the router level:

```javascript
const router = new Router({
  prefix: '/users'
});

router.get('/', ...); // responds to "/users"
router.get('/:id', ...); // responds to "/users/:id"
```

### URL parameters

Named route parameters are captured and added to `ctx.params`.

```javascript
router.get('/:category/:title', (ctx, next) => {
  console.log(ctx.params);
  // => { category: 'programming', title: 'how-to-node' }
});
```

The [path-to-regexp](https://github.com/pillarjs/path-to-regexp) module is
used to convert paths to regular expressions.

**Kind**: instance property of <code>[Router](#exp_module_koa-router--Router)</code>

| Param        | Type                  | Description         |
| ------------ | --------------------- | ------------------- |
| path         | <code>String</code>   |                     |
| [middleware] | <code>function</code> | route middleware(s) |
| callback     | <code>function</code> | route callback      |

### router.routes ⇒ <code>function</code>

Returns router middleware which dispatches a route matching the request.

**Kind**: instance property of <code>[Router](#exp_module_koa-router--Router)</code>

### router.use(\[path], middleware) ⇒ <code>Router</code>

Use given middleware, **if and only if**, a route is matched.

Middleware run in the order they are defined by `.use()`. They are invoked
sequentially, requests start at the first middleware and work their way
"down" the middleware stack.

**Kind**: instance method of <code>[Router](#exp_module_koa-router--Router)</code>

| Param      | Type                  |
| ---------- | --------------------- |
| [path]     | <code>String</code>   |
| middleware | <code>function</code> |
| [...]      | <code>function</code> |

**Example**

```javascript
// session middleware will run before authorize
router
  .use(session())
  .use(authorize());

// use middleware only with given path
router.use('/users', userAuth());

// or with an array of paths
router.use(['/users', '/admin'], userAuth());

app.use(router.routes());
```

### router.prefix(prefix) ⇒ <code>Router</code>

Set the path prefix for a Router instance that was already initialized.

**Kind**: instance method of <code>[Router](#exp_module_koa-router--Router)</code>

| Param  | Type                |
| ------ | ------------------- |
| prefix | <code>String</code> |

**Example**

```javascript
const router = new Router({
  prefix: '/categories'
});

router.get('/', ...); // respond "/categories"

router.prefix('/users');

router.get('/', ...); // responds to "/users"
router.get('/:id', ...); // responds to "/users/:id"
```

**Note**: prefix always should start from `/` otherwise it won't work.

### router.allowedMethods(\[options]) ⇒ <code>function</code>

Returns separate middleware for responding to `OPTIONS` requests with
an `Allow` header containing the allowed methods, as well as responding
with `405 Method Not Allowed` and `501 Not Implemented` as appropriate.

**Kind**: instance method of <code>[Router](#exp_module_koa-router--Router)</code>

| Param                      | Type                  | Description                                                             |
| -------------------------- | --------------------- | ----------------------------------------------------------------------- |
| [options]                  | <code>Object</code>   |                                                                         |
| [options.throw]            | <code>Boolean</code>  | throw error instead of setting status and header                        |
| [options.notImplemented]   | <code>function</code> | throw the returned value in place of the default NotImplemented error   |
| [options.methodNotAllowed] | <code>function</code> | throw the returned value in place of the default MethodNotAllowed error |

**Example**

```javascript
const Koa = require('koa');
const Router = require('@koa/router');

const app = new Koa();
const router = new Router();

app.use(router.routes());
app.use(router.allowedMethods());
```

**Example with [Boom](https://github.com/hapijs/boom)**

```javascript
const Koa = require('koa');
const Router = require('@koa/router');
const Boom = require('@hapi/boom');

const app = new Koa();
const router = new Router();

app.use(router.routes());
app.use(router.allowedMethods({
  throw: true,
  notImplemented: () => Boom.notImplemented(),
  methodNotAllowed: () => Boom.methodNotAllowed()
}));
```

### router.redirect(source, destination, \[code]) ⇒ <code>Router</code>

Redirect `source` to `destination` URL with optional 30x status `code`.

Both `source` and `destination` can be route names.

```javascript
router.redirect('/login', 'sign-in');
```

This is equivalent to:

```javascript
router.all('/login', ctx => {
  ctx.redirect('/sign-in');
  ctx.status = 301;
});
```

**Kind**: instance method of <code>[Router](#exp_module_koa-router--Router)</code>

| Param       | Type                | Description                      |
| ----------- | ------------------- | -------------------------------- |
| source      | <code>String</code> | URL or route name.               |
| destination | <code>String</code> | URL or route name.               |
| [code]      | <code>Number</code> | HTTP status code (default: 301). |

### router.route(name) ⇒ <code>Layer</code> | <code>false</code>

Lookup route with given `name`.

**Kind**: instance method of <code>[Router](#exp_module_koa-router--Router)</code>

| Param | Type                |
| ----- | ------------------- |
| name  | <code>String</code> |

### router.url(name, params, \[options]) ⇒ <code>String</code> | <code>Error</code>

Generate URL for route. Takes a route name and map of named `params`.

**Kind**: instance method of <code>[Router](#exp_module_koa-router--Router)</code>

| Param           | Type                                       | Description       |
| --------------- | ------------------------------------------ | ----------------- |
| name            | <code>String</code>                        | route name        |
| params          | <code>Object</code>                        | url parameters    |
| [options]       | <code>Object</code>                        | options parameter |
| [options.query] | <code>Object</code> \| <code>String</code> | query options     |

**Example**

```javascript
router.get('user', '/users/:id', (ctx, next) => {
  // ...
});

router.url('user', 3);
// => "/users/3"

router.url('user', { id: 3 });
// => "/users/3"

router.use((ctx, next) => {
  // redirect to named route
  ctx.redirect(ctx.router.url('sign-in'));
})

router.url('user', { id: 3 }, { query: { limit: 1 } });
// => "/users/3?limit=1"

router.url('user', { id: 3 }, { query: "limit=1" });
// => "/users/3?limit=1"
```

### router.param(param, middleware) ⇒ <code>Router</code>

Run middleware for named route parameters. Useful for auto-loading or
validation.

**Kind**: instance method of <code>[Router](#exp_module_koa-router--Router)</code>

| Param      | Type                  |
| ---------- | --------------------- |
| param      | <code>String</code>   |
| middleware | <code>function</code> |

**Example**

```javascript
router
  .param('user', (id, ctx, next) => {
    ctx.user = users[id];
    if (!ctx.user) return ctx.status = 404;
    return next();
  })
  .get('/users/:user', ctx => {
    ctx.body = ctx.user;
  })
  .get('/users/:user/friends', ctx => {
    return ctx.user.getFriends().then(function(friends) {
      ctx.body = friends;
    });
  })
  // /users/3 => {"id": 3, "name": "Alex"}
  // /users/3/friends => [{"id": 4, "name": "TJ"}]
```

### Router.url(path, params) ⇒ <code>String</code>

Generate URL from url pattern and given `params`.

**Kind**: static method of <code>[Router](#exp_module_koa-router--Router)</code>

| Param  | Type                | Description    |
| ------ | ------------------- | -------------- |
| path   | <code>String</code> | url pattern    |
| params | <code>Object</code> | url parameters |

**Example**

```javascript
const url = Router.url('/users/:id', {id: 1});
// => "/users/1"
```
