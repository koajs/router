/**
 * TypeScript Recipe
 *
 * Demonstrates @koa/router's full TypeScript support with type inference.
 *
 * Key features showcased:
 * - Automatic type inference for ctx and next (no explicit types needed!)
 * - ctx.params is always typed as Record<string, string>
 * - Generic router for custom state/context types
 * - Type-safe parameter middleware
 * - Proper body parsing with @koa/bodyparser
 *
 * Note: getUserById and createUser are placeholder functions.
 * Replace with your actual implementation.
 */
import Router from '../router-module-loader';
import type { RouterMiddleware } from '../router-module-loader';

import '@koa/bodyparser';

type User = {
  id: number;
  name: string;
  email: string;
};

type CreateUserBody = {
  name: string;
  email: string;
};

// ===========================================
// Example 1: Basic router with type inference
// ===========================================

const router = new Router();

// ✅ ctx and next are automatically inferred - no explicit types needed!
router.get('/users/:id', async (ctx, next) => {
  // ctx.params.id is inferred as string
  const userId = parseInt(ctx.params.id, 10);

  if (isNaN(userId)) {
    ctx.throw(400, 'Invalid user ID');
  }

  const user: User = await getUserById(userId);
  ctx.body = user;
  return next();
});

// ✅ Multiple middleware - all have inferred types
// Note: @koa/bodyparser adds ctx.request.body to Koa's types
router.post(
  '/users',
  async (ctx, next) => {
    // Validation middleware - check body exists
    // ctx.request.body is typed by @koa/bodyparser
    if (!ctx.request.body) {
      ctx.throw(400, 'Request body required');
    }
    return next();
  },
  async (ctx) => {
    // Handler - body is available from bodyparser
    // Type narrowing: we know body exists from previous middleware
    const body = ctx.request.body as CreateUserBody;
    const user = await createUser(body);
    ctx.status = 201;
    ctx.body = user;
  }
);

// ✅ router.use() also has type inference
router.use(async (ctx, next) => {
  const start = Date.now();
  await next();
  const ms = Date.now() - start;
  ctx.set('X-Response-Time', `${ms}ms`);
});

// ✅ Parameter middleware with type inference
router.param('id', (value, ctx, next) => {
  // value is inferred as string
  if (!/^\d+$/.test(value)) {
    ctx.throw(400, 'Invalid ID format');
  }
  return next();
});

// ===========================================
// Example 2: Generic router with custom types
// ===========================================

type AppState = {
  user?: User;
  requestId: string;
};

type AppContext = {
  log: (message: string) => void;
};

// Router with custom state and context types
const typedRouter = new Router<AppState, AppContext>();

typedRouter.get('/profile', async (ctx) => {
  // ctx.state.user is typed as User | undefined
  // ctx.log is typed as (message: string) => void
  ctx.log(`Fetching profile for request ${ctx.state.requestId}`);

  if (!ctx.state.user) {
    ctx.throw(401, 'Not authenticated');
  }

  ctx.body = ctx.state.user;
});

// ===========================================
// Example 3: Explicit types when needed
// ===========================================

// Sometimes you need explicit types for complex scenarios
const authMiddleware: RouterMiddleware<AppState, AppContext> = async (
  ctx,
  next
) => {
  // Verify token and set user
  ctx.state.user = await verifyToken(ctx.headers.authorization);
  return next();
};

typedRouter.get('/admin', authMiddleware, async (ctx) => {
  // ctx.state.user is available from the middleware
  ctx.body = { admin: true, user: ctx.state.user };
});

// ===========================================
// Placeholder implementations
// ===========================================

async function getUserById(id: number): Promise<User> {
  return { id, name: 'John Doe', email: 'john@example.com' };
}

async function createUser(data: CreateUserBody): Promise<User> {
  return { id: 1, ...data };
}

async function verifyToken(_token?: string): Promise<User | undefined> {
  return { id: 1, name: 'Admin', email: 'admin@example.com' };
}

export { router, typedRouter };
export type { User, CreateUserBody, AppState, AppContext };
