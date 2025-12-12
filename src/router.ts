import compose from 'koa-compose';
import HttpError from 'http-errors';

import Layer from './layer';
import { getAllHttpMethods, COMMON_HTTP_METHODS } from './utils/http-methods';
import {
  applyAllParameterMiddleware,
  applyParameterMiddlewareToRoute
} from './utils/parameter-helpers';
import {
  hasPathParameters,
  determineMiddlewarePath
} from './utils/path-helpers';
import { debug } from './utils/debug';

import type {
  Middleware,
  ParameterizedContext,
  RouterOptions,
  RouterOptionsWithMethods,
  RouterMiddleware,
  RouterParameterMiddleware,
  RouterContext,
  RouterParameterContext,
  MatchResult,
  AllowedMethodsOptions,
  LayerOptions,
  RouterWithMethods
} from './types';

const httpMethods = getAllHttpMethods();

/**
 * Middleware with router property
 */
type RouterComposedMiddleware<
  StateT = import('koa').DefaultState,
  ContextT = import('koa').DefaultContext
> = Middleware<StateT, ContextT & RouterParameterContext<StateT, ContextT>> & {
  router?: Router<StateT, ContextT>;
};

/**
 * @module koa-router
 */
class Router<
  StateT = import('koa').DefaultState,
  ContextT = import('koa').DefaultContext
