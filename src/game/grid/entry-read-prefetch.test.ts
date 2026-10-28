import { expect, test } from 'vitest';
import { entryReadPlan, prefetchEntryReads, type EntryReadPorts } from './entryReadPrefetch';
import type { EntryReadSet } from '@wildshard/format/entryReads';

const hash = (n: number): string => n.toString(16).padStart(64, '0');
const set: EntryReadSet = [
  { region: 'pine-hollow', tier: 'desktop', at: [0, 0], reads: [{ url: '/assets/pine-hollow/desk.ktx2', hash: hash(9), bytes: 9 }] },
  { region: 'pine-hollow', tier: 'phone', at: [0, 0], reads: [
    { url: `/shardfiles/pine-hollow/blobs/bin/${hash(1)}.bin`, hash: hash(1), bytes: 1 },
    { url: '/assets/pine-hollow/astc6/tex/bark-7b80dfb8.ktx2', hash: hash(2), bytes: 2 },
    { url: `/shardfiles/pine-hollow/blobs/bin/${hash(3)}.bin`, hash: hash(3), bytes: 3 },
    { url: '/assets/baked/pine-hollow/near.glb?v=11dcb0b8', hash: hash(4), bytes: 4 },
  ] },
];

test('the plan is the tier row in first-demand order, with the blobs this product still holds and every asset', () => {
  const plan = entryReadPlan(set, 'phone', 'pine-hollow', { files: [{ hash: hash(1) }, { hash: hash(7) }] as never });
  expect(plan.map(read => read.hash)).toEqual([hash(1), hash(2), hash(4)]);
});

const ports = (files: readonly string[], json: unknown = set, fetchJson: EntryReadPorts['fetchJson'] = () => Promise.resolve(json)): EntryReadPorts & { blobs: string[]; assets: string[] } => {
  const blobs: string[] = [], assets: string[] = [];
  return { blobs, assets, source: { files: files.map(h => ({ hash: h })) as never },
    readBlob: h => { blobs.push(h); return Promise.resolve(); },
    fetchAsset: url => { assets.push(url); return Promise.resolve(); },
    fetchJson };
};

test('a verified approach reads blobs through the product reader and assets through the HTTP cache, and counts them', async () => {
  const p = ports([hash(1), hash(3)]);
  const count = await prefetchEntryReads('pine-hollow', 'phone', p, new AbortController().signal);
  expect(count).toBe(4); expect(p.blobs.sort()).toEqual([hash(1), hash(3)]);
  expect(p.assets.sort()).toEqual(['/assets/baked/pine-hollow/near.glb?v=11dcb0b8', '/assets/pine-hollow/astc6/tex/bark-7b80dfb8.ktx2']);
});

test('a turn-away starts no read, and a missing or invalid record prefetches nothing', async () => {
  const aborted = new AbortController(); aborted.abort();
  const p = ports([hash(1), hash(3)]);
  expect(await prefetchEntryReads('pine-hollow', 'phone', p, aborted.signal)).toBe(0); expect(p.blobs).toEqual([]);
  expect(await prefetchEntryReads('pine-hollow', 'phone', ports([hash(1)], { not: 'a set' }), new AbortController().signal)).toBe(0);
  const missing = ports([hash(1)], set, () => Promise.reject(new Error('404')));
  expect(await prefetchEntryReads('pine-hollow', 'phone', missing, new AbortController().signal)).toBe(0);
});
