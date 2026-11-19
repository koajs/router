import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const legacyHooksPath = '.husky/_';
const hookContents = `#!/bin/sh
# koa-router-managed-hook
set -eu
if ! git diff --quiet --; then
  printf '%s\\n' 'Stage or set aside unstaged changes before committing.' >&2
  exit 1
fi
npm run validate
`;

function installHook() {
  const isCI = process.env.CI === 'true' || process.env.CI === '1';
  if (isCI) return;
  if (!isGitCheckout()) return;
  if (readHooksPath() !== undefined) {
    console.log('Skipping hooks: core.hooksPath is already configured.');
    return;
  }
  const hooksDir = git(['rev-parse', '--git-path', 'hooks']);
  writeHook(hooksDir);
}

function isGitCheckout() {
  if (!existsSync('.git')) return false;
  const result = spawnSync('git', ['rev-parse', '--is-inside-work-tree'], {
    encoding: 'utf8'
  });
  return result.status === 0 && result.stdout.trim() === 'true';
}

function readHooksPath() {
  const hooksPath = git(['config', '--get', 'core.hooksPath'], 1);
  if (hooksPath !== legacyHooksPath) return hooksPath;

  const localPath = git(['config', '--local', '--get', 'core.hooksPath'], 1);
  if (localPath === legacyHooksPath) {
    git([
      'config',
      '--local',
      '--fixed-value',
      '--unset-all',
      'core.hooksPath',
      legacyHooksPath
    ]);
  }
  return git(['config', '--get', 'core.hooksPath'], 1);
}

function writeHook(hooksDir: string) {
  const hookPath = join(hooksDir, 'pre-commit');
  if (existsSync(hookPath)) return;
  mkdirSync(hooksDir, { recursive: true });
  try {
    writeFileSync(hookPath, hookContents, { mode: 0o755, flag: 'wx' });
    console.log('Installed pre-commit hook.');
  } catch (error) {
    const hookExists =
      error instanceof Error && 'code' in error && error.code === 'EEXIST';
    if (!hookExists) throw error;
    console.log('Skipping existing pre-commit hook.');
  }
}

function git(args: string[]): string;
function git(args: string[], allowedExitCode: 1): string | undefined;
function git(args: string[], allowedExitCode?: 1) {
  const result = spawnSync('git', args, { encoding: 'utf8' });
  if (result.error) throw result.error;
  if (result.status === 0) return result.stdout.replace(/\r?\n$/, '');
  if (result.status === allowedExitCode) return undefined;
  throw new Error(result.stderr.trim() || `git ${args.join(' ')} failed`);
}

installHook();
