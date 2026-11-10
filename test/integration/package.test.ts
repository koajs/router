import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync
} from 'node:fs';
import { join, resolve } from 'node:path';
import { after, before, describe, it } from 'node:test';

const root = resolve(__dirname, '..', '..');
const npmCli = process.env['npm_execpath'] ?? '';
assert.ok(npmCli, 'Run package tests with npm test or npm run test:core.');
const expectedExports = [
  'Router',
  'RouterEvents',
  'createParameterValidationMiddleware',
  'default'
];
let directory: string;

function installPackage() {
  mkdirSync(join(root, 'tmp'), { recursive: true });
  directory = mkdtempSync(join(root, 'tmp', 'package-test-'));
  writeFileSync(join(directory, 'package.json'), '{"private":true}');
  const tarball = resolve(
    root,
    process.env['ROUTER_TEST_TARBALL'] || packPackage()
  );
  execFileSync(
    process.execPath,
    [
      npmCli,
      'install',
      '--ignore-scripts',
      '--no-audit',
      '--no-fund',
      '--package-lock=false',
      tarball
    ],
    { cwd: directory, encoding: 'utf8', timeout: 120_000 }
  );
}

function packPackage(): string {
  const output = execFileSync(
    process.execPath,
    [
      npmCli,
      'pack',
      '--ignore-scripts',
      '--json',
      '--pack-destination',
      directory
    ],
    { cwd: root, encoding: 'utf8' }
  );
  const [{ filename }] = JSON.parse(output);
  return join(directory, filename);
}

function runNode(args: string[]) {
  const env = { ...process.env };
  delete env['NODE_TEST_CONTEXT'];
  const result = spawnSync(process.execPath, args, {
    cwd: directory,
    env,
    encoding: 'utf8',
    timeout: 120_000
  });
  assert.equal(
    result.status,
    0,
    result.error?.message || result.stdout + result.stderr
  );
  return result.stdout;
}

function writeRoutingTest(extension: string): string {
  const source = readFileSync(join(__dirname, 'router.test.ts'), 'utf8');
  const consumer = source
    .replace("from '../../src'", "from '@koa/router'")
    .replace(
      "import Layer from '../../src/layer';",
      "const Layer = new Router().get('/', () => {}).stack[0].constructor;"
    )
    .replaceAll('__dirname', JSON.stringify(__dirname));
  assert.doesNotMatch(consumer, /['"](?:\.\.\/)+src(?:\/|['"])/);
  const filename = `router.test.${extension}`;
  writeFileSync(join(directory, filename), consumer);
  return filename;
}

function writeTypeTests() {
  const source = readFileSync(join(root, 'test', 'check-types.ts'), 'utf8');
  const consumer = source.replaceAll("'../src'", "'@koa/router'");
  ['cts', 'mts'].forEach((extension) => {
    writeFileSync(join(directory, `types.${extension}`), consumer);
  });
  const config = {
    extends: join(root, 'tsconfig.test.json'),
    compilerOptions: { rootDir: directory },
    include: ['types.cts', 'types.mts'],
    exclude: []
  };
  writeFileSync(join(directory, 'tsconfig.json'), JSON.stringify(config));
}

describe('Packed package', () => {
  before(installPackage);
  after(() => {
    if (directory) rmSync(directory, { recursive: true, force: true });
  });

  it('preserves the CommonJS exports and constructor aliases', () => {
    const output = runNode([
      '-e',
      `
      const assert = require('node:assert/strict');
      const Router = require('@koa/router');
      assert.equal(typeof Router, 'function');
      assert.equal(Router, Router.default);
      assert.equal(Router, Router.Router);
      assert.ok(new Router() instanceof Router);
      assert.equal(Router.url('/users/:id', { id: 123 }), '/users/123');
      const prefix = process.cwd() + require('node:path').sep;
      assert.deepEqual(Object.keys(require.cache).filter(file => !file.startsWith(prefix)), []);
      process.stdout.write(JSON.stringify(Object.keys(Router).sort()));
    `
    ]);
    assert.deepEqual(JSON.parse(output), expectedExports);
  });

  it('preserves the ESM exports and constructor aliases', () => {
    const output = runNode([
      '--input-type=module',
      '-e',
      `
      import assert from 'node:assert/strict';
      import { createRequire } from 'node:module';
      import Router, * as namespace from '@koa/router';
      const require = createRequire(import.meta.url);
      assert.equal(typeof Router, 'function');
      assert.equal(Router, namespace.Router);
      assert.ok(new Router() instanceof Router);
      assert.equal(Router.url('/users/:id', { id: 456 }), '/users/456');
      const prefix = process.cwd() + require('node:path').sep;
      assert.deepEqual(Object.keys(require.cache).filter(file => !file.startsWith(prefix)), []);
      process.stdout.write(JSON.stringify(Object.keys(namespace).sort()));
    `
    ]);
    assert.deepEqual(JSON.parse(output), expectedExports);
  });

  ['ts', 'mts'].forEach((extension) => {
    it(`passes the routing suite through the ${extension} package entry`, () => {
      const filename = writeRoutingTest(extension);
      const loader = extension === 'mts' ? '--loader' : '--require';
      const register =
        extension === 'mts'
          ? 'ts-node/esm/transpile-only'
          : 'ts-node/register/transpile-only';
      const output = runNode([
        loader,
        register,
        '--test',
        '--test-reporter=tap',
        filename
      ]);
      assert.match(output, /^# tests [1-9]\d*$/m);
    });
  });

  it('preserves the CJS and ESM consumer types', () => {
    writeTypeTests();
    const compiler = join(root, 'node_modules', 'typescript', 'bin', 'tsc');
    execFileSync(
      process.execPath,
      [compiler, '--project', join(directory, 'tsconfig.json')],
      {
        cwd: directory,
        encoding: 'utf8',
        timeout: 120_000
      }
    );
  });
});
