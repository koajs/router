/**
 * Tests for Authentication & Authorization Recipe
 */

import { describe, it } from 'node:test';
import * as assert from 'node:assert';
import * as http from 'node:http';
import Router, { RouterContext } from '../router-module-loader';
import request from 'supertest';
import Koa from 'koa';
import { Next } from '../common';

describe('Authentication & Authorization', () => {
  it('should authenticate requests with JWT token', async () => {
    const app = new Koa();
    const router = new Router();

    const User = {
      findById: async (id: string) => ({ id, name: 'John', role: 'user' })
    };

    const jwt = {
      verify: (token: string, _secret: string) => {
        if (token === 'valid-token') {
          return { userId: '123' };
        }
        throw new Error('Invalid token');
      }
    };

    const authenticate = async (ctx: RouterContext, next: Next) => {
      const authHeader = ctx.headers.authorization || ctx.headers.Authorization;
      const token =
        typeof authHeader === 'string'
          ? authHeader.replace('Bearer ', '')
          : undefined;

      if (!token) {
        ctx.throw(401, 'Authentication required');
        return;
      }

      try {
        const decoded = jwt.verify(token, 'secret') as { userId: string };
        ctx.state.user = await User.findById(decoded.userId);
        return next();
      } catch (err) {
        ctx.throw(401, 'Invalid token');
        return;
      }
    };

    const requireRole =
      (role: string) => async (ctx: RouterContext, next: Next) => {
        if (!ctx.state.user) {
          ctx.throw(401, 'Authentication required');
        }

        if (ctx.state.user.role !== role) {
          ctx.throw(403, 'Insufficient permissions');
        }

        await next();
      };

    router.get('/profile', authenticate, async (ctx: RouterContext) => {
      ctx.body = ctx.state.user;
    });

    router.get(
      '/admin',
      authenticate,
      requireRole('admin'),
      async (ctx: RouterContext) => {
        ctx.body = { message: 'Admin access granted' };
      }
    );

    app.use(router.routes());
    app.use(router.allowedMethods());

    const res1 = await request(http.createServer(app.callback()))
      .get('/profile')
      .set('Authorization', 'Bearer valid-token')
      .expect(200);

    assert.strictEqual(res1.body.id, '123');
    assert.strictEqual(res1.body.name, 'John');

    await request(http.createServer(app.callback()))
      .get('/profile')
      .expect(401);

    await request(http.createServer(app.callback()))
      .get('/admin')
      .set('Authorization', 'Bearer valid-token')
      .expect(403);
  });
});
