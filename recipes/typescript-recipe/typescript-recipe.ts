/**
 * TypeScript Recipe
 *
 * Full TypeScript example with types and type safety.
 *
 * Note: getUserById and createUser are placeholder functions.
 * Replace with your actual implementation.
 */
import Router from '../router-module-loader';
import { ContextWithBody, Next } from '../common';
import type {
  RouterContext,
  RouterParameterMiddleware
} from '../router-module-loader';

interface User {
  id: number;
  name: string;
  email: string;
}

interface CreateUserBody {
  name: string;
  email: string;
}

const router = new Router();

router.get('/users/:id', async (ctx: RouterContext) => {
  const userId = parseInt(ctx.params.id, 10);

  if (isNaN(userId)) {
    ctx.throw(400, 'Invalid user ID');
  }

  const user: User = await getUserById(userId);
  ctx.body = user;
});

router.post('/users', async (ctx: ContextWithBody) => {
  const { name, email } = (ctx.request.body || {}) as CreateUserBody;

  const user = await createUser({ name, email });
  ctx.status = 201;
  ctx.body = user;
});

router.param('id', ((value: string, ctx: RouterContext, next: Next) => {
  if (!/^\d+$/.test(value)) {
    ctx.throw(400, 'Invalid ID');
  }
  return next();
}) as RouterParameterMiddleware);

async function getUserById(id: number): Promise<User> {
  return { id, name: '', email: '' };
}

async function createUser(data: CreateUserBody): Promise<User> {
  return { id: 1, ...data };
}
