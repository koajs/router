/**
 * Tests for Pagination Recipe
 */

import { describe, it } from 'node:test';
import * as assert from 'node:assert';
import * as http from 'node:http';
import Router, { RouterContext } from '../router-module-loader';
import request from 'supertest';
import Koa from 'koa';
import { Next } from '../common';

describe('Pagination', () => {
  it('should paginate list endpoints', async () => {
    const app = new Koa();
    const router = new Router();

    interface PaginationState {
      page: number;
      limit: number;
      offset: number;
    }

    const User = {
      findAndCountAll: async (options: { limit: number; offset: number }) => {
        const allUsers = [
          { id: 1, name: 'User 1' },
          { id: 2, name: 'User 2' },
          { id: 3, name: 'User 3' },
          { id: 4, name: 'User 4' },
          { id: 5, name: 'User 5' }
        ];

        const start = options.offset;
        const end = start + options.limit;
        const rows = allUsers.slice(start, end);

        return {
          count: allUsers.length,
          rows
        };
      }
    };

    const paginate = async (ctx: RouterContext, next: Next) => {
      const page = parseInt(ctx.query.page as string) || 1;
      const limit = parseInt(ctx.query.limit as string) || 10;
      const offset = (page - 1) * limit;

      ctx.state.pagination = { page, limit, offset } as PaginationState;
      await next();
    };

    router.get('/users', paginate, async (ctx: RouterContext) => {
      const { limit, offset } = ctx.state.pagination as PaginationState;
      const { count, rows } = await User.findAndCountAll({ limit, offset });

      ctx.set('X-Total-Count', count.toString());
      ctx.set('X-Page-Count', Math.ceil(count / limit).toString());
      ctx.body = {
        data: rows,
        pagination: {
          page: ctx.state.pagination.page,
          limit,
          total: count,
          pages: Math.ceil(count / limit)
        }
      };
    });

    app.use(router.routes());

    const res1 = await request(http.createServer(app.callback()))
      .get('/users?page=1&limit=2')
      .expect(200);

    assert.strictEqual(res1.body.data.length, 2);
    assert.strictEqual(res1.body.pagination.page, 1);
    assert.strictEqual(res1.body.pagination.limit, 2);
    assert.strictEqual(res1.body.pagination.total, 5);
    assert.strictEqual(res1.body.pagination.pages, 3);
    assert.strictEqual(res1.headers['x-total-count'], '5');
    assert.strictEqual(res1.headers['x-page-count'], '3');

    const res2 = await request(http.createServer(app.callback()))
      .get('/users?page=2&limit=2')
      .expect(200);

    assert.strictEqual(res2.body.data.length, 2);
    assert.strictEqual(res2.body.pagination.page, 2);

    const res3 = await request(http.createServer(app.callback()))
      .get('/users')
      .expect(200);

    assert.strictEqual(res3.body.pagination.page, 1);
    assert.strictEqual(res3.body.pagination.limit, 10);
  });
});
