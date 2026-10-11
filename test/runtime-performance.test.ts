// oxlint-disable-next-line import/no-nodejs-modules -- Immutable frozen-source identities in the guard fixture.
import { createHash } from 'node:crypto';
// oxlint-disable-next-line import/no-nodejs-modules -- Exercise the real lint binary and immutable predecessor files.
import { spawnSync } from 'node:child_process';
// oxlint-disable-next-line import/no-nodejs-modules -- Fixtures own and remove their temporary files.
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Temporary fixture root.
import { tmpdir } from 'node:os';
// oxlint-disable-next-line import/no-nodejs-modules -- Real binary and policy fixture paths.
import { dirname, join, resolve } from 'node:path';
import { checkProjectRuntime } from '../src/sdk/runtimePerformance';
import { comparePlatformList } from '../scripts/check-platform-ratchets.mjs';
import { expect, it } from 'vitest';
import { runtimePerformanceSites, runtimePerformanceViolations, frozenRuntimePerformanceViolations } from '../lint/runtime-performance.mjs';

it('refuses frame allocations through methods, local helpers, aliases and scheduled callbacks', () => {
  for (const code of [
    'function update(){ return new Float32Array(3) }',
    'class Native { tick(){ return { value: 1 } } }',
    'const helper=()=>[1]; const alias=helper; function update(){return alias()}',
    'function worker(){ return values.map(x=>x*2) } ctx.system({run:worker})',
    `function worker(){ return \`health \${hp}\` } game.onUpdate(worker)`,
  ]) expect(runtimePerformanceSites(code).some(site => site.kind === 'frame-allocation'), code).toBe(true);
  expect(runtimePerformanceSites('const buffer=new Float32Array(3); function update(){buffer[0]=1}')).toEqual([]);
});

it('refuses raw rendering, DOM, timers and fetch including computed names and destructuring', () => {
  for (const code of ['ctx.world.renderer.render()', 'const K="getContext"; canvas[K]("webgl")', 'const {renderer:r}=world', 'document.createElement("div")', 'const {fetch:f}=globalThis; f("url")', 'scope.timeout(10, fn)', 'setInterval(fn,1)', 'new Scene()']) {
    expect(runtimePerformanceSites(code).some(site => ['raw-render', 'dom', 'async'].includes(site.kind)), code).toBe(true);
  }
  expect(runtimePerformanceSites('import type { Scene } from "three"; let value: Scene;')).toEqual([]);
  expect(runtimePerformanceSites('(world.renderer as object)')).not.toEqual([]);
});

it('requires finite loop bounds and detects recursion, mutable bounds and counter resets', () => {
  for (const code of ['function update(){while(alive) work()}', 'for(;;){}', 'for(const x of things) work(x)', 'let N=10;for(let i=0;i<N;i++){N++}', 'for(let i=0;i<10;i++){i=0}', 'function update(){next()} function next(){update()}']) expect(runtimePerformanceSites(code).some(site => site.kind === 'unbounded-loop'), code).toBe(true);
  expect(runtimePerformanceSites('const N=10;function update(){for(let i=0;i<N;i++){state.x+=i}}')).toEqual([]);
  expect(runtimePerformanceSites('function update(){for(let i=0;i<Math.min(length,100);i++){state.x+=i}}')).toEqual([]);
  expect(runtimePerformanceSites('for(const x of [1,2,3]) use(x)')).toEqual([]);
  expect(runtimePerformanceSites('const N=10;function update(N){for(let i=0;i<N;i++) work()}').some(site => site.kind === 'unbounded-loop')).toBe(true);
});

it('permits only exact existing sites at their original path and multiplicity', () => {
  const source = 'function update(){ new Float32Array(3) }', filename = 'src/shards/fixture/runtime/native.ts';
  const site = runtimePerformanceSites(source, filename)[0]; if (site === undefined) throw new Error('Missing refusal fixture');
  const baseline = { [`${filename}:${site.kind}:${site.site}`]: { count: 1, row: 'SF46' } };
  expect(runtimePerformanceViolations(source, filename, baseline)).toEqual([]);
  expect(runtimePerformanceViolations(`\n${source}`, filename, baseline)).toEqual([]);
  expect(runtimePerformanceViolations(source.replace('(3)', '(4)'), filename, baseline)).toHaveLength(1);
  expect(runtimePerformanceViolations(source.replace('new Float32Array(3)', 'new Float32Array(3); new Float32Array(3)'), filename, baseline)).toHaveLength(1);
  expect(runtimePerformanceViolations(source, 'outside/runtime/native.ts', baseline)).toHaveLength(1);
});


