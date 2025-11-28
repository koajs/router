/**
 * Pagination Recipe
 *
 * Implement pagination for list endpoints.
 *
 * Note: User and Post models are placeholders.
 * Replace with your actual models/services.
 */
import Router from '../router-module-loader';
import { User, Post, ContextWithUser, Next } from '../common';

const router = new Router();

const paginate = async (ctx: ContextWithUser, next: Next) => {
  const page = parseInt(ctx.query.page as string) || 1;
  const limit = parseInt(ctx.query.limit as string) || 10;
  const offset = (page - 1) * limit;

  ctx.state.pagination = { page, limit, offset };
  await next();
};

router.get('/users', paginate, async (ctx: ContextWithUser) => {
  const { limit, offset } = ctx.state.pagination || {
    page: 1,
    limit: 10,
    offset: 0
  };
  const { count, rows } = await User.findAndCountAll({
    limit,
    offset
  });

  ctx.set('X-Total-Count', count.toString());
  ctx.set('X-Page-Count', Math.ceil(count / limit).toString());
  const pagination = ctx.state.pagination || { page: 1, limit: 10, offset: 0 };
  ctx.body = {
    data: rows,
    pagination: {
      page: pagination.page,
      limit,
      total: count,
      pages: Math.ceil(count / limit)
    }
  };
});

const getPaginationParams = (ctx: ContextWithUser) => {
  const page = parseInt(ctx.query.page as string) || 1;
  const limit = parseInt(ctx.query.limit as string) || 10;
  const offset = (page - 1) * limit;

  return { page, limit, offset };
};

router.get('/posts', async (ctx: ContextWithUser) => {
  const { limit, offset } = getPaginationParams(ctx);
  const posts = await Post.findAll({ limit, offset });
  ctx.body = posts;
});
