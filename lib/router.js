/**
 * RESTful resource routing middleware for koa.
 *
 * @author Alex Mingoia <talk@alexmingoia.com>
 * @link https://github.com/alexmingoia/koa-router
 */
const http = require('node:http');

const debug = require('debug')('koa-router');

const compose = require('koa-compose');
const HttpError = require('http-errors');
const { pathToRegexp } = require('path-to-regexp');

const Layer = require('./layer');

const methods = http.METHODS.map((method) => method.toLowerCase());

/**
 * @module koa-router
 */
class Router {
  /**
   * Create a new router.
   *
   * @example
   *
   * Basic usage:
   *
   * ```javascript
   * const Koa = require('koa');
   * const Router = require('@koa/router');
   *
   * const app = new Koa();
   * const router = new Router();
   *
   * router.get('/', (ctx, next) => {
   *   // ctx.router available
   * });
   *
   * app
   *   .use(router.routes())
   *   .use(router.allowedMethods());
   * ```
   *
   * @alias module:koa-router
   * @param {Object=} opts
   * @param {Boolean=false} opts.exclusive only run last matched route's controller when there are multiple matches
   * @param {String=} opts.prefix prefix router paths
   * @param {String|RegExp=} opts.host host for router match
   * @constructor
   */
  constructor(opts = {}) {
    if (!(this instanceof Router)) return new Router(opts);  

    this.opts = opts;
    this.methods = this.opts.methods || [
      'HEAD',
      'OPTIONS',
      'GET',
      'PUT',
      'PATCH',
      'POST',
      'DELETE'
    ];
    this.exclusive = Boolean(this.opts.exclusive);

    this.params = {};
    this.stack = [];
    this.host = this.opts.host;
  }

  /**
   * Generate URL from url pattern and given `params`.
   *
   * @example
   *
   * ```javascript
   * const url = Router.url('/users/:id', {id: 1});
   * // => "/users/1"
   * ```
   *
   * @param {String} path url pattern
   * @param {Object} params url parameters
   * @returns {String}
   */
  static url(path, ...args) {
    return Layer.prototype.url.apply({ path }, args);
  }

  /**
   * Use given middleware.
   *
   * Middleware run in the order they are defined by `.use()`. They are invoked
   * sequentially, requests start at the first middleware and work their way
   * "down" the middleware stack.
   *
   * @example
   *
   * ```javascript
   * // session middleware will run before authorize
   * router
   *   .use(session())
   *   .use(authorize());
   *
   * // use middleware only with given path
   * router.use('/users', userAuth());
   *
   * // or with an array of paths
   * router.use(['/users', '/admin'], userAuth());
   *
   * app.use(router.routes());
   * ```
   *
   * @param {String=} path
   * @param {Function} middleware
   * @param {Function=} ...
   * @returns {Router}
   */
  use(...middleware) {
    const router = this;
    let path;

    // support array of paths
    if (Array.isArray(middleware[0]) && typeof middleware[0][0] === 'string') {
      const arrPaths = middleware[0];
      for (const p of arrPaths) {
        router.use.apply(router, [p, ...middleware.slice(1)]);
      }

      return this;
    }

    const hasPath = typeof middleware[0] === 'string';
    if (hasPath) path = middleware.shift();

    for (const m of middleware) {
      if (m.router) {
        const cloneRouter = Object.assign(
          Object.create(Router.prototype),
          m.router,
          {
            stack: [...m.router.stack]
          }
        );

        for (let j = 0; j < cloneRouter.stack.length; j++) {
          const nestedLayer = cloneRouter.stack[j];
          const cloneLayer = Object.assign(
            Object.create(Layer.prototype),
            nestedLayer
          );

          if (path) cloneLayer.setPrefix(path);
          if (router.opts.prefix) cloneLayer.setPrefix(router.opts.prefix);
          router.stack.push(cloneLayer);
          cloneRouter.stack[j] = cloneLayer;
        }

        if (router.params) {
          const routerParams = Object.keys(router.params);
          for (const key of routerParams) {
            cloneRouter.param(key, router.params[key]);
          }
        }
      } else {
        const { keys } = pathToRegexp(router.opts.prefix || '', router.opts);
        const routerPrefixHasParam = Boolean(
          router.opts.prefix && keys.length > 0
        );
        router.register(path || '([^/]*)', [], m, {
          end: false,
          ignoreCaptures: !hasPath && !routerPrefixHasParam,
          pathAsRegExp: true
        });
      }
    }

    return this;
  }

