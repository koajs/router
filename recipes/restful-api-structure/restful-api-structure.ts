/**
 * RESTful API Structure Recipe
 *
 * Organize your API with nested routers for clean separation.
 *
 * Note: User, Post, and other model references are placeholders.
 * Replace them with your actual database models or service layer.
 */
import Koa from 'koa';
import Router from '../router-module-loader';
import { User, ContextWithBody } from '../common';
import type { RouterContext } from '../router-module-loader';

const app = new Koa();

const usersRouter = new Router({ prefix: '/users' });
usersRouter.get('/', async (ctx: RouterContext) => {
  ctx.body = await User.findAll();
});
usersRouter.post('/', async (ctx: ContextWithBody) => {
  const body = ctx.request.body as
    | { email?: string; name?: string }
    | undefined;
  ctx.body = await User.create(body || {});
});
usersRouter.get('/:id', async (ctx: RouterContext) => {
  ctx.body = await User.findById(ctx.params.id);
});
usersRouter.put('/:id', async (ctx: ContextWithBody) => {
  const body = ctx.request.body as
    | { email?: string; name?: string }
    | undefined;
  ctx.body = await User.update(ctx.params.id, body || {});
});
usersRouter.delete('/:id', async (ctx: RouterContext) => {
  await User.delete(ctx.params.id);
  ctx.status = 204;
});

const apiRouter = new Router({ prefix: '/api/v1' });
apiRouter.use(usersRouter.routes(), usersRouter.allowedMethods());

app.use(apiRouter.routes());
app.use(apiRouter.allowedMethods());
