// oxlint-disable-next-line import/no-nodejs-modules -- All writes are confined to an owned temporary policy fixture.
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- The guard compares actual immutable Node source trees.
import { tmpdir } from 'node:os';
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
