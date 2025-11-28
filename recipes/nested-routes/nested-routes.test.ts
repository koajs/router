/**
 * Tests for Production-Ready Nested Routes Recipe
 *
 * Tests multiple levels of nesting, parameter propagation, and real-world scenarios.
 */

import { describe, it } from 'node:test';
import * as assert from 'node:assert';
import * as http from 'node:http';
import Koa from 'koa';
import Router from '../router-module-loader';
import request from 'supertest';

describe('Production-Ready Nested Routes', () => {
  it('should handle multiple levels of nested routes correctly', async () => {
    const app = new Koa();

    app.use(async (ctx, next) => {
      if (ctx.request.is('application/json')) {
        let body = '';
        for await (const chunk of ctx.req) {
          body += chunk;
        }
        try {
          (ctx.request as any).body = JSON.parse(body);
        } catch {
          (ctx.request as any).body = {};
        }
      }
      await next();
    });

    // ============================================================================
    // Level 1: API Version Router
    // ============================================================================
    const apiV1Router = new Router({ prefix: '/api/v1' });

    // ============================================================================
    // Level 2: Users Router
    // ============================================================================
    const usersRouter = new Router({ prefix: '/users' });

    usersRouter.get('/', async (ctx: any) => {
      ctx.body = { users: [{ id: '1', name: 'John' }] };
    });

    usersRouter.get('/:userId', async (ctx: any) => {
      ctx.body = { id: ctx.params.userId, name: 'John' };
    });

    // ============================================================================
    // Level 3: User Posts Router
    // ============================================================================
    const userPostsRouter = new Router({ prefix: '/:userId/posts' });

    userPostsRouter.get('/', async (ctx: any) => {
      ctx.body = {
        userId: ctx.params.userId,
        posts: [{ id: '1', title: 'Post 1' }]
      };
    });

    userPostsRouter.get('/:postId', async (ctx: any) => {
      ctx.body = {
        id: ctx.params.postId,
        userId: ctx.params.userId,
        title: 'Post Title'
      };
    });

    userPostsRouter.post('/', async (ctx: any) => {
      ctx.body = {
        id: '2',
        userId: ctx.params.userId,
        ...(ctx.request as any).body
      };
    });

    // ============================================================================
    // Level 4: Post Comments Router
    // ============================================================================
    const postCommentsRouter = new Router({ prefix: '/:postId/comments' });

    postCommentsRouter.get('/', async (ctx: any) => {
      ctx.body = {
        postId: ctx.params.postId,
        userId: ctx.params.userId,
        comments: [{ id: '1', text: 'Comment 1' }]
      };
    });

    postCommentsRouter.get('/:commentId', async (ctx: any) => {
      ctx.body = {
        id: ctx.params.commentId,
        postId: ctx.params.postId,
        userId: ctx.params.userId,
        text: 'Comment text'
      };
    });

    postCommentsRouter.post('/', async (ctx: any) => {
      ctx.body = {
        id: '2',
        postId: ctx.params.postId,
        userId: ctx.params.userId,
        ...(ctx.request as any).body
      };
    });

    // ============================================================================
    // Level 3: User Settings Router
    // ============================================================================
    const userSettingsRouter = new Router({ prefix: '/:userId/settings' });

    userSettingsRouter.get('/', async (ctx: any) => {
      ctx.body = {
        userId: ctx.params.userId,
        theme: 'dark'
      };
    });

    userSettingsRouter.put('/', async (ctx: any) => {
      ctx.body = {
        userId: ctx.params.userId,
        ...(ctx.request as any).body
      };
    });

    // ============================================================================
    // Mounting: Assemble nested structure
    // ============================================================================
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
    app.use(apiV1Router.routes());
    app.use(apiV1Router.allowedMethods());

    const server = http.createServer(app.callback());

    // Test Level 2: Users routes
    const res1 = await request(server).get('/api/v1/users').expect(200);
    assert.strictEqual(Array.isArray(res1.body.users), true);

    const res2 = await request(server).get('/api/v1/users/123').expect(200);
    assert.strictEqual(res2.body.id, '123');

    // Test Level 3: User Posts routes
    const res3 = await request(server)
      .get('/api/v1/users/123/posts')
      .expect(200);
    assert.strictEqual(res3.body.userId, '123');
    assert.strictEqual(Array.isArray(res3.body.posts), true);

    const res4 = await request(server)
      .get('/api/v1/users/123/posts/456')
      .expect(200);
    assert.strictEqual(res4.body.id, '456');
    assert.strictEqual(res4.body.userId, '123');

    const res5 = await request(server)
      .post('/api/v1/users/123/posts')
      .send({ title: 'New Post' })
      .expect(200);
    assert.strictEqual(res5.body.userId, '123');
    assert.strictEqual(res5.body.title, 'New Post');

    // Test Level 4: Post Comments routes (deeply nested)
    const res6 = await request(server)
      .get('/api/v1/users/123/posts/456/comments')
      .expect(200);
    assert.strictEqual(res6.body.userId, '123');
    assert.strictEqual(res6.body.postId, '456');
    assert.strictEqual(Array.isArray(res6.body.comments), true);

    const res7 = await request(server)
      .get('/api/v1/users/123/posts/456/comments/789')
      .expect(200);
    assert.strictEqual(res7.body.userId, '123');
    assert.strictEqual(res7.body.postId, '456');
    assert.strictEqual(res7.body.id, '789');

    const res8 = await request(server)
      .post('/api/v1/users/123/posts/456/comments')
      .send({ text: 'New Comment' })
      .expect(200);
    assert.strictEqual(res8.body.userId, '123');
    assert.strictEqual(res8.body.postId, '456');
    assert.strictEqual(res8.body.text, 'New Comment');

    // Test Level 3: User Settings routes
    const res9 = await request(server)
      .get('/api/v1/users/123/settings')
      .expect(200);
    assert.strictEqual(res9.body.userId, '123');

    const res10 = await request(server)
      .put('/api/v1/users/123/settings')
      .send({ theme: 'light' })
      .expect(200);
    assert.strictEqual(res10.body.userId, '123');
    assert.strictEqual(res10.body.theme, 'light');
  });

  it('should propagate parameters correctly through nested routers', async () => {
    const app = new Koa();
    const apiRouter = new Router({ prefix: '/api' });
    const usersRouter = new Router({ prefix: '/users' });
    const postsRouter = new Router({ prefix: '/:userId/posts' });
    const commentsRouter = new Router({ prefix: '/:postId/comments' });

    commentsRouter.get('/:commentId', async (ctx: any) => {
      ctx.body = {
        userId: ctx.params.userId,
        postId: ctx.params.postId,
        commentId: ctx.params.commentId,
        allParams: ctx.params
      };
    });

    postsRouter.use(commentsRouter.routes(), commentsRouter.allowedMethods());
    usersRouter.use(postsRouter.routes(), postsRouter.allowedMethods());
    apiRouter.use(usersRouter.routes(), usersRouter.allowedMethods());
    app.use(apiRouter.routes());
    app.use(apiRouter.allowedMethods());

    const server = http.createServer(app.callback());

    const res = await request(server)
      .get('/api/users/user123/posts/post456/comments/comment789')
      .expect(200);

    assert.strictEqual(res.body.userId, 'user123');
    assert.strictEqual(res.body.postId, 'post456');
    assert.strictEqual(res.body.commentId, 'comment789');
    assert.deepStrictEqual(res.body.allParams, {
      userId: 'user123',
      postId: 'post456',
      commentId: 'comment789'
    });
  });

  it('should handle multiple nested resources at the same level', async () => {
    const app = new Koa();
    const apiRouter = new Router({ prefix: '/api' });
    const usersRouter = new Router({ prefix: '/users' });

    const postsRouter = new Router({ prefix: '/:userId/posts' });
    const settingsRouter = new Router({ prefix: '/:userId/settings' });
    const followersRouter = new Router({ prefix: '/:userId/followers' });

    postsRouter.get('/', async (ctx: any) => {
      ctx.body = { userId: ctx.params.userId, resource: 'posts' };
    });

    settingsRouter.get('/', async (ctx: any) => {
      ctx.body = { userId: ctx.params.userId, resource: 'settings' };
    });

    followersRouter.get('/', async (ctx: any) => {
      ctx.body = { userId: ctx.params.userId, resource: 'followers' };
    });

    usersRouter.use(postsRouter.routes(), postsRouter.allowedMethods());
    usersRouter.use(settingsRouter.routes(), settingsRouter.allowedMethods());
    usersRouter.use(followersRouter.routes(), followersRouter.allowedMethods());
    apiRouter.use(usersRouter.routes(), usersRouter.allowedMethods());
    app.use(apiRouter.routes());
    app.use(apiRouter.allowedMethods());

    const server = http.createServer(app.callback());

    const res1 = await request(server).get('/api/users/123/posts').expect(200);
    assert.strictEqual(res1.body.resource, 'posts');

    const res2 = await request(server)
      .get('/api/users/123/settings')
      .expect(200);
    assert.strictEqual(res2.body.resource, 'settings');

    const res3 = await request(server)
      .get('/api/users/123/followers')
      .expect(200);
    assert.strictEqual(res3.body.resource, 'followers');
  });

  it('should handle 405 Method Not Allowed correctly for nested routes', async () => {
    const app = new Koa();
    const apiRouter = new Router({ prefix: '/api' });
    const usersRouter = new Router({ prefix: '/users' });
    const postsRouter = new Router({ prefix: '/:userId/posts' });

    postsRouter.get('/:postId', async (ctx: any) => {
      ctx.body = { id: ctx.params.postId };
    });

    usersRouter.use(postsRouter.routes(), postsRouter.allowedMethods());
    apiRouter.use(usersRouter.routes(), usersRouter.allowedMethods());
    app.use(apiRouter.routes());
    app.use(apiRouter.allowedMethods());

    const server = http.createServer(app.callback());

    await request(server).get('/api/users/123/posts/456').expect(200);

    await request(server).post('/api/users/123/posts/456').expect(405);
  });
});
