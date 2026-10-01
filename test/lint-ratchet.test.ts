// oxlint-disable-next-line import/no-nodejs-modules -- Exercise the real oxlint and ratchet CLIs in Node.
import { spawnSync } from 'node:child_process';
// oxlint-disable-next-line import/no-nodejs-modules -- Isolated fixtures never edit the shared source tree.
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Fixture paths are platform independent.
import { dirname, join, resolve } from 'node:path';
// oxlint-disable-next-line import/no-nodejs-modules -- Temporary test repositories live outside the checkout.
import { tmpdir } from 'node:os';
// oxlint-disable-next-line import/no-nodejs-modules -- Child processes use the Vitest worker's Node executable.
import { env, execPath } from 'node:process';
import { afterAll, describe, expect, it } from 'vitest';

interface Case { id: string; file: string; rule: string; code: string; count: number }
interface Diagnostic { code: string; filename: string; message: string }
interface Baseline {
  allow?: Record<string, Record<string, string>>;
  budgets?: Record<string, number>;
  debugRows?: { max: number; raisedBy: string[]; note?: string };
  [rule: `wildshard/${string}`]: Record<string, number>;
}
const dirs: string[] = [];
afterAll(() => { for (const dir of dirs) rmSync(dir, { recursive: true, force: true }); });
function temp(): string { const dir = mkdtempSync(join(tmpdir(), 'wildshard-lint-')); dirs.push(dir); return dir; }
function put(root: string, file: string, code: string): void { const path = join(root, file); mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, code); }
const cases = JSON.parse(readFileSync('test/fixtures/lint/cases.json', 'utf8')) as Case[];
const fixtureRoot = temp();
for (const item of cases) put(fixtureRoot, item.file, item.code);
const fixtureBaseline = join(fixtureRoot, 'ratchet.json');
writeFileSync(fixtureBaseline, JSON.stringify({ allow: { 'wildshard/no-raw-random-time': { 'src/ui/perfHud.ts': 'fixture diagnostic stopwatch' } } }));
const lint = spawnSync(execPath, [resolve('node_modules/oxlint/bin/oxlint'), '-c', resolve('.oxlintrc.ratchet.json'), '-f', 'json', 'src'], {
  cwd: fixtureRoot, encoding: 'utf8', env: { ...env, WILDSHARD_RATCHET_FILE: fixtureBaseline },
});
const diagnostics = (JSON.parse(lint.stdout) as { diagnostics: Diagnostic[] }).diagnostics;

describe('F4 rules through the real oxlint plugin', () => {
  it('oxlint reports rule violations rather than a plugin/config failure', () => { expect(lint.status).toBe(1); expect(lint.stderr).toBe(''); });
  it.each(cases)('$id', (item) => {
    expect(diagnostics.filter((diagnostic) => diagnostic.filename === item.file && diagnostic.code === `wildshard(${item.rule})`), item.code).toHaveLength(item.count);
  });
});

