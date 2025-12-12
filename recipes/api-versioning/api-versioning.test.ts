/**
 * Tests for API Versioning Recipe
 */

import { describe, it } from 'node:test';
import * as assert from 'node:assert';
import * as http from 'node:http';
import Router, { RouterContext } from '../router-module-loader';
import request from 'supertest';
import Koa from 'koa';

describe('API Versioning', () => {
  it('should support multiple API versions', async () => {
    const app = new Koa();

    const getUsersV1 = async (ctx: RouterContext) => {
      ctx.body = { users: [{ id: 1 }], version: 'v1' };
    };

    const getUserV1 = async (ctx: RouterContext) => {
      ctx.body = { user: { id: ctx.params.id }, version: 'v1' };
    };

    const getUsersV2 = async (ctx: RouterContext) => {
      ctx.body = {
        users: [{ id: 1 }],
        version: 'v2',
        metadata: { count: 1, timestamp: new Date().toISOString() }
      };
    };

    const getUserV2 = async (ctx: RouterContext) => {
      ctx.body = {
        user: { id: ctx.params.id },
        version: 'v2',
        links: { self: `/api/v2/users/${ctx.params.id}` }
      };
    };

    const v1Router = new Router({ prefix: '/v1' });
    v1Router.get('/users', getUsersV1);
    v1Router.get('/users/:id', getUserV1);

    const v2Router = new Router({ prefix: '/v2' });
    v2Router.get('/users', getUsersV2);
    v2Router.get('/users/:id', getUserV2);

    const apiRouter = new Router({ prefix: '/api' });
    apiRouter.use(v1Router.routes(), v1Router.allowedMethods());
    apiRouter.use(v2Router.routes(), v2Router.allowedMethods());

    app.use(apiRouter.routes());
    app.use(apiRouter.allowedMethods());

    const res1 = await request(http.createServer(app.callback()))
      .get('/api/v1/users')
      .expect(200);

    assert.strictEqual(res1.body.version, 'v1');
    assert.strictEqual(Array.isArray(res1.body.users), true);

    const res2 = await request(http.createServer(app.callback()))
      .get('/api/v1/users/123')
      .expect(200);

    assert.strictEqual(res2.body.version, 'v1');
    assert.strictEqual(res2.body.user.id, '123');

    const res3 = await request(http.createServer(app.callback()))
      .get('/api/v2/users')
      .expect(200);

    assert.strictEqual(res3.body.version, 'v2');
    assert.strictEqual(res3.body.metadata.count, 1);

    const res4 = await request(http.createServer(app.callback()))
      .get('/api/v2/users/456')
      .expect(200);

    assert.strictEqual(res4.body.version, 'v2');
    assert.strictEqual(res4.body.links.self, '/api/v2/users/456');
  });
});
