/**
 * Tests for Error Handling Recipe
 */

import { describe, it } from 'node:test';
import * as assert from 'node:assert';
import * as http from 'node:http';
import Router, { RouterContext } from '../router-module-loader';
import request from 'supertest';
import Koa from 'koa';
import { Next } from '../common';

type ErrorDetails = Record<string, unknown>;

type CaughtError = Error & {
  status?: number;
  code?: string;
  details?: ErrorDetails;
};

describe('Error Handling', () => {
  it('should handle errors with custom error class', async () => {
    const app = new Koa();
    const router = new Router();

    class AppError extends Error {
      status: number;
      code: string;
      isOperational: boolean;
      details?: ErrorDetails;

      constructor(
        message: string,
        status = 500,
        code = 'INTERNAL_ERROR',
        details?: ErrorDetails
      ) {
        super(message);
        this.status = status;
        this.code = code;
        this.isOperational = true;
        this.details = details;
      }
    }

    const errorHandler = async (ctx: RouterContext, next: Next) => {
      try {
        await next();
      } catch (err) {
        const error = err as CaughtError;
        ctx.status = error.status || 500;
        ctx.body = {
          error: {
            message: error.message,
            code: error.code || 'INTERNAL_ERROR',
            ...(process.env.NODE_ENV === 'development' && {
              stack: error.stack,
              details: error.details
            })
          }
        };

        ctx.app.emit('error', error, ctx);
      }
    };

    const User = {
      findById: async (id: string) => {
        if (id === '123') {
          return { id: '123', name: 'John' };
        }
        return null;
      }
    };

    router.get('/users/:id', async (ctx: RouterContext) => {
      const user = await User.findById(ctx.params.id);
      if (!user) {
        throw new AppError('User not found', 404, 'USER_NOT_FOUND');
      }
      ctx.body = user;
    });

    app.use(errorHandler);
    app.use(router.routes());
    app.use(router.allowedMethods({ throw: true }));

    const res1 = await request(http.createServer(app.callback()))
      .get('/users/123')
      .expect(200);

    assert.strictEqual(res1.body.id, '123');
    assert.strictEqual(res1.body.name, 'John');

    const res2 = await request(http.createServer(app.callback()))
      .get('/users/999')
      .expect(404);

    assert.strictEqual(res2.body.error.message, 'User not found');
    assert.strictEqual(res2.body.error.code, 'USER_NOT_FOUND');
  });

  it('should handle generic errors', async () => {
    const app = new Koa();
    const router = new Router();

    const errorHandler = async (ctx: RouterContext, next: Next) => {
      try {
        await next();
      } catch (err) {
        const error = err as CaughtError;
        ctx.status = error.status || 500;
        ctx.body = {
          error: {
            message: error.message,
            code: error.code || 'INTERNAL_ERROR'
          }
        };
      }
    };

    router.get('/error', async () => {
      throw new Error('Something went wrong');
    });

    app.use(errorHandler);
    app.use(router.routes());

    const res = await request(http.createServer(app.callback()))
      .get('/error')
      .expect(500);

    assert.strictEqual(res.body.error.message, 'Something went wrong');
    assert.strictEqual(res.body.error.code, 'INTERNAL_ERROR');
  });
});
