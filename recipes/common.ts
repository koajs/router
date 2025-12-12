/**
 * Common types and placeholder implementations for recipe examples
 *
 * These are example types that should be replaced with actual
 * implementations in real applications.
 *
 * NOTE: Instead of using extended context types with casting,
 * prefer using Router generics: new Router<StateT, ContextT>()
 * This provides better type safety without runtime casting.
 */

import type { RouterContext } from './router-module-loader';

// ===========================================
// Domain Types
// ===========================================

export type User = {
  id: string;
  email: string;
  name: string;
  role?: string;
};

export type Post = {
  id: string;
  userId: string;
  title: string;
  content: string;
};

export type Resource = {
  id: string;
  name: string;
};

// ===========================================
// Extended Context Types (Legacy)
// ===========================================

/**
 * @deprecated Prefer using Router generics: new Router<StateT>()
 * Context with request body (for POST/PUT/PATCH requests)
 */
export type ContextWithBody = RouterContext & {
  request: RouterContext['request'] & {
    body?: Record<string, unknown>;
  };
};

/**
 * @deprecated Prefer using Router generics: new Router<StateT>()
 * Context with authenticated user state
 */
export type ContextWithUser = RouterContext & {
  state: RouterContext['state'] & {
    user?: User;
    resource?: Resource;
  };
};

// Re-export Next type for convenience
export type { Next } from 'koa';

export const db = {
  authenticate: async (): Promise<void> => {}
};

export const redis = {
  ping: async (): Promise<string> => {
    return 'PONG';
  }
};

type UserCreateData = { email?: string; name?: string };
type UserUpdateData = { email?: string; name?: string };

export const User = {
  findById: async (_id: string): Promise<User | null> => {
    return null;
  },
  findAll: async (): Promise<User[]> => {
    return [];
  },
  findAndCountAll: async (_options: {
    limit: number;
    offset: number;
  }): Promise<{ count: number; rows: User[] }> => {
    return { count: 0, rows: [] };
  },
  create: async (data: UserCreateData): Promise<User> => {
    return { id: '1', email: data.email || '', name: data.name || '' };
  },
  update: async (_id: string, data: UserUpdateData): Promise<User> => {
    return { id: _id, email: data.email || '', name: data.name || '' };
  },
  delete: async (_id: string): Promise<void> => {}
};

export const Post = {
  findAll: async (_options: {
    limit: number;
    offset: number;
  }): Promise<Post[]> => {
    return [];
  },
  findByUserId: async (_userId: string): Promise<Post[]> => {
    return [];
  }
};

export const Resource = {
  findById: async (_id: string): Promise<Resource | null> => {
    return null;
  }
};

export const createUser = async (data: {
  email: string;
  password: string;
  name: string;
}): Promise<User> => {
  return { id: '1', email: data.email, name: data.name };
};

export const updateUser = async (
  _id: string,
  data: { email?: string; name?: string }
): Promise<User> => {
  return { id: _id, email: data.email || '', name: data.name || '' };
};
