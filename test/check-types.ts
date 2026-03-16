import Router, { RouterMiddleware } from '../src';
import type { DefaultState, DefaultContext } from 'koa';

// Import Router as type for generic usage
import type { Router as RouterType } from '../src';
import type RouterTypeDefault from '../src';

type Assert<T extends true> = T;
type IsAny<T> = 0 extends 1 & T ? true : false;
type MiddlewareContext<M> = M extends (
  ctx: infer C,
  next: () => Promise<unknown>
) => unknown
  ? C
  : never;

// ===========================================
// Test 1: router.use(...middlewares) - Array spread
// ===========================================

const router = new Router();

const middlewares: Array<RouterMiddleware> = [
  async (ctx, next) => {
    ctx.set('X-Test', '1');
    await next();
  },
  async (ctx, next) => {
    if (ctx.request.method === 'GET') {
      ctx.status = 200;
    }
    await next();
  }
];

router.use(...middlewares);

type ContextFromArray = MiddlewareContext<(typeof middlewares)[number]>;
true as Assert<IsAny<ContextFromArray> extends false ? true : false>;

// ===========================================
// Test 2: Multiple inline middlewares - Context should not become 'any'
// ===========================================

router.use(
  async (ctx, next) => {
    // First middleware - ctx should not be 'any'
    type FirstCtx = typeof ctx;
    true as Assert<IsAny<FirstCtx> extends false ? true : false>;
    ctx.set('X-Auth', 'checked');
    await next();
  },
  async (ctx, next) => {
    // Second middleware - ctx should not be 'any'
    type SecondCtx = typeof ctx;
    true as Assert<IsAny<SecondCtx> extends false ? true : false>;
    ctx.status = 200;
    await next();
  }
);

// ===========================================
// Test 3: Router type import with generics
// ===========================================

type AppState = {
  user?: {
    id: string;
    name: string;
  };
  requestId: string;
};

type AppContext = {
  log: (message: string) => void;
};

// Should work: import type { Router } from '@koa/router'
type AppRouterNamed = RouterType<AppState, AppContext>;
true as Assert<
  AppRouterNamed extends Router<AppState, AppContext> ? true : false
>;

// Should work: import type Router from '@koa/router'
type AppRouterDefault = RouterTypeDefault<AppState, AppContext>;
true as Assert<
  AppRouterDefault extends Router<AppState, AppContext> ? true : false
>;

// Should work with DefaultState and DefaultContext
type DefaultRouter = RouterType<DefaultState, DefaultContext>;
true as Assert<
  DefaultRouter extends Router<DefaultState, DefaultContext> ? true : false
>;

// ===========================================
// Test 4: HTTP method handlers - Context typing
// ===========================================

const methodRouter = new Router<AppState, AppContext>();

// GET method
methodRouter.get('/users/:id', async (ctx, next) => {
  type GetCtx = typeof ctx;
  true as Assert<IsAny<GetCtx> extends false ? true : false>;
  // ctx.params should be Record<string, string>
  const userId: string = ctx.params.id;
  userId;
  await next();
});

// POST method
methodRouter.post('/users', async (ctx, next) => {
  type PostCtx = typeof ctx;
  true as Assert<IsAny<PostCtx> extends false ? true : false>;
  ctx.state.user = { id: '123', name: 'Test' };
  await next();
});

// PUT method
methodRouter.put('/users/:id', async (ctx) => {
  type PutCtx = typeof ctx;
  true as Assert<IsAny<PutCtx> extends false ? true : false>;
  ctx.log('Updating user');
});

// PATCH method
methodRouter.patch('/users/:id', async (ctx) => {
  type PatchCtx = typeof ctx;
  true as Assert<IsAny<PatchCtx> extends false ? true : false>;
});

// DELETE method
methodRouter.delete('/users/:id', async (ctx) => {
  type DeleteCtx = typeof ctx;
  true as Assert<IsAny<DeleteCtx> extends false ? true : false>;
});

// HEAD method
methodRouter.head('/users/:id', async (ctx) => {
  type HeadCtx = typeof ctx;
  true as Assert<IsAny<HeadCtx> extends false ? true : false>;
});

// OPTIONS method
methodRouter.options('/users', async (ctx) => {
  type OptionsCtx = typeof ctx;
  true as Assert<IsAny<OptionsCtx> extends false ? true : false>;
});

