/**
 * Request Validation Recipe
 *
 * Validate request data with middleware.
 * Demonstrates:
 * - Joi schema validation
 * - Type-safe validation middleware using generics
 * - Proper body parsing with @koa/bodyparser
 *
 * Requires: yarn add joi @koa/bodyparser
 */
import Router from '../router-module-loader';
import type { RouterMiddleware } from '../router-module-loader';
import * as Joi from 'joi';
import { createUser, updateUser } from '../common';

// Import bodyparser types
import '@koa/bodyparser';

const router = new Router();

/**
 * Generic validation middleware factory
 * Validates ctx.request.body against a Joi schema
 * After validation, body is guaranteed to match the schema
 */
const validate = <T>(schema: Joi.ObjectSchema<T>): RouterMiddleware => {
  return async (ctx, next) => {
    const { error, value } = schema.validate(ctx.request.body, {
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

    // Replace body with validated value
    ctx.request.body = value;
    await next();
  };
};

// ===========================================
// Validation Schemas
// ===========================================

type CreateUserInput = {
  email: string;
  password: string;
  name: string;
};

type UpdateUserInput = {
  email?: string;
  name?: string;
};

const createUserSchema = Joi.object<CreateUserInput>({
  email: Joi.string().email().required(),
  password: Joi.string().min(8).required(),
  name: Joi.string().min(2).required()
});

const updateUserSchema = Joi.object<UpdateUserInput>({
  email: Joi.string().email().optional(),
  name: Joi.string().min(2).optional()
});

// ===========================================
// Routes
// ===========================================

router.post('/users', validate(createUserSchema), async (ctx) => {
  // After validation, body is guaranteed to match CreateUserInput
  const body = ctx.request.body as CreateUserInput;
  ctx.body = await createUser(body);
});

router.put('/users/:id', validate(updateUserSchema), async (ctx) => {
  // After validation, body is guaranteed to match UpdateUserInput
  const body = ctx.request.body as UpdateUserInput;
  ctx.body = await updateUser(ctx.params.id, body);
});

export { router, validate, createUserSchema, updateUserSchema };
export type { CreateUserInput, UpdateUserInput };
