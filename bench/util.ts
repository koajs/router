import process from 'node:process';
import chalk from 'chalk';

export const operations = 1_000_000;

export function now(): number {
  const ts = process.hrtime();
  return ts[0] * 1e3 + ts[1] / 1e6;
}

export function getOpsSec(ms: number): number {
  return Number(((operations * 1000) / ms).toFixed(0));
}

export function print(name: string, time: number): number {
  const opsSec = getOpsSec(now() - time);
  console.log(chalk.yellow(name), opsSec.toLocaleString(), 'ops/sec');
  return Number(opsSec);
}

export function title(name: string): void {
  console.log(
    chalk.green(`
${'='.repeat(name.length + 2)}
 ${name}
${'='.repeat(name.length + 2)}`)
  );
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
