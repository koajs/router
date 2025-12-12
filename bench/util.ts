import process from 'node:process';
import chalk from 'chalk';

export const operations = 1_000_000;

/**
 * Get current high-resolution time in milliseconds
 * Uses process.hrtime.bigint() for better precision
 */
export function now(): number {
  return Number(process.hrtime.bigint()) / 1e6;
}

/**
 * Calculate operations per second
 */
export function getOpsSec(ms: number): number {
  return Math.round((operations * 1000) / ms);
}

/**
 * Print benchmark result
 */
export function print(name: string, time: number): number {
  const opsSec = getOpsSec(now() - time);
  console.log(
    chalk.yellow(name.padEnd(30)),
    opsSec.toLocaleString().padStart(12),
    'ops/sec'
  );
  return opsSec;
}

/**
 * Print section title
 */
export function title(name: string): void {
  console.log(
    chalk.green(`
${'='.repeat(name.length + 4)}
  ${name}
${'='.repeat(name.length + 4)}`)
  );
}

/**
 * Warmup function - runs the benchmark once to warm up JIT
 */
export function warmup(fn: () => void, iterations = 10_000): void {
  for (let i = 0; i < iterations; i++) {
    fn();
  }
}

export class Queue {
  private q: Array<(callback: () => void) => void> = [];
  private running = false;

  add(job: (callback: () => void) => void): void {
    this.q.push(job);
    if (!this.running) this.run();
  }

  private run(): void {
    this.running = true;
    const job = this.q.shift();
    if (job) {
      job(() => {
        if (this.q.length > 0) {
          this.run();
        } else {
          this.running = false;
        }
      });
    }
  }
}
