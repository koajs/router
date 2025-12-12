/**
 * Pagination Recipe
 *
 * Implement pagination for list endpoints.
 * Demonstrates:
 * - Pagination middleware for reuse across routes
 * - Configurable page size with max limit
 * - Pagination metadata in response
 * - Pagination headers for API clients
 * - Using generics to avoid type casting
 *
 * Note: User and Post models are placeholders.
 * Replace with your actual models/services.
 */
import Router from '../router-module-loader';
import type { RouterMiddleware, RouterContext } from '../router-module-loader';
import { User, Post } from '../common';

// ===========================================
// Pagination Configuration
// ===========================================

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 100;

// ===========================================
// Pagination Types
// ===========================================

type PaginationInfo = {
  page: number;
  limit: number;
  offset: number;
};

type PaginationState = {
  pagination?: PaginationInfo;
};

type PaginatedResponse<T> = {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
};

// ===========================================
// Typed Router
// ===========================================

const router = new Router<PaginationState>();

// ===========================================
// Pagination Middleware
// ===========================================

/**
 * Pagination middleware factory
 * Extracts and validates pagination params from query string
 */
const paginate = (options?: {
  defaultLimit?: number;
  maxLimit?: number;
}): RouterMiddleware<PaginationState> => {
  const defaultLimit = options?.defaultLimit || DEFAULT_LIMIT;
  const maxLimit = options?.maxLimit || MAX_LIMIT;

  return async (ctx, next) => {
    const page = Math.max(
      1,
      parseInt(ctx.query.page as string) || DEFAULT_PAGE
    );
    const requestedLimit = parseInt(ctx.query.limit as string) || defaultLimit;
    const limit = Math.min(Math.max(1, requestedLimit), maxLimit);
    const offset = (page - 1) * limit;

    ctx.state.pagination = { page, limit, offset };
    await next();
  };
};

/**
 * Helper to build paginated response
 */
function buildPaginatedResponse<T>(
  data: T[],
  total: number,
  pagination: PaginationInfo
): PaginatedResponse<T> {
  const pages = Math.ceil(total / pagination.limit);

  return {
    data,
    pagination: {
      page: pagination.page,
      limit: pagination.limit,
      total,
      pages,
      hasNext: pagination.page < pages,
      hasPrev: pagination.page > 1
    }
  };
}

/**
 * Helper to set pagination headers
 */
function setPaginationHeaders(
  ctx: RouterContext,
  total: number,
  pagination: PaginationInfo
): void {
  const pages = Math.ceil(total / pagination.limit);
  ctx.set('X-Total-Count', total.toString());
  ctx.set('X-Page-Count', pages.toString());
  ctx.set('X-Current-Page', pagination.page.toString());
  ctx.set('X-Per-Page', pagination.limit.toString());
}

// ===========================================
// Routes
// ===========================================

/**
 * Get paginated users list
 * Query params: ?page=1&limit=10
 */
router.get('/users', paginate(), async (ctx) => {
  const pagination = ctx.state.pagination!;
  const { count, rows } = await User.findAndCountAll({
    limit: pagination.limit,
    offset: pagination.offset
  });

  setPaginationHeaders(ctx, count, pagination);
  ctx.body = buildPaginatedResponse(rows, count, pagination);
});

/**
 * Get paginated posts with custom limit
 * Query params: ?page=1&limit=20 (max 50)
 */
router.get(
  '/posts',
  paginate({ defaultLimit: 20, maxLimit: 50 }),
  async (ctx) => {
    const pagination = ctx.state.pagination!;
    const posts = await Post.findAll({
      limit: pagination.limit,
      offset: pagination.offset
    });

    // Simple response without total count
    ctx.body = {
      data: posts,
      pagination: {
        page: pagination.page,
        limit: pagination.limit
      }
    };
  }
);

export {
  router,
  paginate,
  buildPaginatedResponse,
  setPaginationHeaders,
  DEFAULT_PAGE,
  DEFAULT_LIMIT,
  MAX_LIMIT
};
export type { PaginatedResponse, PaginationInfo, PaginationState };