// ===========================================
// Test 5: Router.all() method
// ===========================================

methodRouter.all('/health', async (ctx) => {
  type AllCtx = typeof ctx;
  true as Assert<IsAny<AllCtx> extends false ? true : false>;
  ctx.body = { status: 'ok' };
});

// ===========================================
// Test 6: Array of paths
// ===========================================

methodRouter.get(['/v1/users', '/v2/users'], async (ctx) => {
  type ArrayPathCtx = typeof ctx;
  true as Assert<IsAny<ArrayPathCtx> extends false ? true : false>;
});

// ===========================================
// Test 7: Named routes
// ===========================================

methodRouter.get('user-detail', '/users/:id', async (ctx) => {
  type NamedRouteCtx = typeof ctx;
  true as Assert<IsAny<NamedRouteCtx> extends false ? true : false>;
  const id: string = ctx.params.id;
  id;
});

// ===========================================
// Test 8: Parameter middleware
// ===========================================

methodRouter.param('id', (value, ctx, next) => {
  type ParamValue = typeof value;
  type ParamCtx = typeof ctx;
  true as Assert<IsAny<ParamValue> extends false ? true : false>;
  true as Assert<IsAny<ParamCtx> extends false ? true : false>;
  // value should be string
  const id: string = value;
  id;
  return next();
});

// ===========================================
// Test 9: Nested routers
// ===========================================

const parentRouter = new Router<AppState, AppContext>({
  prefix: '/api'
});

const childRouter = new Router<AppState, AppContext>();

childRouter.get('/items', async (ctx) => {
  type ChildCtx = typeof ctx;
  true as Assert<IsAny<ChildCtx> extends false ? true : false>;
  ctx.log('Child router handler');
});

parentRouter.use('/v1', childRouter.routes());

// ===========================================
// Test 10: Middleware with path
// ===========================================

methodRouter.use('/admin', async (ctx, next) => {
  type PathMiddlewareCtx = typeof ctx;
  true as Assert<IsAny<PathMiddlewareCtx> extends false ? true : false>;
  ctx.state.requestId = 'admin-123';
  await next();
});

// ===========================================
// Test 11: Multiple middleware in route definition
// ===========================================

const authMiddleware: RouterMiddleware<AppState, AppContext> = async (
  ctx,
  next
) => {
  type AuthCtx = typeof ctx;
  true as Assert<IsAny<AuthCtx> extends false ? true : false>;
  ctx.state.user = { id: '123', name: 'Admin' };
  await next();
};

const validateMiddleware: RouterMiddleware<AppState, AppContext> = async (
  ctx,
  next
) => {
  type ValidateCtx = typeof ctx;
  true as Assert<IsAny<ValidateCtx> extends false ? true : false>;
  await next();
};

methodRouter.get(
  '/protected',
  authMiddleware,
  validateMiddleware,
  async (ctx) => {
    type ProtectedCtx = typeof ctx;
    true as Assert<IsAny<ProtectedCtx> extends false ? true : false>;
    // Should have access to state.user from authMiddleware
    const user = ctx.state.user;
    user;
  }
);

// ===========================================
// Test 12: Generic type parameters in route methods
// ===========================================

type ExtendedState = AppState & { timestamp: number };
type ExtendedContext = AppContext & { trace: (id: string) => void };

methodRouter.get<ExtendedState, ExtendedContext>(
  '/extended',
  async (ctx, next) => {
    type ExtendedCtx = typeof ctx;
    true as Assert<IsAny<ExtendedCtx> extends false ? true : false>;
    // Should have both base and extended properties
    ctx.state.timestamp = Date.now();
    ctx.state.requestId = 'ext-123';
    ctx.log('Base log');
    await next();
  }
);

// ===========================================
// Test 13: Response body type with generic parameter
// ===========================================

type CreateUserResponse = {
  id: string;
  name: string;
  email: string;
};

methodRouter.post<{}, {}, CreateUserResponse>('/users', async (ctx) => {
  type BodyCtx = typeof ctx;
  true as Assert<IsAny<BodyCtx> extends false ? true : false>;
  // Third generic parameter is for response body type
  ctx.body = {
    id: '123',
    name: 'John',
    email: 'john@example.com'
  };
});

// ===========================================
// Test 14: RegExp paths
// ===========================================

