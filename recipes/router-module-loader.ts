/**
 * Router Module Loader
 *
 * Centralized import point for router modules.
 * This allows easy switching between router versions for testing.
 *
 * To switch versions, update the import path below:
 * - For latest and local development: '../src/index'
 * - For dist build: '../dist/index'
 * - For published package: '@koa/router'
 */
export { default, default as Router } from '../src/index';
export type * from '../src/index';
