/**
 * Tests for router-events utilities
 */
import { describe, it } from 'node:test';
import assert from 'node:assert';

import {
  RouterEvents,
  resolveEvent,
  RouterEventEmitter
} from '../../src/utils/router-events';

describe('router-events utilities', () => {
  // -------------------------------------------------------------------------
  // RouterEvents constant
  // -------------------------------------------------------------------------

  describe('RouterEvents', () => {
    it('should have NotFound event with correct string value', () => {
      assert.strictEqual(RouterEvents.NotFound, 'not-found');
    });

    it('should only expose active events', () => {
      assert.strictEqual(Object.keys(RouterEvents).length, 1);
      assert.strictEqual('NotFound' in RouterEvents, true);
    });
  });

  // -------------------------------------------------------------------------
  // resolveEvent() helper
  // -------------------------------------------------------------------------

  describe('resolveEvent()', () => {
    it('should return a raw string event as-is', () => {
      assert.strictEqual(resolveEvent('not-found'), 'not-found');
    });

    it('should resolve a selector function to the event name', () => {
      assert.strictEqual(
        resolveEvent((events) => events.NotFound),
        'not-found'
      );
    });

    it('should work with RouterEvents constant passed directly', () => {
      assert.strictEqual(resolveEvent(RouterEvents.NotFound), 'not-found');
    });
  });

  // -------------------------------------------------------------------------
  // RouterEventEmitter class
  // -------------------------------------------------------------------------

  describe('RouterEventEmitter', () => {
    describe('register()', () => {
      it('should store a handler so emit() calls it', async () => {
        const emitter = new RouterEventEmitter();
        let called = false;

        emitter.register('not-found', async () => {
          called = true;
        });

        await emitter.emit('not-found', {} as any, () => Promise.resolve());

        assert.strictEqual(called, true);
      });

      it('should store multiple handlers for the same event in order', async () => {
        const emitter = new RouterEventEmitter();
        const order: number[] = [];

        emitter.register('not-found', async (ctx, next) => {
          order.push(1);
          await next();
        });
        emitter.register('not-found', async () => {
          order.push(2);
        });

        await emitter.emit('not-found', {} as any, () => Promise.resolve());

        assert.deepStrictEqual(order, [1, 2]);
      });

      it('should maintain independent handler storage per emitter instance', async () => {
        const emitter1 = new RouterEventEmitter();
        const emitter2 = new RouterEventEmitter();
        let emitter1Called = false;

        emitter1.register('not-found', async () => {
          emitter1Called = true;
        });

        // Emit on emitter2 — emitter1's handler should NOT run
        await emitter2.emit('not-found', {} as any, () => Promise.resolve());

        assert.strictEqual(emitter1Called, false);

        // Emit on emitter1 — emitter1's handler SHOULD run
        await emitter1.emit('not-found', {} as any, () => Promise.resolve());

        assert.strictEqual(emitter1Called, true);
      });
    });

    describe('emit()', () => {
      it('should call next() directly when no handlers are registered', async () => {
        const emitter = new RouterEventEmitter();
        let nextCalled = false;

        await emitter.emit('not-found', {} as any, async () => {
          nextCalled = true;
        });

        assert.strictEqual(nextCalled, true);
      });

      it('should compose handlers in koa-compose onion order', async () => {
        const emitter = new RouterEventEmitter();
        const order: number[] = [];

        emitter.register('not-found', async (ctx, next) => {
          order.push(1);
          await next();
          order.push(4);
        });
        emitter.register('not-found', async (ctx, next) => {
          order.push(2);
          await next();
          order.push(3);
        });

        await emitter.emit('not-found', {} as any, () => Promise.resolve());

        assert.deepStrictEqual(order, [1, 2, 3, 4]);
      });

      it('should pass the context object to every handler', async () => {
        const emitter = new RouterEventEmitter();
        const capturedPaths: string[] = [];

        emitter.register('not-found', async (ctx: any, next) => {
          capturedPaths.push(ctx.path);
          await next();
        });
        emitter.register('not-found', async (ctx: any) => {
          capturedPaths.push(ctx.path);
        });

        await emitter.emit('not-found', { path: '/missing' } as any, () =>
          Promise.resolve()
        );

        assert.deepStrictEqual(capturedPaths, ['/missing', '/missing']);
      });

      it('should allow a handler to call next() to pass control downstream', async () => {
        const emitter = new RouterEventEmitter();
        const order: string[] = [];

        emitter.register('not-found', async (ctx, next) => {
          order.push('handler');
          await next();
        });

        await emitter.emit('not-found', {} as any, async () => {
          order.push('downstream');
        });

        assert.deepStrictEqual(order, ['handler', 'downstream']);
      });

      it('should not call downstream next() when handler does not call next()', async () => {
        const emitter = new RouterEventEmitter();
        let downstreamCalled = false;

        emitter.register('not-found', async () => {
          // intentionally does NOT call next()
        });

        await emitter.emit('not-found', {} as any, async () => {
          downstreamCalled = true;
        });

        assert.strictEqual(downstreamCalled, false);
      });
    });
  });
});