methodRouter.get(/^\/users\/(\d+)$/, async (ctx) => {
  type RegexCtx = typeof ctx;
  true as Assert<IsAny<RegexCtx> extends false ? true : false>;
  const captures = ctx.captures;
  captures;
});

// ===========================================
// Test 15: AllowedMethods middleware
// ===========================================

const allowedMethodsMiddleware = methodRouter.allowedMethods();
type AllowedMethodsType = typeof allowedMethodsMiddleware;
true as Assert<IsAny<AllowedMethodsType> extends false ? true : false>;

// ===========================================
// Test 16: Router.routes() return type
// ===========================================

const routesMiddleware = methodRouter.routes();
type RoutesType = typeof routesMiddleware;
true as Assert<IsAny<RoutesType> extends false ? true : false>;

// ===========================================
// Test 17: RouterContext type usage
// ===========================================

import type { RouterContext } from '../src';

function customHandler(ctx: RouterContext<AppState, AppContext>) {
  type CustomHandlerCtx = typeof ctx;
  true as Assert<IsAny<CustomHandlerCtx> extends false ? true : false>;
  ctx.params.id;
  ctx.state.user;
  ctx.log('Custom handler');
}

methodRouter.get('/custom', customHandler);

// ===========================================
// Test 18: Middleware array with path
// ===========================================

const adminMiddlewares: Array<RouterMiddleware<AppState, AppContext>> = [
  async (ctx, next) => {
    type AdminMw1Ctx = typeof ctx;
    true as Assert<IsAny<AdminMw1Ctx> extends false ? true : false>;
    await next();
  },
  async (ctx, next) => {
    type AdminMw2Ctx = typeof ctx;
    true as Assert<IsAny<AdminMw2Ctx> extends false ? true : false>;
    await next();
  }
];

methodRouter.use('/admin', ...adminMiddlewares);

// ===========================================
// Test 19: Router prefix with parameters
// ===========================================

const prefixedRouter = new Router<AppState, AppContext>({
  prefix: '/api/v1'
});

prefixedRouter.get('/items', async (ctx) => {
  type PrefixedCtx = typeof ctx;
  true as Assert<IsAny<PrefixedCtx> extends false ? true : false>;
});

// ===========================================
// Test 20: Router redirect
// ===========================================

methodRouter.redirect('/old-path', '/new-path', 301);

// ===========================================
// Test 21: Static Router.url method
// ===========================================

const staticUrl = Router.url('/users/:id', { id: '123' });
type StaticUrlType = typeof staticUrl;
true as Assert<IsAny<StaticUrlType> extends false ? true : false>;

// ===========================================
// Test 22: Instance url method
// ===========================================

const instanceUrl = methodRouter.url('user-detail', { id: '456' });
type InstanceUrlType = typeof instanceUrl;
true as Assert<IsAny<InstanceUrlType> extends false ? true : false>;

// ===========================================
// Test 23: Router with host option
// ===========================================

const hostRouter = new Router<AppState, AppContext>({
  host: 'api.example.com'
});

hostRouter.get('/status', async (ctx) => {
  type HostCtx = typeof ctx;
  true as Assert<IsAny<HostCtx> extends false ? true : false>;
});

// ===========================================
// Test 24: Exclusive router option
// ===========================================

const exclusiveRouter = new Router<AppState, AppContext>({
  exclusive: true
});

exclusiveRouter.get('/exclusive', async (ctx) => {
  type ExclusiveCtx = typeof ctx;
  true as Assert<IsAny<ExclusiveCtx> extends false ? true : false>;
});

const exclusiveRouterFirst = new Router<AppState, AppContext>({
  exclusive: 'first'
});

exclusiveRouterFirst.get('/exclusive', async (ctx) => {
  type ExclusiveCtx = typeof ctx;
  true as Assert<IsAny<ExclusiveCtx> extends false ? true : false>;
});

const exclusiveRouterLast = new Router<AppState, AppContext>({
  exclusive: 'last'
});

exclusiveRouterLast.get('/exclusive', async (ctx) => {
  type ExclusiveCtx = typeof ctx;
  true as Assert<IsAny<ExclusiveCtx> extends false ? true : false>;
});

// ===========================================
// Test 25: Type narrowing and property access
// ===========================================

// Helper type to check if a property exists on a type
type HasProperty<T, K extends string> = K extends keyof T ? true : false;

