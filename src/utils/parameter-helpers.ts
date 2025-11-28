/**
 * Parameter handling utilities for router.param() functionality
 */

import type { RouterParameterMiddleware, Layer } from '../types';
import type Router from '../router';

/**
 * Normalize param middleware to always be an array
 * @param paramMiddleware - Single middleware or array
 * @returns Array of middleware functions
 */
export function normalizeParameterMiddleware(
  parameterMiddleware:
    | RouterParameterMiddleware
    | RouterParameterMiddleware[]
    | undefined
): RouterParameterMiddleware[] {
  if (!parameterMiddleware) {
    return [];
  }

  if (Array.isArray(parameterMiddleware)) {
    return parameterMiddleware;
  }

  return [parameterMiddleware];
}

/**
 * Apply param middleware to a route
 * @param route - Route layer to apply middleware to
 * @param paramName - Name of the parameter
 * @param paramMiddleware - Middleware to apply
 */
export function applyParameterMiddlewareToRoute(
  route: Layer | Router,
  parameterName: string,
  parameterMiddleware: RouterParameterMiddleware | RouterParameterMiddleware[]
): void {
  const middlewareList = normalizeParameterMiddleware(parameterMiddleware);

  for (const middleware of middlewareList) {
    route.param(parameterName, middleware);
  }
}

/**
 * Apply all param middleware from params object to a route
 * @param route - Route layer
 * @param paramsObject - Object mapping param names to middleware
 */
export function applyAllParameterMiddleware(
  route: Layer,
  parametersObject: Record<
    string,
    RouterParameterMiddleware | RouterParameterMiddleware[]
  >
): void {
  const parameterNames = Object.keys(parametersObject);

  for (const parameterName of parameterNames) {
    const parameterMiddleware = parametersObject[parameterName];
    applyParameterMiddlewareToRoute(route, parameterName, parameterMiddleware);
  }
}
