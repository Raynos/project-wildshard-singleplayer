// oxlint-disable-next-line import/no-nodejs-modules -- Node contract test runs the coverage CLI against temporary fixtures.
import { spawnSync } from 'node:child_process';
// oxlint-disable-next-line import/no-nodejs-modules -- The fixtures live outside the shared repository.
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Node temporary-file paths are platform-independent.
import { join } from 'node:path';
// oxlint-disable-next-line import/no-nodejs-modules -- Keep fixtures in the system temporary directory.
import { tmpdir } from 'node:os';
// oxlint-disable-next-line import/no-nodejs-modules -- Run the same Node executable as the Vitest worker.
import process from 'node:process';
import { afterEach, describe, expect, it } from 'vitest';

interface Percentages { lines: number; statements: number; functions: number; branches: number }
const starting: Percentages = { lines: 10.12, statements: 11.23, functions: 12.34, branches: 13.45 };
const fixtures: string[] = [];
afterEach(() => { for (const path of fixtures.splice(0)) rmSync(path, { recursive: true, force: true }); });

function fixture(current: Percentages = starting): {
  baselineFile: string; summaryFile: string; run: (...args: string[]) => ReturnType<typeof spawnSync>;
} {
  const dir = mkdtempSync(join(tmpdir(), 'wildshard-coverage-'));
  fixtures.push(dir);
  const baselineFile = join(dir, 'ratchet.json'), summaryFile = join(dir, 'summary.json');
  writeFileSync(baselineFile, `${JSON.stringify(starting, null, 2)}\n`);
  const metrics = ['lines', 'statements', 'functions', 'branches'] as const;
  writeFileSync(summaryFile, JSON.stringify({ total: Object.fromEntries(metrics.map((key) => [key, { pct: current[key] }])) }));
  return { baselineFile, summaryFile, run: (...args) => spawnSync(process.execPath,
    ['scripts/coverage-ratchet.mjs', '--summary', summaryFile, '--baseline', baselineFile, ...args], { encoding: 'utf8' }) };
}

describe('coverage ratchet CLI', () => {
  it.each(['lines', 'statements', 'functions', 'branches'] as const)('a %s drop exits 1 and --update does not lower the baseline', (key) => {
    const f = fixture({ ...starting, [key]: starting[key] - 0.01 }), before = readFileSync(f.baselineFile, 'utf8');
    const check = f.run(); expect(check.status).toBe(1); expect(String(check.stderr)).toContain(`Coverage dropped: ${key}`);
    expect(f.run('--update').status).toBe(1);
    expect(readFileSync(f.baselineFile, 'utf8')).toBe(before);
  });

  it('equal coverage exits 0 without rewriting', () => {
    const f = fixture(), before = readFileSync(f.baselineFile, 'utf8');
    expect(f.run().status).toBe(0); expect(f.run('--update').status).toBe(0);
    expect(readFileSync(f.baselineFile, 'utf8')).toBe(before);
  });

  it('a rise passes without writing, then --update raises only to the measured values', () => {
    const current = { ...starting, lines: 20.25 }, f = fixture(current), before = readFileSync(f.baselineFile, 'utf8');
    expect(f.run().status).toBe(0); expect(readFileSync(f.baselineFile, 'utf8')).toBe(before);
    expect(f.run('--update').status).toBe(0);
    expect(JSON.parse(readFileSync(f.baselineFile, 'utf8')) as Percentages).toEqual(current);
  });

  it('a mixed rise/drop refuses the update atomically', () => {
    const f = fixture({ ...starting, lines: 90, branches: 1 }), before = readFileSync(f.baselineFile, 'utf8');
    expect(f.run('--update').status).toBe(1); expect(readFileSync(f.baselineFile, 'utf8')).toBe(before);
  });

  it('a missing baseline fails unless explicitly initialized with --update', () => {
    const f = fixture(); rmSync(f.baselineFile);
    expect(f.run().status).toBe(1); expect(f.run('--update').status).toBe(0);
    expect(JSON.parse(readFileSync(f.baselineFile, 'utf8')) as Percentages).toEqual(starting);
  });

  it.each(['{}', '{broken', '{"total":{"lines":{"pct":"100"}}}'])('malformed or incomplete summaries fail closed: %s', (summary) => {
    const f = fixture(); writeFileSync(f.summaryFile, summary);
    expect(f.run('--update').status).toBe(1);
  });

  it('missing reports, malformed baselines and unknown options fail closed', () => {
    const f = fixture(); expect(f.run('--oops').status).toBe(1);
    writeFileSync(f.baselineFile, JSON.stringify({ ...starting, lines: -1 }));
    expect(f.run('--update').status).toBe(1);
    rmSync(f.summaryFile); expect(f.run().status).toBe(1);
  });
});
