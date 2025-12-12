/**
 * Authentication & Authorization Recipe
 *
 * Implement JWT-based authentication with middleware.
 * Demonstrates:
 * - JWT token verification middleware
 * - Role-based access control
 * - Chaining authentication middleware
 * - Using generics to avoid type casting
 *
 * Note: User model is a placeholder. Replace with your actual user model/service.
 * Requires: npm install jsonwebtoken @types/jsonwebtoken
 */
import * as jwt from 'jsonwebtoken';

import Router from '../router-module-loader';
import type { RouterMiddleware } from '../router-module-loader';
import { User } from '../common';
import type { User as UserType } from '../common';

/**
 * State type for authenticated routes
 */
type AuthState = {
  user?: UserType;
};

/**
 * JWT payload structure
 */
type JwtPayload = {
  userId?: string;
};

/**
 * Typed router with authentication state
 */
const router = new Router<AuthState>();

/**
 * Authentication middleware
 * Verifies JWT token and attaches user to ctx.state
 */
const authenticate: RouterMiddleware<AuthState> = async (ctx, next) => {
  const token = ctx.headers.authorization?.replace('Bearer ', '');

  if (!token) {
    ctx.throw(401, 'Authentication required');
    return;
  }

  try {
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || 'secret'
    ) as JwtPayload;
    const userId = decoded.userId;
    if (!userId) {
      ctx.throw(401, 'Invalid token payload');
      return;
    }
    const user = await User.findById(userId);
    ctx.state.user = user || undefined;
    await next();
  } catch {
    ctx.throw(401, 'Invalid token');
  }
};

/**
 * Role-based authorization middleware factory
 * Returns middleware that checks if user has required role
 */
const requireRole = (role: string): RouterMiddleware<AuthState> => {
  return async (ctx, next) => {
    const { user } = ctx.state;

    if (!user) {
      ctx.throw(401, 'Authentication required');
      return;
    }

    if (user.role !== role) {
      ctx.throw(403, 'Insufficient permissions');
    }

    await next();
  };
};

/**
 * Multiple roles authorization middleware factory
 * Returns middleware that checks if user has any of the required roles
 */
const requireAnyRole = (...roles: string[]): RouterMiddleware<AuthState> => {
  return async (ctx, next) => {
    const { user } = ctx.state;

    if (!user) {
      ctx.throw(401, 'Authentication required');
      return;
    }

    if (!user.role || !roles.includes(user.role)) {
      ctx.throw(403, `Requires one of: ${roles.join(', ')}`);
    }

    await next();
  };
};

// Routes with authentication and authorization
router
  // Public route - no authentication needed
  .get('/public', (ctx) => {
    ctx.body = { message: 'Public content' };
  })

  // Protected route - requires authentication
  .get('/profile', authenticate, (ctx) => {
    ctx.body = ctx.state.user;
  })

  // Admin route - requires authentication + admin role
  .get('/admin', authenticate, requireRole('admin'), (ctx) => {
    ctx.body = { message: 'Admin access granted' };
  })

  // Moderator route - requires authentication + moderator or admin role
  .get(
    '/moderate',
    authenticate,
    requireAnyRole('admin', 'moderator'),
    (ctx) => {
      ctx.body = { message: 'Moderator access granted' };
    }
  );

export { router, authenticate, requireRole, requireAnyRole };
export type { AuthState };
