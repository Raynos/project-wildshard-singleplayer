import { expect, test } from 'vitest';
import { selectedManifests, gridManifests } from '../src/selectedManifests';
import { legacyContentIdentity, shards } from '../src/game/shard/list';

function fixture() {
  const copy = shards().find(row => row.legacy === true);
  if (copy === undefined) throw new Error('Missing inventoried legacy fixture');
  const primaryId = legacyContentIdentity(copy.slug), primary = shards().find(row => row.slug === primaryId);
  const other = shards().find(row => row.legacy !== true && row.slug !== primaryId);
  if (primary === undefined || other === undefined) throw new Error('Missing original primary fixtures');
  const calls: string[] = [], declared: string[] = [];
  const loaders = Object.fromEntries([primary, copy, other].map(row => [row.slug, () => { calls.push(row.slug); return Promise.resolve(row); }]));
  return { primary, copy, other, calls, declared, loaders, identities: { [copy.slug]: primary.slug }, before: (id: string): void => { declared.push(id); } };
}

test('native selection prepares only its own original manifest', async () => {
  const f = fixture(), result = await selectedManifests(f.primary, f.loaders, f.identities, f.before);
  expect(result.manifests).toEqual([f.primary]);
  expect(result.manifests[0]).toBe(f.primary);
  expect(result.contentIdentities).toEqual({});
  expect(f.calls).toEqual([f.primary.slug]); expect(f.declared).toEqual(f.calls);
});

test('frozen selection prepares exactly its inventoried pair with unchanged content identity', async () => {
  const f = fixture(), result = await selectedManifests(f.copy, f.loaders, f.identities, f.before);
  expect(result.manifests).toEqual([f.primary, f.copy]);
  expect(result.manifests[0]).toBe(f.primary); expect(result.manifests[1]).toBe(f.copy);
  expect(result.contentIdentities).toEqual(f.identities);
  expect(f.calls).toEqual([f.primary.slug, f.copy.slug]); expect(f.declared).toEqual(f.calls);
});

test('a suffix, missing primary or misleading native identity refuses before fetching any world', async () => {
  const f = fixture();
  await expect(selectedManifests(f.copy, f.loaders, {}, f.before)).rejects.toThrow('not inventoried');
  await expect(selectedManifests(f.primary, f.loaders, { [f.primary.slug]: f.other.slug }, f.before)).rejects.toThrow('not inventoried');
  await expect(selectedManifests(f.copy, f.loaders, { [f.copy.slug]: f.copy.slug }, f.before)).rejects.toThrow('not inventoried');
  await expect(selectedManifests(f.copy, { [f.copy.slug]: f.loaders[f.copy.slug] }, f.identities, f.before)).rejects.toThrow('Missing selected discovery loader');
  expect(f.calls).toEqual([]); expect(f.declared).toEqual([]);
});

test('a swapped or wrongly flagged loaded identity refuses the whole pair', async () => {
  const f = fixture();
  await expect(selectedManifests(f.copy, { ...f.loaders, [f.primary.slug]: () => Promise.resolve(f.other) }, f.identities, f.before)).rejects.toThrow('identity differs');
  await expect(selectedManifests(f.copy, { ...f.loaders, [f.primary.slug]: () => Promise.resolve({ ...f.primary, legacy: true }) }, f.identities, f.before)).rejects.toThrow('identity differs');
  await expect(selectedManifests(f.copy, { ...f.loaders, [f.copy.slug]: () => Promise.resolve({ ...f.primary, slug: f.copy.slug }) }, f.identities, f.before)).rejects.toThrow('identity differs');
});

test('a grid prepares every exact primary without evaluating frozen standalone copies', async () => {
  const f = fixture(), installed = shards();
  const result = await gridManifests([f.copy, f.other, f.primary], {
    ...f.loaders, [f.copy.slug]: () => Promise.reject(new Error('Grid evaluated a frozen copy')),
  }, f.identities, f.before);
  const originals = [f.other, f.primary].sort((a, b) => a.order - b.order);
  expect(result.manifests).toEqual(originals);
  expect(result.manifests.every((row, index) => row === originals[index])).toBe(true);
  expect(result.contentIdentities).toEqual({});
  expect(f.calls).toEqual([f.other.slug, f.primary.slug]);
  expect(f.declared).toEqual(f.calls);
  expect(shards()).toBe(installed);
  // The frozen route retains its original paired loader and content namespace.
  const frozen = await selectedManifests(f.copy, f.loaders, f.identities, f.before);
  expect(frozen.manifests).toEqual([f.primary, f.copy]);
  expect(frozen.contentIdentities).toEqual(f.identities);
});

test('invalid grid inventories refuse before any manifest read', async () => {
  const f = fixture(), rows = [f.primary, f.copy, f.other];
  await expect(gridManifests(rows, f.loaders, {}, f.before)).rejects.toThrow('not inventoried');
  await expect(gridManifests(rows, f.loaders, { [f.copy.slug]: f.copy.slug }, f.before)).rejects.toThrow('not inventoried');
  await expect(gridManifests([f.copy], f.loaders, f.identities, f.before)).rejects.toThrow('not inventoried');
  await expect(gridManifests([...rows, f.primary], f.loaders, f.identities, f.before)).rejects.toThrow('duplicate identities');
  await expect(gridManifests([], f.loaders, {}, f.before)).rejects.toThrow('no native manifests');
  await expect(gridManifests(rows, { [f.primary.slug]: f.loaders[f.primary.slug] }, f.identities, f.before)).rejects.toThrow('Missing grid discovery loader');
  expect(f.calls).toEqual([]); expect(f.declared).toEqual([]);
});

test('a grid retains the full primary readiness barrier and refuses swapped manifests', async () => {
  const f = fixture(), installed = shards();
  let release = (): void => { throw new Error('Grid loader gate was not installed'); };
  const gate = new Promise<void>(resolve => { release = resolve; });
  let complete = false;
  const pending = gridManifests([f.primary, f.other], { ...f.loaders,
    [f.other.slug]: async () => { await gate; return f.other; },
  }, {}, f.before).then(value => { complete = true; return value; });
  await Promise.resolve(); await Promise.resolve();
  expect(complete).toBe(false); expect(shards()).toBe(installed);
  release(); expect((await pending).manifests).toHaveLength(2);
  await expect(gridManifests([f.primary, f.other], { ...f.loaders,
    [f.primary.slug]: () => Promise.resolve(f.copy),
  }, {}, f.before)).rejects.toThrow('identity differs');
  expect(shards()).toBe(installed);
});
