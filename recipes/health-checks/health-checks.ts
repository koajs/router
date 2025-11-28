/**
 * Health Checks Recipe
 *
 * Add health check endpoints for monitoring and orchestration.
 *
 * Note: db and redis are placeholders. Replace with your actual
 * database and cache clients.
 */
import Router from '../router-module-loader';
import { db, redis } from '../common';
import type { RouterContext } from '../router-module-loader';

const router = new Router();

router.get('/health', async (ctx: RouterContext) => {
  const health = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    checks: {} as Record<string, string>
  };

  try {
    await db.authenticate();
    health.checks.database = 'ok';
  } catch (err) {
    health.checks.database = 'error';
    health.status = 'degraded';
  }

  try {
    await redis.ping();
    health.checks.redis = 'ok';
  } catch (err) {
    health.checks.redis = 'error';
    health.status = 'degraded';
  }

  ctx.status = health.status === 'ok' ? 200 : 503;
  ctx.body = health;
});

router.get('/ready', async (ctx: RouterContext) => {
  const isReady = await checkReadiness();
  ctx.status = isReady ? 200 : 503;
  ctx.body = { ready: isReady };
});

router.get('/live', async (ctx: RouterContext) => {
  ctx.body = { alive: true };
});

async function checkReadiness(): Promise<boolean> {
  try {
    await db.authenticate();

    // Check other critical services
    // await redis.ping();

    return true;
  } catch (err) {
    return false;
  }
}
