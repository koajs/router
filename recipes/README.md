# Recipes

Common patterns and recipes for building real-world applications with @koa/router.

## Available Recipes

- **[Nested Routes](./nested-routes/)** - Production-ready nested router patterns with multiple levels, parameter propagation, and real-world examples
- **[RESTful API Structure](./restful-api-structure/)** - Organize your API with nested routers for clean separation
- **[Authentication & Authorization](./authentication-authorization/)** - Implement JWT-based authentication with middleware
- **[Request Validation](./request-validation/)** - Validate request data with middleware
- **[Parameter Validation](./parameter-validation/)** - Validate and transform parameters using router.param()
- **[API Versioning](./api-versioning/)** - Implement API versioning with multiple routers
- **[Error Handling](./error-handling/)** - Centralized error handling with custom error classes
- **[Pagination](./pagination/)** - Implement pagination for list endpoints
- **[Health Checks](./health-checks/)** - Add health check endpoints for monitoring
- **[TypeScript Recipe](./typescript-recipe/)** - Full TypeScript example with types and type safety

Each recipe folder contains:

- `[recipe-name].ts` - The recipe implementation
- `[recipe-name].test.ts` - Comprehensive tests for the recipe

## Usage

Each recipe file contains complete, runnable TypeScript code examples. You can:

1. Copy the code from any recipe file
2. Adapt it to your specific needs
3. Import and use the patterns in your application

## Testing

Each recipe includes comprehensive tests alongside the recipe file. Run the tests to see how each pattern works:

```bash
# Run all recipe tests
npm test -- recipes

# Run a specific recipe test
npm test -- recipes/authentication-authorization/authentication-authorization.test.ts
```

The tests demonstrate:

- How to use each recipe pattern
- Expected behavior and responses
- Error handling scenarios
- Integration with Koa applications

## Examples

### Using a Recipe

```typescript
import {
  authenticate,
  requireRole
} from './recipes/authentication-authorization/authentication-authorization';

router.get('/admin', authenticate, requireRole('admin'), adminHandler);
```

### Combining Recipes

```typescript
import { paginate } from './recipes/pagination/pagination';
import { validate } from './recipes/request-validation/request-validation';
import { createUserSchema } from './schemas';

router.get('/users', paginate, getUsers);
router.post('/users', validate(createUserSchema), createUser);
```

## Contributing

If you have a useful recipe pattern, feel free to add it to this directory!
