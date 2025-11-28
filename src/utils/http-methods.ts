/**
 * HTTP methods utilities
 */

import http from 'node:http';

/**
 * Get all HTTP methods in lowercase
 * @returns Array of HTTP method names in lowercase
 */
export function getAllHttpMethods(): string[] {
  return http.METHODS.map((method) => method.toLowerCase());
}

/**
 * Common HTTP methods that are explicitly defined
 */
export const COMMON_HTTP_METHODS: string[] = [
  'get',
  'post',
  'put',
  'patch',
  'delete',
  'del',
  'head',
  'options'
];
