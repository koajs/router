/**
 * Path handling utilities
 */

import { compilePathToRegexp } from './path-to-regexp-wrapper';
import type { LayerOptions } from '../types';

/**
 * Check if a path has parameters (like :id, :name, etc.)
 * @param path - Path to check
 * @param options - path-to-regexp options
 * @returns True if path contains parameters
 */
export function hasPathParameters(
  path: string,
  options: LayerOptions = {}
): boolean {
  if (!path) {
    return false;
  }

  const { keys } = compilePathToRegexp(path, options);
  return keys.length > 0;
}

/**
 * Determine the appropriate middleware path based on router configuration
 * @param explicitPath - Explicitly provided path (if any)
 * @param hasPrefixParameters - Whether the router prefix has parameters
 * @returns Object with path and pathAsRegExp flag
 */
export function determineMiddlewarePath(
  explicitPath: string | RegExp | undefined,
  hasPrefixParameters: boolean
): { path: string | RegExp; pathAsRegExp: boolean } {
  if (explicitPath !== undefined) {
    if (typeof explicitPath === 'string') {
      if (explicitPath === '') {
        return {
          path: '{/*rest}',
          pathAsRegExp: false
        };
      }

      if (explicitPath === '/') {
        return {
          path: '/',
          pathAsRegExp: false
        };
      }

      return {
        path: explicitPath,
        pathAsRegExp: false
      };
    }

    return {
      path: explicitPath,
      pathAsRegExp: true
    };
  }

  if (hasPrefixParameters) {
    return {
      path: '{/*rest}',
      pathAsRegExp: false
    };
  }

  return {
    path: String.raw`(?:\/|$)`,
    pathAsRegExp: true
  };
}
