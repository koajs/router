/**
 * Module exports tests
 *
 * These tests verify that both CommonJS and ESM exports work correctly
 * after the TypeScript build. This ensures backwards compatibility for
 * users who use `const Router = require('@koa/router')` pattern.
 */
import { describe, it, before } from 'node:test';
import assert from 'node:assert';
import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const distPath = join(__dirname, '..', 'dist');
const cjsPath = join(distPath, 'index.js');
const esmPath = join(distPath, 'index.mjs');

describe('Module Exports (CJS/ESM)', () => {
  before(() => {
    if (!existsSync(cjsPath)) {
      throw new Error(
        `CJS dist file not found at ${cjsPath}. Run 'npm run build' first.`
      );
    }
    if (!existsSync(esmPath)) {
      throw new Error(
        `ESM dist file not found at ${esmPath}. Run 'npm run build' first.`
      );
    }
  });

  describe('CommonJS exports', () => {
    it('should allow `const Router = require("@koa/router")`', () => {
      const code = `
        const Router = require('${cjsPath.replace(/\\/g, '\\\\')}');
        if (typeof Router !== 'function') {
          throw new Error('Router is not a function, got: ' + typeof Router);
        }
        const router = new Router();
        if (!(router instanceof Router)) {
          throw new Error('router is not an instance of Router');
        }
        console.log('OK');
      `;
      const result = execSync(`node -e "${code}"`, { encoding: 'utf-8' });
      assert.strictEqual(result.trim(), 'OK');
    });

    it('should allow `require("@koa/router").default` for backwards compatibility', () => {
      const code = `
        const Router = require('${cjsPath.replace(/\\/g, '\\\\')}').default;
        if (typeof Router !== 'function') {
          throw new Error('Router.default is not a function, got: ' + typeof Router);
        }
        const router = new Router();
        console.log('OK');
      `;
      const result = execSync(`node -e "${code}"`, { encoding: 'utf-8' });
      assert.strictEqual(result.trim(), 'OK');
    });

    it('should allow `require("@koa/router").Router` named export', () => {
      const code = `
        const { Router } = require('${cjsPath.replace(/\\/g, '\\\\')}');
        if (typeof Router !== 'function') {
          throw new Error('Router named export is not a function, got: ' + typeof Router);
        }
        const router = new Router();
        console.log('OK');
      `;
      const result = execSync(`node -e "${code}"`, { encoding: 'utf-8' });
      assert.strictEqual(result.trim(), 'OK');
    });

    it('should have Router constructor equal to Router.Router and Router.default', () => {
      const code = `
        const Router = require('${cjsPath.replace(/\\/g, '\\\\')}');
        if (Router !== Router.Router) {
          throw new Error('Router !== Router.Router');
        }
        if (Router !== Router.default) {
          throw new Error('Router !== Router.default');
        }
        console.log('OK');
      `;
      const result = execSync(`node -e "${code}"`, { encoding: 'utf-8' });
      assert.strictEqual(result.trim(), 'OK');
    });

    it('should expose static url() method', () => {
      const code = `
        const Router = require('${cjsPath.replace(/\\/g, '\\\\')}');
        if (typeof Router.url !== 'function') {
          throw new Error('Router.url is not a function');
        }
        const url = Router.url('/users/:id', { id: 123 });
        if (url !== '/users/123') {
          throw new Error('Expected /users/123, got: ' + url);
        }
        console.log('OK');
      `;
      const result = execSync(`node -e "${code}"`, { encoding: 'utf-8' });
      assert.strictEqual(result.trim(), 'OK');
    });
  });

  describe('ESM exports', () => {
    it('should allow `import Router from "@koa/router"`', () => {
      const code = `
        import Router from '${esmPath.replace(/\\/g, '\\\\')}';
        if (typeof Router !== 'function') {
          throw new Error('Router is not a function, got: ' + typeof Router);
        }
        const router = new Router();
        if (!(router instanceof Router)) {
          throw new Error('router is not an instance of Router');
        }
        console.log('OK');
      `;
      const result = execSync(`node --input-type=module -e "${code}"`, {
        encoding: 'utf-8'
      });
      assert.strictEqual(result.trim(), 'OK');
    });

    it('should allow `import { Router } from "@koa/router"`', () => {
      const code = `
        import { Router } from '${esmPath.replace(/\\/g, '\\\\')}';
        if (typeof Router !== 'function') {
          throw new Error('Router named import is not a function, got: ' + typeof Router);
        }
        const router = new Router();
        console.log('OK');
      `;
      const result = execSync(`node --input-type=module -e "${code}"`, {
        encoding: 'utf-8'
      });
      assert.strictEqual(result.trim(), 'OK');
    });

    it('should have default export equal to named Router export', () => {
      const code = `
        import DefaultRouter from '${esmPath.replace(/\\/g, '\\\\')}';
        import { Router } from '${esmPath.replace(/\\/g, '\\\\')}';
        if (DefaultRouter !== Router) {
          throw new Error('Default export !== named Router export');
        }
        console.log('OK');
      `;
      const result = execSync(`node --input-type=module -e "${code}"`, {
        encoding: 'utf-8'
      });
      assert.strictEqual(result.trim(), 'OK');
    });

    it('should expose static url() method', () => {
      const code = `
        import Router from '${esmPath.replace(/\\/g, '\\\\')}';
        if (typeof Router.url !== 'function') {
          throw new Error('Router.url is not a function');
        }
        const url = Router.url('/users/:id', { id: 456 });
        if (url !== '/users/456') {
          throw new Error('Expected /users/456, got: ' + url);
        }
        console.log('OK');
      `;
      const result = execSync(`node --input-type=module -e "${code}"`, {
        encoding: 'utf-8'
      });
      assert.strictEqual(result.trim(), 'OK');
    });
  });
});
