# Recipes

Common patterns and recipes for building real-world applications with @koa/router.

## Available Recipes

| Recipe                                                                | Description                                                                       |
| --------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| **[TypeScript Recipe](./typescript-recipe/)**                         | Full TypeScript example showcasing **type inference** - no explicit types needed! |
| **[Nested Routes](./nested-routes/)**                                 | Production-ready nested router patterns with multiple levels (3+ deep)            |
| **[RESTful API Structure](./restful-api-structure/)**                 | Organize your API with nested routers for clean separation                        |
| **[Authentication & Authorization](./authentication-authorization/)** | JWT-based authentication with role-based access control                           |
| **[Request Validation](./request-validation/)**                       | Validate request data with Joi middleware                                         |
| **[Parameter Validation](./parameter-validation/)**                   | Validate and transform URL parameters using `router.param()`                      |
| **[API Versioning](./api-versioning/)**                               | Implement API versioning with multiple routers                                    |
| **[Error Handling](./error-handling/)**                               | Centralized error handling with custom error classes                              |
| **[Pagination](./pagination/)**                                       | Pagination middleware with configurable limits and metadata                       |
| **[Health Checks](./health-checks/)**                                 | Health check, readiness, and liveness probe endpoints                             |

## Key Features Demonstrated

### Type Inference (New!)

The router now provides **automatic type inference** - no explicit type annotations needed:

```typescript
import Router from '@koa/router';

const router = new Router();

// ✅ ctx and next are automatically inferred!
router.get('/users/:id', async (ctx, next) => {
  ctx.params.id;        // ✅ Inferred as string
  ctx.request.params;   // ✅ Inferred as Record<string, string>
  ctx.body = { ... };   // ✅ Works
  return next();        // ✅ Works
});

// ✅ Also works for router.use()
router.use(async (ctx, next) => {
  ctx.state.startTime = Date.now();
  return next();
});
```

See the [TypeScript Recipe](./typescript-recipe/) for complete examples.

## Recipe Structure

Each recipe folder contains:

- `[recipe-name].ts` - The recipe implementation with full documentation
- `[recipe-name].test.ts` - Comprehensive tests demonstrating usage

## Running Tests

```bash
# Run all recipe tests
yarn test:recipes

# Run a specific recipe test
yarn test:recipes -- --test-name-pattern="Authentication"
```

## Usage Examples

### Authentication & Authorization

```typescript
import {
  authenticate,
  requireRole,
  requireAnyRole
} from './recipes/authentication-authorization';

// Require authentication only
router.get('/profile', authenticate, getProfile);

// Require specific role
router.get('/admin', authenticate, requireRole('admin'), adminHandler);

// Require any of multiple roles
router.get(
  '/moderate',
  authenticate,
  requireAnyRole('admin', 'moderator'),
  modHandler
);
```

### Pagination

```typescript
import { paginate, buildPaginatedResponse } from './recipes/pagination';

// Use default pagination (10 items per page)
router.get('/users', paginate(), getUsers);

// Custom pagination limits
router.get('/posts', paginate({ defaultLimit: 20, maxLimit: 50 }), getPosts);
```

### Error Handling

```typescript
import {
  errorHandler,
  NotFoundError,
  ValidationError
} from './recipes/error-handling';

// Global error handler (add first)
app.use(errorHandler);

// Throw typed errors in routes
router.get('/users/:id', async (ctx) => {
  const user = await User.findById(ctx.params.id);
  if (!user) {
    throw new NotFoundError('User', ctx.params.id);
  }
  ctx.body = user;
});
```

### Combining Recipes

```typescript
import { authenticate } from './recipes/authentication-authorization';
import { paginate } from './recipes/pagination';
import { validate } from './recipes/request-validation';

router
  .get('/users', authenticate, paginate(), getUsers)
  .post('/users', authenticate, validate(createUserSchema), createUser);
```

## Contributing

If you have a useful recipe pattern, feel free to add it to this directory!
