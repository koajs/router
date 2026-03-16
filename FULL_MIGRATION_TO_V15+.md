## Migration Guide: Upgrading from @koa/router v10 to v15

This document describes how to migrate existing applications from **@koa/router v10.x** (classic JavaScript version) to the **next major release (v15)**, which corresponds to the current TypeScript + `path-to-regexp` v8 code in this repository.

The guide is written so you can either:

- **Jump directly from v10 → v15**, or
- **Apply the changes incrementally**, following the sections in order.

---

## Contents

- [1. Overview](#1-overview)
- [2. Quick Checklist](#2-quick-checklist)
- [3. Runtime & Tooling Changes](#3-runtime--tooling-changes)
- [4. Path Matching Changes (path-to-regexp v8)](#4-path-matching-changes-path-to-regexp-v8)
  - [4.1. Custom regex parameters (`:param(regex)`) removed](#41-custom-regex-parameters-paramregex-removed)
  - [4.2. `strict` vs `trailing` behavior](#42-strict-vs-trailing-behavior)
  - [4.3. Rest-style routes and `pathAsRegExp` options](#43-rest-style-routes-and-pathasregexp-options)
  - [4.4. Middleware path boundary matching (fixed)](#44-middleware-path-boundary-matching-fixed)
- [5. TypeScript & Types Changes](#5-typescript--types-changes)
  - [5.1. Built-in types, no `@types/@koa/router`](#51-built-in-types-no-typeskoarouter)
  - [5.2. New/updated exported types](#52-newupdated-exported-types)
  - [5.3. Full type inference (no explicit types needed)](#53-full-type-inference-no-explicit-types-needed)
- [6. Behavioral Changes and Best Practices](#6-behavioral-changes-and-best-practices)
  - [6.1. Parameter validation (replacement for `:param(regex)`)](#61-parameter-validation-replacement-for-paramregex)
  - [6.2. Nested routers and prefixes](#62-nested-routers-and-prefixes)
  - [6.3. New features in v15 (non-breaking additions)](#63-new-features-in-v15-non-breaking-additions)
- [7. Migration Recipes](#7-migration-recipes)
  - [7.1. Minimal "just works" upgrade](#71-minimal-just-works-upgrade)
  - [7.2. Strictly typed TypeScript upgrade](#72-strictly-typed-typescript-upgrade)
- [8. Troubleshooting](#8-troubleshooting)

---

## 1. Overview

The jump from **v10 → v15** is primarily about:

- **Runtime + tooling:**
  - Requires **Node.js ≥ 20** (see `package.json` `engines` field).
  - The codebase is now written in **TypeScript**, with a modern build pipeline.

- **Routing internals:**
  - Switched to **`path-to-regexp` v8** for path matching.
  - Some legacy patterns (especially custom regex in params) are **no longer supported**.

- **Types:**
  - **TypeScript types are built-in**; you should **not** install `@types/@koa/router` anymore.
  - Types are more complete and closer to actual runtime behavior.

The public **Router API** (`new Router()`, `.get()`, `.post()`, `.use()`, `.routes()`, `.allowedMethods()`, `.param()`, `.url()`, etc.) is **largely compatible**, but there are important edge cases to handle.

---

## 2. Quick Checklist

**Required steps (most applications):**

- **Runtime / tooling**
  - **Update Node.js to ≥ 20.**
  - Remove any custom build hacks that depended on the old JS layout if you were importing internal files.

- **Routing changes**
  - **Stop using custom regex capture syntax in route params** (e.g. `'/user/:id(\\d+)'`).
  - Replace those with **validation in handlers or middleware**.
  - Review any usage of `strict`, trailing slashes, and raw RegExp paths.

- **Types / TypeScript**
  - **Remove `@types/@koa/router`** from dependencies/devDependencies.
  - Update TS imports to use the new exported types from `@koa/router`.
  - Fix any type errors around `RouterContext`, `RouterMiddleware`, and `LayerOptions`.

**Recommended steps:**

- Adopt the **recipes** in `recipes/**` (nested routes, API versioning, validation, error handling).
- Use new utilities and options in `LayerOptions` for more predictable routing.

---

## 3. Runtime & Tooling Changes

- **Node.js requirement**
  - New version requires **Node.js ≥ 20**:

    ```json
    // package.json
    "engines": {
      "node": ">= 20"
    }
    ```

  - If your app is on an older Node, upgrade first **before** bumping @koa/router.

- **Build / TypeScript**
  - The library is now built with **tsup** and authored in TypeScript.
  - Public entrypoints are still:
    - CommonJS: `dist/index.js`
    - ESM: `dist/index.mjs`
    - Types: `dist/index.d.ts`
  - For consumers, the migration is mostly transparent:
    - **CommonJS**:

      ```js
      const Router = require('@koa/router');
      ```

    - **ESM / TypeScript**:

      ```ts
      import Router from '@koa/router';
      ```

  - Avoid importing internal files (e.g. `@koa/router/lib/router`) – these were never public API and may have moved.

---

## 4. Path Matching Changes (path-to-regexp v8)

The new version uses **`path-to-regexp` v8** via a wrapper (`src/utils/path-to-regexp-wrapper.ts`). Several behaviors differ from older versions used in v10.

### 4.1. Custom regex parameters (`:param(regex)`) removed

- **Older versions (v10)**:
  - Allowed routes like:

    ```js
    router.get('/user/:id(\\d+)', handler);
    ```

- **New version (v15)**:
  - **Custom regex patterns in parameters are no longer supported.**
  - From the README:

    > **Note:** Custom regex patterns in parameters (`:param(regex)`) are **no longer supported** in v15+ due to path-to-regexp v8. Use validation in handlers or middleware instead.

  - **Helper available (since v15.2):** Use `createParameterValidationMiddleware(name, regexp)` to keep regex validation while moving it into middleware. The same helper can also be used inline on specific routes.

    ```js
    import Router, { createParameterValidationMiddleware } from '@koa/router';

    const validateUserId = createParameterValidationMiddleware(
      'id',
      /^[0-9]+$/
    );

    router.param('id', validateUserId).get('/user/:id', (ctx) => {
      ctx.body = { id: Number(ctx.params.id) };
    });
    ```

    Inline per-route example (same helper):

    ```js
    import Router, { createParameterValidationMiddleware } from '@koa/router';

    router.get(
      '/user/:id',
      createParameterValidationMiddleware('id', /^[0-9]+$/),
      (ctx) => {
        ctx.body = { id: Number(ctx.params.id) };
      }
    );
    ```

- **Migration strategy:**
  - **Before (v10):**

    ```js
    router.get('/user/:id(\\d+)', (ctx) => {
      // id is guaranteed to be numeric
      ctx.body = { id: Number(ctx.params.id) };
    });
    ```

  - **After (v15) – validate inside handler:**

    ```js
    const numericId = /^[0-9]+$/;

    router.get('/user/:id', (ctx) => {
      if (!numericId.test(ctx.params.id)) {
        ctx.status = 400;
        ctx.body = { error: 'Invalid id' };
        return;
      }

      ctx.body = { id: Number(ctx.params.id) };
    });
    ```

  - **After (v15) – validate via middleware:**

    ```js
    function validateNumericId(paramName) {
      const numericId = /^[0-9]+$/;

      return async (ctx, next) => {
        if (!numericId.test(ctx.params[paramName])) {
          ctx.status = 400;
          ctx.body = { error: `Invalid ${paramName}` };
          return;
        }
        await next();
      };
    }

    router.get('/user/:id', validateNumericId('id'), (ctx) => {
      ctx.body = { id: Number(ctx.params.id) };
    });
    ```

- The tests in `test/router.test.ts` show this **“v15 approach”** for UUID validation, which is a good reference.

### 4.2. `strict` vs `trailing` behavior

- `path-to-regexp` v8 changed how trailing slashes are controlled. Internally, the router normalizes your options:
  - `LayerOptions` includes:

    ```ts
    type LayerOptions = {
      sensitive?: boolean;
      strict?: boolean;
      trailing?: boolean;
      end?: boolean;
      prefix?: string;
      ignoreCaptures?: boolean;
      pathAsRegExp?: boolean;
    };
    ```

  - `normalizeLayerOptionsToPathToRegexp()` converts `strict` and `trailing` into the shape expected by v8.

- **Impact:**
  - If you previously relied on very specific behavior of trailing slashes, verify your routes with tests.
  - Where possible, **write tests that cover both with and without trailing slash** for important routes.

### 4.3. Rest-style routes and `pathAsRegExp` options

- The router introduces helper utilities:
  - `hasPathParameters(path, options)`
  - `determineMiddlewarePath(explicitPath, hasPrefixParameters)`

- `LayerOptions` gains:
  - `ignoreCaptures` – ignore regexp captures for middleware-only routes.
  - `pathAsRegExp` – treat the path literally as a regular expression.

- Some internal patterns (like `'{/*rest}'` or raw `RegExp` paths) are handled more explicitly when dealing with prefixes or middleware.

**Migration tip:**

- If you manually created routes with raw regexes, or rely on special middleware paths, test them carefully after upgrade.
- Prefer **string paths with parameters** where possible; use middleware for validation and complex patterns.

### 4.4. Middleware path boundary matching (fixed)

**Important fix:** Middleware scoped to a specific path now correctly respects path boundaries.

- **Previously (buggy behavior):** Middleware on `/accounts` might incorrectly run for `/users/:userId/accounts`
- **Now (correct behavior):** Middleware on `/accounts` only runs for paths starting with `/accounts`

**Example:**

```javascript
const accountsRouter = new Router({ prefix: '/accounts' });
accountsRouter.use(async (ctx, next) => {
  ctx.state.isAccount = true; // Only runs for /accounts/*
  return next();
});

const usersRouter = new Router({ prefix: '/users' });
usersRouter.get('/:userId/accounts', async (ctx) => {
  // ctx.state.isAccount is correctly undefined
  // The /accounts middleware does NOT run here
});
```

**Migration tip:** If you were accidentally relying on the incorrect behavior, you'll need to explicitly add the middleware to the routes where you want it to run.

---

## 5. TypeScript & Types Changes

### 5.1. Built-in types, no `@types/@koa/router`

- Types are now shipped with the package:
  - `types`: `./dist/index.d.ts` in `package.json`.

- **Remove** `@types/@koa/router` from your project:

  ```bash
  npm uninstall @types/@koa/router
  # or
  yarn remove @types/@koa/router
  ```

- Import types directly from `@koa/router`:

  ```ts
  import Router, { RouterContext, RouterMiddleware } from '@koa/router';
  ```

### 5.2. New/updated exported types

Key types live in `src/types.ts` and are exported from the main entry:

- **RouterOptions**

  ```ts
  type RouterOptions = {
    exclusive?: boolean | 'first' | 'last';
    prefix?: string;
    host?: string | string[] | RegExp;
    methods?: string[];
    routerPath?: string;
    sensitive?: boolean;
    strict?: boolean;
  };
  ```

- **LayerOptions** (used by individual routes)

  ```ts
  type LayerOptions = {
    name?: string | null;
    sensitive?: boolean;
    strict?: boolean;
    trailing?: boolean;
    end?: boolean;
    prefix?: string;
    ignoreCaptures?: boolean;
    pathAsRegExp?: boolean;
  };
  ```

- **RouterContext** – extended Koa context including router-specific fields.

  ```ts
  export type RouterContext<
    StateT = DefaultState,
    ContextT = DefaultContext,
    BodyT = unknown
  > = ParameterizedContext<
    StateT,
    ContextT & RouterParameterContext<StateT, ContextT>,
    BodyT
  > & {
    params: Record<string, string>; // Always defined in route handlers
    request: { params: Record<string, string> }; // Always defined in route handlers
    routerPath?: string;
    routerName?: string;
    matched?: Layer[];
    routeMatched?: boolean; // NEW: true if any route (with HTTP methods) matched
    captures?: string[];
    newRouterPath?: string;
    router: Router<StateT, ContextT>;
  };
  ```

- **RouterMiddleware**, **RouterParameterMiddleware**, **HttpMethod** etc. are also exported.

- **RouterEvent**, **RouterEventSelector** (new) — types for the experimental event system.

- **RouterEvents** (new) — named constants for router lifecycle events (e.g. `RouterEvents.NotFound`).

**Migration tips:**

- Replace older custom type definitions with the exported ones:

  ```ts
  // Before (v10, with DefinitelyTyped)
  import Router from '@koa/router';
  import { RouterContext } from '@types/koa__router';

  // After (v15)
  import Router, { RouterContext } from '@koa/router';
  ```

- If you had your own `ContextWithRouter` types, you can usually replace them with the provided `RouterContext` or extend it.

### 5.3. Full type inference (no explicit types needed)

The router now provides **full type inference** out of the box. You no longer need to explicitly type `ctx` and `next` in most cases:

**Before (manual types required):**

```typescript
import Router, { RouterContext } from '@koa/router';
import type { Next } from 'koa';

router.get('/users/:id', (ctx: RouterContext, next: Next) => {
  ctx.params.id; // Required explicit type for ctx
  return next();
});
```

**After (types are inferred):**

```typescript
import Router from '@koa/router';

router.get('/users/:id', (ctx, next) => {
  ctx.params.id;        // ✅ Inferred as string
  ctx.request.params;   // ✅ Inferred as Record<string, string>
  ctx.body = { ... };   // ✅ Works
  return next();        // ✅ Works
});

// Also works for router.use()
router.use((ctx, next) => {
  ctx.state.foo = 'bar';  // ✅ Works
  return next();          // ✅ Works
});
```

**Key improvements:**

| Feature                            | Before                      | After             |
| ---------------------------------- | --------------------------- | ----------------- |
| `ctx` in `.get()`, `.post()`, etc. | Manual type required        | ✅ Inferred       |
| `next` parameter                   | Manual type required        | ✅ Inferred       |
| `ctx.params`                       | Optional (`ctx.params?.id`) | ✅ Always defined |
| `ctx.request.params`               | Required `!` assertion      | ✅ Always defined |
| `router.use()` middleware          | Manual types required       | ✅ Inferred       |

**Custom HTTP methods with inference:**

```typescript
const router = new Router({
  methods: ['GET', 'POST', 'PURGE'] as const
});

// The purge method is automatically typed!
router.purge('/cache/:key', (ctx) => {
  ctx.body = { key: ctx.params.key };
});
```

---

## 6. Behavioral Changes and Best Practices

### 6.1. Parameter validation (replacement for `:param(regex)`)

- As shown in tests around **“v15 approach for custom regex”**, validation is now expected to be done:
  - **Inside handlers**, or
  - Via **middleware** using `router.param()` or regular middleware functions.

- Example using middleware:

  ```ts
  function validateUUID(paramName: string) {
    const uuidRegex =
      /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

    return async (ctx: RouterContext, next: () => Promise<unknown>) => {
      if (!uuidRegex.test(ctx.params[paramName])) {
        ctx.status = 400;
        ctx.body = { error: `Invalid ${paramName} format` };
        return;
      }
      await next();
    };
  }

  router.get('/role/:id', validateUUID('id'), (ctx) => {
    ctx.body = { id: ctx.params.id, valid: true };
  });
  ```

### 6.2. Nested routers and prefixes

- The new codebase includes **recipes for nested routers and API versioning** under `recipes/**`.
- `Layer` logic around `setPrefix()` and `_reconfigurePathMatching()` is more explicit about:
  - Prefixes that contain parameters (`/users/:userId`).
  - Raw regexp routes (`pathAsRegExp === true`).
  - Special “rest” patterns like `'{/*rest}'`.

**Migration tip:**

- If you used nested routers heavily in v10, compare against the **`recipes/nested-routes`** implementation and tests.
- It’s a good template for **production-grade nested routing** with the new behavior.

---

## 6.3. New features in v15 (non-breaking additions)

These features are purely additive — they don't break any existing behavior.

### `ctx.routeMatched`

A new `boolean` property on `RouterContext` (and the Koa context while the router is active). It is set by the router **before any route handlers run** and indicates whether a route with HTTP methods matched the current request.

- `true` — at least one route matched path + method.
- `false` — no route matched (the request fell through).
- `undefined` — the request never entered the router (host mismatch, etc.).

Use it in **app-level middleware after `router.routes()`** to detect unmatched requests:

```ts
app.use(router.routes());
app.use(router.allowedMethods());

app.use((ctx) => {
  if (!ctx.routeMatched) {
    ctx.status = 404;
    ctx.body = { error: 'Not Found', path: ctx.path };
  }
});
```

> **Note:** Do not check `ctx.routeMatched` inside a catch-all route handler
> (`router.all('{/*rest}', handler)`). Since the catch-all is itself a route, it always
> sets `ctx.routeMatched = true`. Use app-level middleware or `router.on()` instead.

### `router.on()` — experimental event system

Register handlers that run when specific router lifecycle events occur.
Currently the only active event is `not-found`, which fires when no route matched.

```ts
import Router, { RouterEvents } from '@koa/router';

const router = new Router();

router.get('/users', handler);

// Runs only when no route matched (instead of falling through to next())
router.on(RouterEvents.NotFound, (ctx) => {
  ctx.status = 404;
  ctx.body = { error: 'Not Found', path: ctx.path };
});

app.use(router.routes());
```

All three call forms are equivalent:

```ts
router.on(RouterEvents.NotFound, handler); // named constant (recommended)
router.on((events) => events.NotFound, handler); // selector function
router.on('not-found', handler); // raw string
```

Multiple handlers for the same event are composed in registration order (koa-compose
onion model) — the same way route middleware stacks work.

> **Experimental:** This API may change in future minor versions.

### New exports

| Export                | Kind    | Description                                                             |
| --------------------- | ------- | ----------------------------------------------------------------------- |
| `RouterEvents`        | `const` | Named constants for active lifecycle events (`NotFound: 'not-found'`)   |
| `RouterEvent`         | `type`  | Union of valid event name strings (derived from `RouterEvents`)         |
| `RouterEventSelector` | `type`  | `RouterEvent` string or selector function `(events) => events.NotFound` |

Import them from `@koa/router`:

```ts
import { RouterEvents } from '@koa/router';
import type { RouterEvent, RouterEventSelector } from '@koa/router';
```

---

## 7. Migration Recipes

### 7.1. Minimal “just works” upgrade

**Goal:** Upgrade to v15 with minimal code changes, focusing on correctness.

1. **Upgrade runtime & dependency:**
   - Ensure **Node ≥ 20**.
   - Bump `@koa/router` to the new major (v15).

2. **Remove custom regex parameters:**
   - Search for patterns like `':id('`, `':slug('`, etc.
   - Replace:

     ```js
     router.get('/user/:id(\\d+)', handler);
     ```

     with:

     ```js
     router.get('/user/:id', handlerWithValidation);
     ```

3. **Remove `@types/@koa/router` (if present).**

4. **Run your test suite** and fix any failures related to:
   - Trailing slashes,
   - Nested routers,
   - Raw regex routes.

5. For any subtle routing differences, **compare against the new tests and recipes in this repo**.

### 7.2. Strictly typed TypeScript upgrade

**Goal:** Take advantage of first-class TypeScript support.

1. Update imports:

   ```ts
   import Router, {
     RouterContext,
     RouterMiddleware,
     LayerOptions,
     RouterOptions
   } from '@koa/router';
   ```

2. Type your Koa app and context:

   ```ts
   interface State {
     user?: { id: string };
   }

   interface CustomContext {
     requestId: string;
   }

   type AppContext = RouterContext<State, CustomContext>;

   const router = new Router<State, CustomContext>();
   ```

3. Replace any custom context typings with `RouterContext` (or interfaces based on it).

4. Fix new type errors:
   - These often reveal **actual runtime assumptions** that weren’t enforced before.

---

## 8. Troubleshooting

- **“Route no longer matches with custom regex in parameter”**
  - Confirm you’re no longer using `:param(regex)` style definitions.
  - Move regex into validation middleware or handlers.

- **“Trailing slash routes behave differently”**
  - Check `strict` / `trailing` usage in your `RouterOptions` or route-level `LayerOptions`.
  - Add explicit tests for `/path` vs `/path/`.

- **“TypeScript now reports type errors for router context”**
  - Update imports to use the new exported types.
  - Make sure you’re not mixing types from `@types/@koa/router` with the new ones.

- **“Something that worked in v10 is now broken but not covered here”**
  - The new version aims to be mostly backward compatible aside from the documented breaking changes.
  - If you hit a case that looks like a regression or undocumented breaking change, **open an issue** on the GitHub repo with a minimal reproduction.

---

By following this guide, you should be able to migrate from **@koa/router v10.x** to **@koa/router v15.x** in a controlled, testable manner.
