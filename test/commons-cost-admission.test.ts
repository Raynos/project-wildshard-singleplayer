import { expect, it } from 'vitest';
import { emptyShardfile } from '../src/sdk/author';
import { contentHash, projectAssets } from '../src/sdk/project';
import { preflightShardfile } from '../src/game/shardfile/preflight';
import { preflightDeclaredCosts, validateShardfileAssets } from '../src/game/shardfile/validate';
import { admitProduct, type ProductOptions } from '../src/game/shardfile/product';

const empty = () => emptyShardfile({ slug: 'commons-cost-test', name: 'Commons', author: 'Fixture', seed: 1, revision: 1 });
const bytes = new Uint8Array([1]), hash = contentHash(bytes), cost = { decoded: 1, gpu: 0, triangles: 0, draws: 0 };
const source = () => { const shard = empty(); return { ...shard, requires: { ...shard.requires, commons: [hash], commonsWire: { [hash]: 1 }, commonsCosts: { [hash]: cost } }, library: [`commons:${hash}`] }; };
function ports(offline: boolean, input: unknown, read: () => void): ProductOptions {
  return { base: 'https://outside.test/', offline, firstParty: false, hash: payload => Promise.resolve(contentHash(payload)), fetch: () => { read(); return Promise.resolve(new Response(bytes)); }, cache: {
    product: () => Promise.resolve(offline ? { source: input, firstParty: false } : null), asset: () => { read(); return Promise.resolve(offline ? bytes : null); }, putAsset: () => Promise.resolve(), putProduct: () => Promise.resolve(),
  } };
}
it.each([false, true])('declared over-envelope commons refuse without asset cache reads or requests (offline=%s)', async offline => {
  const shard = source(); shard.requires.commonsCosts[hash] = { ...cost, decoded: 1_000_000_001 }; let reads = 0;
  await expect(admitProduct(shard, ports(offline, shard, () => { reads++; }))).rejects.toThrow('declared worst-location');
  expect(reads).toBe(0);
  expect(() => projectAssets('/does-not-exist', shard)).toThrow('declared worst-location');
});
it('rejects local declared over-envelope assets before opening their nonexistent files', () => {
  const shard = empty(); shard.budgets.library.resident = 1_000_000_001;
  expect(() => projectAssets('/does-not-exist', shard)).toThrow('declared worst-location');
});
it('rejects missing, extra or malformed costs before reading any immutable bytes', async () => {
  for (const commonsCosts of [{}, { ['b'.repeat(64)]: cost }, { [hash]: { ...cost, gpu: -1 } }]) {
    const shard = { ...source(), requires: { ...source().requires, commonsCosts } }; let reads = 0;
    await expect(admitProduct(shard, ports(false, shard, () => { reads++; }))).rejects.toThrow(); expect(reads).toBe(0);
  }
});
it('rejects understated local bundle budgets before an asset read or hashing', async () => {
  const shard = empty(); shard.files.push({ hash, kind: 'binary', compressed: 1, ...cost, decoded: 1_000_000_001, dependencies: [], critical: false }); shard.library.push(hash);
  let reads = 0;
  await expect(admitProduct(shard, ports(false, shard, () => { reads++; }))).rejects.toThrow('declared bundle cost'); expect(reads).toBe(0);
});
it('rechecks every exact header cost after declared preflight passes', () => {
  const shard = source(); shard.requires.commonsCosts[hash] = { ...cost, decoded: 2 };
  expect(() => preflightDeclaredCosts(shard)).not.toThrow();
  expect(() => validateShardfileAssets(shard, new Map([[`commons:${hash}`, bytes]]), contentHash)).toThrow('commons cost declaration differs');
});
it('admits eleven distinct small commons assets and deduplicates local/common aliases in transport', async () => {
  const shard = source(), payloads = Array.from({ length: 11 }, (_, index) => new Uint8Array([index + 1]));
  const assets = new Map(payloads.map(payload => [contentHash(payload), payload]));
  shard.requires.commons = [...assets.keys()]; shard.requires.commonsWire = Object.fromEntries(shard.requires.commons.map(key => [key, 1]));
  shard.requires.commonsCosts = Object.fromEntries(shard.requires.commons.map(key => [key, cost])); shard.library = shard.requires.commons.map(key => `commons:${key}`);
  shard.files.push({ hash, kind: 'binary', compressed: 1, ...cost, dependencies: [], critical: false }); shard.library.push(hash); shard.budgets.library = { resident: 1, compressed: 1 };
  let requests = 0;
  const admitted = await admitProduct(shard, { base: 'https://outside.test/', offline: false, firstParty: false, hash: payload => Promise.resolve(contentHash(payload)), fetch: url => {
    requests++; const payload = assets.get(new URL(url).pathname.slice(1)); if (payload === undefined) throw new Error('Unknown fixture asset'); return Promise.resolve(new Response(payload));
  } });
  expect(requests).toBe(11); expect(admitted.assets.size).toBe(12);
  expect(admitted.assets.get(hash)).toBe(admitted.assets.get(`commons:${hash}`));
});
it('rejects declared over-cap commons wire with zero asset requests and bounds forged small streams', async () => {
  const shard = source(); shard.requires.commonsWire[hash] = 256_000_001;
  expect(() => preflightShardfile(shard)).toThrow('total wire');
  let reads = 0;
  await expect(admitProduct(shard, ports(false, shard, () => { reads++; }))).rejects.toThrow('total wire'); expect(reads).toBe(0);
  let cancelled = false, requests = 0;
  const forged = source(), body = new ReadableStream<Uint8Array>({ start(controller) { controller.enqueue(new Uint8Array([1, 2])); }, cancel() { cancelled = true; } });
  await expect(admitProduct(forged, { base: 'https://outside.test/', offline: false, firstParty: false, hash: payload => Promise.resolve(contentHash(payload)), fetch: () => { requests++; return Promise.resolve(new Response(body)); } })).rejects.toThrow('wire size');
  expect(requests).toBe(1); expect(cancelled).toBe(true);
});