> {
  opts: RouterOptions;
  methods: string[];
  exclusive: boolean;
  params: Record<
    string,
    | RouterParameterMiddleware<StateT, ContextT>
    | RouterParameterMiddleware<StateT, ContextT>[]
  >;
  stack: Layer<StateT, ContextT>[];
  host?: string | string[] | RegExp;

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
   * @param opts - Router options
   * @constructor
   */
  constructor(options: RouterOptions = {}) {
    this.opts = options;
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
   * @param path - URL pattern
   * @param args - URL parameters
   * @returns Generated URL
   */
  static url(path: string | RegExp, ...arguments_: unknown[]): string {
    const temporaryLayer = new Layer(path, [], () => {});
    return temporaryLayer.url(...arguments_);
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
   * @param middleware - Middleware functions
   * @returns This router instance
   */
  use<T = {}, U = {}, B = unknown>(
    middleware: RouterMiddleware<StateT & T, ContextT & U, B>
  ): Router<StateT, ContextT>;
  use<T = {}, U = {}>(
    middleware: RouterComposedMiddleware<StateT & T, ContextT & U>
  ): Router<StateT, ContextT>;
  use<T = {}, U = {}, B = unknown>(
    path: string | RegExp | string[],
    middleware: RouterMiddleware<StateT & T, ContextT & U, B>
  ): Router<StateT, ContextT>;
  use<T = {}, U = {}>(
    path: string | RegExp | string[],
    middleware: RouterComposedMiddleware<StateT & T, ContextT & U>
  ): Router<StateT, ContextT>;
  use<T = {}, U = {}, B = unknown>(
    path: string | RegExp | string[],
    m1: RouterMiddleware<StateT & T, ContextT & U, B>,
    m2:
      | RouterMiddleware<StateT & T, ContextT & U, B>
      | RouterComposedMiddleware<StateT & T, ContextT & U>,
    ...middleware: Array<
      | RouterMiddleware<StateT & T, ContextT & U, B>
      | RouterComposedMiddleware<StateT & T, ContextT & U>
    >
  ): Router<StateT, ContextT>;
  use<T = {}, U = {}, B = unknown>(
    m1: RouterMiddleware<StateT & T, ContextT & U, B>,
    m2:
      | RouterMiddleware<StateT & T, ContextT & U, B>
      | RouterComposedMiddleware<StateT & T, ContextT & U>,
    ...middleware: Array<
      | RouterMiddleware<StateT & T, ContextT & U, B>
      | RouterComposedMiddleware<StateT & T, ContextT & U>
    >
  ): Router<StateT, ContextT>;
  use(
    ...middleware: (
      | string
      | RegExp
      | string[]
      | RouterMiddleware<StateT, ContextT>
      | RouterComposedMiddleware<StateT, ContextT>
    )[]
  ): Router<StateT, ContextT> {
    let explicitPath: string | RegExp | undefined;

    if (this._isPathArray(middleware[0])) {
      return this._useWithPathArray(middleware);
    }

    const hasExplicitPath = this._hasExplicitPath(middleware[0]);
    if (hasExplicitPath) {
      explicitPath = middleware.shift() as string | RegExp;
    }

    if (middleware.length === 0) {
      throw new Error(
        'You must provide at least one middleware function to router.use()'
      );
    }

    for (const currentMiddleware of middleware) {
      if (this._isNestedRouter(currentMiddleware)) {
        this._mountNestedRouter(
          currentMiddleware as RouterComposedMiddleware<StateT, ContextT>,
          explicitPath
        );
      } else {
        this._registerMiddleware(
          currentMiddleware as RouterMiddleware<StateT, ContextT>,
          explicitPath,
          hasExplicitPath
        );
      }
    }

    return this;
  }

  /**
   * Check if first argument is an array of paths (all elements must be strings)
   * @private
   */
  private _isPathArray(firstArgument: unknown): firstArgument is string[] {
    return (
      Array.isArray(firstArgument) &&
      firstArgument.length > 0 &&
      firstArgument.every((item) => typeof item === 'string')
    );
  }

  /**
   * Check if first argument is an explicit path (string or RegExp)
   * Empty string counts as explicit path to enable param capture
   * @private
   */
  private _hasExplicitPath(firstArgument: unknown): boolean {
    return typeof firstArgument === 'string' || firstArgument instanceof RegExp;
  }

  /**
   * Check if middleware contains a nested router
   * @private
   */
  private _isNestedRouter(
    middleware: unknown
  ): middleware is RouterComposedMiddleware<StateT, ContextT> {
    return (
      typeof middleware === 'function' &&
      'router' in middleware &&
      middleware.router !== undefined
    );
  }

  /**
   * Apply middleware to multiple paths
   * @private
   */
  private _useWithPathArray(middleware: unknown[]): Router<StateT, ContextT> {
    const pathArray = middleware[0] as string[];
    const remainingMiddleware = middleware.slice(1);

    for (const singlePath of pathArray) {
      Reflect.apply(this.use, this, [singlePath, ...remainingMiddleware]);
    }

    return this;
  }

  /**
   * Mount a nested router
   * @private
   */
  private _mountNestedRouter(
    middlewareWithRouter: RouterComposedMiddleware<StateT, ContextT>,
    mountPath?: string | RegExp
  ): void {
    const nestedRouter = middlewareWithRouter.router!;

    const clonedRouter = this._cloneRouter(nestedRouter);

    const mountPathHasParameters =
      mountPath &&
      typeof mountPath === 'string' &&
      hasPathParameters(mountPath, this.opts);

    for (
      let routeIndex = 0;
      routeIndex < clonedRouter.stack.length;
      routeIndex++
    ) {
      const nestedLayer = clonedRouter.stack[routeIndex];
      const clonedLayer = this._cloneLayer(nestedLayer);

      if (mountPath && typeof mountPath === 'string') {
        clonedLayer.setPrefix(mountPath);
      }
      if (this.opts.prefix) {
        clonedLayer.setPrefix(this.opts.prefix);
      }

      if (clonedLayer.methods.length === 0 && mountPathHasParameters) {
        clonedLayer.opts.ignoreCaptures = false;
      }

      this.stack.push(clonedLayer);
      clonedRouter.stack[routeIndex] = clonedLayer;
    }

    if (this.params) {
      this._applyParamMiddlewareToRouter(clonedRouter);
    }
  }

  /**
   * Clone a router instance
   * @private
   */
  private _cloneRouter(
    sourceRouter: Router<StateT, ContextT>
  ): Router<StateT, ContextT> {
    return Object.assign(
      Object.create(Object.getPrototypeOf(sourceRouter)),
      sourceRouter,
      {
        stack: [...sourceRouter.stack]
      }
    );
  }

  /**
   * Clone a layer instance (deep clone to avoid shared references)
   * @private
   */
  private _cloneLayer(
    sourceLayer: Layer<StateT, ContextT>
  ): Layer<StateT, ContextT> {
    const cloned = Object.assign(
      Object.create(Object.getPrototypeOf(sourceLayer)),
      sourceLayer,
      {
        // Deep clone arrays and objects to avoid shared references
        stack: [...sourceLayer.stack],
        methods: [...sourceLayer.methods],
        paramNames: [...sourceLayer.paramNames],
        opts: { ...sourceLayer.opts }
      }
    ) as Layer<StateT, ContextT>;

    return cloned;
  }

  /**
   * Apply this router's param middleware to a nested router
   * @private
   */
  private _applyParamMiddlewareToRouter(
    targetRouter: Router<StateT, ContextT>
  ): void {
    const parameterNames = Object.keys(this.params);

    for (const parameterName of parameterNames) {
      const parameterMiddleware = this.params[parameterName];
      applyParameterMiddlewareToRoute<StateT, ContextT>(
        targetRouter,
        parameterName,
        parameterMiddleware
      );
    }
  }

  /**
   * Register regular middleware (not nested router)
   * @private
   */
  private _registerMiddleware(
    middleware: RouterMiddleware<StateT, ContextT>,
    explicitPath?: string | RegExp,
    hasExplicitPath?: boolean
  ): void {
    const prefixHasParameters = hasPathParameters(
      this.opts.prefix || '',
      this.opts
    );

    const effectiveExplicitPath = (() => {
      if (explicitPath !== undefined) return explicitPath;
      if (prefixHasParameters) return '';
      return;
    })();

    const effectiveHasExplicitPath =
      hasExplicitPath || (explicitPath === undefined && prefixHasParameters);

    const { path: middlewarePath, pathAsRegExp } = determineMiddlewarePath(
      effectiveExplicitPath,
      prefixHasParameters
    );

    let finalPath: string | RegExp = middlewarePath;
    let usePathToRegexp = pathAsRegExp;

    const isRootPath = effectiveHasExplicitPath && middlewarePath === '/';

    if (effectiveHasExplicitPath && typeof middlewarePath === 'string') {
      finalPath = middlewarePath;
      usePathToRegexp = false;
    }

    this.register(finalPath, [], middleware, {
      end: isRootPath,
      ignoreCaptures: !effectiveHasExplicitPath && !prefixHasParameters,
      pathAsRegExp: usePathToRegexp
    });
  }

  /**
   * Set the path prefix for a Router instance that was already initialized.
   * Note: Calling this method multiple times will replace the prefix, not stack them.
   *
   * @example
   *
   * ```javascript
   * router.prefix('/things/:thing_id')
   * ```
   *
   * @param prefixPath - Prefix string
   * @returns This router instance
   */
  prefix(prefixPath: string): Router<StateT, ContextT> {
    const normalizedPrefix = prefixPath.replace(/\/$/, '');
    const previousPrefix = this.opts.prefix || '';

    this.opts.prefix = normalizedPrefix;

    for (const route of this.stack) {
      if (previousPrefix && typeof route.path === 'string') {
        if (route.path.startsWith(previousPrefix)) {
          route.path = route.path.slice(previousPrefix.length) || '/';
          route.setPrefix(normalizedPrefix);
        } else {
          route.setPrefix(normalizedPrefix);
        }
      } else {
        route.setPrefix(normalizedPrefix);
      }
    }

    return this;
  }

  /**
   * Returns router middleware which dispatches a route matching the request.
   *
   * @returns Router middleware
   */
  middleware(): RouterComposedMiddleware<StateT, ContextT> {
    const dispatchMiddleware = function (
      this: Router<StateT, ContextT>,
      context: ParameterizedContext<
        StateT,
        ContextT & RouterParameterContext<StateT, ContextT>
      >,
      next: () => Promise<unknown>
    ) {
      debug('%s %s', context.method, context.path);

      if (!this.matchHost(context.host)) {
        return next();
      }

      const requestPath = this._getRequestPath(context);

      const matchResult = this.match(requestPath, context.method);

      this._storeMatchedRoutes(context, matchResult);
      context.router = this;

      if (!matchResult.route) {
        return next();
      }

      const matchedLayers = matchResult.pathAndMethod;
      this._setMatchedRouteInfo(context, matchedLayers);

      const middlewareChain = this._buildMiddlewareChain(
        matchedLayers,
        requestPath
      );
      return compose(middlewareChain)(
        context as RouterContext<StateT, ContextT>,
        next
      );
    }.bind(this);

    (dispatchMiddleware as RouterComposedMiddleware<StateT, ContextT>).router =
      this;
    return dispatchMiddleware as RouterComposedMiddleware<StateT, ContextT>;
  }

  /**
   * Get the request path to use for routing
   * @private
   */
  private _getRequestPath(
    context: ParameterizedContext<
      StateT,
      ContextT & RouterParameterContext<StateT, ContextT>
    >
  ): string {
    const context_ = context as RouterContext<StateT, ContextT>;
    return (
      this.opts.routerPath ||
      context_.newRouterPath ||
      context_.path ||
      context_.routerPath ||
      ''
    );
  }

  /**
   * Store matched routes on context
   * @private
   */
  private _storeMatchedRoutes(
    context: ParameterizedContext<
      StateT,
      ContextT & RouterParameterContext<StateT, ContextT>
    >,
    matchResult: MatchResult<StateT, ContextT>
  ): void {
    const context_ = context as RouterContext<StateT, ContextT>;
    if (context_.matched) {
      context_.matched.push(...matchResult.path);
    } else {
      context_.matched = matchResult.path;
    }
  }

  /**
   * Set matched route information on context
   * @private
   */
  private _setMatchedRouteInfo(
    context: ParameterizedContext<
      StateT,
      ContextT & RouterParameterContext<StateT, ContextT>
    >,
    matchedLayers: Layer<StateT, ContextT>[]
  ): void {
    const context_ = context as RouterContext<StateT, ContextT>;
    const routeLayer = matchedLayers
      .toReversed()
      .find((layer) => layer.methods.length > 0);

    if (routeLayer) {
      context_._matchedRoute = routeLayer.path as string;

      if (routeLayer.name) {
        context_._matchedRouteName = routeLayer.name;
      }
    }
  }

  /**
   * Build middleware chain from matched layers
   * @private
   */
  private _buildMiddlewareChain(
    matchedLayers: Layer<StateT, ContextT>[],
    requestPath: string
  ): RouterMiddleware<StateT, ContextT>[] {
    const layersToExecute = this.opts.exclusive
      ? [matchedLayers.at(-1)].filter(
          (layer): layer is Layer<StateT, ContextT> => layer !== undefined
        )
      : matchedLayers;

    const middlewareChain: RouterMiddleware<StateT, ContextT>[] = [];

    for (const layer of layersToExecute) {
      middlewareChain.push(
        (
          context: ParameterizedContext<
            StateT,
            ContextT & RouterParameterContext<StateT, ContextT>
          >,
          next: () => Promise<unknown>
        ) => {
          const routerContext = context as RouterContext<StateT, ContextT>;
          routerContext.captures = layer.captures(requestPath);
          routerContext.request.params = layer.params(
            requestPath,
            routerContext.captures || [],
            routerContext.params
          );
          routerContext.params = routerContext.request.params;
          routerContext.routerPath = layer.path as string;
          routerContext.routerName = layer.name || undefined;
          routerContext._matchedRoute = layer.path as string;

          if (layer.name) {
            routerContext._matchedRouteName = layer.name;
          }

          return next();
        },
        ...(layer.stack as RouterMiddleware<StateT, ContextT>[])
      );
    }

    return middlewareChain;
  }

  routes(): RouterComposedMiddleware<StateT, ContextT> {
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
   * @param options - Options object
   * @returns Middleware function
   */
  allowedMethods(
    options: AllowedMethodsOptions = {}
  ): RouterMiddleware<StateT, ContextT> {
    const implementedMethods = this.methods;

    return (
      context: ParameterizedContext<
        StateT,
        ContextT & RouterParameterContext<StateT, ContextT>
      >,
      next: () => Promise<unknown>
    ) => {
      const routerContext = context as RouterContext<StateT, ContextT>;
      return next().then(() => {
        if (!this._shouldProcessAllowedMethods(routerContext)) {
          return;
        }

        // Safe access since _shouldProcessAllowedMethods validates matched exists
        const matchedRoutes = routerContext.matched || [];
        const allowedMethods = this._collectAllowedMethods(matchedRoutes);
        const allowedMethodsList = Object.keys(allowedMethods);

        // Normalize method to uppercase for comparison
        const requestMethod = context.method.toUpperCase();
        if (!implementedMethods.includes(requestMethod)) {
          this._handleNotImplemented(
            routerContext,
            allowedMethodsList,
            options
          );
          return;
        }

        if (requestMethod === 'OPTIONS' && allowedMethodsList.length > 0) {
          this._handleOptionsRequest(routerContext, allowedMethodsList);
          return;
        }

        if (allowedMethodsList.length > 0 && !allowedMethods[requestMethod]) {
          this._handleMethodNotAllowed(
            routerContext,
            allowedMethodsList,
            options
          );
        }
      });
    };
  }

  /**
   * Check if we should process allowed methods
   * @private
   */
  private _shouldProcessAllowedMethods(
    context: RouterContext<StateT, ContextT>
  ): boolean {
    return !!(context.matched && (!context.status || context.status === 404));
  }

  /**
   * Collect all allowed methods from matched routes
   * @private
   */
  private _collectAllowedMethods(
    matchedRoutes: Layer<StateT, ContextT>[]
  ): Record<string, string> {
    const allowedMethods: Record<string, string> = {};

    for (const route of matchedRoutes) {
      for (const method of route.methods) {
        allowedMethods[method] = method;
      }
    }

    return allowedMethods;
  }

  /**
   * Handle 501 Not Implemented response
   * @private
   */
  private _handleNotImplemented(
    context: RouterContext<StateT, ContextT>,
    allowedMethodsList: string[],
    options: AllowedMethodsOptions
  ): void {
    if (options.throw) {
      const error =
        typeof options.notImplemented === 'function'
          ? options.notImplemented()
          : new HttpError.NotImplemented();
      throw error;
    }

    context.status = 501;
    context.set('Allow', allowedMethodsList.join(', '));
  }

  /**
   * Handle OPTIONS request
   * @private
   */
  private _handleOptionsRequest(
    context: RouterContext<StateT, ContextT>,
    allowedMethodsList: string[]
  ): void {
    context.status = 200;
    context.body = '';
    context.set('Allow', allowedMethodsList.join(', '));
  }

  /**
   * Handle 405 Method Not Allowed response
   * @private
   */
  private _handleMethodNotAllowed(
    context: RouterContext<StateT, ContextT>,
    allowedMethodsList: string[],
    options: AllowedMethodsOptions
  ): void {
    if (options.throw) {
      const error =
        typeof options.methodNotAllowed === 'function'
          ? options.methodNotAllowed()
          : new HttpError.MethodNotAllowed();
      throw error;
    }

    context.status = 405;
    context.set('Allow', allowedMethodsList.join(', '));
  }

  /**
   * Register route with all methods.
   *
   * @param args - Route arguments (name, path, middleware)
   * @returns This router instance
   */
  all<T = {}, U = {}, B = unknown>(
    name: string,
    path: string | RegExp,
    ...middleware: Array<RouterMiddleware<StateT & T, ContextT & U, B>>
  ): Router<StateT, ContextT>;
  all<T = {}, U = {}, B = unknown>(
    path: string | RegExp | Array<string | RegExp>,
    ...middleware: Array<RouterMiddleware<StateT & T, ContextT & U, B>>
  ): Router<StateT, ContextT>;
  all(...arguments_: unknown[]): Router<StateT, ContextT> {
    let name: string | undefined;
    let path: string | RegExp | string[];
    let middleware: RouterMiddleware<StateT, ContextT>[];

    if (
      arguments_.length >= 2 &&
      (typeof arguments_[1] === 'string' || arguments_[1] instanceof RegExp)
    ) {
      name = arguments_[0] as string;
      path = arguments_[1] as string | RegExp;
      middleware = arguments_.slice(2) as RouterMiddleware<StateT, ContextT>[];
    } else {
      name = undefined;
      path = arguments_[0] as string | RegExp | string[];
      middleware = arguments_.slice(1) as RouterMiddleware<StateT, ContextT>[];
    }

    if (
      typeof path !== 'string' &&
      !(path instanceof RegExp) &&
      (!Array.isArray(path) || path.length === 0)
    )
      throw new Error('You have to provide a path when adding an all handler');

    const routeOptions: LayerOptions = {
      name,
      pathAsRegExp: path instanceof RegExp
    };

    this.register(path, httpMethods, middleware, {
      ...this.opts,
      ...routeOptions
    });

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
   * @param source - URL or route name
   * @param destination - URL or route name
   * @param code - HTTP status code (default: 301)
   * @returns This router instance
   */
  redirect(
    source: string | symbol,
    destination: string | symbol,
    code?: number
  ): Router<StateT, ContextT> {
    let resolvedSource: string = source as string;
    let resolvedDestination: string = destination as string;

    if (
      typeof source === 'symbol' ||
      (typeof source === 'string' && source[0] !== '/')
    ) {
      const sourceUrl = this.url(source as string);
      if (sourceUrl instanceof Error) throw sourceUrl;
      resolvedSource = sourceUrl;
    }

    if (
      typeof destination === 'symbol' ||
      (typeof destination === 'string' &&
        destination[0] !== '/' &&
        !destination.includes('://'))
    ) {
      const destinationUrl = this.url(destination as string);
      if (destinationUrl instanceof Error) throw destinationUrl;
      resolvedDestination = destinationUrl;
    }

    const result = this.all(
      resolvedSource,
      (
        context: ParameterizedContext<
          StateT,
          ContextT & RouterParameterContext<StateT, ContextT>
        >
      ) => {
        context.redirect(resolvedDestination);
        context.status = code || 301;
      }
    );
    return result as Router<StateT, ContextT>;
  }

  /**
   * Create and register a route.
   *
   * @param path - Path string
   * @param methods - Array of HTTP verbs
   * @param middleware - Middleware functions
   * @param additionalOptions - Additional options
   * @returns Created layer
   * @private
   */
  register(
    path: string | RegExp | string[],
    methods: string[],
    middleware:
      | RouterMiddleware<StateT, ContextT>
      | RouterMiddleware<StateT, ContextT>[],
    additionalOptions: LayerOptions = {}
  ): Layer<StateT, ContextT> | Router<StateT, ContextT> {
    const mergedOptions = { ...this.opts, ...additionalOptions };

    if (Array.isArray(path)) {
      return this._registerMultiplePaths(
        path,
        methods,
        middleware,
        mergedOptions
      );
    }

    const routeLayer = this._createRouteLayer(
      path,
      methods,
      middleware,
      mergedOptions
    );

    if (this.opts.prefix) {
      routeLayer.setPrefix(this.opts.prefix);
    }

    applyAllParameterMiddleware<StateT, ContextT>(routeLayer, this.params);

    this.stack.push(routeLayer);

    debug('defined route %s %s', routeLayer.methods, routeLayer.path);

    return routeLayer;
  }

  /**
   * Register multiple paths with the same configuration
   * @private
   */
  private _registerMultiplePaths(
    pathArray: string[],
    methods: string[],
    middleware:
      | RouterMiddleware<StateT, ContextT>
      | RouterMiddleware<StateT, ContextT>[],
    options: LayerOptions
  ): Router<StateT, ContextT> {
    for (const singlePath of pathArray) {
      this.register.call(this, singlePath, methods, middleware, options);
    }

    return this;
  }

  /**
   * Create a route layer with given configuration
   * @private
   */
  private _createRouteLayer(
    path: string | RegExp,
    methods: string[],
    middleware:
      | RouterMiddleware<StateT, ContextT>
      | RouterMiddleware<StateT, ContextT>[],
    options: LayerOptions
  ): Layer<StateT, ContextT> {
    return new Layer<StateT, ContextT>(path, methods, middleware, {
      end: options.end === false ? options.end : true,
      name: options.name,
      sensitive: options.sensitive || false,
      strict: options.strict || false,
      prefix: options.prefix || '',
      ignoreCaptures: options.ignoreCaptures,
      pathAsRegExp: options.pathAsRegExp
    });
  }

  /**
   * Lookup route with given `name`.
   *
   * @param name - Route name
   * @returns Matched layer or false
   */
  route(name: string): Layer<StateT, ContextT> | false {
    const matchingRoute = this.stack.find((route) => route.name === name);
    return matchingRoute || false;
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
   * @param name - Route name
   * @param args - URL parameters
   * @returns Generated URL or Error
   */
  url(name: string, ...arguments_: unknown[]): string | Error {
    const route = this.route(name);
    if (route) return route.url(...arguments_);

    return new Error(`No route found for name: ${String(name)}`);
  }

  /**
   * Match given `path` and return corresponding routes.
   *
   * @param path - Request path
   * @param method - HTTP method
   * @returns Match result with matched layers
   * @private
   */
  match(path: string, method: string): MatchResult<StateT, ContextT> {
    const matchResult: MatchResult<StateT, ContextT> = {
      path: [],
      pathAndMethod: [],
      route: false
    };

    // Normalize method to uppercase for consistent comparison
    const normalizedMethod = method.toUpperCase();

    for (const layer of this.stack) {
      debug('test %s %s', layer.path, layer.regexp);

      // eslint-disable-next-line unicorn/prefer-regexp-test -- layer.match() is a method, not String.match()
      if (layer.match(path)) {
        matchResult.path.push(layer);

        const isMiddleware = layer.methods.length === 0;
        const matchesMethod = layer.methods.includes(normalizedMethod);

        if (isMiddleware || matchesMethod) {
          matchResult.pathAndMethod.push(layer);

          if (layer.methods.length > 0) {
            matchResult.route = true;
          }
        }
      }
    }

    return matchResult;
  }

  /**
   * Match given `input` to allowed host
   * @param input - Host to check
   * @returns Whether host matches
   */
  matchHost(input?: string): boolean {
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

    if (Array.isArray(host)) {
      return host.includes(input);
    }

    if (host instanceof RegExp) {
      return host.test(input);
    }

    return false;
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
   * @param param - Parameter name
   * @param middleware - Parameter middleware
   * @returns This router instance
   */
  param(
    parameter: string,
    middleware: RouterParameterMiddleware<StateT, ContextT>
  ): Router<StateT, ContextT> {
    if (!this.params[parameter]) {
      this.params[parameter] = [];
    }

    if (!Array.isArray(this.params[parameter])) {
      this.params[parameter] = [
        this.params[parameter] as RouterParameterMiddleware<StateT, ContextT>
      ];
    }

    (
      this.params[parameter] as RouterParameterMiddleware<StateT, ContextT>[]
    ).push(middleware);

    for (const route of this.stack) {
      route.param(parameter, middleware);
    }

    return this;
  }

  /**
   * Helper method for registering HTTP verb routes
   * @internal - Used by dynamically added HTTP methods
   */
  _registerMethod(
    method: string,
    ...arguments_: unknown[]
  ): Router<StateT, ContextT> {
    let name: string | undefined;
    let path: string | RegExp | string[];
    let middleware: RouterMiddleware<StateT, ContextT>[];

    if (
      arguments_.length >= 2 &&
      (typeof arguments_[1] === 'string' || arguments_[1] instanceof RegExp)
    ) {
      name = arguments_[0] as string;
      path = arguments_[1] as string | RegExp;
      middleware = arguments_.slice(2) as RouterMiddleware<StateT, ContextT>[];
    } else {
      name = undefined;
      path = arguments_[0] as string | RegExp | string[];
      middleware = arguments_.slice(1) as RouterMiddleware<StateT, ContextT>[];
    }

    if (
      typeof path !== 'string' &&
      !(path instanceof RegExp) &&
      (!Array.isArray(path) || path.length === 0)
    )
      throw new Error(
        `You have to provide a path when adding a ${method} handler`
      );

    const options: LayerOptions = {
      name,
      pathAsRegExp: path instanceof RegExp
    };

    this.register(path, [method], middleware, {
      ...this.opts,
      ...options
    });
    return this;
  }

  /**
   * HTTP GET method
   */
  get<T = {}, U = {}, B = unknown>(
    name: string,
    path: string | RegExp,
    ...middleware: Array<RouterMiddleware<StateT & T, ContextT & U, B>>
  ): Router<StateT, ContextT>;
  get<T = {}, U = {}, B = unknown>(
    path: string | RegExp | Array<string | RegExp>,
    ...middleware: Array<RouterMiddleware<StateT & T, ContextT & U, B>>
  ): Router<StateT, ContextT>;
  get(...arguments_: unknown[]): Router<StateT, ContextT> {
    return this._registerMethod('get', ...arguments_);
  }

  /**
   * HTTP POST method
   */
  post<T = {}, U = {}, B = unknown>(
    name: string,
    path: string | RegExp,
    ...middleware: Array<RouterMiddleware<StateT & T, ContextT & U, B>>
  ): Router<StateT, ContextT>;
  post<T = {}, U = {}, B = unknown>(
    path: string | RegExp | Array<string | RegExp>,
    ...middleware: Array<RouterMiddleware<StateT & T, ContextT & U, B>>
  ): Router<StateT, ContextT>;
  post(...arguments_: unknown[]): Router<StateT, ContextT> {
    return this._registerMethod('post', ...arguments_);
  }

  /**
   * HTTP PUT method
   */
  put<T = {}, U = {}, B = unknown>(
    name: string,
    path: string | RegExp,
    ...middleware: Array<RouterMiddleware<StateT & T, ContextT & U, B>>
  ): Router<StateT, ContextT>;
  put<T = {}, U = {}, B = unknown>(
    path: string | RegExp | Array<string | RegExp>,
    ...middleware: Array<RouterMiddleware<StateT & T, ContextT & U, B>>
  ): Router<StateT, ContextT>;
  put(...arguments_: unknown[]): Router<StateT, ContextT> {
    return this._registerMethod('put', ...arguments_);
  }

  /**
   * HTTP PATCH method
   */
  patch<T = {}, U = {}, B = unknown>(
    name: string,
    path: string | RegExp,
    ...middleware: Array<RouterMiddleware<StateT & T, ContextT & U, B>>
  ): Router<StateT, ContextT>;
  patch<T = {}, U = {}, B = unknown>(
    path: string | RegExp | Array<string | RegExp>,
    ...middleware: Array<RouterMiddleware<StateT & T, ContextT & U, B>>
  ): Router<StateT, ContextT>;
  patch(...arguments_: unknown[]): Router<StateT, ContextT> {
    return this._registerMethod('patch', ...arguments_);
  }

  /**
   * HTTP DELETE method
   */
  delete<T = {}, U = {}, B = unknown>(
    name: string,
    path: string | RegExp,
    ...middleware: Array<RouterMiddleware<StateT & T, ContextT & U, B>>
  ): Router<StateT, ContextT>;
  delete<T = {}, U = {}, B = unknown>(
    path: string | RegExp | Array<string | RegExp>,
    ...middleware: Array<RouterMiddleware<StateT & T, ContextT & U, B>>
  ): Router<StateT, ContextT>;
  delete(...arguments_: unknown[]): Router<StateT, ContextT> {
    return this._registerMethod('delete', ...arguments_);
  }

  /**
   * HTTP DELETE method alias (del)
   */
  del<T = {}, U = {}, B = unknown>(
    name: string,
    path: string | RegExp,
    ...middleware: Array<RouterMiddleware<StateT & T, ContextT & U, B>>
  ): Router<StateT, ContextT>;
  del<T = {}, U = {}, B = unknown>(
    path: string | RegExp | Array<string | RegExp>,
    ...middleware: Array<RouterMiddleware<StateT & T, ContextT & U, B>>
  ): Router<StateT, ContextT>;
  del(...arguments_: unknown[]): Router<StateT, ContextT> {
    return this.delete.apply(
      this,
      arguments_ as Parameters<typeof this.delete>
    );
  }

  /**
   * HTTP HEAD method
   */
  head<T = {}, U = {}, B = unknown>(
    name: string,
    path: string | RegExp,
    ...middleware: Array<RouterMiddleware<StateT & T, ContextT & U, B>>
  ): Router<StateT, ContextT>;
  head<T = {}, U = {}, B = unknown>(
    path: string | RegExp | Array<string | RegExp>,
    ...middleware: Array<RouterMiddleware<StateT & T, ContextT & U, B>>
  ): Router<StateT, ContextT>;
  head(...arguments_: unknown[]): Router<StateT, ContextT> {
    return this._registerMethod('head', ...arguments_);
  }

  /**
   * HTTP OPTIONS method
   */
  options<T = {}, U = {}, B = unknown>(
    name: string,
    path: string | RegExp,
    ...middleware: Array<RouterMiddleware<StateT & T, ContextT & U, B>>
  ): Router<StateT, ContextT>;
  options<T = {}, U = {}, B = unknown>(
    path: string | RegExp | Array<string | RegExp>,
    ...middleware: Array<RouterMiddleware<StateT & T, ContextT & U, B>>
  ): Router<StateT, ContextT>;
  options(...arguments_: unknown[]): Router<StateT, ContextT> {
    return this._registerMethod('options', ...arguments_);
  }

  /**
   * Dynamic HTTP method handler for any method from http.METHODS.
   * Use this index signature to access methods like PURGE, COPY, CONNECT, TRACE, etc.
   * These are dynamically added at runtime from Node's http.METHODS.
   *
   * @example
   * ```typescript
   * // Type-safe way to use dynamic methods
   * const router = new Router();
   * router.register('/cache/:key', ['PURGE'], middleware);
   *
   * // Or cast to access dynamic method directly
   * (router as any).purge('/cache/:key', middleware);
   * ```
   */
  [method: string]: unknown;
}

/**
 * Router constructor interface with automatic type inference for custom HTTP methods.
 *
 * @example
 * ```typescript
 * // Methods are automatically typed based on what you pass
 * const router = new Router({
 *   methods: ['GET', 'POST', 'PURGE', 'CUSTOM'] as const
 * });
 *
 * // TypeScript knows these methods exist
 * router.get('/users', handler);
 * router.purge('/cache/:key', handler);
 * router.custom('/special', handler);
 * ```
 */
interface RouterConstructor {
  new <
    M extends string,
    StateT = import('koa').DefaultState,
    ContextT = import('koa').DefaultContext
  >(
    options: RouterOptionsWithMethods<M>
  ): RouterWithMethods<M, StateT, ContextT>;

  new <
    StateT = import('koa').DefaultState,
    ContextT = import('koa').DefaultContext
  >(
    options?: RouterOptions
  ): Router<StateT, ContextT>;

  /**
   * Generate URL from url pattern and given `params`.
   */
  url(path: string, parameters?: Record<string, unknown>): string;
  url(path: string, ...parameters: unknown[]): string;

  readonly prototype: Router;
}

const RouterExport: RouterConstructor = Router as RouterConstructor;

export default RouterExport;
export { RouterExport as Router };
export type { Router as RouterInstance };

/**
 * Create `router.verb()` methods, where *verb* is one of the HTTP verbs such
 * as `router.get()` or `router.post()`.
 *
 * Match URL patterns to callback functions or controller actions using `router.verb()`,
 * where **verb** is one of the HTTP verbs such as `router.get()` or `router.post()`.
 *
 * Additionally, `router.all()` can be used to match against all methods.
 */

for (const httpMethod of httpMethods) {
  const isAlreadyDefined =
    COMMON_HTTP_METHODS.includes(httpMethod) || httpMethod in Router.prototype;

  if (!isAlreadyDefined) {
    Object.defineProperty(Router.prototype, httpMethod, {
      value: function (this: Router, ...arguments_: unknown[]) {
        return this._registerMethod(httpMethod, ...arguments_);
      },
      writable: true,
      configurable: true,
      enumerable: false
    });
  }
}
