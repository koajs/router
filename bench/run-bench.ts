/**
 * Benchmark runner - runs router.match() benchmarks
 *
 * This script benchmarks the router matching performance.
 * Results are printed to console and saved to bench-result.txt
 */

import { writeFileSync } from 'node:fs';
import Router from '../src';
import { now, print, title, warmup, operations } from './util';

const router = new Router();

type Route = {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  url: string;
};

const routes: Route[] = [
  { method: 'GET', url: '/user' },
  { method: 'GET', url: '/user/comments' },
  { method: 'GET', url: '/user/avatar' },
  { method: 'GET', url: '/user/lookup/username/:username' },
  { method: 'GET', url: '/user/lookup/email/:address' },
  { method: 'GET', url: '/event/:id' },
  { method: 'GET', url: '/event/:id/comments' },
  { method: 'POST', url: '/event/:id/comment' },
  { method: 'PUT', url: '/event/:id' },
  { method: 'DELETE', url: '/event/:id' },
  { method: 'GET', url: '/map/:location/events' },
  { method: 'GET', url: '/status' },
  { method: 'GET', url: '/very/deeply/nested/route/hello/there' },
  { method: 'GET', url: '/static/{/*path}' }
];

function noop(): void {}

// Register all routes
for (const route of routes) {
  router[route.method.toLowerCase() as 'get' | 'post' | 'put' | 'delete'](
    route.url,
    noop
  );
}

title('Router Match Benchmarks');
console.log(`Running ${operations.toLocaleString()} iterations per test\n`);

// Warmup - runs each match once to warm up JIT compiler
warmup(() => {
  router.match('/user', 'GET');
  router.match('/user/comments', 'GET');
  router.match('/user/lookup/username/john', 'GET');
  router.match('/event/abcd1234/comments', 'GET');
  router.match('/very/deeply/nested/route/hello/there', 'GET');
  router.match('/static/index.html', 'GET');
});

const results: Record<string, number> = {};
let time: number;

// Short static route
time = now();
for (let i = 0; i < operations; i++) {
  router.match('/user', 'GET');
}
results['short static'] = print('short static', time);

// Static with same radix
time = now();
for (let i = 0; i < operations; i++) {
  router.match('/user/comments', 'GET');
}
results['static with same radix'] = print('static with same radix', time);

// Dynamic route
time = now();
for (let i = 0; i < operations; i++) {
  router.match('/user/lookup/username/john', 'GET');
}
results['dynamic route'] = print('dynamic route', time);

// Mixed static and dynamic
time = now();
for (let i = 0; i < operations; i++) {
  router.match('/event/abcd1234/comments', 'GET');
}
results['mixed static dynamic'] = print('mixed static dynamic', time);

// Long static route
time = now();
for (let i = 0; i < operations; i++) {
  router.match('/very/deeply/nested/route/hello/there', 'GET');
}
results['long static'] = print('long static', time);

// Wildcard route
time = now();
for (let i = 0; i < operations; i++) {
  router.match('/static/index.html', 'GET');
}
results['wildcard'] = print('wildcard', time);

// POST method
time = now();
for (let i = 0; i < operations; i++) {
  router.match('/event/abcd1234/comment', 'POST');
}
results['POST method'] = print('POST method', time);

// All together (6 matches per iteration)
time = now();
for (let i = 0; i < operations; i++) {
  router.match('/user', 'GET');
  router.match('/user/comments', 'GET');
  router.match('/user/lookup/username/john', 'GET');
  router.match('/event/abcd1234/comments', 'GET');
  router.match('/very/deeply/nested/route/hello/there', 'GET');
  router.match('/static/index.html', 'GET');
}
results['all together (6 matches)'] = print('all together (6 matches)', time);

// Save results
const output = JSON.stringify(results, null, 2);
writeFileSync('bench-result.txt', output);
console.log('\nResults saved to bench-result.txt');