  /**
   * Set the path prefix for a Router instance that was already initialized.
   *
   * @example
   *
   * ```javascript
   * router.prefix('/things/:thing_id')
   * ```
   *
   * @param {String} prefix
   * @returns {Router}
   */
  prefix(prefix) {
    prefix = prefix.replace(/\/$/, '');

    this.opts.prefix = prefix;

    for (let i = 0; i < this.stack.length; i++) {
      const route = this.stack[i];
      route.setPrefix(prefix);
    }

    return this;
  }

  /**
   * Returns router middleware which dispatches a route matching the request.
   *
   * @returns {Function}
   */
  middleware() {
    const router = this;
    const dispatch = (ctx, next) => {
      debug('%s %s', ctx.method, ctx.path);

      const hostMatched = router.matchHost(ctx.host);

      if (!hostMatched) {
        return next();
      }

      const path =
        router.opts.routerPath ||
        ctx.newRouterPath ||
        ctx.path ||
        ctx.routerPath;
      const matched = router.match(path, ctx.method);
      if (ctx.matched) {
        ctx.matched.push.apply(ctx.matched, matched.path);
      } else {
        ctx.matched = matched.path;
      }

      ctx.router = router;

      if (!matched.route) return next();

      const matchedLayers = matched.pathAndMethod;
      const mostSpecificLayer = matchedLayers[matchedLayers.length - 1];
      ctx._matchedRoute = mostSpecificLayer.path;
      if (mostSpecificLayer.name) {
        ctx._matchedRouteName = mostSpecificLayer.name;
      }

      const layerChain = (
        router.exclusive ? [mostSpecificLayer] : matchedLayers
      ).reduce((memo, layer) => {
        memo.push((ctx, next) => {
          ctx.captures = layer.captures(path, ctx.captures);
          ctx.request.params = layer.params(path, ctx.captures, ctx.params);
          ctx.params = ctx.request.params;
          ctx.routerPath = layer.path;
          ctx.routerName = layer.name;
          ctx._matchedRoute = layer.path;
          if (layer.name) {
            ctx._matchedRouteName = layer.name;
          }

          return next();
        });
        return [...memo, ...layer.stack];
      }, []);

      return compose(layerChain)(ctx, next);
    };

    dispatch.router = this;

    return dispatch;
  }

  routes() {
    return this.middleware();
  }

  /**
   * Returns separate middleware for responding to `OPTIONS` requests with
   * an `Allow` header containing the allowed methods, as well as responding
   * with `405 Method Not Allowed` and `501 Not Implemented` as appropriate.
   *
   * @example
   *
   * ```javascript
   * const Koa = require('koa');
   * const Router = require('@koa/router');
   *
   * const app = new Koa();
   * const router = new Router();
   *
   * app.use(router.routes());
   * app.use(router.allowedMethods());
   * ```
   *
   * **Example with [Boom](https://github.com/hapijs/boom)**
   *
   * ```javascript
   * const Koa = require('koa');
   * const Router = require('@koa/router');
   * const Boom = require('boom');
   *
   * const app = new Koa();
   * const router = new Router();
   *
   * app.use(router.routes());
   * app.use(router.allowedMethods({
   *   throw: true,
   *   notImplemented: () => new Boom.notImplemented(),
   *   methodNotAllowed: () => new Boom.methodNotAllowed()
   * }));
   * ```
   *
   * @param {Object=} options
   * @param {Boolean=} options.throw throw error instead of setting status and header
   * @param {Function=} options.notImplemented throw the returned value in place of the default NotImplemented error
   * @param {Function=} options.methodNotAllowed throw the returned value in place of the default MethodNotAllowed error
   * @returns {Function}
   */
  allowedMethods(options = {}) {
    const implemented = this.methods;

    return (ctx, next) => {
      return next().then(() => {
        const allowed = {};

        if (ctx.matched && (!ctx.status || ctx.status === 404)) {
          for (let i = 0; i < ctx.matched.length; i++) {
            const route = ctx.matched[i];
            for (let j = 0; j < route.methods.length; j++) {
              const method = route.methods[j];
              allowed[method] = method;
            }
          }

          const allowedArr = Object.keys(allowed);
          if (!implemented.includes(ctx.method)) {
            if (options.throw) {
              const notImplementedThrowable =
                typeof options.notImplemented === 'function'
                  ? options.notImplemented() // set whatever the user returns from their function
                  : new HttpError.NotImplemented();

              throw notImplementedThrowable;
            } else {
              ctx.status = 501;
              ctx.set('Allow', allowedArr.join(', '));
            }
          } else if (allowedArr.length > 0) {
            if (ctx.method === 'OPTIONS') {
              ctx.status = 200;
              ctx.body = '';
              ctx.set('Allow', allowedArr.join(', '));
            } else if (!allowed[ctx.method]) {
              if (options.throw) {
                const notAllowedThrowable =
                  typeof options.methodNotAllowed === 'function'
                    ? options.methodNotAllowed() // set whatever the user returns from their function
                    : new HttpError.MethodNotAllowed();

                throw notAllowedThrowable;
              } else {
                ctx.status = 405;
                ctx.set('Allow', allowedArr.join(', '));
              }
            }
          }
        }
      });
    };
  }

