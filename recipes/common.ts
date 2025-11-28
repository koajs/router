/**
 * Placeholder types for recipe examples
 *
 * These are example types that should be replaced with actual
 * implementations in real applications.
 */

import type { RouterContext } from './router-module-loader';

export interface User {
  id: string;
  email: string;
  name: string;
  role?: string;
}

export interface Post {
  id: string;
  userId: string;
  title: string;
  content: string;
}

export interface Resource {
  id: string;
  name: string;
}

export type ContextWithBody<StateT = any, ContextT = any> = RouterContext<
  StateT,
  ContextT
> & {
  request: RouterContext<StateT, ContextT>['request'] & {
    body?: any;
  };
};

export type ContextWithUser<StateT = any, ContextT = any> = RouterContext<
  StateT,
  ContextT
> & {
  state: RouterContext<StateT, ContextT>['state'] & {
    user?: User;
    resource?: Resource;
    pagination?: {
      page: number;
      limit: number;
      offset: number;
    };
  };
};

export type RecipeContext<StateT = any, ContextT = any> = RouterContext<
  StateT,
  ContextT
> & {
  request: RouterContext<StateT, ContextT>['request'] & {
    body?: any;
  };
  state: RouterContext<StateT, ContextT>['state'] & {
    user?: User;
    resource?: Resource;
    pagination?: {
      page: number;
      limit: number;
      offset: number;
    };
  };
};

export type { Next } from 'koa';

export const db = {
  authenticate: async (): Promise<void> => {}
};

export const redis = {
  ping: async (): Promise<string> => {
    return 'PONG';
  }
};

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
  create: async (data: any): Promise<User> => {
    return { id: '1', email: data.email || '', name: data.name || '' };
  },
  update: async (_id: string, data: any): Promise<User> => {
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