it('enables the actual hard oxlint rule on shard runtime paths', () => {
  const root = mkdtempSync(join(tmpdir(), 'runtime-perf-'));
  try {
    mkdirSync(join(root, 'src/shards/outside/runtime'), { recursive: true });
    writeFileSync(join(root, 'src/shards/outside/runtime/native.ts'), 'export function update(){return new Float32Array(3)}');
    writeFileSync(join(root, 'lint.json'), JSON.stringify({ jsPlugins: [resolve('lint/wildshard-plugin.js')], categories: { correctness: 'off' }, rules: { 'wildshard/runtime-performance': 'error' } }));
    const result = spawnSync('node', [resolve('node_modules/oxlint/bin/oxlint'), '-c', join(root, 'lint.json'), '-f', 'json', 'src'], { cwd: root, encoding: 'utf8' });
    expect(result.status, result.stderr).toBe(1);
    expect(result.stdout).toContain('frame-allocation');
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it('refuses an unreviewed missing predecessor, then permits shrinking exact sites without changing owners', () => {
  const root = mkdtempSync(join(tmpdir(), 'runtime-debt-')), list = 'lint/runtime-performance.json';
  try {
    const before = join(root, 'before.json'), after = join(root, 'after.json');
    const reviewed = readFileSync(list, 'utf8');
    writeFileSync(after, JSON.stringify({ about: 'unreviewed', baselineAt: 'unreviewed', sites: {} }));
    expect(comparePlatformList(list, before, after).join(',')).toContain('bootstrap differs');
    writeFileSync(before, reviewed); writeFileSync(after, reviewed);
    expect(comparePlatformList(list, before, after)).toEqual([]);
    const document = JSON.parse(reviewed) as { sites: Record<string, { count: number; row: string }> };
    const key = Object.keys(document.sites)[0]; if (key === undefined) throw new Error('Missing reviewed inventory');
    const site = document.sites[key]; if (site === undefined) throw new Error('Missing reviewed site');
    site.count++; writeFileSync(after, JSON.stringify(document));
    expect(comparePlatformList(list, before, after).join(',')).toContain('count rose');
    site.count--; site.row = 'different'; writeFileSync(after, JSON.stringify(document));
    expect(comparePlatformList(list, before, after).join(',')).toContain('owner changed');
    delete document.sites[key]; writeFileSync(after, JSON.stringify(document));
    expect(comparePlatformList(list, before, after)).toEqual([]);
    document.sites['src/shards/outside/runtime/new.ts:frame-allocation:new'] = { count: 1, row: 'SF46' };
    writeFileSync(after, JSON.stringify(document));
    expect(comparePlatformList(list, before, after).join(',')).toContain('new runtime site');
    rmSync(before); expect(comparePlatformList(list, before, after).join(',')).toContain('bootstrap differs');
  } finally { rmSync(root, { recursive: true, force: true }); }
});


it('checks actual author runtime files with zero outside allowance before the build', () => {
  const root = mkdtempSync(join(tmpdir(), 'author-runtime-'));
  try {
    mkdirSync(join(root, 'runtime')); const source = join(root, 'runtime/native.ts');
    writeFileSync(source, 'const buffer=new Float32Array(3); export function update(){buffer[0]=1}');
    expect(() => checkProjectRuntime(root, 'refuse')).not.toThrow();
    writeFileSync(source, 'export function update(){return new Float32Array(3)}');
    expect(() => checkProjectRuntime(root, 'refuse')).toThrow('frame-allocation');
    writeFileSync(source, 'export function update(){while(true){}}');
    expect(() => checkProjectRuntime(root, 'refuse')).toThrow('unbounded-loop');
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it.each(['game', 'sdk', 'engine'])('admits a verbatim %s site only when its predecessor implementation is removed', layer => {
  const root = mkdtempSync(join(tmpdir(), 'runtime-move-'));
  try {
    const baselineRoot = join(root, 'before'), candidateRoot = join(root, 'after');
    const list = 'lint/runtime-performance.json', filename = 'src/shards/fixture/runtime/moved.ts';
    const original = 'export function update(){return new Float32Array(3)}';
    const write = (tree: string, name: string, source: string): void => {
      const path = join(tree, name); mkdirSync(join(path, '..'), { recursive: true }); writeFileSync(path, source);
    };
    const old = `src/${layer}/system.ts`;
    write(baselineRoot, old, original);
    write(candidateRoot, filename, `\n${original}\n`);
    const before = { about: 'fixture', baselineAt: 'fixture', sites: {} };
    const site = runtimePerformanceSites(original, filename)[0]; if (site === undefined) throw new Error('Missing move fixture');
    const key = `${filename}:${site.kind}:${site.site}`;
    const after = { ...before, sites: { [key]: { count: 1, row: 'SF76 verbatim move' } } };
    write(baselineRoot, list, JSON.stringify(before)); write(candidateRoot, list, JSON.stringify(after));
    const compare = (): string[] => comparePlatformList(list, join(baselineRoot, list), join(candidateRoot, list), { baselineRoot, candidateRoot });
    expect(compare()).toEqual([]);
    write(candidateRoot, old, 'export const retained = 1'); // A smaller surviving module is valid too.
    expect(compare()).toEqual([]);
    write(candidateRoot, old, original); // Keeping the old implementation grants no new allowance.
    expect(compare().join(',')).toContain('new runtime site');
    write(candidateRoot, old, 'export const retained = 1');
    write(candidateRoot, filename, original.replace('(3)', '(4)'));
    expect(compare().join(',')).toContain('new runtime site');
    const changed = runtimePerformanceSites(original.replace('(3)', '(4)'), filename)[0]; if (changed === undefined) throw new Error('Missing edited fixture');
    write(candidateRoot, list, JSON.stringify({ ...before, sites: { [`${filename}:${changed.kind}:${changed.site}`]: { count: 1, row: 'SF76' } } }));
    expect(compare().join(',')).toContain('new runtime site'); // A new hash cannot consume the old code span.
    write(candidateRoot, filename, original);
    write(candidateRoot, list, JSON.stringify({ ...before, sites: { [key]: { count: 2, row: 'SF76' } } }));
    expect(compare().join(',')).toContain('new runtime site'); // Counts cannot grow during a move.
    const second = 'src/shards/fixture/runtime/copied.ts'; write(candidateRoot, second, original);
    write(candidateRoot, list, JSON.stringify({ ...after, sites: { ...after.sites, [`${second}:${site.kind}:${site.site}`]: { count: 1, row: 'SF76' } } }));
    expect(compare()).toHaveLength(1); // One removed site cannot fund two destinations.
    rmSync(join(baselineRoot, old)); write(candidateRoot, list, JSON.stringify(after));
    expect(compare().join(',')).toContain('new runtime site'); // No predecessor, no migration.
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it('admits one verbatim primary copy of a retained platform module only for an exact registered frozen caller', () => {
  const root = mkdtempSync(join(tmpdir(), 'legacy-runtime-copy-'));
  const baselineRoot = join(root, 'before'), candidateRoot = join(root, 'after');
  const original = 'export function update(){return new Float32Array(3)}';
  const old = 'src/game/system.ts', filename = 'src/shards/fixture/runtime/system.ts';
  const frozen = "import '@wildshard/game/system';\n";
  const list = 'lint/runtime-performance.json';
  const write = (tree: string, name: string, source: string): void => {
    const path = join(tree, name); mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, source);
  };
  try {
    write(baselineRoot, old, original); write(candidateRoot, old, original); write(candidateRoot, filename, original);
    const site = runtimePerformanceSites(original, filename)[0]; if (site === undefined) throw new Error('Missing copy site');
    const key = `${filename}:${site.kind}:${site.site}`;
    const before = { about: 'fixture', baselineAt: 'fixture', sites: {} };
    const after = { ...before, sites: { [key]: { count: 1, row: 'SF76 verbatim legacy copy' } } };
    write(baselineRoot, list, JSON.stringify(before)); write(candidateRoot, list, JSON.stringify(after));
    const compare = (): string[] => comparePlatformList(list, join(baselineRoot, list), join(candidateRoot, list), { baselineRoot, candidateRoot });
    expect(compare().join(',')).toContain('new runtime site');
    write(baselineRoot, 'src/shards/fixture-legacy/manifest.ts', frozen);
    write(baselineRoot, 'src/shards/fixture-legacy/plugin.ts', 'export const plugin = 1;\n');
    const hash = (value: string): string => createHash('sha256').update(value).digest('hex');
    write(baselineRoot, 'lint/legacy-shards.json', JSON.stringify({ version: 1, sealed: true, shards: { 'fixture-legacy': {
      primary: 'fixture', source: 'a'.repeat(40), files: { 'manifest.ts': hash(frozen), 'plugin.ts': hash('export const plugin = 1;\n') },
    } } }));
    expect(compare()).toEqual([]);
    write(candidateRoot, filename, `${original}export const added = 1;\n`);
    expect(compare().join(',')).toContain('new runtime site');
    write(candidateRoot, filename, original); write(candidateRoot, old, `${original}\n// altered original\n`);
    expect(compare().join(',')).toContain('new runtime site');
    write(candidateRoot, old, original); write(baselineRoot, 'src/shards/fixture-legacy/manifest.ts', `${frozen}// changed\n`);
    expect(compare().join(',')).toContain('new runtime site');
    write(baselineRoot, 'src/shards/fixture-legacy/manifest.ts', frozen);
    const second = 'src/shards/fixture/runtime/second.ts'; write(candidateRoot, second, original);
    write(candidateRoot, list, JSON.stringify({ ...after, sites: { ...after.sites, [`${second}:${site.kind}:${site.site}`]: { count: 1, row: 'SF76' } } }));
    expect(compare()).toHaveLength(1);
    const foreign = 'src/shards/other/runtime/system.ts'; write(candidateRoot, foreign, original);
    write(candidateRoot, list, JSON.stringify({ ...before, sites: { [`${foreign}:${site.kind}:${site.site}`]: { count: 1, row: 'SF76' } } }));
    expect(compare().join(',')).toContain('new runtime site');
    // A frozen caller also retains its immutable transitive dependencies. The same exact-copy checks apply.
    const child = 'src/engine/child.ts', copy = 'src/shards/fixture/runtime/child.ts';
    const parent = "import '../engine/child'; export const parent = 1;\n";
    write(baselineRoot, old, parent); write(candidateRoot, old, parent);
    write(baselineRoot, child, original); write(candidateRoot, child, original); write(candidateRoot, copy, original);
    write(candidateRoot, list, JSON.stringify({ ...before, sites: { [`${copy}:${site.kind}:${site.site}`]: { count: 1, row: 'SF76' } } }));
    expect(compare()).toEqual([]);
    write(candidateRoot, old, `${parent}// changed parent\n`);
    expect(compare().join(',')).toContain('new runtime site');
    write(candidateRoot, old, parent); write(candidateRoot, child, `${original}// changed dependency\n`);
    expect(compare().join(',')).toContain('new runtime site');
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it('retains retired debt only for an exact registered frozen runtime file', () => {
  const root = mkdtempSync(join(tmpdir(), 'frozen-runtime-debt-'));
  try {
    const baselineRoot = join(root, 'before'), candidateRoot = join(root, 'after');
    const file = 'src/shards/fixture-legacy/runtime/retired.ts', primary = 'src/shards/fixture/runtime/retired.ts';
    const source = 'export function update(){return new Float32Array(3)}';
    const digest = createHash('sha256').update(source).digest('hex');
    const site = runtimePerformanceSites(source, file)[0]; if (site === undefined) throw new Error('Missing frozen fixture');
    const key = `${file}:${site.kind}:${site.site}`;
    const before = { about: 'fixture', baselineAt: 'fixture', sites: {} };
    const after = { ...before, sites: { [key]: { count: 1, row: 'SF46' } } };
    const list = 'lint/runtime-performance.json';
    const write = (tree: string, name: string, text: string): void => {
      const path = join(tree, name); mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, text);
    };
    const inventory = JSON.stringify({ version: 1, sealed: true, shards: { 'fixture-legacy': {
      primary: 'fixture', source: 'a'.repeat(40), files: { 'manifest.ts': digest, 'plugin.ts': digest, 'runtime/retired.ts': digest },
    } } });
    write(baselineRoot, 'lint/legacy-shards.json', inventory);
    write(baselineRoot, list, JSON.stringify(before)); write(candidateRoot, list, JSON.stringify(after));
    write(baselineRoot, file, source); write(candidateRoot, file, source);
    const compare = (): string[] => comparePlatformList(list, join(baselineRoot, list), join(candidateRoot, list), { baselineRoot, candidateRoot });
    expect(compare()).toEqual([]);
    expect(frozenRuntimePerformanceViolations(source, file, primary, digest, after.sites)).toEqual([]);
    expect(runtimePerformanceViolations(source, primary, after.sites)).toHaveLength(1);
    expect(frozenRuntimePerformanceViolations(`${source}\n`, file, primary, digest, after.sites)).toHaveLength(1);
    write(candidateRoot, file, `${source}\n`); expect(compare().join(',')).toContain('new runtime site');
    write(candidateRoot, file, source);
    write(baselineRoot, 'lint/legacy-shards.json', JSON.stringify({ version: 1, sealed: true, shards: {} }));
    expect(compare().join(',')).toContain('new runtime site');
    write(baselineRoot, 'lint/legacy-shards.json', inventory);
    write(candidateRoot, list, JSON.stringify({ ...after, sites: { [key]: { count: 2, row: 'SF46' } } }));
    expect(compare().join(',')).toContain('new runtime site');
    write(candidateRoot, list, JSON.stringify({ ...after, sites: { [`${file}:frame-allocation:${'0'.repeat(64)}`]: { count: 1, row: 'SF46' } } }));
    expect(compare().join(',')).toContain('new runtime site');
  } finally { rmSync(root, { recursive: true, force: true }); }
});
