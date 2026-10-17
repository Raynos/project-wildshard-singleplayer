import { sameRuntimeProfile } from '../src/game/plugin/headless';
import { parseItems } from '../src/format/items';
import { expect, test } from 'vitest';
import { encodeCanonicalJson, hashImmutableBytes } from '../src/sdk/immutable';
import { emptyShardfile } from '../src/sdk/author';
import { createShardProduct } from '../src/game/shardfile/shardProduct';
import { driftwoodSwordProfiles } from '../src/shards/driftwood-isle/runtime/loadout';
import source from '../src/shards/driftwood-isle/shard.config';
import { DRIFTWOOD_MELEE_PROFILE, DRIFTWOOD_IRON_PROFILE } from '../src/shards/driftwood-isle/generators/meleeProfile';

const shardfile = emptyShardfile({ slug: 'sword-profiles-test', name: 'Sword', author: 'Wildshard', revision: 1, seed: 1 });
function context(items: unknown) {
  return { product: createShardProduct({ slug: shardfile.identity.slug, revision: 1, shardfile: { ...shardfile, items: parseItems(items) },
    sections: new Map([['combat/items', { items }]]), files: new Map(), check: true,
    read: () => Promise.reject(new Error('Sword profiles must already be admitted')) }) };
}

function withProfile(row: object, profile: unknown) {
  return { ...row, profile };
}

test('both native swords borrow their original admitted combat profiles without a const copy', () => {
  const admitted = context(source.items);
  const rows = driftwoodSwordProfiles(admitted);
  expect(rows).toEqual([DRIFTWOOD_MELEE_PROFILE, DRIFTWOOD_IRON_PROFILE]);
  // Exact canonical numeric payload from 0f5854a97's two runtime mirrors.
  expect(hashImmutableBytes(new TextEncoder().encode(encodeCanonicalJson(rows)))).toBe('cd922abc25931f46847366a5c5f44c2fd1137885d9e9dd1acb368764d63813b4');
  const declared = source.items.rows;
  const normalized = admitted.product.shardfile.items.rows;
  const weapons = normalized.filter(row => row.kind === 'weapon');
  expect(rows[0]).toBe(weapons.find(row => row.id === 'weapon.driftwood-isle.wood')?.profile);
  expect(rows[1]).toBe(weapons.find(row => row.id === 'weapon.driftwood-isle.iron')?.profile);
  for (const id of ['weapon.driftwood-isle.wood', 'weapon.driftwood-isle.iron']) {
    expect(() => driftwoodSwordProfiles(context({ ...source.items, rows: declared.filter(row => row.id !== id) }))).toThrow();
    expect(() => driftwoodSwordProfiles(context({ ...source.items, rows: declared.map(row => row.id === id ? withProfile(row, undefined) : row) }))).toThrow();
    expect(() => driftwoodSwordProfiles(context({ ...source.items, rows: declared.map(row => row.id === id ? withProfile(row, { family: 'bow' }) : row) }))).toThrow();
  }
});

// The output writer sorts keys on the wire; item admission reconstructs schema order.
test('canonical section key order cannot change native sword admission', () => {
  const wire: unknown = JSON.parse(encodeCanonicalJson(source.items));
  const admitted = context(wire), profiles = driftwoodSwordProfiles(admitted);
  const installed = parseItems(wire).rows.filter(row => row.kind === 'weapon').map(row => row.profile);
  expect(profiles.map(profile => JSON.stringify(profile))).toEqual(installed.map(profile => JSON.stringify(profile)));
  const raw = admitted.product.section('combat/items').items.rows.filter(row => row.kind === 'weapon').map(row => row.profile);
  expect(raw).toEqual(profiles);
  expect(raw.map(profile => JSON.stringify(profile))).not.toEqual(installed.map(profile => JSON.stringify(profile)));
  expect(raw.every((profile, index) => sameRuntimeProfile(profile, installed[index]))).toBe(true);
  expect(profiles.map(profile => profile.damage)).toEqual([12, 28]);
  for (const profile of profiles) {
    expect(sameRuntimeProfile(profile, { ...profile, damage: profile.damage + 1 })).toBe(false);
    expect(sameRuntimeProfile(profile, { ...profile, moves: { ...profile.moves, combo: [...profile.moves.combo].reverse() } })).toBe(false);
  }
  expect(sameRuntimeProfile(undefined, profiles[0])).toBe(false);
});
