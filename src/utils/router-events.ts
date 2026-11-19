/**
 * Router lifecycle event constants, types, and emitter.
 *
 * Prefer using `RouterEvents` over raw strings for autocomplete, type safety,
 * and refactor safety.
 *
 * `RouterEvents` only contains events that are currently active. New events
 * are added here when their implementation lands — this keeps the public API
 * and the implementation always in sync.
 *
 * @experimental
 *
 * @example
 *
 * ```typescript
 * import { RouterEvents } from '@koa/router';
 *
 * // Recommended: named constant
 * router.on(RouterEvents.NotFound, handler);
 *
 * // Fluent selector function — same safety, different style
 * router.on((events) => events.NotFound, handler);
 *
 * // Raw string — still accepted for convenience
 * router.on('not-found', handler);
 * ```
 */
import compose from 'koa-compose';

import type { RouterMiddleware, RouterContext } from '../types';

// ---------------------------------------------------------------------------
// Event constants
// ---------------------------------------------------------------------------

/**
 * Named constants for active router lifecycle events.
 *
 * Only events that are fully implemented appear here. Planned events will be
 * added as each one is implemented so the public API always reflects what
 * actually works.
 *
 * @experimental
 */
export const RouterEvents = {
  /**
   * Fires when no route matched the request path + HTTP method.
   */
  NotFound: 'not-found'

  // /**
  //  * Fires when the request path matched a registered route but the HTTP
  //  * method did not match any of its allowed methods.
  //  *
  //  * @planned Not yet active — handlers are stored but not called.
  //  */
  // MethodNotAllowed: 'method-not-allowed',

  // /**
  //  * Fires after a route is matched and before its handlers run.
  //  * Useful for tracing and logging the matched route.
  //  *
  //  * @planned Not yet active — handlers are stored but not called.
  //  */
  // Match: 'match',

  // /**
  //  * Fires on every request that enters the router, before route matching.
  //  * Useful for per-router metrics and request logging.
  //  *
  //  * @planned Not yet active — handlers are stored but not called.
  //  */
  // Dispatch: 'dispatch'
} as const;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Union of all valid router event name strings.
 * Derived from `RouterEvents` so the two are always in sync.
 *
 * @experimental
 */
export type RouterEvent = (typeof RouterEvents)[keyof typeof RouterEvents];

/**
 * Accepts either a raw event name string or a selector function that receives
 * the `RouterEvents` object and returns an event name.
 *
 * Both forms are equivalent — choose whichever reads better in context.
 *
 * @example
 * ```typescript
 * // string
 * 'not-found'
 *
 * // selector function
 * (events) => events.NotFound
 * ```
 *
 * @experimental
 */
export type RouterEventSelector =
  | RouterEvent
  | ((events: typeof RouterEvents) => RouterEvent);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Resolve a `RouterEventSelector` to its underlying event name string.
 * If a selector function is passed, it is called with `RouterEvents`.
 */
export function resolveEvent(selector: RouterEventSelector): RouterEvent {
  return typeof selector === 'function' ? selector(RouterEvents) : selector;
}

// ---------------------------------------------------------------------------
// Emitter
// ---------------------------------------------------------------------------

/**
 * Lightweight emitter for router lifecycle events.
 *
 * Manages a map of event name → composed middleware handlers.
 * Each event stores an ordered list of handlers that are composed
 * (koa-compose style) when emitted.
 *
 * @experimental
 */
export class RouterEventEmitter<
  StateT = import('koa').DefaultState,
  ContextT = import('koa').DefaultContext
> {
  private _handlers: Map<RouterEvent, RouterMiddleware<StateT, ContextT>[]> =
    new Map();

  /**
   * Register a handler for the given event.
   * Multiple handlers for the same event are composed in registration order.
   */
  register(
    event: RouterEvent,
    handler: RouterMiddleware<StateT, ContextT>
  ): void {
    const existing = this._handlers.get(event) ?? [];
    existing.push(handler);
    this._handlers.set(event, existing);
  }

  /**
   * Emit an event by composing and running all registered handlers.
   * If no handlers are registered for the event, calls `next()` directly.
   *
   * @param event   - The event to emit
   * @param context - The router context
   * @param next    - The downstream next function
   */
  emit(
    event: RouterEvent,
    context: RouterContext<StateT, ContextT>,
    next: () => Promise<unknown>
  ): Promise<unknown> {
    const handlers = this._handlers.get(event);
    if (handlers && handlers.length > 0) {
      return compose(handlers)(context, next);
    }

    return next();
  }
}
