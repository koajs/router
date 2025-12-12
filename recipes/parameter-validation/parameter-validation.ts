/**
 * Parameter Validation with router.param() Recipe
 *
 * Validate and transform parameters using router.param().
 * Demonstrates:
 * - UUID validation
 * - Loading resources from database
 * - Chaining multiple param handlers
 * - Using generics to avoid type casting
 *
 * Note: User, Post, Resource models are placeholders.
 * Replace with your actual models/services.
 */
import Router from '../router-module-loader';
import { User, Post, Resource } from '../common';
import type { User as UserType, Resource as ResourceType } from '../common';

/**
 * State type for routes with user parameter
 * Using null | undefined to handle both database returns and initial state
 */
type UserState = {
  user?: UserType | null;
};

/**
 * State type for routes with resource parameter
 */
type ResourceState = {
  resource?: ResourceType | null;
};

// ===========================================
// Router with User param validation
// ===========================================

const userRouter = new Router<UserState>();

// Validate UUID format for :id parameter
userRouter.param('id', (value, ctx, next) => {
  const uuidRegex =
    /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

  if (!uuidRegex.test(value)) {
    ctx.throw(400, 'Invalid ID format');
  }

  return next();
});

// Load user from database for :user parameter
userRouter.param('user', async (id, ctx, next) => {
  const user = await User.findById(id);

  if (!user) {
    ctx.throw(404, 'User not found');
  }

  ctx.state.user = user;
  return next();
});

// Routes using the :user parameter
userRouter.get('/users/:user', (ctx) => {
  ctx.body = ctx.state.user;
});

userRouter.get('/users/:user/posts', async (ctx) => {
  const user = ctx.state.user;
  if (user) {
    ctx.body = await Post.findByUserId(user.id);
  }
});

// ===========================================
// Router with Resource param validation
// ===========================================

const resourceRouter = new Router<ResourceState>();

// Chain multiple param handlers for :id
resourceRouter
  // First: validate format
  .param('id', (value, ctx, next) => {
    if (!/^\d+$/.test(value)) {
      ctx.throw(400, 'Invalid ID format');
    }
    return next();
  })
  // Second: load from database
  .param('id', async (value, ctx, next) => {
    const resource = await Resource.findById(value);
    ctx.state.resource = resource;
    return next();
  })
  // Third: check existence
  .param('id', (_value, ctx, next) => {
    if (!ctx.state.resource) {
      ctx.throw(404, 'Resource not found');
    }
    return next();
  })
  .get('/resource/:id', (ctx) => {
    ctx.body = ctx.state.resource;
  });

// Combined router for export
const router = new Router();
router.use(userRouter.routes());
router.use(resourceRouter.routes());

export { router, userRouter, resourceRouter };
export type { UserState, ResourceState };
