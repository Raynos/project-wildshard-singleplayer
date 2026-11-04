import { expect, test } from 'vitest';
import { selectedManifests, gridManifests } from '../src/selectedManifests';
import { shards } from '../src/game/shard/list';
import type { ShardManifest } from '../src/game/shard/manifest';
import { prepareBootImports } from '../src/bootDownloads';
import { installCatalogueFixture } from './fixtures/bootSetup';

await installCatalogueFixture();

function fixture() {
  const [primary, other] = shards().filter(row => row.legacy !== true);
  if (primary === undefined || other === undefined) throw new Error('Missing original primary fixtures');
  // LD6 retired the last frozen copy and LD8 its pairing: a flagged row is only ever refused.
  const copy: ShardManifest = { ...other, legacy: true };
  const calls: string[] = [], declared: string[] = [];
  const loaders = Object.fromEntries([primary, other].map(row => [row.slug, () => { calls.push(row.slug); return Promise.resolve(row); }]));
  return { primary, copy, other, calls, declared, loaders, before: (id: string): void => { declared.push(id); } };
}

test('native selection prepares only its own original manifest', async () => {
  const f = fixture(), result = await selectedManifests(f.primary, f.loaders, f.before);
  expect(result.manifests).toEqual([f.primary]);
  expect(result.manifests[0]).toBe(f.primary);
  expect(f.calls).toEqual([f.primary.slug]); expect(f.declared).toEqual(f.calls);
});

test('a flagged frozen copy or a missing loader refuses before fetching any world', async () => {
  const f = fixture();
  await expect(selectedManifests(f.copy, f.loaders, f.before)).rejects.toThrow('frozen copy');
  await expect(selectedManifests(f.primary, { [f.other.slug]: f.loaders[f.other.slug] }, f.before)).rejects.toThrow('Missing selected discovery loader');
  expect(f.calls).toEqual([]); expect(f.declared).toEqual([]);
});

test('a swapped or wrongly flagged loaded identity refuses', async () => {
  const f = fixture();
  await expect(selectedManifests(f.primary, { ...f.loaders, [f.primary.slug]: () => Promise.resolve(f.other) }, f.before)).rejects.toThrow('identity differs');
  await expect(selectedManifests(f.primary, { ...f.loaders, [f.primary.slug]: () => Promise.resolve({ ...f.primary, legacy: true }) }, f.before)).rejects.toThrow('identity differs');
});

test('a grid prepares every exact primary in catalogue order', async () => {
  const f = fixture(), installed = shards();
  const result = await gridManifests([f.other, f.primary], f.loaders, f.before);
  const originals = [f.other, f.primary].sort((a, b) => a.order - b.order);
  expect(result.manifests).toEqual(originals);
  expect(result.manifests.every((row, index) => row === originals[index])).toBe(true);
  expect(f.calls).toEqual([f.other.slug, f.primary.slug]);
  expect(f.declared).toEqual(f.calls);
  expect(shards()).toBe(installed);
});

test('invalid grid catalogues refuse before any manifest read', async () => {
  const f = fixture();
  await expect(gridManifests([f.primary, f.copy], f.loaders, f.before)).rejects.toThrow('frozen copy');
  await expect(gridManifests([f.primary, f.other, f.primary], f.loaders, f.before)).rejects.toThrow('duplicate identities');
  await expect(gridManifests([], f.loaders, f.before)).rejects.toThrow('no native manifests');
  await expect(gridManifests([f.primary, f.other], { [f.primary.slug]: f.loaders[f.primary.slug] }, f.before)).rejects.toThrow('Missing grid discovery loader');
  expect(f.calls).toEqual([]); expect(f.declared).toEqual([]);
});

test('a grid retains the full primary readiness barrier and refuses swapped manifests', async () => {
  const f = fixture(), installed = shards();
  let release = (): void => { throw new Error('Grid loader gate was not installed'); };
  const gate = new Promise<void>(resolve => { release = resolve; });
  let complete = false;
  const pending = gridManifests([f.primary, f.other], { ...f.loaders,
    [f.other.slug]: async () => { await gate; return f.other; },
  }, f.before).then(value => { complete = true; return value; });
  await Promise.resolve(); await Promise.resolve();
  expect(complete).toBe(false); expect(shards()).toBe(installed);
  release(); expect((await pending).manifests).toHaveLength(2);
  await expect(gridManifests([f.primary, f.other], { ...f.loaders,
    [f.primary.slug]: () => Promise.resolve(f.copy),
  }, f.before)).rejects.toThrow('identity differs');
  expect(shards()).toBe(installed);
});

test('staged primary reads settle without publication and retain the original refusal', async () => {
  const f = fixture(), installed = shards(), refusal = new Error('Primary declaration failed');
  let release = (): void => { throw new Error('Grid read was not started'); };
  const gate = new Promise<void>(resolve => { release = resolve; });
  const pending = prepareBootImports(gridManifests([f.primary, f.other], { ...f.loaders,
    [f.other.slug]: async () => { await gate; throw refusal; },
  }, f.before));
  expect(f.calls).toEqual([f.primary.slug]);
  expect(f.declared).toEqual([f.primary.slug, f.other.slug]);
  expect(shards()).toBe(installed);
  // Earlier boot work can complete before the original catalogue barrier.
  release(); await Promise.resolve(); await Promise.resolve();
  expect(shards()).toBe(installed);
  await expect(pending.ready()).rejects.toBe(refusal);
  await expect(pending.refuse(new Error('Later input refused'))).rejects.toBe(refusal);
  expect(shards()).toBe(installed);
});
