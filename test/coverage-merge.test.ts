// E429: push CI's 3 vitest shards merge their coverage like one unsharded run would measure it.
// oxlint-disable-next-line import/no-nodejs-modules -- Node contract test runs the merge CLI against temporary fixtures.
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

interface Loc { start: { line: number; column: number }; end: { line: number; column: number } }
interface FileCoverage {
  path: string; statementMap: Record<string, Loc>; s: Record<string, number>;
  fnMap: Record<string, unknown>; f: Record<string, number>; branchMap: Record<string, unknown>; b: Record<string, number[]>;
}
interface Metric { total: number; covered: number; pct: number }
interface Summary { total: { lines: Metric; statements: Metric; functions: Metric; branches: Metric } }

const dirs: string[] = [];
afterEach(() => { for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true }); });

const loc = (line: number): Loc => ({ start: { line, column: 0 }, end: { line, column: 9 } });
/** a file with `hits.length` statements on lines 1…n and one function */
function file(path: string, hits: number[], fn = 0): FileCoverage {
  return {
    path,
    statementMap: Object.fromEntries(hits.map((_, i) => [String(i), loc(i + 1)])),
    s: Object.fromEntries(hits.map((n, i) => [String(i), n])),
    fnMap: { '0': { name: 'f', loc: loc(1) } }, f: { '0': fn },
    branchMap: {}, b: {},
  };
}
const emptyFile = (path: string): FileCoverage => ({ path, statementMap: {}, s: {}, fnMap: {}, f: {}, branchMap: {}, b: {} });

function merge(shards: FileCoverage[][]): { status: number | null; summary: Summary | undefined; stderr: string } {
  const dir = mkdtempSync(join(tmpdir(), 'coverage-merge-'));
  dirs.push(dir);
  const inputs = shards.map((files, i) => {
    const p = join(dir, `shard-${i}.json`);
    writeFileSync(p, JSON.stringify(Object.fromEntries(files.map((f) => [f.path, f]))));
    return p;
  });
  const out = join(dir, 'summary.json');
  const run = spawnSync(process.execPath, ['scripts/coverage-merge.mjs', '--out', out, ...inputs], { encoding: 'utf8' });
  const summary = run.status === 0 ? (JSON.parse(readFileSync(out, 'utf8')) as Summary) : undefined;
  return { status: run.status, summary, stderr: run.stderr };
}

describe('coverage-merge (E429)', () => {
  it('sums the shards that ran a file and ignores the untested copies of it', () => {
    const a = merge([[file('/a.ts', [1, 0, 0, 0], 1)], [file('/a.ts', [0, 0, 0, 0])], [file('/a.ts', [2, 3, 0, 0], 1)]]);
    expect(a.status).toBe(0);
    expect(a.summary?.total.statements).toMatchObject({ total: 4, covered: 2, pct: 50 });
    expect(a.summary?.total.functions).toMatchObject({ total: 1, covered: 1, pct: 100 });
  });

  it('a file loaded with an empty map wins over the untested copies (one run leaves it out too)', () => {
    const r = merge([[emptyFile('/m.ts'), file('/a.ts', [1, 1], 1)], [file('/m.ts', [0, 0, 0, 0, 0, 0]), file('/a.ts', [0, 0])]]);
    expect(r.summary?.total.statements).toMatchObject({ total: 2, covered: 2, pct: 100 });
    expect(r.summary?.total.lines).toMatchObject({ total: 2, covered: 2 });
  });

  it('a file no shard loaded counts once as untested', () => {
    const r = merge([[file('/u.ts', [0, 0, 0])], [file('/u.ts', [0, 0, 0])], [file('/a.ts', [1], 1)]]);
    expect(r.summary?.total.statements).toMatchObject({ total: 4, covered: 1, pct: 25 });
  });

  it('refuses shards that ran a file with different statement maps', () => {
    const r = merge([[file('/a.ts', [1, 1], 1)], [file('/a.ts', [1], 1)]]);
    expect(r.status).toBe(1);
    expect(r.stderr).toContain('different statement maps');
  });
});
