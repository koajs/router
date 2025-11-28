/**
 * Tests for Health Checks Recipe
 */

import { describe, it } from 'node:test';
import * as assert from 'node:assert';
import * as http from 'node:http';
import Router, { RouterContext } from '../router-module-loader';
import request from 'supertest';
import Koa from 'koa';

describe('Health Checks', () => {
  it('should provide health check endpoint', async () => {
    const app = new Koa();
    const router = new Router();

    const db = {
      authenticate: async () => Promise.resolve()
    };

    const redis = {
      ping: async () => Promise.resolve('PONG')
    };

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

    app.use(router.routes());

    const res = await request(http.createServer(app.callback()))
      .get('/health')
      .expect(200);

    assert.strictEqual(res.body.status, 'ok');
    assert.strictEqual(res.body.checks.database, 'ok');
    assert.strictEqual(res.body.checks.redis, 'ok');
    assert.strictEqual(typeof res.body.uptime, 'number');
    assert.strictEqual(typeof res.body.timestamp, 'string');
  });

  it('should provide readiness probe', async () => {
    const app = new Koa();
    const router = new Router();

    let isReady = true;

    const checkReadiness = async (): Promise<boolean> => {
      return isReady;
    };

    router.get('/ready', async (ctx: RouterContext) => {
      const ready = await checkReadiness();
      ctx.status = ready ? 200 : 503;
      ctx.body = { ready };
    });

    app.use(router.routes());

    const res1 = await request(http.createServer(app.callback()))
      .get('/ready')
      .expect(200);

    assert.strictEqual(res1.body.ready, true);

    isReady = false;
    const res2 = await request(http.createServer(app.callback()))
      .get('/ready')
      .expect(503);

    assert.strictEqual(res2.body.ready, false);
  });

  it('should provide liveness probe', async () => {
    const app = new Koa();
    const router = new Router();

    router.get('/live', async (ctx: RouterContext) => {
      ctx.body = { alive: true };
    });

    app.use(router.routes());

    const res = await request(http.createServer(app.callback()))
      .get('/live')
      .expect(200);

    assert.strictEqual(res.body.alive, true);
  });
});
