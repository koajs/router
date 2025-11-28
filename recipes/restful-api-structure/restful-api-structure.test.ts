/**
 * Tests for RESTful API Structure Recipe
 */

import { describe, it } from 'node:test';
import * as assert from 'node:assert';
import * as http from 'node:http';
import Koa from 'koa';
import Router from '../router-module-loader';
import request from 'supertest';

describe('RESTful API Structure', () => {
  it('should organize API with nested routers', async () => {
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

    const User = {
      findAll: async () => [
        { id: 1, name: 'John' },
        { id: 2, name: 'Jane' }
      ],
      findById: async (id: string) => ({ id, name: 'John' }),
      create: async (data: any) => ({ id: 3, ...data }),
      update: async (id: string, data: any) => ({ id, ...data }),
      delete: async (_id: string) => true
    };

    const usersRouter = new Router({ prefix: '/users' });
    usersRouter.get('/', async (ctx: any) => {
      ctx.body = await User.findAll();
    });
    usersRouter.post('/', async (ctx: any) => {
      ctx.body = await User.create((ctx.request as any).body);
    });
    usersRouter.get('/:id', async (ctx: any) => {
      ctx.body = await User.findById(ctx.params.id);
    });
    usersRouter.put('/:id', async (ctx: any) => {
      ctx.body = await User.update(ctx.params.id, (ctx.request as any).body);
    });
    usersRouter.delete('/:id', async (ctx: any) => {
      await User.delete(ctx.params.id);
      ctx.status = 204;
    });

    const apiRouter = new Router({ prefix: '/api/v1' });
    apiRouter.use(usersRouter.routes(), usersRouter.allowedMethods());

    app.use(apiRouter.routes());
    app.use(apiRouter.allowedMethods());

    const res1 = await request(http.createServer(app.callback()))
      .get('/api/v1/users')
      .expect(200);

    assert.strictEqual(Array.isArray(res1.body), true);
    assert.strictEqual(res1.body.length, 2);

    const res2 = await request(http.createServer(app.callback()))
      .get('/api/v1/users/123')
      .expect(200);

    assert.strictEqual(res2.body.id, '123');

    const res3 = await request(http.createServer(app.callback()))
      .post('/api/v1/users')
      .send({ name: 'Alice', email: 'alice@example.com' })
      .expect(200);

    assert.strictEqual(res3.body.name, 'Alice');

    const res4 = await request(http.createServer(app.callback()))
      .delete('/api/v1/users/123')
      .expect(204);

    assert.strictEqual(res4.status, 204);
  });
});
