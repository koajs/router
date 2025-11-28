/**
 * Path-to-regexp wrapper utility
 *
 * Centralizes all path-to-regexp imports and provides a clean interface.
 * This abstraction allows easier maintenance and potential future changes.
 */

import { pathToRegexp, compile, parse } from 'path-to-regexp';
import type { Key } from 'path-to-regexp';
import type { LayerOptions } from '../types';

/**
 * Options for path-to-regexp operations
 * Based on path-to-regexp v8 options
 */
export interface PathToRegexpOptions {
  /**
   * Case sensitive matching
   */
  sensitive?: boolean;

  /**
   * Whether trailing slashes are significant
   * Note: path-to-regexp v8 renamed 'strict' to 'trailing'
   */
  strict?: boolean;
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
   * Additional options passed to path-to-regexp
   */
  [key: string]: any;
}

/**
 * Result of path-to-regexp compilation
 */
export interface PathToRegexpResult {
  regexp: RegExp;
  keys: Key[];
}

/**
 * Compile a path pattern to a regular expression
 *
 * @param path - Path pattern string
 * @param options - Compilation options
 * @returns Object with regexp and parameter keys
 */
export function compilePathToRegexp(
  path: string,
  options: PathToRegexpOptions = {}
): PathToRegexpResult {
  const normalizedOptions: any = { ...options };

  if ('strict' in normalizedOptions && !('trailing' in normalizedOptions)) {
    normalizedOptions.trailing = normalizedOptions.strict !== true;
    delete normalizedOptions.strict;
  }

  delete normalizedOptions.pathAsRegExp;
  delete normalizedOptions.ignoreCaptures;
  delete normalizedOptions.prefix;

  const { regexp, keys } = pathToRegexp(path, normalizedOptions);
  return { regexp, keys };
}

/**
 * Compile a path pattern to a URL generator function
 *
 * @param path - Path pattern string
 * @param options - Compilation options
 * @returns Function that generates URLs from parameters
 */
export function compilePath(
  path: string,
  options: Record<string, any> = {}
): (parameters?: Record<string, string>) => string {
  return compile(path, options);
}

/**
 * Parse a path pattern into tokens
 *
 * @param path - Path pattern string
 * @param options - Parse options
 * @returns Array of tokens
 */
export function parsePath(
  path: string,
  options?: Record<string, any>
): ReturnType<typeof parse> {
  return parse(path, options);
}

/**
 * Re-export Key type for convenience
 */

/**
 * Normalize LayerOptions to path-to-regexp options
 * Handles the strict/trailing option conversion
 *
 * @param options - Layer options
 * @returns Normalized path-to-regexp options
 */
export function normalizeLayerOptionsToPathToRegexp(
  options: LayerOptions = {}
): Record<string, any> {
  const normalized: Record<string, any> = {
    sensitive: options.sensitive,
    end: options.end,
    strict: options.strict,
    trailing: options.trailing
  };

  if ('strict' in normalized && !('trailing' in normalized)) {
    normalized.trailing = normalized.strict !== true;
    delete normalized.strict;
  }

  for (const key of Object.keys(normalized)) {
    if (normalized[key] === undefined) {
      delete normalized[key];
    }
  }

  return normalized;
}

export { type Key } from 'path-to-regexp';