methodRouter.get('/type-narrow', async (ctx) => {
  // Verify ctx has expected router properties
  true as Assert<HasProperty<typeof ctx, 'params'>>;
  true as Assert<HasProperty<typeof ctx, 'router'>>;
  true as Assert<HasProperty<typeof ctx, 'matched'>>;

  // Verify params is properly typed
  type ParamsType = typeof ctx.params;
  true as Assert<ParamsType extends Record<string, string> ? true : false>;

  // Verify request.params exists
  true as Assert<HasProperty<typeof ctx.request, 'params'>>;

  // State should have AppState properties
  type StateType = typeof ctx.state;
  true as Assert<HasProperty<StateType, 'user'>>;
  true as Assert<HasProperty<StateType, 'requestId'>>;

  // Context should have AppContext properties
  true as Assert<HasProperty<typeof ctx, 'log'>>;
});

// ===========================================
// Test 26: Type safety with wrong property access (should compile-time error if uncommented)
// ===========================================

// These would cause TypeScript errors if uncommented:
// methodRouter.get('/wrong-access', async (ctx) => {
//   ctx.nonExistentProperty; // Error: Property 'nonExistentProperty' does not exist
//   ctx.request.body; // Error: Property 'body' does not exist (unless @koa/bodyparser types are imported)
// });

// ===========================================
// Test 27: Middleware composition type preservation
// ===========================================

const composedMiddleware = [
  async (
    ctx: RouterContext<AppState, AppContext>,
    next: () => Promise<void>
  ) => {
    type ComposedCtx1 = typeof ctx;
    true as Assert<IsAny<ComposedCtx1> extends false ? true : false>;
    ctx.state.requestId = 'comp-1';
    await next();
  },
  async (
    ctx: RouterContext<AppState, AppContext>,
    next: () => Promise<void>
  ) => {
    type ComposedCtx2 = typeof ctx;
    true as Assert<IsAny<ComposedCtx2> extends false ? true : false>;
    // Should have access to requestId set in previous middleware
    const id = ctx.state.requestId;
    id;
    await next();
  }
];

methodRouter.use(...composedMiddleware);

// ===========================================
// Test 28: Type inference with optional path parameter
// ===========================================

methodRouter.use(async (ctx, next) => {
  type NoPathCtx = typeof ctx;
  true as Assert<IsAny<NoPathCtx> extends false ? true : false>;
  // Verify all standard Koa properties exist
  true as Assert<HasProperty<typeof ctx, 'request'>>;
  true as Assert<HasProperty<typeof ctx, 'response'>>;
  true as Assert<HasProperty<typeof ctx, 'app'>>;
  true as Assert<HasProperty<typeof ctx, 'state'>>;
  true as Assert<HasProperty<typeof ctx, 'cookies'>>;
  await next();
});

// ===========================================
// Test 29: Return type validation
// ===========================================

type MiddlewareReturnType = ReturnType<RouterMiddleware<AppState, AppContext>>;
true as Assert<
  MiddlewareReturnType extends Promise<unknown> | unknown ? true : false
>;

// ===========================================
// Test 30: Next function type
// ===========================================

methodRouter.get('/next-type', async (ctx, next) => {
  ctx;
  type NextType = typeof next;
  true as Assert<IsAny<NextType> extends false ? true : false>;
  // next should return a Promise
  type NextReturn = ReturnType<typeof next>;
  true as Assert<NextReturn extends Promise<unknown> ? true : false>;
  await next();
});

// ===========================================
// Test 31: Context extends checks
// ===========================================

type ExpectedRouterContext = RouterContext<AppState, AppContext>;

methodRouter.get('/extends-check', async (ctx) => {
  type CtxType = typeof ctx;
  // Verify ctx extends expected RouterContext
  true as Assert<CtxType extends ExpectedRouterContext ? true : false>;
  ctx.params;
});

// ===========================================
// Test 32: Params type narrowing with specific routes
// ===========================================

methodRouter.get('/users/:userId/posts/:postId', async (ctx) => {
  // params should be Record<string, string>
  const userId: string = ctx.params.userId;
  const postId: string = ctx.params.postId;
  userId;
  postId;

  // Type should allow any string key
  const anyParam: string | undefined = ctx.params['anyKey'];
  anyParam;
});