function fixture(code = "localStorage.getItem('x');"): {
  root: string; file: string; read: () => Baseline; write: (baseline: Baseline) => void;
  run: (...args: string[]) => ReturnType<typeof spawnSync>;
} {
  const root = temp(), file = join(root, 'ratchet.json');
  put(root, 'src/ui/example.ts', code);
  return {
    root, file,
    read: () => JSON.parse(readFileSync(file, 'utf8')) as Baseline,
    write: (baseline) => { writeFileSync(file, JSON.stringify(baseline)); },
    run: (...args) => spawnSync(execPath, ['lint/ratchet.mjs', '--root', root, '--baseline', file, ...args], { encoding: 'utf8' }),
  };
}
describe('ratchet CLI', () => {
  it('initializes once and rejects missing baselines and unknown options', () => {
    const f = fixture(); expect(f.run().status).toBe(1); expect(f.run('--init').status).toBe(0);
    expect(f.read()['wildshard/no-raw-save']).toEqual({ 'src/ui/example.ts': 1 });
    expect(f.run('--init').status).toBe(1); expect(f.run('--oops').status).toBe(1);
    expect(f.run('--init', '--update').status).toBe(1);
  });
  it('reports rises and rejects mixed rise/fall updates atomically', () => {
    const f = fixture(); expect(f.run('--init').status).toBe(0);
    f.write({ ...f.read(), 'wildshard/no-raw-input': { 'src/deleted.ts': 4 } });
    const before = readFileSync(f.file, 'utf8');
    put(f.root, 'src/ui/example.ts', "localStorage.getItem('x'); sessionStorage.getItem('y');");
    const result = f.run('--update'); expect(result.status).toBe(1);
    expect(result.stderr).toContain('src/ui/example.ts: wildshard/no-raw-save was 1, now 2');
    expect(readFileSync(f.file, 'utf8')).toBe(before);
  });
  it('rejects a new file with a violation even if an old file was deleted', () => {
    const f = fixture(); expect(f.run('--init').status).toBe(0);
    rmSync(join(f.root, 'src/ui/example.ts')); put(f.root, 'src/ui/new.ts', "localStorage.getItem('x');");
    expect(f.run().stderr).toContain('src/ui/new.ts: wildshard/no-raw-save was 0, now 1');
  });
  it('lowers counts, removes zero/deleted files and preserves all non-file entries', () => {
    const f = fixture("localStorage.getItem('x'); sessionStorage.getItem('y');"); expect(f.run('--init').status).toBe(0);
    const baseline = f.read();
    baseline.budgets = { 'sample.phone.spawn.gpuMs': 12 };
    baseline.debugRows = { max: 5, raisedBy: ['E357'], note: 'keep me' };
    baseline.allow = { 'wildshard/no-raw-random-time': { 'src/ui/perf.ts': 'measurement only' } };
    baseline['wildshard/no-raw-save'] = { ...baseline['wildshard/no-raw-save'], 'src/deleted.ts': 3 };
    f.write(baseline); put(f.root, 'src/ui/example.ts', "localStorage.getItem('x');");
    expect(f.run('--update').status).toBe(0);
    expect(f.read()['wildshard/no-raw-save']).toEqual({ 'src/ui/example.ts': 1 });
    expect(f.read().allow).toEqual(baseline.allow); expect(f.read().budgets).toEqual(baseline.budgets);
    expect(f.read().debugRows).toEqual({ ...baseline.debugRows, max: 0 });
    put(f.root, 'src/ui/example.ts', 'export const x = 1;'); expect(f.run('--update').status).toBe(0);
    expect(f.read()['wildshard/no-raw-save']).toBeUndefined();
  });
  it('adds one configured rule exactly once and leaves non-file sections untouched', () => {
    const f = fixture(); f.write({ budgets: { 'sample.desktop.spawn.draws': 3 }, debugRows: { max: 2, raisedBy: ['E357'] } });
    expect(f.run('--add-rule', 'wildshard/no-raw-save').status).toBe(0);
    expect(f.read()['wildshard/no-raw-save']).toEqual({ 'src/ui/example.ts': 1 });
    expect(f.read().debugRows).toEqual({ max: 2, raisedBy: ['E357'] });
    expect(f.run('--add-rule', 'wildshard/no-raw-save').status).toBe(1);
    expect(f.run('--add-rule', 'wildshard/missing').status).toBe(1);
    expect(f.run('--add-rule', 'wildshard/layer').status).toBe(0);
    expect(f.run('--add-rule', 'wildshard/layer').status).toBe(1);
  });
  it('counts static registry entries and plugin rows, and refuses a Debug-row rise', () => {
    const f = fixture('export const DEBUG_ROWS = [opt(), { id: "x" }]; ctx.debugRow({});');
    expect(f.run('--init').status).toBe(0);
    f.write({ ...f.read(), debugRows: { max: 10, raisedBy: [] } });
    expect(f.run('--update').status).toBe(0); expect(f.read().debugRows?.max).toBe(3);
    put(f.root, 'src/ui/example.ts', 'export const DEBUG_ROWS = [opt(), opt(), { id: "x" }]; ctx.debugRow({});');
    const before = readFileSync(f.file, 'utf8');
    expect(f.run('--update').stderr).toContain('debugRows: was 3, now 4'); expect(readFileSync(f.file, 'utf8')).toBe(before);
  });
  it('honors reasoned measurement allowances only for performance.now', () => {
    const f = fixture('performance.now(); Math.random();');
    f.write({ allow: { 'wildshard/no-raw-random-time': { 'src/ui/example.ts': 'diagnostic stopwatch' } } });
    expect(f.run('--add-rule', 'wildshard/no-raw-random-time').status).toBe(0);
    expect(f.read()['wildshard/no-raw-random-time']).toEqual({ 'src/ui/example.ts': 1 });
  });
  it.each(['{broken', '{"budgets":{"x":-1}}', '{"debugRows":{"max":"1","raisedBy":[]}}', '{"wildshard/layer":{"x":1.5}}'])('fails closed on malformed data: %s', (data) => {
    const f = fixture(); writeFileSync(f.file, data); expect(f.run('--update').status).toBe(1); expect(readFileSync(f.file, 'utf8')).toBe(data);
  });
  it('fails closed on parse errors instead of lowering a count', () => {
    const f = fixture(); expect(f.run('--init').status).toBe(0);
    const before = readFileSync(f.file, 'utf8'); put(f.root, 'src/ui/example.ts', 'const = ;');
    expect(f.run('--update').status).toBe(1); expect(readFileSync(f.file, 'utf8')).toBe(before);
  });
});
