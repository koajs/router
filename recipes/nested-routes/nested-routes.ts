/**
 * Production-Ready Nested Routes Recipe
 *
 * Demonstrates advanced nested router patterns used in production applications:
 * - Multiple levels of nesting (3+ levels deep)
 * - Parameter propagation through nested routers
 * - Middleware at different nesting levels
 * - Multiple resources organized hierarchically
 * - Type inference without explicit annotations
 *
 * This pattern is commonly used in:
 * - RESTful APIs with versioning
 * - Multi-tenant applications
 * - Resource hierarchies (e.g., /users/:userId/posts/:postId/comments)
 * - Admin panels with nested sections
 */

import Koa from 'koa';
import { bodyParser } from '@koa/bodyparser';
import Router from '../router-module-loader';

const app = new Koa();

// Add body parser middleware
app.use(bodyParser());

const apiV1Router = new Router({ prefix: '/api/v1' });

// ✅ Type inference - no explicit types needed
apiV1Router.use(async (ctx, next) => {
  console.log(`[API v1] ${ctx.method} ${ctx.path}`);
  ctx.state.apiVersion = 'v1';
  await next();
});

const usersRouter = new Router({ prefix: '/users' });

usersRouter.use(async (_ctx, next) => {
  console.log('[Users Router] Processing user request');
  await next();
});

usersRouter.get('/', async (ctx) => {
  ctx.body = {
    users: [
      { id: '1', name: 'John', email: 'john@example.com' },
      { id: '2', name: 'Jane', email: 'jane@example.com' }
    ]
  };
});

// POST with body - ctx.request.body typed by @koa/bodyparser
usersRouter.post('/', async (ctx) => {
  ctx.body = {
    id: '3',
    ...(ctx.request.body || {}),
    createdAt: new Date().toISOString()
  };
});

usersRouter.get('/:userId', async (ctx) => {
  ctx.body = {
    id: ctx.params.userId,
    name: 'John',
    email: 'john@example.com'
  };
});

usersRouter.put('/:userId', async (ctx) => {
  ctx.body = {
    id: ctx.params.userId,
    ...(ctx.request.body || {}),
    updatedAt: new Date().toISOString()
  };
});

usersRouter.delete('/:userId', async (ctx) => {
  ctx.status = 204;
});

const userPostsRouter = new Router({ prefix: '/:userId/posts' });

userPostsRouter.use(async (ctx, next) => {
  console.log(`[User Posts] Loading posts for user ${ctx.params.userId}`);
  ctx.state.userId = ctx.params.userId;
  await next();
});

userPostsRouter.get('/', async (ctx) => {
  ctx.body = {
    userId: ctx.params.userId,
    posts: [
      { id: '1', title: 'Post 1', userId: ctx.params.userId },
      { id: '2', title: 'Post 2', userId: ctx.params.userId }
    ]
  };
});

userPostsRouter.post('/', async (ctx) => {
  ctx.body = {
    id: '3',
    userId: ctx.params.userId,
    ...(ctx.request.body || {}),
    createdAt: new Date().toISOString()
  };
});

userPostsRouter.get('/:postId', async (ctx) => {
  ctx.body = {
    id: ctx.params.postId,
    userId: ctx.params.userId,
    title: 'Post Title',
    content: 'Post content...'
  };
});

userPostsRouter.put('/:postId', async (ctx) => {
  ctx.body = {
    id: ctx.params.postId,
    userId: ctx.params.userId,
    ...(ctx.request.body || {}),
    updatedAt: new Date().toISOString()
  };
});

userPostsRouter.delete('/:postId', async (ctx) => {
  ctx.status = 204;
});

const postCommentsRouter = new Router({ prefix: '/:postId/comments' });

postCommentsRouter.use(async (ctx, next) => {
  console.log(
    `[Comments] Loading comments for post ${ctx.params.postId} by user ${ctx.params.userId}`
  );
  ctx.state.postId = ctx.params.postId;
  await next();
});

postCommentsRouter.get('/', async (ctx) => {
  ctx.body = {
    postId: ctx.params.postId,
    userId: ctx.params.userId,
    comments: [
      { id: '1', text: 'Comment 1', postId: ctx.params.postId },
      { id: '2', text: 'Comment 2', postId: ctx.params.postId }
    ]
  };
});

postCommentsRouter.post('/', async (ctx) => {
  ctx.body = {
    id: '3',
    postId: ctx.params.postId,
    userId: ctx.params.userId,
    ...(ctx.request.body || {}),
    createdAt: new Date().toISOString()
  };
});

postCommentsRouter.get('/:commentId', async (ctx) => {
  ctx.body = {
    id: ctx.params.commentId,
    postId: ctx.params.postId,
    userId: ctx.params.userId,
    text: 'Comment text...'
  };
});

postCommentsRouter.delete('/:commentId', async (ctx) => {
  ctx.status = 204;
});

const userSettingsRouter = new Router({ prefix: '/:userId/settings' });

userSettingsRouter.get('/', async (ctx) => {
  ctx.body = {
    userId: ctx.params.userId,
    theme: 'dark',
    notifications: true
  };
});

userSettingsRouter.put('/', async (ctx) => {
  ctx.body = {
    userId: ctx.params.userId,
    ...(ctx.request.body || {}),
    updatedAt: new Date().toISOString()
  };
});

userPostsRouter.use(
  postCommentsRouter.routes(),
  postCommentsRouter.allowedMethods()
);

usersRouter.use(userPostsRouter.routes(), userPostsRouter.allowedMethods());
usersRouter.use(
  userSettingsRouter.routes(),
  userSettingsRouter.allowedMethods()
);

apiV1Router.use(usersRouter.routes(), usersRouter.allowedMethods());

const postsRouter = new Router({ prefix: '/posts' });

postsRouter.get('/', async (ctx) => {
  ctx.body = {
    posts: [
      { id: '1', title: 'Global Post 1' },
      { id: '2', title: 'Global Post 2' }
    ]
  };
});

postsRouter.get('/:postId', async (ctx) => {
  ctx.body = {
    id: ctx.params.postId,
    title: 'Global Post Title'
  };
});

apiV1Router.use(postsRouter.routes(), postsRouter.allowedMethods());

app.use(apiV1Router.routes());
app.use(apiV1Router.allowedMethods());

export default app;