  /**
   * Register route with all methods.
   *
   * @param {String} name Optional.
   * @param {String} path
   * @param {Function=} middleware You may also pass multiple middleware.
   * @param {Function} callback
   * @returns {Router}
   */
  all(name, path, middleware) {
    if (typeof path === 'string' || path instanceof RegExp) {
      middleware = Array.prototype.slice.call(arguments, 2);
    } else {
      middleware = Array.prototype.slice.call(arguments, 1);
      path = name;
      name = null;
    }

    // Sanity check to ensure we have a viable path candidate (eg: string|regex|non-empty array)
    if (
      typeof path !== 'string' &&
      !(path instanceof RegExp) &&
      (!Array.isArray(path) || path.length === 0)
    )
      throw new Error('You have to provide a path when adding an all handler');

    const opts = {
      name,
      pathAsRegExp: path instanceof RegExp
    };

    this.register(path, methods, middleware, { ...this.opts, ...opts });

    return this;
  }

  /**
   * Redirect `source` to `destination` URL with optional 30x status `code`.
   *
   * Both `source` and `destination` can be route names.
   *
   * ```javascript
   * router.redirect('/login', 'sign-in');
   * ```
   *
   * This is equivalent to:
   *
   * ```javascript
   * router.all('/login', ctx => {
   *   ctx.redirect('/sign-in');
   *   ctx.status = 301;
   * });
   * ```
   *
   * @param {String} source URL or route name.
   * @param {String} destination URL or route name.
   * @param {Number=} code HTTP status code (default: 301).
   * @returns {Router}
   */
  redirect(source, destination, code) {
    // lookup source route by name
    if (typeof source === 'symbol' || source[0] !== '/') {
      source = this.url(source);
      if (source instanceof Error) throw source;
    }

    // lookup destination route by name
    if (
      typeof destination === 'symbol' ||
      (destination[0] !== '/' && !destination.includes('://'))
    ) {
      destination = this.url(destination);
      if (destination instanceof Error) throw destination;
    }

    return this.all(source, (ctx) => {
      ctx.redirect(destination);
      ctx.status = code || 301;
    });
  }

  /**
   * Create and register a route.
   *
   * @param {String} path Path string.
   * @param {Array.<String>} methods Array of HTTP verbs.
   * @param {Function} middleware Multiple middleware also accepted.
   * @returns {Layer}
   * @private
   */
  register(path, methods, middleware, newOpts = {}) {
    const router = this;
    const { stack } = this;
    const opts = { ...this.opts, ...newOpts };
    // support array of paths
    if (Array.isArray(path)) {
      for (const curPath of path) {
        router.register.call(router, curPath, methods, middleware, opts);
      }

      return this;
    }

    // create route
    const route = new Layer(path, methods, middleware, {
      end: opts.end === false ? opts.end : true,
      name: opts.name,
      sensitive: opts.sensitive || false,
      strict: opts.strict || false,
      prefix: opts.prefix || '',
      ignoreCaptures: opts.ignoreCaptures,
      pathAsRegExp: opts.pathAsRegExp
    });

    // if parent prefix exists, add prefix to new route
    if (this.opts.prefix) {
      route.setPrefix(this.opts.prefix);
    }

    // add parameter middleware
    for (let i = 0; i < Object.keys(this.params).length; i++) {
      const param = Object.keys(this.params)[i];
      route.param(param, this.params[param]);
    }

    stack.push(route);

    debug('defined route %s %s', route.methods, route.path);

    return route;
  }

