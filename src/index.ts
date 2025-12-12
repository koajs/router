/**
 * @koa/router - RESTful resource routing middleware for Koa
 *
 * @module @koa/router
 */

export type {
  RouterOptions,
  RouterOptionsWithMethods,
  LayerOptions,
  UrlOptions,
  RouterParameterMiddleware,
  RouterMiddleware,
  RouterMethodFunction,
  RouterContext,
  MatchResult,
  AllowedMethodsOptions,
  Layer,
  HttpMethod,
  RouterWithMethods
} from './types';

export { default, Router, type RouterInstance } from './router';
