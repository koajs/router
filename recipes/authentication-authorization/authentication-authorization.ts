/**
 * Authentication & Authorization Recipe
 *
 * Implement JWT-based authentication with middleware.
 *
 * Note: User model is a placeholder. Replace with your actual user model/service.
 * Requires: npm install jsonwebtoken @types/jsonwebtoken
 */
import * as jwt from 'jsonwebtoken';
import Router from '../router-module-loader';
import { User, ContextWithUser, Next } from '../common';

const router = new Router();

const authenticate = async (ctx: ContextWithUser, next: Next) => {
  const token = ctx.headers.authorization?.replace('Bearer ', '');

  if (!token) {
    ctx.throw(401, 'Authentication required');
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET as string);
    const user = await User.findById((decoded as any).userId);
    ctx.state.user = user || undefined;
    await next();
  } catch (err) {
    ctx.throw(401, 'Invalid token');
  }
};

const requireRole =
  (role: string) => async (ctx: ContextWithUser, next: Next) => {
    if (!ctx.state.user) {
      ctx.throw(401, 'Authentication required');
    }

    if (ctx.state.user.role !== role) {
      ctx.throw(403, 'Insufficient permissions');
    }

    await next();
  };

router
  .get('/profile', authenticate, async (ctx: ContextWithUser) => {
    ctx.body = ctx.state.user;
  })
  .get(
    '/admin',
    authenticate,
    requireRole('admin'),
    async (ctx: ContextWithUser) => {
      ctx.body = { message: 'Admin access granted' };
    }
  );