  /**
   * Lookup route with given `name`.
   *
   * @param {String} name
   * @returns {Layer|false}
   */
  route(name) {
    const routes = this.stack;

    for (let len = routes.length, i = 0; i < len; i++) {
      if (routes[i].name && routes[i].name === name) return routes[i];
    }

    return false;
  }

  /**
   * Generate URL for route. Takes a route name and map of named `params`.
   *
   * @example
   *
   * ```javascript
   * router.get('user', '/users/:id', (ctx, next) => {
   *   // ...
   * });
   *
   * router.url('user', 3);
   * // => "/users/3"
   *
   * router.url('user', { id: 3 });
   * // => "/users/3"
   *
   * router.use((ctx, next) => {
   *   // redirect to named route
   *   ctx.redirect(ctx.router.url('sign-in'));
   * })
   *
   * router.url('user', { id: 3 }, { query: { limit: 1 } });
   * // => "/users/3?limit=1"
   *
   * router.url('user', { id: 3 }, { query: "limit=1" });
   * // => "/users/3?limit=1"
   * ```
   *
   * @param {String} name route name
   * @param {Object} params url parameters
   * @param {Object} [options] options parameter
   * @param {Object|String} [options.query] query options
   * @returns {String|Error}
   */
  url(name, ...args) {
    const route = this.route(name);
    if (route) return route.url.apply(route, args);

    return new Error(`No route found for name: ${String(name)}`);
  }

  /**
   * Match given `path` and return corresponding routes.
   *
   * @param {String} path
   * @param {String} method
   * @returns {Object.<path, pathAndMethod>} returns layers that matched path and
   * path and method.
   * @private
   */
  match(path, method) {
    const layers = this.stack;
    let layer;
    const matched = {
      path: [],
      pathAndMethod: [],
      route: false
    };

    for (let len = layers.length, i = 0; i < len; i++) {
      layer = layers[i];

      debug('test %s %s', layer.path, layer.regexp);

      if (layer.match(path)) {
        matched.path.push(layer);

        if (layer.methods.length === 0 || layer.methods.includes(method)) {
          matched.pathAndMethod.push(layer);
          if (layer.methods.length > 0) matched.route = true;
        }
      }
    }

    return matched;
  }

  /**
   * Match given `input` to allowed host
   * @param {String} input
   * @returns {boolean}
   */
  matchHost(input) {
    const { host } = this;

    if (!host) {
      return true;
    }

    if (!input) {
      return false;
    }

    if (typeof host === 'string') {
      return input === host;
    }

    if (typeof host === 'object' && host instanceof RegExp) {
      return host.test(input);
    }
  }

  /**
   * Run middleware for named route parameters. Useful for auto-loading or
   * validation.
   *
   * @example
   *
   * ```javascript
   * router
   *   .param('user', (id, ctx, next) => {
   *     ctx.user = users[id];
   *     if (!ctx.user) return ctx.status = 404;
   *     return next();
   *   })
   *   .get('/users/:user', ctx => {
   *     ctx.body = ctx.user;
   *   })
   *   .get('/users/:user/friends', ctx => {
   *     return ctx.user.getFriends().then(function(friends) {
   *       ctx.body = friends;
   *     });
   *   })
   *   // /users/3 => {"id": 3, "name": "Alex"}
   *   // /users/3/friends => [{"id": 4, "name": "TJ"}]
   * ```
   *
   * @param {String} param
   * @param {Function} middleware
   * @returns {Router}
   */
  param(param, middleware) {
    this.params[param] = middleware;
    for (let i = 0; i < this.stack.length; i++) {
      const route = this.stack[i];
      route.param(param, middleware);
    }

    return this;
  }
}

