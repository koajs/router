/**
 * Tests for TypeScript Recipe
 */

import { describe, it } from 'node:test';
import * as assert from 'node:assert';
import * as http from 'node:http';
import Router, { RouterContext } from '../router-module-loader';
import request from 'supertest';
import Koa from 'koa';
import { Next } from '../common';

type RequestBody = Record<string, unknown>;

type ContextWithBody = RouterContext & {
  request: RouterContext['request'] & {
    body?: RequestBody;
  };
};

describe('TypeScript Recipe', () => {
  it('should work with typed route handlers', async () => {
    const app = new Koa();
    const router = new Router();

    app.use(async (ctx, next) => {
      if (ctx.request.is('application/json')) {
        let body = '';
        for await (const chunk of ctx.req) {
          body += chunk;
        }
        try {
          (ctx.request as { body?: RequestBody }).body = JSON.parse(body);
        } catch {
          (ctx.request as { body?: RequestBody }).body = {};
        }
      }
      await next();
    });

    type User = {
      id: number;
      name: string;
      email: string;
    };

    const getUserById = async (id: number): Promise<User> => {
      return { id, name: 'John Doe', email: 'john@example.com' };
    };

    const createUser = async (data: {
      name: string;
      email: string;
    }): Promise<User> => {
      return { id: 1, ...data };
    };

    router.get('/users/:id', async (ctx: RouterContext) => {
      const userId = parseInt(ctx.params.id, 10);

      if (isNaN(userId)) {
        ctx.throw(400, 'Invalid user ID');
      }

      const user: User = await getUserById(userId);
      ctx.body = user;
    });

    type CreateUserBody = {
      name: string;
      email: string;
    };

    router.post('/users', async (ctx: ContextWithBody) => {
      const body =
        (ctx.request.body as CreateUserBody) || ({} as CreateUserBody);
      const { name, email } = body;

      const user = await createUser({ name, email });
      ctx.status = 201;
      ctx.body = user;
    });

    router.param('id', (value: string, ctx: RouterContext, next: Next) => {
      if (!/^\d+$/.test(value)) {
        ctx.throw(400, 'Invalid ID');
      }
      return next();
    });

    app.use(router.routes());
    app.use(router.allowedMethods());

    const res1 = await request(http.createServer(app.callback()))
      .get('/users/123')
      .expect(200);

    assert.strictEqual(res1.body.id, 123);
    assert.strictEqual(res1.body.name, 'John Doe');
    assert.strictEqual(res1.body.email, 'john@example.com');

    await request(http.createServer(app.callback()))
      .get('/users/abc')
      .expect(400);

    const res2 = await request(http.createServer(app.callback()))
      .post('/users')
      .send({ name: 'Jane Doe', email: 'jane@example.com' })
      .expect(201);

    assert.strictEqual(res2.body.name, 'Jane Doe');
    assert.strictEqual(res2.body.email, 'jane@example.com');
    assert.strictEqual(res2.body.id, 1);
  });
});
