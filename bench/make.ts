/**
 * Benchmark Makefile equivalent in TypeScript
 *
 * Runs all benchmark tests with different factors and middleware configurations.
 * This replaces the Makefile for cross-platform compatibility.
 */

import { spawn } from 'node:child_process';
import { join } from 'node:path';

const projectRoot = join(
  typeof __dirname !== 'undefined' ? __dirname : process.cwd(),
  '..'
);

const factors = [1, 5, 10, 20, 50, 100, 200, 500, 1000];
const middlewareOptions = [false, true];

async function runBenchmark(
  factor: number,
  useMiddleware: boolean
): Promise<void> {
  return new Promise((resolve, reject) => {
    const childProcess = spawn(
      'node',
      [
        '--require',
        'ts-node/register',
        'bench/run.ts',
        String(factor),
        String(useMiddleware)
      ],
      {
        env: {
          ...process.env,
          TS_NODE_PROJECT: 'tsconfig.bench.json'
        },
        stdio: 'inherit',
        cwd: projectRoot
      }
    );

    childProcess.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Benchmark failed with code ${code}`));
      }
    });

    childProcess.on('error', (error) => {
      reject(error);
    });
  });
}

async function runAllBenchmarks(): Promise<void> {
  console.log('Running all benchmarks...\n');

  for (const useMiddleware of middlewareOptions) {
    console.log(`\nMiddleware: ${useMiddleware}\n`);

    for (const factor of factors) {
      try {
        await runBenchmark(factor, useMiddleware);
        await new Promise((resolve) => setTimeout(resolve, 100));
      } catch (error) {
        console.error(
          `Error running benchmark with factor ${factor}, middleware ${useMiddleware}:`,
          error
        );
        process.exit(1);
      }
    }
  }

  console.log('\nAll benchmarks completed!');
}

runAllBenchmarks().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
