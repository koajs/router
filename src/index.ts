/**
 * @koa/router - RESTful resource routing middleware for Koa
 *
 * @module @koa/router
 */

export type {
  RouterOptions,
  LayerOptions,
  UrlOptions,
  RouterParameterMiddleware,
  RouterMiddleware,
  RouterContext,
  MatchResult,
  AllowedMethodsOptions,
  Layer,
  HttpMethod
} from './types';

export { default, default as Router } from './router';