/**
 * Create `router.verb()` methods, where *verb* is one of the HTTP verbs such
 * as `router.get()` or `router.post()`.
 *
 * Match URL patterns to callback functions or controller actions using `router.verb()`,
 * where **verb** is one of the HTTP verbs such as `router.get()` or `router.post()`.
 *
 * Additionally, `router.all()` can be used to match against all methods.
 *
 * ```javascript
 * router
 *   .get('/', (ctx, next) => {
 *     ctx.body = 'Hello World!';
 *   })
 *   .post('/users', (ctx, next) => {
 *     // ...
 *   })
 *   .put('/users/:id', (ctx, next) => {
 *     // ...
 *   })
 *   .del('/users/:id', (ctx, next) => {
 *     // ...
 *   })
 *   .all('/users/:id', (ctx, next) => {
 *     // ...
 *   });
 * ```
 *
 * When a route is matched, its path is available at `ctx._matchedRoute` and if named,
 * the name is available at `ctx._matchedRouteName`
 *
 * Route paths will be translated to regular expressions using
 * [path-to-regexp](https://github.com/pillarjs/path-to-regexp).
 *
 * Query strings will not be considered when matching requests.
 *
 * #### Named routes
 *
 * Routes can optionally have names. This allows generation of URLs and easy
 * renaming of URLs during development.
 *
 * ```javascript
 * router.get('user', '/users/:id', (ctx, next) => {
 *  // ...
 * });
 *
 * router.url('user', 3);
 * // => "/users/3"
 * ```
 *
 * #### Multiple middleware
 *
 * Multiple middleware may be given:
 *
 * ```javascript
 * router.get(
 *   '/users/:id',
 *   (ctx, next) => {
 *     return User.findOne(ctx.params.id).then(function(user) {
 *       ctx.user = user;
 *       next();
 *     });
 *   },
 *   ctx => {
 *     console.log(ctx.user);
 *     // => { id: 17, name: "Alex" }
 *   }
 * );
 * ```
 *
 * ### Nested routers
 *
 * Nesting routers is supported:
 *
 * ```javascript
 * const forums = new Router();
 * const posts = new Router();
 *
 * posts.get('/', (ctx, next) => {...});
 * posts.get('/:pid', (ctx, next) => {...});
 * forums.use('/forums/:fid/posts', posts.routes(), posts.allowedMethods());
 *
 * // responds to "/forums/123/posts" and "/forums/123/posts/123"
 * app.use(forums.routes());
 * ```
 *
 * #### Router prefixes
 *
 * Route paths can be prefixed at the router level:
 *
 * ```javascript
 * const router = new Router({
 *   prefix: '/users'
 * });
 *
 * router.get('/', ...); // responds to "/users"
 * router.get('/:id', ...); // responds to "/users/:id"
 * ```
 *
 * #### URL parameters
 *
 * Named route parameters are captured and added to `ctx.params`.
 *
 * ```javascript
 * router.get('/:category/:title', (ctx, next) => {
 *   console.log(ctx.params);
 *   // => { category: 'programming', title: 'how-to-node' }
 * });
 * ```
 *
 * The [path-to-regexp](https://github.com/pillarjs/path-to-regexp) module is
 * used to convert paths to regular expressions.
 *
 *
 * ### Match host for each router instance
 *
 * ```javascript
 * const router = new Router({
 *    host: 'example.domain' // only match if request host exactly equal `example.domain`
 * });
 *
 * ```
 *
 * OR host cloud be a regexp
 *
 * ```javascript
 * const router = new Router({
 *     host: /.*\.?example\.domain$/ // all host end with .example.domain would be matched
 * });
 * ```
 *
 * @name get|put|post|patch|delete|del
 * @memberof module:koa-router.prototype
 * @param {String} path
 * @param {Function=} middleware route middleware(s)
 * @param {Function} callback route callback
 * @returns {Router}
 */
for (const method of methods) {
  Router.prototype[method] = function (name, path, middleware) {
    if (typeof path === 'string' || path instanceof RegExp) {
      middleware = Array.prototype.slice.call(arguments, 2);
    } else {
      middleware = Array.prototype.slice.call(arguments, 1);
      path = name;
      name = null;
    }

    // Sanity check to ensure we have a viable path candidate (eg: string|regex|non-empty array)
    if (
      typeof path !== 'string' &&
      !(path instanceof RegExp) &&
      (!Array.isArray(path) || path.length === 0)
    )
      throw new Error(
        `You have to provide a path when adding a ${method} handler`
      );

    const opts = {
      name,
      pathAsRegExp: path instanceof RegExp
    };

    // pass opts to register call on verb methods
    this.register(path, [method], middleware, { ...this.opts, ...opts });
    return this;
  };
}

// Alias for `router.delete()` because delete is a reserved word
 
Router.prototype.del = Router.prototype['delete'];

module.exports = Router;
