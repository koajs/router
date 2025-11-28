/**
 * API Versioning Recipe
 *
 * Implement API versioning with multiple routers.
 *
 * This example shows how to maintain multiple API versions
 * simultaneously with separate routers.
 */
import Koa from 'koa';
import Router from '../router-module-loader';
import type { RouterContext } from '../router-module-loader';

const app = new Koa();

const getUsersV1 = async (ctx: RouterContext) => {
  ctx.body = { users: [], version: 'v1' };
};

const getUserV1 = async (ctx: RouterContext) => {
  ctx.body = { user: { id: ctx.params.id }, version: 'v1' };
};

const getUsersV2 = async (ctx: RouterContext) => {
  ctx.body = {
    users: [],
    version: 'v2',
    metadata: { count: 0, timestamp: new Date() }
  };
};

const getUserV2 = async (ctx: RouterContext) => {
  ctx.body = {
    user: { id: ctx.params.id },
    version: 'v2',
    links: { self: `/api/v2/users/${ctx.params.id}` }
  };
};

const v1Router = new Router({ prefix: '/api/v1' });
v1Router.get('/users', getUsersV1);
v1Router.get('/users/:id', getUserV1);

const v2Router = new Router({ prefix: '/api/v2' });
v2Router.get('/users', getUsersV2);
v2Router.get('/users/:id', getUserV2);

const apiRouter = new Router({ prefix: '/api' });
apiRouter.use(v1Router.routes(), v1Router.allowedMethods());
apiRouter.use(v2Router.routes(), v2Router.allowedMethods());

app.use(apiRouter.routes());
app.use(apiRouter.allowedMethods());
