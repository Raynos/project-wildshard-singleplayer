// oxlint-disable-next-line import/no-nodejs-modules -- All writes are confined to an owned temporary policy fixture.
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- The guard compares actual immutable Node source trees.
import { tmpdir } from 'node:os';
// oxlint-disable-next-line import/no-nodejs-modules -- Exact frozen fixture identity uses the policy's SHA256.
import { createHash } from 'node:crypto';
// oxlint-disable-next-line import/no-nodejs-modules -- Resolve only the owned fixture trees.
import { join } from 'node:path';
import { expect, test } from 'vitest';
import { runtimePerformanceSites } from '../lint/runtime-performance.mjs';
import { comparePlatformList } from '../scripts/check-platform-ratchets.mjs';

test('rekeys real edited or moved sites without new kind or row allowance', () => {
  const root = mkdtempSync(join(tmpdir(), 'runtime-rekey-'));
  const baselineRoot = join(root, 'before'), candidateRoot = join(root, 'after');
  const oldFile = 'src/shards/example/runtime/old.ts', newFile = 'src/shards/example/runtime/new.ts';
  const oldSource = 'export function update(items) { for (const item of items) consume(item); }';
  const newSource = 'export function update(values) { for (const value of values) consume(value); }';
  const site = (source: string, file: string) => {
    const found = runtimePerformanceSites(source, file).find(item => item.kind === 'unbounded-loop');
    if (found === undefined) throw new Error('Fixture needs a real loop violation');
    return `${file}:${found.kind}:${found.site}`;
  };
  const oldSite = site(oldSource, oldFile), newSite = site(newSource, newFile);
  const before = { about: 'reviewed', baselineAt: 'fixed', sites: { [oldSite]: { count: 1, row: 'C3' } } };
  const oldList = join(baselineRoot, 'lint/runtime-performance.json'), newList = join(candidateRoot, 'lint/runtime-performance.json');
  const put = (base: string, file: string, source: string) => { const path = join(base, file); mkdirSync(join(path, '..'), { recursive: true }); writeFileSync(path, source); };
  put(baselineRoot, oldFile, oldSource); put(candidateRoot, newFile, newSource);
  put(baselineRoot, 'lint/runtime-performance.json', JSON.stringify(before));
  const check = (sites: Record<string, { count: number; row: string }>) => {
    put(candidateRoot, 'lint/runtime-performance.json', JSON.stringify({ ...before, sites }));
    return comparePlatformList('lint/runtime-performance.json', oldList, newList, { baselineRoot, candidateRoot });
  };
  try {
    expect(check({ [newSite]: { count: 1, row: 'C3' } })).toEqual([]);
    expect(check({})).toEqual([]);
    expect(check({ [oldSite]: { count: 1, row: 'C3' }, [newSite]: { count: 1, row: 'C3' } })).not.toEqual([]);
    expect(check({ [newSite]: { count: 1, row: 'C2' } })).not.toEqual([]);
    expect(check({ [newSite.replace(':unbounded-loop:', ':async:')]: { count: 1, row: 'C3' } })).not.toEqual([]);
    expect(check({ [newSite.replace(/.$/u, 'z')]: { count: 1, row: 'C3' } })).not.toEqual([]);
    expect(check({ [newSite]: { count: 2, row: 'C3' } })).not.toEqual([]);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('only consumed verbatim platform sites pay newly visible runtime debt', () => {
  mkdirSync('tmp', { recursive: true });
  const root = mkdtempSync('tmp/runtime-platform-move-');
  const baselineRoot = join(root, 'before'), candidateRoot = join(root, 'after');
  const oldFile = 'src/game/life.ts', newFile = 'src/shards/example/runtime/life.ts';
  const original = 'export function update(items) { for (const item of items) consume(item); }';
  const edited = 'export function update(items) { for (const item of items) changed(item); }';
  const before = { about: 'reviewed', baselineAt: 'fixed', sites: {} };
  const put = (base: string, file: string, source: string) => { const path = join(base, file); mkdirSync(join(path, '..'), { recursive: true }); writeFileSync(path, source); };
  put(baselineRoot, oldFile, original);
  put(baselineRoot, 'lint/runtime-performance.json', JSON.stringify(before));
  const check = (source: string, options: { retain?: boolean; duplicate?: boolean; count?: number; proof?: boolean } = {}) => {
    put(candidateRoot, oldFile, options.retain === true ? original : '');
    put(candidateRoot, newFile, source);
    const sites: Record<string, { count: number; row: string }> = {};
    const issues = runtimePerformanceSites(source, newFile);
    if (!issues.some(row => row.kind === 'unbounded-loop')) throw new Error('Fixture needs a loop');
    for (const issue of issues) {
      const key = `${newFile}:${issue.kind}:${issue.site}`;
      sites[key] ??= { count: 0, row: 'H1' }; sites[key].count += options.count ?? 1;
    }
    if (options.duplicate === true) {
      const second = 'src/shards/example/runtime/copy.ts';
      put(candidateRoot, second, source);
      for (const issue of issues) sites[`${second}:${issue.kind}:${issue.site}`] = { count: 1, row: 'H1' };
    }
    put(candidateRoot, 'lint/runtime-performance.json', JSON.stringify({ ...before, sites }));
    return comparePlatformList('lint/runtime-performance.json', join(baselineRoot, 'lint/runtime-performance.json'), join(candidateRoot, 'lint/runtime-performance.json'), options.proof === false ? undefined : { baselineRoot, candidateRoot });
  };
  try {
    expect(check(original)).toEqual([]);
    expect(check(original, { retain: true })).not.toEqual([]);
    expect(check(edited)).not.toEqual([]);
    expect(check(original, { proof: false })).not.toEqual([]);
    expect(check(original, { duplicate: true })).not.toEqual([]);
    expect(check(original, { count: 2 })).not.toEqual([]);
    expect(check(`${original} export function tick() { return new Set(); }`)).not.toEqual([]);
  } finally { rmSync(root, { recursive: true, force: true }); }
});


test('retains exact frozen sites after primary debt retires', () => {
  mkdirSync('tmp', { recursive: true });
  const root = mkdtempSync('tmp/runtime-frozen-retention-');
  const baselineRoot = join(root, 'before'), candidateRoot = join(root, 'after');
  const relative = 'runtime/life.ts', file = `src/shards/example-legacy/${relative}`;
  const source = 'export function update(items) { for (const item of items) consume(item); }';
  const put = (base: string, path: string, text: string) => {
    const target = join(base, path); mkdirSync(join(target, '..'), { recursive: true }); writeFileSync(target, text);
  };
  const digest = createHash('sha256').update(source).digest('hex');
  const inventory = { version: 1, sealed: true, shards: { 'example-legacy': {
    primary: 'example', source: 'a'.repeat(40), files: { 'manifest.ts': digest, 'plugin.ts': digest, [relative]: digest },
  } } };
  const before = { about: 'reviewed', baselineAt: 'fixed', sites: {} };
  const sites: Record<string, { count: number; row: string }> = {};
  for (const issue of runtimePerformanceSites(source, file)) {
    const key = `${file}:${issue.kind}:${issue.site}`;
    sites[key] ??= { count: 0, row: 'SF46' }; sites[key].count++;
  }
  expect(Object.keys(sites).length).toBeGreaterThan(0);
  const list = 'lint/runtime-performance.json';
  put(baselineRoot, file, source);
  put(baselineRoot, 'lint/legacy-shards.json', JSON.stringify(inventory));
  put(baselineRoot, list, JSON.stringify(before));
  put(candidateRoot, list, JSON.stringify({ ...before, sites }));
  const check = () => comparePlatformList(list, join(baselineRoot, list), join(candidateRoot, list), { baselineRoot, candidateRoot });
  try {
    put(candidateRoot, file, source);
    expect(check()).toEqual([]);
    put(candidateRoot, file, `${source}\nchanged();`);
    expect(check()).not.toEqual([]);
    put(candidateRoot, file, source);
    put(baselineRoot, 'lint/legacy-shards.json', JSON.stringify({ version: 1, sealed: true, shards: {} }));
    expect(check()).not.toEqual([]);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
