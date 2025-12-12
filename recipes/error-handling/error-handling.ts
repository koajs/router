/**
 * Error Handling Recipe
 *
 * Centralized error handling with custom error classes.
 * Demonstrates:
 * - Custom error class with status codes and error codes
 * - Global error handling middleware
 * - Development vs production error responses
 * - Specific error types (NotFound, Validation, etc.)
 * - Proper body parsing with @koa/bodyparser
 *
 * Note: User model is a placeholder. Replace with your actual model/service.
 */
import Koa from 'koa';
import type { Middleware } from 'koa';
import { bodyParser } from '@koa/bodyparser';

import { User } from '../common';
import Router from '../router-module-loader';

const app = new Koa();
const router = new Router();

// ===========================================
// Custom Error Classes
// ===========================================

type ErrorDetails = Record<string, unknown>;

/**
 * Base application error class
 * Use this for all operational errors (expected errors)
 */
class AppError extends Error {
  readonly status: number;
  readonly code: string;
  readonly isOperational: boolean;
  readonly details?: ErrorDetails;

  constructor(
    message: string,
    status = 500,
    code = 'INTERNAL_ERROR',
    details?: ErrorDetails
  ) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
    this.isOperational = true;
    this.details = details;

    // Maintains proper stack trace for where error was thrown
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Not Found error (404)
 */
class NotFoundError extends AppError {
  constructor(resource: string, id?: string) {
    const message = id
      ? `${resource} with id '${id}' not found`
      : `${resource} not found`;
    super(message, 404, `${resource.toUpperCase()}_NOT_FOUND`);
    this.name = 'NotFoundError';
  }
}

/**
 * Validation error (400)
 */
class ValidationError extends AppError {
  constructor(message: string, details?: ErrorDetails) {
    super(message, 400, 'VALIDATION_ERROR', details);
    this.name = 'ValidationError';
  }
}

/**
 * Unauthorized error (401)
 */
class UnauthorizedError extends AppError {
  constructor(message = 'Authentication required') {
    super(message, 401, 'UNAUTHORIZED');
    this.name = 'UnauthorizedError';
  }
}

/**
 * Forbidden error (403)
 */
class ForbiddenError extends AppError {
  constructor(message = 'Access denied') {
    super(message, 403, 'FORBIDDEN');
    this.name = 'ForbiddenError';
  }
}

// ===========================================
// Error Handler Middleware
// ===========================================

type CaughtError = Error & {
  status?: number;
  code?: string;
  details?: ErrorDetails;
  isOperational?: boolean;
};

/**
 * Global error handling middleware
 * Should be the first middleware in the chain
 */
const errorHandler: Middleware = async (ctx, next) => {
  try {
    await next();
  } catch (err) {
    const error = err as CaughtError;
    const isDev = process.env.NODE_ENV === 'development';

    // Set response status
    ctx.status = error.status || 500;

    // Build error response
    ctx.body = {
      error: {
        message: error.isOperational ? error.message : 'Internal server error',
        code: error.code || 'INTERNAL_ERROR',
        // Include details only in development or for operational errors
        ...(isDev && { stack: error.stack }),
        ...(error.details && { details: error.details })
      }
    };

    // Emit error event for logging
    ctx.app.emit('error', error, ctx);
  }
};

// ===========================================
// Routes
// ===========================================

router.get('/users/:id', async (ctx) => {
  const { id } = ctx.params;

  // Validate ID format
  if (!/^[a-zA-Z0-9-]+$/.test(id)) {
    throw new ValidationError('Invalid user ID format', {
      field: 'id',
      value: id
    });
  }

  const user = await User.findById(id);
  if (!user) {
    throw new NotFoundError('User', id);
  }

  ctx.body = user;
});

// POST route using @koa/bodyparser
// The body property is typed by @koa/bodyparser's type augmentation
router.post('/users', async (ctx) => {
  // ctx.request.body is typed by @koa/bodyparser
  const body = ctx.request.body as
    | { email?: string; name?: string }
    | undefined;

  if (!body?.email || !body?.name) {
    throw new ValidationError('Email and name are required', {
      fields: ['email', 'name']
    });
  }

  const user = await User.create({ email: body.email, name: body.name });
  ctx.status = 201;
  ctx.body = user;
});

// ===========================================
// App Setup
// ===========================================

// Error handler should be first
app.use(errorHandler);

// Body parser for POST/PUT requests
app.use(bodyParser());

// Router middleware
app.use(router.routes());
app.use(router.allowedMethods({ throw: true }));

// Error logging
app.on('error', (err: CaughtError) => {
  if (!err.isOperational) {
    console.error('Unexpected error:', err);
  }
});

export {
  app,
  router,
  errorHandler,
  AppError,
  NotFoundError,
  ValidationError,
  UnauthorizedError,
  ForbiddenError
};
