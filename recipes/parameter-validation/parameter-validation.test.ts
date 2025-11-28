/**
 * Tests for Parameter Validation Recipe
 */

import { describe, it } from 'node:test';
import * as assert from 'node:assert';
import * as http from 'node:http';
import Router, { RouterContext } from '../router-module-loader';
import request from 'supertest';
import Koa from 'koa';
import { Next } from '../common';

describe('Parameter Validation', () => {
  it('should validate UUID format with router.param()', async () => {
    const app = new Koa();
    const router = new Router();

    router.param('id', (value: string, ctx: RouterContext, next: Next) => {
      const uuidRegex =
        /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

      if (!uuidRegex.test(value)) {
        ctx.throw(400, 'Invalid ID format');
      }

      return next();
    });

    router.get('/users/:id', (ctx: RouterContext) => {
      ctx.body = { id: ctx.params.id, valid: true };
    });

    app.use(router.routes());

    const validUUID = '123e4567-e89b-12d3-a456-426614174000';
    const res1 = await request(http.createServer(app.callback()))
      .get(`/users/${validUUID}`)
      .expect(200);

    assert.strictEqual(res1.body.id, validUUID);
    assert.strictEqual(res1.body.valid, true);

    await request(http.createServer(app.callback()))
      .get('/users/invalid-id')
      .expect(400);
  });

  it('should load resource from database with router.param()', async () => {
    const app = new Koa();
    const router = new Router();

    const User = {
      findById: async (id: string) => {
        if (id === '123') {
          return { id: '123', name: 'John' };
        }
        return null;
      }
    };

    router.param('user', async (id: string, ctx: RouterContext, next: Next) => {
      const user = await User.findById(id);

      if (!user) {
        ctx.throw(404, 'User not found');
      }

      ctx.state.user = user;
      return next();
    });

    router.get('/users/:user', (ctx: RouterContext) => {
      ctx.body = ctx.state.user;
    });

    router.get('/users/:user/posts', async (ctx: RouterContext) => {
      ctx.body = { userId: ctx.state.user.id, posts: [] };
    });

    app.use(router.routes());

    const res1 = await request(http.createServer(app.callback()))
      .get('/users/123')
      .expect(200);

    assert.strictEqual(res1.body.id, '123');
    assert.strictEqual(res1.body.name, 'John');

    const res2 = await request(http.createServer(app.callback()))
      .get('/users/123/posts')
      .expect(200);

    assert.strictEqual(res2.body.userId, '123');

    await request(http.createServer(app.callback()))
      .get('/users/999')
      .expect(404);
  });

  it('should support multiple param handlers', async () => {
    const app = new Koa();
    const router = new Router();

    let validationCalled = false;
    let loadCalled = false;

    router.param('id', (value: string, ctx: RouterContext, next: Next) => {
      if (!/^\d+$/.test(value)) {
        ctx.throw(400, 'Invalid ID format');
      }
      validationCalled = true;
      return next();
    });

    router.param(
      'id',
      async (value: string, ctx: RouterContext, next: Next) => {
        ctx.state.resource = { id: value, loaded: true };
        loadCalled = true;
        return next();
      }
    );

    router.get('/resource/:id', (ctx: RouterContext) => {
      ctx.body = ctx.state.resource;
    });

    app.use(router.routes());

    const res = await request(http.createServer(app.callback()))
      .get('/resource/123')
      .expect(200);

    assert.strictEqual(validationCalled, true);
    assert.strictEqual(loadCalled, true);
    assert.strictEqual(res.body.id, '123');
    assert.strictEqual(res.body.loaded, true);
  });
});
