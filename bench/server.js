const process = require('node:process');
const env = require('@ladjs/env')({
  path: '../.env',
  includeProcessEnv: true,
  assignToProcessEnv: true
});
const Koa = require('koa');

const Router = require('../');

const app = new Koa();
const router = new Router();

const ok = (ctx) => {
  ctx.status = 200;
};

const n = Number.parseInt(env.FACTOR || '10', 10);
const useMiddleware = env.USE_MIDDLEWARE === 'true';

router.get('/_health', ok);

for (let i = n; i > 0; i--) {
  if (useMiddleware) router.use((ctx, next) => next());
  router.get(`/${i}/one`, ok);
  router.get(`/${i}/one/two`, ok);
  router.get(`/${i}/one/two/:three`, ok);
  router.get(`/${i}/one/two/:three/:four?`, ok);
  router.get(`/${i}/one/two/:three/:four?/five`, ok);
  router.get(`/${i}/one/two/:three/:four?/five/six`, ok);
}

const grandchild = new Router();

if (useMiddleware) grandchild.use((ctx, next) => next());
grandchild.get('/', ok);
grandchild.get('/:id', ok);
grandchild.get('/:id/seven', ok);
grandchild.get('/:id/seven(/eight)?', ok);

for (let i = n; i > 0; i--) {
  const child = new Router();
  if (useMiddleware) child.use((ctx, next) => next());
  child.get(`/:${''.padStart(i, 'a')}`, ok);
  child.middleware('/grandchild', grandchild);
  router.middleware(`/${i}/child`, child);
}

if (process.env.DEBUG) {
  console.log(require('../lib/utils').inspect(router));
}

app.use(router.routes());

process.stdout.write(`mw: ${useMiddleware} factor: ${n} requests/sec`);

app.listen(env.PORT);
