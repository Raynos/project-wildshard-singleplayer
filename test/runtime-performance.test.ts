// oxlint-disable-next-line import/no-nodejs-modules -- Exercise the real lint binary and immutable predecessor files.
import { spawnSync } from 'node:child_process';
// oxlint-disable-next-line import/no-nodejs-modules -- Fixtures own and remove their temporary files.
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Temporary fixture root.
import { tmpdir } from 'node:os';
// oxlint-disable-next-line import/no-nodejs-modules -- Real binary and policy fixture paths.
import { join, resolve } from 'node:path';
import { checkProjectRuntime } from '../src/sdk/runtimePerformance';
import { comparePlatformList } from '../scripts/check-platform-ratchets.mjs';
import { expect, it } from 'vitest';
import { runtimePerformanceSites, runtimePerformanceViolations } from '../lint/runtime-performance.mjs';

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

it('allows only the reviewed bootstrap, then shrinking exact sites without changing owners', () => {
  const root = mkdtempSync(join(tmpdir(), 'runtime-debt-')), list = 'lint/runtime-performance.json';
  try {
    const before = join(root, 'before.json'), after = join(root, 'after.json');
    const reviewed = readFileSync(list, 'utf8'); writeFileSync(after, reviewed);
    expect(comparePlatformList(list, before, after)).toEqual([]);
    writeFileSync(before, reviewed);
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
