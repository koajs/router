/**
 * Tests for Request Validation Recipe
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

type ValidationError = {
  path: string[];
  message: string;
};

type ValidationResult = {
  error: { details: ValidationError[] } | null;
  value: RequestBody | null;
};

type ValidationSchema = {
  validate: (
    data: RequestBody,
    options?: { abortEarly?: boolean; stripUnknown?: boolean }
  ) => ValidationResult;
};

describe('Request Validation', () => {
  it('should validate request data with middleware', async () => {
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

    const validate =
      (schema: ValidationSchema) =>
      async (ctx: ContextWithBody, next: Next) => {
        const body = ctx.request.body || {};
        const { error, value } = schema.validate(body, {
          abortEarly: false,
          stripUnknown: true
        });

        if (error) {
          ctx.status = 400;
          ctx.body = {
            error: 'Validation failed',
            details: error.details.map((d) => ({
              field: d.path.join('.'),
              message: d.message
            }))
          };
          return;
        }

        ctx.request.body = value || {};
        await next();
      };

    const createUserSchema: ValidationSchema = {
      validate: (data: RequestBody) => {
        const errors: ValidationError[] = [];
        const email = data.email as string | undefined;
        const password = data.password as string | undefined;
        const name = data.name as string | undefined;

        if (!email || !email.includes('@')) {
          errors.push({ path: ['email'], message: 'Email is invalid' });
        }
        if (!password || password.length < 8) {
          errors.push({
            path: ['password'],
            message: 'Password must be at least 8 characters'
          });
        }
        if (!name || name.length < 2) {
          errors.push({
            path: ['name'],
            message: 'Name must be at least 2 characters'
          });
        }

        if (errors.length > 0) {
          return { error: { details: errors }, value: null };
        }
        return { error: null, value: data };
      }
    };

    router.post(
      '/users',
      validate(createUserSchema),
      async (ctx: ContextWithBody) => {
        ctx.body = { success: true, user: ctx.request.body };
      }
    );

    app.use(router.routes());

    const res1 = await request(http.createServer(app.callback()))
      .post('/users')
      .send({
        email: 'test@example.com',
        password: 'password123',
        name: 'John Doe'
      })
      .expect(200);

    assert.strictEqual(res1.body.success, true);
    assert.strictEqual(res1.body.user.email, 'test@example.com');

    const res2 = await request(http.createServer(app.callback()))
      .post('/users')
      .send({
        email: 'invalid-email',
        password: 'short'
      })
      .expect(400);

    assert.strictEqual(res2.body.error, 'Validation failed');
    assert.strictEqual(Array.isArray(res2.body.details), true);
  });
});
