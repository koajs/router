/**
 * Tests for parameter-match utilities
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';

import { createParameterValidationMiddleware } from '../../src/utils/parameter-match';

describe('parameter-match utilities', () => {
  describe('createParameterValidationMiddleware()', () => {
    const uuidPattern =
      /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

    function createMockContext() {
      return {
        throw(status: number, message: string) {
          const error = new Error(message) as Error & { status?: number };
          error.status = status;
          throw error;
        }
      };
    }

    it('should allow matching values to continue', async () => {
      const middleware = createParameterValidationMiddleware('id', uuidPattern);
      let nextCalled = false;

      await middleware(
        '2f1c1cb6-1a59-4d85-8b3d-69ba09b2aa11',
        createMockContext(),
        async () => {
          nextCalled = true;
        }
      );

      assert.strictEqual(nextCalled, true);
    });

    it('should reject non-matching values with default error', async () => {
      const middleware = createParameterValidationMiddleware('id', uuidPattern);

      await assert.rejects(
        async () => {
          await middleware('not-a-uuid', createMockContext(), async () => {});
        },
        (error: Error & { status?: number }) => {
          assert.strictEqual(error.status, 400);
          assert.ok(
            error.message.includes('Invalid value for parameter "id"'),
            'message should mention parameter'
          );
          return true;
        }
      );
    });

    it('should honor custom status and message', async () => {
      const middleware = createParameterValidationMiddleware(
        'id',
        uuidPattern,
        {
          status: 422,
          message: 'id must be a uuid'
        }
      );

      await assert.rejects(
        async () => {
          await middleware('abc', createMockContext(), async () => {});
        },
        (error: Error & { status?: number }) => {
          assert.strictEqual(error.status, 422);
          assert.strictEqual(error.message, 'id must be a uuid');
          return true;
        }
      );
    });

    it('should reset lastIndex for global patterns', async () => {
      const middleware = createParameterValidationMiddleware('slug', /[a-z]+/g);
      let calls = 0;

      const ctx = createMockContext();

      await middleware('abc', ctx, async () => {
        calls += 1;
      });

      await middleware('def', ctx, async () => {
        calls += 1;
      });

      assert.strictEqual(calls, 2);
    });

    it('should work as inline route middleware (ctx, next)', async () => {
      const middleware = createParameterValidationMiddleware('id', uuidPattern);
      let nextCalled = false;

      const callAsRouteMiddleware = middleware as unknown as (
        context: { params: Record<string, string> },
        next: () => Promise<void>
      ) => Promise<void>;

      await callAsRouteMiddleware(
        { params: { id: '2f1c1cb6-1a59-4d85-8b3d-69ba09b2aa11' } },
        async () => {
          nextCalled = true;
        }
      );

      assert.strictEqual(nextCalled, true);
    });

    it('should reject when used inline and ctx.params is missing the parameter', async () => {
      const middleware = createParameterValidationMiddleware('id', uuidPattern);

      await assert.rejects(
        async () => {
          const callAsRouteMiddleware = middleware as unknown as (
            context: { params: Record<string, string> },
            next: () => Promise<void>
          ) => Promise<void>;

          await callAsRouteMiddleware({ params: {} }, async () => {});
        },
        (error: Error & { status?: number }) => {
          assert.strictEqual(error.status, 400);
          assert.ok(
            error.message.includes('Missing required parameter "id"'),
            'message should mention missing parameter'
          );
          return true;
        }
      );
    });

    it('should throw TypeError when pattern is not a RegExp', async () => {
      // @ts-expect-error - intentionally passing invalid pattern
      assert.throws(() => createParameterValidationMiddleware('id', 'abc'), {
        name: 'TypeError',
        message: 'pattern must be a RegExp instance'
      });
    });

    it('should use createError when provided', async () => {
      const customError = new Error('custom') as Error & { status?: number };
      customError.status = 418;

      const middleware = createParameterValidationMiddleware(
        'id',
        uuidPattern,
        {
          createError: () => customError
        }
      );

      await assert.rejects(
        async () => {
          await middleware('not-a-uuid', createMockContext(), async () => {});
        },
        (error: Error & { status?: number }) => {
          assert.strictEqual(error, customError);
          assert.strictEqual(error.status, 418);
          return true;
        }
      );
    });

    it('should set expose on default http error when provided', async () => {
      const middleware = createParameterValidationMiddleware(
        'id',
        uuidPattern,
        {
          expose: false
        }
      );

      await assert.rejects(
        async () => {
          await middleware('not-a-uuid', createMockContext(), async () => {});
        },
        (error: Error & { expose?: boolean }) => {
          assert.strictEqual(error.expose, false);
          return true;
        }
      );
    });

    it('should not mutate caller RegExp (global lastIndex stays unchanged)', async () => {
      const callerPattern = /[a-z]+/g;
      callerPattern.lastIndex = 2;

      const middleware = createParameterValidationMiddleware(
        'slug',
        callerPattern
      );

      await middleware('abc', createMockContext(), async () => {});

      assert.strictEqual(callerPattern.lastIndex, 2);
    });

    it('should reset lastIndex for sticky patterns too', async () => {
      const middleware = createParameterValidationMiddleware('slug', /[a-z]+/y);
      let calls = 0;

      await middleware('abc', createMockContext(), async () => {
        calls += 1;
      });

      await middleware('def', createMockContext(), async () => {
        calls += 1;
      });

      assert.strictEqual(calls, 2);
    });

    it('should reject inline route middleware when params is missing', async () => {
      const middleware = createParameterValidationMiddleware('id', uuidPattern);
      const callAsRouteMiddleware = middleware as unknown as (
        context: { params?: Record<string, string> },
        next: () => Promise<void>
      ) => Promise<void>;

      await assert.rejects(
        async () => {
          await callAsRouteMiddleware({}, async () => {});
        },
        (error: Error & { status?: number }) => {
          assert.strictEqual(error.status, 400);
          assert.ok(
            error.message.includes('Missing required parameter "id"'),
            'message should mention missing parameter'
          );
          return true;
        }
      );
    });

    it('should use options.message for missing param too (single message for both cases)', async () => {
      const middleware = createParameterValidationMiddleware(
        'id',
        uuidPattern,
        {
          message: 'bad id'
        }
      );
      const callAsRouteMiddleware = middleware as unknown as (
        context: { params: Record<string, string> },
        next: () => Promise<void>
      ) => Promise<void>;

      await assert.rejects(
        async () => {
          await callAsRouteMiddleware({ params: {} }, async () => {});
        },
        (error: Error & { status?: number }) => {
          assert.strictEqual(error.status, 400);
          assert.strictEqual(error.message, 'bad id');
          return true;
        }
      );
    });
  });
});
