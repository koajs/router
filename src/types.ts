/**
 * Type definitions for @koa/router
 */

import type {
  Middleware,
  ParameterizedContext,
  DefaultContext,
  DefaultState
} from 'koa';
import type Router from './router';
import type Layer from './layer';

export interface RouterOptions {
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
}

export interface LayerOptions {
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
}

export interface UrlOptions {
  /**
   * Query string parameters
   */
  query?: Record<string, any> | string;

  [key: string]: any;
}

export interface RouterParameterContext<
  StateT = DefaultState,
  ContextT = DefaultContext
> {
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
}

export interface RouterParameterMiddleware<
  StateT = DefaultState,
  ContextT = DefaultContext,
  BodyT = unknown
> {
  (
    parameterValue: string,
    context: RouterContext<StateT, ContextT, BodyT>,
    next: () => Promise<any>
  ): any;
}

export interface MatchResult {
  /**
   * Layers that matched the path
   */
  path: Layer[];

  /**
   * Layers that matched both path and HTTP method
   */
  pathAndMethod: Layer[];

  /**
   * Whether a route (not just middleware) was matched
   */
  route: boolean;
}

export interface AllowedMethodsOptions {
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
}

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
   * Request with params (params added dynamically)
   */
  request: {
    params?: Record<string, string>;
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
  matched?: Layer[];

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
> = Middleware<
  StateT,
  ContextT & RouterParameterContext<StateT, ContextT>,
  BodyT
>;

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

export { type default as Layer } from './layer';
