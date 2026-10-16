import { expect, test } from 'vitest';
import { emptyShardfile } from '../src/sdk/author';
import { nameBlob } from '../src/sdk/blobs';
import { createShardProduct } from '../src/game/shardfile/shardProduct';
import { loadPineFinishes, pineSkins, PINE_FINISH_VARIANTS } from '../src/shards/pine-hollow/runtime/loadout/skins';
import { WEAPON_FINISHES } from '../src/shards/pine-hollow/data/weaponFinishes';
import { output } from '../src/shards/pine-hollow/generators/output';

const shardfile = emptyShardfile({ slug: 'pine-finish-test', name: 'Finish test', author: 'Wildshard', revision: 1, seed: 1 });
function product(bytes: Uint8Array) {
  const blob = nameBlob('loadout/finishes.json', 'json', bytes);
  return createShardProduct({ slug: shardfile.identity.slug, revision: 1, shardfile, sections: new Map(),
    files: new Map([['loadout/finishes.json', { hash: blob.file.hash, url: blob.file.path }]]),
    read: () => Promise.resolve(blob.bytes) });
}

test('finish admission preserves author order/materials/drops, refuses early reads and restores atomically on bad rows', async () => {
  expect(() => pineSkins()).toThrow('not admitted');
  const file = output.namedFiles.find(row => row.name === 'loadout/finishes.json');
  const bytes = file === undefined ? undefined : output.assets.get(file.hash);
  if (bytes === undefined) throw new Error('Missing named finish JSON');
  await loadPineFinishes(product(bytes));
  const previous = pineSkins();
  expect(Object.keys(previous)).toEqual(Object.keys(WEAPON_FINISHES));
  expect(PINE_FINISH_VARIANTS).toEqual(Object.values(WEAPON_FINISHES).map(({ id, name, weapon }) => ({ id, name, weapon })));
  for (const row of Object.values(previous)) expect({ ...row, extras: undefined }).toEqual({ ...WEAPON_FINISHES[row.id], extras: undefined });
  expect(previous['ghost-stag'].extras).toBeTypeOf('function');
  const encode = (value: unknown): Uint8Array => new TextEncoder().encode(JSON.stringify(value));
  await expect(loadPineFinishes(product(encode({ ...WEAPON_FINISHES, extra: true })))).rejects.toThrow();
  await expect(loadPineFinishes(product(encode({ ...WEAPON_FINISHES, ironhide: { ...WEAPON_FINISHES.ironhide, id: 'warden' } })))).rejects.toThrow('identity');
  expect(pineSkins()).toBe(previous);
});
