# [@koa/router](https://github.com/koajs/router)

> Modern TypeScript Router middleware for [Koa](https://github.com/koajs/koa). Maintained by [Forward Email][forward-email] and [Lad][].

[![build status](https://github.com/koajs/router/actions/workflows/ci.yml/badge.svg)](https://github.com/koajs/router/actions/workflows/ci.yml)
[![styled with prettier](https://img.shields.io/badge/styled_with-prettier-ff69b4.svg)](https://github.com/prettier/prettier)
[![made with lass](https://img.shields.io/badge/made_with-lass-95CC28.svg)](https://lass.js.org)
[![license](https://img.shields.io/github/license/koajs/router.svg)](LICENSE)

## Table of Contents

- [Features](#features)
- [Installation](#installation)
- [TypeScript Support](#typescript-support)
- [Quick Start](#quick-start)
- [API Documentation](#api-documentation)
- [Advanced Features](#advanced-features)
- [Best Practices](#best-practices)
- [Recipes](#recipes)
- [Performance](#performance)
- [Testing](#testing)
- [Migration Guides](#migration-guides)
- [Contributing](#contributing)
- [License](#license)
- [Contributors](#contributors)

## Features

- ✅ **Full TypeScript Support** - Written in TypeScript with comprehensive type definitions
- ✅ **Express-Style Routing** - Familiar `app.get`, `app.post`, `app.put`, etc.
- ✅ **Named URL Parameters** - Extract parameters from URLs
- ✅ **Named Routes** - Generate URLs from route names
- ✅ **Host Matching** - Match routes based on hostname
- ✅ **HEAD Request Support** - Automatic HEAD support for GET routes
- ✅ **Multiple Middleware** - Chain multiple middleware functions
- ✅ **Nested Routers** - Mount routers within routers
- ✅ **RegExp Paths** - Use regular expressions for flexible path matching
- ✅ **Parameter Middleware** - Run middleware for specific URL parameters
- ✅ **Path-to-RegExp v8** - Modern, predictable path matching
- ✅ **405 Method Not Allowed** - Automatic method validation
- ✅ **501 Not Implemented** - Proper HTTP status codes
- ✅ **Async/Await** - Full promise-based middleware support

## Installation

**npm:**

```bash
npm install @koa/router
```

**yarn:**

```bash
yarn add @koa/router
```

**Requirements:**

- Node.js >= 20 (tested on v20, v22, v24, v25)
- Koa >= 2.0.0

## TypeScript Support

@koa/router is written in TypeScript and includes comprehensive type definitions out of the box. No need for `@types/*` packages!

### Basic Usage

Types are **automatically inferred** - no explicit type annotations needed:

```typescript
import Router from '@koa/router';

const router = new Router();

// ctx and next are automatically inferred!
router.get('/:id', (ctx, next) => {
  const id = ctx.params.id; // ✅ Inferred as string
  ctx.request.params.id; // ✅ Also available
  ctx.body = { id }; // ✅ Works
  return next(); // ✅ Works
});

// Also works for router.use()
router.use((ctx, next) => {
  ctx.state.startTime = Date.now();
  return next();
});
```

### Explicit Types (Optional)

For cases where you need explicit types:

```typescript
import Router, { RouterContext } from '@koa/router';
import type { Next } from 'koa';

router.get('/:id', (ctx: RouterContext, next: Next) => {
  const id = ctx.params.id;
  ctx.body = { id };
});
```

### Generic Types

The router supports generic type parameters for full type safety with custom state and context types:

```typescript
import Router, { RouterContext } from '@koa/router';
import type { Next } from 'koa';

// Define your application state
interface AppState {
  user?: {
    id: string;
    email: string;
  };
}

// Define your custom context
interface AppContext {
  requestId: string;
}

// Create router with generics
const router = new Router<AppState, AppContext>();

// Type-safe route handlers
router.get(
  '/profile',
  (ctx: RouterContext<AppState, AppContext>, next: Next) => {
    // ctx.state.user is fully typed
    if (ctx.state.user) {
      ctx.body = {
        user: ctx.state.user,
        requestId: ctx.requestId // Custom context property
      };
    }
  }
);
```

### Extending Types in Route Handlers

HTTP methods support generic type parameters to extend state and context types:

```typescript
interface UserState {
  user: { id: string; name: string };
}

interface UserContext {
  permissions: string[];
}

// Extend types for specific routes
router.get<UserState, UserContext>(
  '/users/:id',
  async (ctx: RouterContext<UserState, UserContext>) => {
    // ctx.state.user is fully typed
    // ctx.permissions is fully typed
    ctx.body = {
      user: ctx.state.user,
      permissions: ctx.permissions
    };
  }
);
```

### Parameter Middleware Types

```typescript
import type { RouterParameterMiddleware } from '@koa/router';
import type { Next } from 'koa';

// Type-safe parameter middleware
router.param('id', ((value: string, ctx: RouterContext, next: Next) => {
  if (!/^\d+$/.test(value)) {
    ctx.throw(400, 'Invalid ID format');
  }
  return next();
}) as RouterParameterMiddleware);
```

### Available Types

```typescript
import {
  Router,
  RouterContext,
  RouterOptions,
  RouterMiddleware,
  RouterParameterMiddleware,
  RouterParamContext,
  AllowedMethodsOptions,
  UrlOptions,
  HttpMethod
} from '@koa/router';
import type { Next } from 'koa';

// Router with generics
type MyRouter = Router<AppState, AppContext>;

// Context with generics
type MyContext = RouterContext<AppState, AppContext, BodyType>;

// Middleware with generics
type MyMiddleware = RouterMiddleware<AppState, AppContext, BodyType>;

// Parameter middleware with generics
type MyParamMiddleware = RouterParameterMiddleware<
  AppState,
  AppContext,
  BodyType
>;
```

### Type Safety Features

- ✅ **Full type inference** - `ctx` and `next` are inferred automatically in route handlers
- ✅ **Full generic support** - `Router<StateT, ContextT>` for custom state and context types
- ✅ **Type-safe parameters** - `ctx.params` is fully typed and always defined
- ✅ **Type-safe state** - `ctx.state` respects your state type
- ✅ **Type-safe middleware** - Middleware functions are fully typed
- ✅ **Type-safe HTTP methods** - Methods support generic type extensions
- ✅ **Custom HTTP method inference** - Use `as const` with `methods` option for typed custom methods
- ✅ **Compatible with @types/koa-router** - Matches official type structure

## Quick Start

```javascript
import Koa from 'koa';
import Router from '@koa/router';

const app = new Koa();
const router = new Router();

// Define routes
router.get('/', (ctx, next) => {
  ctx.body = 'Hello World!';
});

router.get('/users/:id', (ctx, next) => {
  ctx.body = { id: ctx.params.id };
});

// Apply router middleware
app.use(router.routes()).use(router.allowedMethods());

app.listen(3000);
```

## API Documentation

### Router Constructor

**`new Router([options])`**

Create a new router instance.

**Options:**

| Option      | Type                           | Description                               |
| ----------- | ------------------------------ | ----------------------------------------- |
| `prefix`    | `string`                       | Prefix all routes with this path          |
| `exclusive` | `boolean`                      | Only run the most specific matching route |
| `host`      | `string \| string[] \| RegExp` | Match routes only for this hostname(s)    |
| `methods`   | `string[]`                     | Custom HTTP methods to support            |
| `sensitive` | `boolean`                      | Enable case-sensitive routing             |
| `strict`    | `boolean`                      | Require trailing slashes                  |

**Example:**

```javascript
const router = new Router({
  prefix: '/api',
  exclusive: true,
  host: 'example.com'
});
```

### HTTP Methods

Router provides methods for all standard HTTP verbs:

- `router.get(path, ...middleware)`
- `router.post(path, ...middleware)`
- `router.put(path, ...middleware)`
- `router.patch(path, ...middleware)`
- `router.delete(path, ...middleware)` or `router.del(path, ...middleware)`
- `router.head(path, ...middleware)`
- `router.options(path, ...middleware)`
- `router.connect(path, ...middleware)` - CONNECT method
- `router.trace(path, ...middleware)` - TRACE method
- `router.all(path, ...middleware)` - Match any HTTP method

**Note:** All standard HTTP methods (as defined by Node.js `http.METHODS`) are automatically available as router methods. The `methods` option in the constructor can be used to limit which methods the router responds to, but you cannot use truly custom HTTP methods beyond the standard set.

**Basic Example:**

```javascript
router
  .get('/users', getUsers)
  .post('/users', createUser)
  .put('/users/:id', updateUser)
  .delete('/users/:id', deleteUser)
  .all('/users/:id', logAccess); // Runs for any method
```

**Using Less Common HTTP Methods:**

All standard HTTP methods from Node.js are automatically available. Here's an example using `PATCH` and `PURGE`:

```javascript
const router = new Router();

// PATCH method (standard HTTP method for partial updates)
router.patch('/users/:id', async (ctx) => {
  // Partial update
  ctx.body = { message: 'User partially updated' };
});

// PURGE method (standard HTTP method, commonly used for cache invalidation)
router.purge('/cache/:key', async (ctx) => {
  // Clear cache
  await clearCache(ctx.params.key);
  ctx.body = { message: 'Cache cleared' };
});

// COPY method (standard HTTP method)
router.copy('/files/:source', async (ctx) => {
  await copyFile(ctx.params.source, ctx.request.body.destination);
  ctx.body = { message: 'File copied' };
});

// Limiting which methods the router responds to
const apiRouter = new Router({
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] // Only these methods
});

apiRouter.get('/users', getUsers);
apiRouter.post('/users', createUser);
// router.purge() won't work here because PURGE is not in the methods array
```

**Note:** HEAD requests are automatically supported for all GET routes. When you define a GET route, HEAD requests will execute the same handler and return the same headers but with an empty body.

### Named Routes

Routes can be named for URL generation:

```javascript
router.get('user', '/users/:id', (ctx) => {
  ctx.body = { id: ctx.params.id };
});

// Generate URL
router.url('user', 3);
// => "/users/3"

router.url('user', { id: 3 });
// => "/users/3"

// With query parameters
router.url('user', { id: 3 }, { query: { limit: 10 } });
// => "/users/3?limit=10"

// In middleware
router.use((ctx, next) => {
  ctx.redirect(ctx.router.url('user', 1));
});
```

### Multiple Middleware

Chain multiple middleware functions for a single route:

```javascript
router.get(
  '/users/:id',
  async (ctx, next) => {
    // Load user from database
    ctx.state.user = await User.findById(ctx.params.id);
    return next();
  },
  async (ctx, next) => {
    // Check permissions
    if (!ctx.state.user) {
      ctx.throw(404, 'User not found');
    }
    return next();
  },
  (ctx) => {
    // Send response
    ctx.body = ctx.state.user;
  }
);
```

### Nested Routers

Mount routers within routers:

```javascript
const usersRouter = new Router();
usersRouter.get('/', getUsers);
usersRouter.get('/:id', getUser);

const postsRouter = new Router();
postsRouter.get('/', getPosts);
postsRouter.get('/:id', getPost);

const apiRouter = new Router({ prefix: '/api' });
apiRouter.use('/users', usersRouter.routes());
apiRouter.use('/posts', postsRouter.routes());

app.use(apiRouter.routes());
```

**Note:** Parameters from parent routes are properly propagated to nested router middleware and handlers.

### Router Prefixes

Set a prefix for all routes in a router:

**Option 1: In constructor**

```javascript
const router = new Router({ prefix: '/api' });
router.get('/users', handler); // Responds to /api/users
```

**Option 2: Using .prefix()**

```javascript
const router = new Router();
router.prefix('/api');
router.get('/users', handler); // Responds to /api/users
```

**With parameters:**

```javascript
const router = new Router({ prefix: '/api/v:version' });
router.get('/users', (ctx) => {
  ctx.body = {
    version: ctx.params.version,
    users: []
  };
});
// Responds to /api/v1/users, /api/v2/users, etc.
```

**Note:** Middleware now correctly executes when the prefix contains parameters.

### URL Parameters

Named parameters are captured and available at `ctx.params`:

```javascript
router.get('/:category/:title', (ctx) => {
  console.log(ctx.params);
  // => { category: 'programming', title: 'how-to-node' }

  ctx.body = {
    category: ctx.params.category,
    title: ctx.params.title
  };
});
```

**Optional parameters:**

```javascript
router.get('/user{/:id}?', (ctx) => {
  // Matches both /user and /user/123
  ctx.body = { id: ctx.params.id || 'all' };
});
```

**Wildcard parameters:**

```javascript
router.get('/files/{/*path}', (ctx) => {
  // Matches /files/a/b/c.txt
  ctx.body = { path: ctx.params.path }; // => a/b/c.txt
});
```

**Note:** Custom regex patterns in parameters (`:param(regex)`) are **no longer supported** in v14+ due to path-to-regexp v8. Use validation in handlers or middleware instead.

### router.routes()

Returns router middleware which dispatches matched routes.

```javascript
app.use(router.routes());
```

### router.use()

Use middleware, **if and only if**, a route is matched.

**Signature:**

```javascript
router.use([path], ...middleware);
```

**Examples:**

```javascript
// Run for all matched routes
router.use(session());

// Run only for specific path
router.use('/admin', requireAuth());

// Run for multiple paths
router.use(['/admin', '/dashboard'], requireAuth());

// Run for RegExp paths
router.use(/^\/api\//, apiAuth());

// Mount nested routers
const nestedRouter = new Router();
router.use('/nested', nestedRouter.routes());
```

**Note:** Middleware path boundaries are correctly enforced. Middleware scoped to `/api` will only run for routes matching `/api/*`, not for unrelated routes.

### router.prefix()

Set the path prefix for a Router instance after initialization.

```javascript
const router = new Router();
router.get('/', handler); // Responds to /

router.prefix('/api');
router.get('/', handler); // Now responds to /api
```

### router.allowedMethods()

Returns middleware for responding to `OPTIONS` requests with allowed methods,
and `405 Method Not Allowed` / `501 Not Implemented` responses.

**Options:**

| Option             | Type       | Description                              |
| ------------------ | ---------- | ---------------------------------------- |
| `throw`            | `boolean`  | Throw errors instead of setting response |
| `notImplemented`   | `function` | Custom function for 501 errors           |
| `methodNotAllowed` | `function` | Custom function for 405 errors           |

**Example:**

```javascript
app.use(router.routes());
app.use(router.allowedMethods());
```

**With custom error handling:**

```javascript
app.use(
  router.allowedMethods({
    throw: true,
    notImplemented: () => new Error('Not Implemented'),
    methodNotAllowed: () => new Error('Method Not Allowed')
  })
);
```

### router.redirect()

Redirect `source` to `destination` URL with optional status code.

```javascript
router.redirect('/login', 'sign-in', 301);
router.redirect('/old-path', '/new-path');

// Redirect to named route
router.get('home', '/', handler);
router.redirect('/index', 'home');
```

### router.route()

Lookup a route by name.

```javascript
const layer = router.route('user');
if (layer) {
  console.log(layer.path); // => /users/:id
}
```

### router.url()

Generate URL from route name and parameters.

```javascript
router.get('user', '/users/:id', handler);

router.url('user', 3);
// => "/users/3"

router.url('user', { id: 3 });
// => "/users/3"

router.url('user', { id: 3 }, { query: { limit: 1 } });
// => "/users/3?limit=1"

router.url('user', { id: 3 }, { query: 'limit=1' });
// => "/users/3?limit=1"
```

**In middleware:**

```javascript
router.use((ctx, next) => {
  // Access router instance via ctx.router
  const userUrl = ctx.router.url('user', ctx.state.userId);
  ctx.redirect(userUrl);
  return next();
});
```

### router.param()

Run middleware for named route parameters.

**Signature:**

```typescript
router.param(param: string, middleware: RouterParameterMiddleware): Router
```

**TypeScript Example:**

```typescript
import type { RouterParameterMiddleware } from '@koa/router';
import type { Next } from 'koa';

router.param('user', (async (id: string, ctx: RouterContext, next: Next) => {
  ctx.state.user = await User.findById(id);
  if (!ctx.state.user) {
    ctx.throw(404, 'User not found');
  }
  return next();
}) as RouterParameterMiddleware);

router.get('/users/:user', (ctx: RouterContext) => {
  // ctx.state.user is already loaded and typed
  ctx.body = ctx.state.user;
});

router.get('/users/:user/friends', (ctx: RouterContext) => {
  // ctx.state.user is available here too
  return ctx.state.user.getFriends();
});
```

**JavaScript Example:**

```javascript
router
  .param('user', async (id, ctx, next) => {
    ctx.state.user = await User.findById(id);
    if (!ctx.state.user) {
      ctx.throw(404, 'User not found');
    }
    return next();
  })
  .get('/users/:user', (ctx) => {
    // ctx.state.user is already loaded
    ctx.body = ctx.state.user;
  })
  .get('/users/:user/friends', (ctx) => {
    // ctx.state.user is available here too
    return ctx.state.user.getFriends();
  });
```

**Multiple param handlers:**

You can register multiple param handlers for the same parameter. All handlers will be called in order, and each handler is executed exactly once per request (even if multiple routes match):

```javascript
router
  .param('id', validateIdFormat)
  .param('id', checkIdExists)
  .param('id', checkPermissions)
  .get('/resource/:id', handler);
// All three param handlers run once per request
```

### Router.url() (static)

Generate URL from path pattern and parameters (static method).

```javascript
const url = Router.url('/users/:id', { id: 1 });
// => "/users/1"

const url = Router.url('/users/:id', { id: 1, name: 'John' });
// => "/users/1"
```

## Advanced Features

### Host Matching

Match routes only for specific hostnames:

```javascript
// Exact match with single host
const routerA = new Router({
  host: 'example.com'
});

// Match multiple hosts with array
const routerB = new Router({
  host: ['some-domain.com', 'www.some-domain.com', 'some.other-domain.com']
});

// Match patterns with RegExp
const routerC = new Router({
  host: /^(.*\.)?example\.com$/ // Match all subdomains
});
```

**Host Matching Options:**

- `string` - Exact match (case-sensitive)
- `string[]` - Matches if the request host equals any string in the array
- `RegExp` - Pattern match using regular expression
- `undefined` - Matches all hosts (default)

### Regular Expressions

Use RegExp for flexible path matching:

**Full RegExp routes:**

```javascript
router.get(/^\/users\/(\d+)$/, (ctx) => {
  const id = ctx.params[0]; // First capture group
  ctx.body = { id };
});
```

**RegExp in router.use():**

```javascript
router.use(/^\/api\//, apiMiddleware);
router.use(/^\/admin\//, adminAuth);
```

### Parameter Validation

Validate parameters using middleware or handlers:

**Option 1: In Handler**

```javascript
router.get('/user/:id', (ctx) => {
  if (!/^\d+$/.test(ctx.params.id)) {
    ctx.throw(400, 'Invalid ID format');
  }

  ctx.body = { id: parseInt(ctx.params.id, 10) };
});
```

**Option 2: Middleware**

```javascript
function validateUUID(paramName) {
  const uuidRegex =
    /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

  return async (ctx, next) => {
    if (!uuidRegex.test(ctx.params[paramName])) {
      ctx.throw(400, `Invalid ${paramName} format`);
    }
    await next();
  };
}

router.get('/user/:id', validateUUID('id'), handler);
```

**Option 3: router.param()**

```javascript
router.param('id', (value, ctx, next) => {
  if (!/^\d+$/.test(value)) {
    ctx.throw(400, 'Invalid ID');
  }
  ctx.params.id = parseInt(value, 10); // Convert to number
  return next();
});

router.get('/user/:id', handler);
router.get('/post/:id', handler);
// Both routes validate :id parameter
```

### Catch-All Routes

Create a catch-all route that only runs when no other routes match:

```javascript
router.get('/users', handler1);
router.get('/posts', handler2);

// Catch-all for unmatched routes
router.all('{/*rest}', (ctx) => {
  if (!ctx.matched || ctx.matched.length === 0) {
    ctx.status = 404;
    ctx.body = { error: 'Not Found' };
  }
});
```

### Array of Paths

Register multiple paths with the same middleware:

```javascript
router.get(['/users', '/people'], handler);
// Responds to both /users and /people
```

### 404 Handling

Implement custom 404 handling:

```javascript
app.use(router.routes());

// 404 middleware - runs after router
app.use((ctx) => {
  if (!ctx.matched || ctx.matched.length === 0) {
    ctx.status = 404;
    ctx.body = {
      error: 'Not Found',
      path: ctx.path
    };
  }
});
```

## Best Practices

### 1. Use Middleware Composition

```javascript
// ✅ Good: Compose reusable middleware
const requireAuth = () => async (ctx, next) => {
  if (!ctx.state.user) ctx.throw(401);
  await next();
};

const requireAdmin = () => async (ctx, next) => {
  if (!ctx.state.user.isAdmin) ctx.throw(403);
  await next();
};

router.get('/admin', requireAuth(), requireAdmin(), adminHandler);
```

### 2. Organize Routes by Resource

```javascript
// ✅ Good: Group related routes
const usersRouter = new Router({ prefix: '/users' });
usersRouter.get('/', listUsers);
usersRouter.post('/', createUser);
usersRouter.get('/:id', getUser);
usersRouter.put('/:id', updateUser);
usersRouter.delete('/:id', deleteUser);

app.use(usersRouter.routes());
```

### 3. Use Named Routes

```javascript
// ✅ Good: Name important routes
router.get('home', '/', homeHandler);
router.get('user-profile', '/users/:id', profileHandler);

// Easy to generate URLs
ctx.redirect(ctx.router.url('home'));
ctx.redirect(ctx.router.url('user-profile', ctx.state.user.id));
```

### 4. Validate Early

```javascript
// ✅ Good: Validate at the route level
router
  .param('id', validateId)
  .get('/users/:id', getUser)
  .put('/users/:id', updateUser)
  .delete('/users/:id', deleteUser);
// Validation runs once for all routes
```

### 5. Handle Errors Consistently

```javascript
// ✅ Good: Centralized error handling
app.use(async (ctx, next) => {
  try {
    await next();
  } catch (err) {
    ctx.status = err.status || 500;
    ctx.body = {
      error: err.message,
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    };
  }
});

app.use(router.routes());
app.use(router.allowedMethods({ throw: true }));
```

### 6. Access Router Context Properties

The router adds useful properties to the Koa context:

```typescript
router.get('/users/:id', (ctx: RouterContext) => {
  // URL parameters (fully typed)
  const id = ctx.params.id; // string

  // Router instance
  const router = ctx.router;

  // Matched route path
  const routePath = ctx.routerPath; // => '/users/:id'

  // Matched route name (if named)
  const routeName = ctx.routerName; // => 'user' (if named)

  // All matched layers
  const matched = ctx.matched; // Array of Layer objects

  // Captured values from RegExp routes
  const captures = ctx.captures; // string[] | undefined

  // Generate URLs
  const url = ctx.router.url('user', id);

  ctx.body = { id, routePath, routeName, url };
});
```

### 7. Type-Safe Context Extensions

Extend the router context with custom properties:

```typescript
import Router, { RouterContext } from '@koa/router';
import type { Next } from 'koa';

interface UserState {
  user?: { id: string; email: string };
}

interface CustomContext {
  requestId: string;
  startTime: number;
}

const router = new Router<UserState, CustomContext>();

// Middleware that adds to context
router.use(async (ctx: RouterContext<UserState, CustomContext>, next: Next) => {
  ctx.requestId = crypto.randomUUID();
  ctx.startTime = Date.now();
  await next();
});

router.get(
  '/users/:id',
  async (ctx: RouterContext<UserState, CustomContext>) => {
    // All properties are fully typed
    ctx.body = {
      user: ctx.state.user,
      requestId: ctx.requestId,
      duration: Date.now() - ctx.startTime
    };
  }
);
```

## Recipes

Common patterns and recipes for building real-world applications with @koa/router.

See the [recipes directory](./recipes/) for complete TypeScript examples:

- **[Nested Routes](./recipes/nested-routes/)** - Production-ready nested router patterns with multiple levels (3-4 levels deep), parameter propagation, and real-world examples
- **[RESTful API Structure](./recipes/restful-api-structure/)** - Organize your API with nested routers
- **[Authentication & Authorization](./recipes/authentication-authorization/)** - JWT-based authentication with middleware
- **[Request Validation](./recipes/request-validation/)** - Validate request data with middleware
- **[Parameter Validation](./recipes/parameter-validation/)** - Validate and transform parameters using router.param()
- **[API Versioning](./recipes/api-versioning/)** - Implement API versioning with multiple routers
- **[Error Handling](./recipes/error-handling/)** - Centralized error handling with custom error classes
- **[Pagination](./recipes/pagination/)** - Implement pagination for list endpoints
- **[Health Checks](./recipes/health-checks/)** - Add health check endpoints for monitoring
- **[TypeScript Recipe](./recipes/typescript-recipe/)** - Full TypeScript example with types and type safety

Each recipe file contains complete, runnable TypeScript code that you can copy and adapt to your needs.

## Performance

@koa/router is designed for high performance:

- **Fast path matching** with path-to-regexp v8
- **Efficient RegExp compilation** and caching
- **Minimal overhead** - zero runtime type checking
- **Optimized middleware execution** with koa-compose

**Benchmarks:**

```bash
# Run benchmarks
yarn benchmark

# Run all benchmark scenarios
yarn benchmark:all
```

## Testing

@koa/router uses Node.js native test runner:

```bash
# Run all tests (core + recipes)
yarn test:all

# Run core tests only
yarn test:core

# Run recipe tests only
yarn test:recipes

# Run tests with coverage
yarn test:coverage

# Type check
yarn ts:check

# Format code with Prettier
yarn format

# Check code formatting
yarn format:check

# Lint code
yarn lint
```

**Example test:**

```javascript
import { describe, it } from 'node:test';
import assert from 'node:assert';
import Koa from 'koa';
import Router from '@koa/router';
import request from 'supertest';

describe('Router', () => {
  it('should route GET requests', async () => {
    const app = new Koa();
    const router = new Router();

    router.get('/users', (ctx) => {
      ctx.body = { users: [] };
    });

    app.use(router.routes());

    const res = await request(app.callback()).get('/users').expect(200);

    assert.deepStrictEqual(res.body, { users: [] });
  });
});
```

## Migration Guides

For detailed migration information, see **[FULL_MIGRATION_TO_V15+.md](./FULL_MIGRATION_TO_V15+.md)**.

**Breaking Changes:**

- Custom regex patterns in parameters (`:param(regex)`) are **no longer supported** due to path-to-regexp v8. Use validation in handlers or middleware instead.
- Node.js >= 20 is required.
- TypeScript types are now included in the package (no need for `@types/@koa/router`).

**Upgrading:**

1. Update Node.js to >= 20
2. Replace custom regex parameters with validation middleware
3. Remove `@types/@koa/router` if installed (types are now included)
4. Update any code using deprecated features

**Backward Compatibility:**

The code is mostly backward compatible. If you notice any issues when upgrading, please don't hesitate to [open an issue](https://github.com/koajs/router/issues) and let us know!

## Contributing

Contributions are welcome!

### Development Setup

```bash
# Clone repository
git clone https://github.com/koajs/router.git
cd router

# Install dependencies (using yarn)
yarn install

# Run tests
yarn test:all

# Run tests with coverage
yarn test:coverage

# Format code
yarn format

# Check formatting
yarn format:check

# Lint code
yarn lint

# Build TypeScript
yarn build

# Type check
yarn ts:check
```

## Contributors

| Name             |
| ---------------- |
| **Alex Mingoia** |
| **@koajs**       |
| **Imed Jaberi**  |

## License

[MIT](LICENSE) © Koa.js

---

[forward-email]: https://forwardemail.net
[lad]: https://lad.js.org
[npm]: https://www.npmjs.com
