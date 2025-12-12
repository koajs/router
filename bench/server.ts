/**
 * Benchmark server
 *
 * Creates a Koa server with routes for benchmarking.
 * Configured via environment variables:
 * - FACTOR: Number of routes to create (default: 10)
 * - USE_MIDDLEWARE: Whether to use middleware (default: false)
 * - PORT: Server port (default: 3000)
 */

import process from 'node:process';
import Koa from 'koa';

import Router, { RouterContext, RouterMiddleware } from '../src';

const app = new Koa();
const router = new Router();

const ok: RouterMiddleware = (ctx: RouterContext): void => {
  ctx.status = 200;
};

const passthrough: RouterMiddleware = (_ctx, next) => next();

const n = Number.parseInt(process.env.FACTOR || '10', 10);
const useMiddleware = process.env.USE_MIDDLEWARE === 'true';

router.get('/_health', ok);

for (let i = n; i > 0; i--) {
  if (useMiddleware) router.use(passthrough);
  router.get(`/${i}/one`, ok);
  router.get(`/${i}/one/two`, ok);
  router.get(`/${i}/one/two/:three`, ok);
  router.get(`/${i}/one/two/:three/:four`, ok);
  router.get(`/${i}/one/two/:three/:four/five`, ok);
  router.get(`/${i}/one/two/:three/:four/five/six`, ok);
}

const grandchild = new Router();

if (useMiddleware) grandchild.use(passthrough);
grandchild.get('/', ok);
grandchild.get('/:id', ok);
grandchild.get('/:id/seven', ok);
grandchild.get('/:id/seven', ok);
grandchild.get('/:id/seven/eight', ok);

for (let i = n; i > 0; i--) {
  const child = new Router();
  if (useMiddleware) child.use(passthrough);
  child.get(`/:${''.padStart(i, 'a')}`, ok);
  child.use('/grandchild', grandchild.routes(), grandchild.allowedMethods());
  router.use(`/${i}/child`, child.routes(), child.allowedMethods());
}

if (process.env.DEBUG) {
  // eslint-disable-next-line no-console
  console.log('Router debug info:', router);
}

app.use(router.routes());

process.stdout.write(`mw: ${useMiddleware} factor: ${n} requests/sec`);

const port = Number.parseInt(process.env.PORT || '3000', 10);
app.listen(port);
