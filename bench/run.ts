/**
 * Benchmark runner script
 *
 * Runs a single benchmark test with specified factor and middleware usage.
 * Usage: node --require ts-node/register bench/run.ts <factor> <useMiddleware>
 * Example: node --require ts-node/register bench/run.ts 10 false
 */

import { spawn } from 'node:child_process';
import { join } from 'node:path';

const projectRoot = join(
  typeof __dirname !== 'undefined' ? __dirname : process.cwd(),
  '..'
);

const factor = process.argv[2] || '10';
const useMiddleware = process.argv[3] === 'true';
const port = process.env.PORT || '3000';
const host = `http://localhost:${port}`;

const serverProcess = spawn(
  'node',
  ['--require', 'ts-node/register', 'bench/server.ts'],
  {
    env: {
      ...process.env,
      TS_NODE_PROJECT: 'tsconfig.bench.json',
      FACTOR: factor,
      USE_MIDDLEWARE: String(useMiddleware),
      PORT: port
    },
    stdio: 'pipe',
    cwd: projectRoot
  }
);

let serverOutput = '';
serverProcess.stdout?.on('data', (data) => {
  serverOutput += data.toString();
});

serverProcess.stderr?.on('data', (data) => {
  console.error(data.toString());
});

async function waitForServer(maxRetries = 30, delay = 200): Promise<void> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch(`${host}/_health`);
      if (response.ok) {
        return;
      }
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, delay));
  }
  throw new Error('Server failed to start');
}

async function runBenchmark(): Promise<void> {
  try {
    await waitForServer();

    const wrkPath = process.env.WRK_PATH || 'wrk';

    const { execSync } = await import('node:child_process');
    const isWindows = process.platform === 'win32';

    try {
      if (isWindows) {
        try {
          execSync(`where ${wrkPath}`, { stdio: 'ignore' });
        } catch {
          try {
            execSync(`wsl which ${wrkPath}`, { stdio: 'ignore' });
          } catch {
            throw new Error('wrk not found');
          }
        }
      } else {
        execSync(`which ${wrkPath}`, { stdio: 'ignore' });
      }
    } catch {
      console.error(`\nError: '${wrkPath}' command not found.`);
      console.error('Please install wrk:');
      if (isWindows) {
        console.error('  Windows options:');
        console.error('    1. Use WSL (Windows Subsystem for Linux):');
        console.error('       - Install WSL: wsl --install');
        console.error('       - Then in WSL: sudo apt-get install wrk');
        console.error('    2. Use alternative tools that work on Windows:');
        console.error('       - autocannon: npm install -g autocannon');
        console.error(
          '       - Apache Bench (ab): Install via Apache HTTP Server'
        );
        console.error(
          '    3. Set WRK_PATH to point to wrk executable in WSL or alternative tool'
        );
      } else {
        console.error('  macOS: brew install wrk');
        console.error(
          '  Linux: sudo apt-get install wrk (or use your package manager)'
        );
      }
      console.error(
        '  Or set WRK_PATH environment variable to point to wrk executable\n'
      );
      process.exit(1);
    }

    const wrkProcess = spawn(
      wrkPath,
      [`${host}/10/child/grandchild/%40`, '-d', '3', '-c', '50', '-t', '8'],
      {
        stdio: 'pipe'
      }
    );

    let wrkOutput = '';
    wrkProcess.stdout?.on('data', (data) => {
      wrkOutput += data.toString();
    });

    wrkProcess.stderr?.on('data', () => {});

    await new Promise<void>((resolve, reject) => {
      wrkProcess.on('close', (code) => {
        if (code === 0) {
          const match = wrkOutput.match(/Requests\/sec:\s+([\d.]+)/);
          if (match) {
            console.log(`  ${match[1]}`);
          } else {
            console.log('  Unable to parse requests/sec');
          }
          resolve();
        } else {
          reject(new Error(`wrk exited with code ${code}`));
        }
      });
    });
  } catch (error) {
    console.error('Error running benchmark:', error);
    process.exit(1);
  } finally {
    serverProcess.kill();
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}

runBenchmark().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
