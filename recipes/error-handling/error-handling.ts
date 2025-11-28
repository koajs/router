/**
 * Error Handling Recipe
 *
 * Centralized error handling with custom error classes.
 *
 * Note: User model is a placeholder. Replace with your actual model/service.
 */
import Koa from 'koa';
import Router from '../router-module-loader';
import { User, Next } from '../common';
import type { RouterContext } from '../router-module-loader';

const app = new Koa();
const router = new Router();

class AppError extends Error {
  status: number;
  code: string;
  isOperational: boolean;
  details?: any;

  constructor(
    message: string,
    status = 500,
    code = 'INTERNAL_ERROR',
    details?: any
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
  } catch (err: any) {
    ctx.status = err.status || 500;
    ctx.body = {
      error: {
        message: err.message,
        code: err.code || 'INTERNAL_ERROR',
        ...(process.env.NODE_ENV === 'development' && {
          stack: err.stack,
          details: err.details
        })
      }
    };

    ctx.app.emit('error', err, ctx);
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
