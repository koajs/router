/**
 * Parameter handling utilities for router.param() functionality
 */

import type { RouterParameterMiddleware } from '../types';
import type Layer from '../layer';

/**
 * Type for objects that have a param() method (Layer or Router)
 * Uses generic types to maintain type safety
 */
type ParameterCapable<StateT = unknown, ContextT = unknown, BodyT = unknown> = {
  param(
    parameterName: string,
    middleware: RouterParameterMiddleware<StateT, ContextT, BodyT>
  ): unknown;
};

/**
 * Normalize param middleware to always be an array
 * @param paramMiddleware - Single middleware or array
 * @returns Array of middleware functions
 */
export function normalizeParameterMiddleware<
  StateT = unknown,
  ContextT = unknown,
  BodyT = unknown
>(
  parameterMiddleware:
    | RouterParameterMiddleware<StateT, ContextT, BodyT>
    | RouterParameterMiddleware<StateT, ContextT, BodyT>[]
    | undefined
): RouterParameterMiddleware<StateT, ContextT, BodyT>[] {
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
 * @param route - Route layer or router to apply middleware to
 * @param paramName - Name of the parameter
 * @param paramMiddleware - Middleware to apply
 */
export function applyParameterMiddlewareToRoute<
  StateT = unknown,
  ContextT = unknown,
  BodyT = unknown
>(
  route: ParameterCapable<StateT, ContextT, BodyT>,
  parameterName: string,
  parameterMiddleware:
    | RouterParameterMiddleware<StateT, ContextT, BodyT>
    | RouterParameterMiddleware<StateT, ContextT, BodyT>[]
): void {
  const middlewareList = normalizeParameterMiddleware<StateT, ContextT, BodyT>(
    parameterMiddleware
  );

  for (const middleware of middlewareList) {
    route.param(parameterName, middleware);
  }
}

/**
 * Apply all param middleware from params object to a route
 * @param route - Route layer
 * @param paramsObject - Object mapping param names to middleware
 */
export function applyAllParameterMiddleware<
  StateT = unknown,
  ContextT = unknown,
  BodyT = unknown
>(
  route: Layer<StateT, ContextT, BodyT>,
  parametersObject: Record<
    string,
    | RouterParameterMiddleware<StateT, ContextT, BodyT>
    | RouterParameterMiddleware<StateT, ContextT, BodyT>[]
  >
): void {
  const parameterNames = Object.keys(parametersObject);

  for (const parameterName of parameterNames) {
    const parameterMiddleware = parametersObject[parameterName];
    applyParameterMiddlewareToRoute<StateT, ContextT, BodyT>(
      route,
      parameterName,
      parameterMiddleware
    );
  }
}
