/**
 * Request Validation Recipe
 *
 * Validate request data with middleware.
 *
 * Requires: npm install joi
 */
import Router from '../router-module-loader';
import * as Joi from 'joi';
import { createUser, updateUser, ContextWithBody, Next } from '../common';

const router = new Router();

const validate =
  (schema: Joi.ObjectSchema) => async (ctx: ContextWithBody, next: Next) => {
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

    ctx.request.body = value;
    await next();
  };

const createUserSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(8).required(),
  name: Joi.string().min(2).required()
});

const updateUserSchema = Joi.object({
  email: Joi.string().email().optional(),
  name: Joi.string().min(2).optional()
});

router.post(
  '/users',
  validate(createUserSchema),
  async (ctx: ContextWithBody) => {
    ctx.body = await createUser(ctx.request.body);
  }
);

router.put(
  '/users/:id',
  validate(updateUserSchema),
  async (ctx: ContextWithBody) => {
    ctx.body = await updateUser(ctx.params.id, ctx.request.body);
  }
);
