/**
 * Type definitions for @koa/router
 */

import type { ParameterizedContext, DefaultContext, DefaultState } from 'koa';
import type { RouterInstance as Router } from './router';
import type Layer from './layer';

/**
 * Re-export Koa types for convenience
 * This makes types.ts the single source of truth for all type imports
 */
export type {
  Middleware,
  ParameterizedContext,
  DefaultContext,
  DefaultState
} from 'koa';

export type RouterOptions = {
  /**
   * Only run last matched route's controller when there are multiple matches
   */
  exclusive?: boolean;

  /**
   * Prefix for all routes
   */
  prefix?: string;

  /**
   * Host for router match (string, array of strings, or RegExp)
   * - string: exact match
   * - string[]: matches if input equals any string in the array
   * - RegExp: pattern match
   */
  host?: string | string[] | RegExp;

  /**
   * HTTP methods this router should respond to
   */
  methods?: string[];

  /**
   * Path to use for routing (internal)
   */
  routerPath?: string;

  /**
   * Whether to use case-sensitive routing
   */
  sensitive?: boolean;

  /**
   * Whether trailing slashes are significant
   */
  strict?: boolean;

  /**
   * Additional options passed through
   */
  [key: string]: unknown;
};

export type LayerOptions = {
  /**
   * Route name for URL generation
   */
  name?: string | null;

  /**
   * Case sensitive routing
   */
  sensitive?: boolean;

  /**
   * Require trailing slash
   */
  strict?: boolean;

  /**
   * Whether trailing slashes matter (path-to-regexp v8)
   */
  trailing?: boolean;

  /**
   * Route path ends at this path
   */
  end?: boolean;

  /**
   * Prefix for the route
   */
  prefix?: string;

  /**
   * Ignore captures in route matching
   */
  ignoreCaptures?: boolean;

  /**
   * Treat path as a regular expression
   */
  pathAsRegExp?: boolean;

  /**
   * Additional options passed through to path-to-regexp
   */
  [key: string]: unknown;
};

export type UrlOptions = {
  /**
   * Query string parameters
   */
  query?: Record<string, unknown> | string;

  [key: string]: unknown;
};

export type RouterParameterContext<
  StateT = DefaultState,
  ContextT = DefaultContext
> = {
  /**
   * URL parameters
   */
  params: Record<string, string>;

  /**
   * Router instance
   */
  router: Router<StateT, ContextT>;

  /**
   * Matched route path (internal)
   */
  _matchedRoute?: string | RegExp;

  /**
   * Matched route name (internal)
   */
  _matchedRouteName?: string;
};

export type RouterParameterMiddleware<
  StateT = DefaultState,
  ContextT = DefaultContext,
  BodyT = unknown
> = (
  parameterValue: string,
  context: RouterContext<StateT, ContextT, BodyT>,
  next: () => Promise<unknown>
) => unknown | Promise<unknown>;

export type MatchResult<
  StateT = DefaultState,
  ContextT = DefaultContext,
  BodyT = unknown
> = {
  /**
   * Layers that matched the path
   */
  path: Layer<StateT, ContextT, BodyT>[];

  /**
   * Layers that matched both path and HTTP method
   */
  pathAndMethod: Layer<StateT, ContextT, BodyT>[];

  /**
   * Whether a route (not just middleware) was matched
   */
  route: boolean;
};

export type AllowedMethodsOptions = {
  /**
   * Throw error instead of setting status and header
   */
  throw?: boolean;

  /**
   * Throw the returned value in place of the default NotImplemented error
   */
  notImplemented?: () => Error;

  /**
   * Throw the returned value in place of the default MethodNotAllowed error
   */
  methodNotAllowed?: () => Error;
};

/**
 * Extended Koa context with router-specific properties
 * Matches the structure from @types/koa-router
 */
export type RouterContext<
  StateT = DefaultState,
  ContextT = DefaultContext,
  BodyT = unknown
> = ParameterizedContext<
  StateT,
  ContextT & RouterParameterContext<StateT, ContextT>,
  BodyT
> & {
  /**
   * Request with params (set by router during routing)
   */
  request: {
    params: Record<string, string>;
  };

  /**
   * Path of matched route
   */
  routerPath?: string;

  /**
   * Name of matched route
   */
  routerName?: string;

  /**
   * Array of matched layers
   */
  matched?: Layer<StateT, ContextT, BodyT>[];

  /**
   * Captured values from path
   */
  captures?: string[];

  /**
   * New router path (for nested routers)
   */
  newRouterPath?: string;

  /**
   * Track param middleware execution (internal)
   */
  _matchedParams?: WeakMap<Function, boolean>;
};

/**
 * Router middleware function type
 */
export type RouterMiddleware<
  StateT = DefaultState,
  ContextT = DefaultContext,
  BodyT = unknown
> = (
  context: RouterContext<StateT, ContextT, BodyT>,
  next: () => Promise<unknown>
) => unknown | Promise<unknown>;

/**
 * HTTP method names in lowercase
 */
export type HttpMethod =
  | 'get'
  | 'post'
  | 'put'
  | 'patch'
  | 'delete'
  | 'del'
  | 'head'
  | 'options'
  | 'connect'
  | 'trace'
  | string;

/**
 * Router options with generic methods array for type inference
 */
export type RouterOptionsWithMethods<M extends string = string> = Omit<
  RouterOptions,
  'methods'
> & {
  methods?: readonly M[];
};

/**
 * Type for a dynamic HTTP method function on Router
 */
export type RouterMethodFunction<
  StateT = DefaultState,
  ContextT = DefaultContext
> = {
  <T = {}, U = {}, B = unknown>(
    name: string,
    path: string | RegExp,
    ...middleware: Array<RouterMiddleware<StateT & T, ContextT & U, B>>
  ): Router<StateT, ContextT>;
  <T = {}, U = {}, B = unknown>(
    path: string | RegExp | Array<string | RegExp>,
    ...middleware: Array<RouterMiddleware<StateT & T, ContextT & U, B>>
  ): Router<StateT, ContextT>;
};

/**
 * Router with additional HTTP methods based on the methods option.
 * Use createRouter() factory function for automatic type inference.
 */
export type RouterWithMethods<
  M extends string,
  StateT = DefaultState,
  ContextT = DefaultContext
> = Router<StateT, ContextT> &
  Record<Lowercase<M>, RouterMethodFunction<StateT, ContextT>>;

export { type default as Layer } from './layer';
