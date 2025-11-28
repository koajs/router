/**
 * Parameter Validation with router.param() Recipe
 *
 * Validate and transform parameters using router.param().
 *
 * Note: User, Post, Resource models are placeholders.
 * Replace with your actual models/services.
 */
import Router from '../router-module-loader';
import { User, Post, Resource, ContextWithUser, Next } from '../common';
import type { RouterParameterMiddleware } from '../router-module-loader';

const router = new Router();

router.param('id', ((value: string, ctx: ContextWithUser, next: Next) => {
  const uuidRegex =
    /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

  if (!uuidRegex.test(value)) {
    ctx.throw(400, 'Invalid ID format');
  }

  return next();
}) as RouterParameterMiddleware);

router.param('user', (async (id: string, ctx: ContextWithUser, next: Next) => {
  const user = await User.findById(id);

  if (!user) {
    ctx.throw(404, 'User not found');
  }

  ctx.state.user = user;
  return next();
}) as RouterParameterMiddleware);

router.get('/users/:user', (ctx: ContextWithUser) => {
  ctx.body = ctx.state.user;
});

router.get('/users/:user/posts', async (ctx: ContextWithUser) => {
  ctx.body = await Post.findByUserId(ctx.state.user!.id);
});

router
  .param('id', ((value: string, ctx: ContextWithUser, next: Next) => {
    if (!/^\d+$/.test(value)) {
      ctx.throw(400, 'Invalid ID format');
    }
    return next();
  }) as RouterParameterMiddleware)
  .param('id', (async (value: string, ctx: ContextWithUser, next: Next) => {
    const resource = await Resource.findById(value);
    ctx.state.resource = resource || undefined;
    return next();
  }) as RouterParameterMiddleware)
  .param('id', ((_value: string, ctx: ContextWithUser, next: Next) => {
    if (!ctx.state.resource) {
      ctx.throw(404);
    }
    return next();
  }) as RouterParameterMiddleware)
  .get('/resource/:id', (ctx: ContextWithUser) => {
    ctx.body = ctx.state.resource;
  });
