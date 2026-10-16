import { expect, test } from 'vitest';
import { encodeCanonicalJson, hashImmutableBytes } from '../src/sdk/immutable';
import { emptyShardfile } from '../src/sdk/author';
import { createShardProduct } from '../src/game/shardfile/shardProduct';
import { driftwoodSwordProfiles } from '../src/shards/driftwood-isle/runtime/loadout';
import source from '../src/shards/driftwood-isle/shard.config';
import { DRIFTWOOD_MELEE_PROFILE, DRIFTWOOD_IRON_PROFILE } from '../src/shards/driftwood-isle/generators/meleeProfile';

const shardfile = emptyShardfile({ slug: 'sword-profiles-test', name: 'Sword', author: 'Wildshard', revision: 1, seed: 1 });
function context(items: unknown) {
  return { product: createShardProduct({ slug: shardfile.identity.slug, revision: 1, shardfile,
    sections: new Map([['combat/items', { items }]]), files: new Map(), check: true,
    read: () => Promise.reject(new Error('Sword profiles must already be admitted')) }) };
}

function withProfile(row: object, profile: unknown) {
  return { ...row, profile };
}

test('both native swords borrow their original admitted combat profiles without a const copy', () => {
  const rows = driftwoodSwordProfiles(context(source.items));
  expect(rows).toEqual([DRIFTWOOD_MELEE_PROFILE, DRIFTWOOD_IRON_PROFILE]);
  // Exact canonical numeric payload from 0f5854a97's two runtime mirrors.
  expect(hashImmutableBytes(new TextEncoder().encode(encodeCanonicalJson(rows)))).toBe('cd922abc25931f46847366a5c5f44c2fd1137885d9e9dd1acb368764d63813b4');
  const declared = source.items.rows;
  const weapons = declared.filter(row => row.kind === 'weapon');
  expect(rows[0]).toBe(weapons.find(row => row.id === 'weapon.driftwood-isle.wood')?.profile);
  expect(rows[1]).toBe(weapons.find(row => row.id === 'weapon.driftwood-isle.iron')?.profile);
  for (const id of ['weapon.driftwood-isle.wood', 'weapon.driftwood-isle.iron']) {
    expect(() => driftwoodSwordProfiles(context({ ...source.items, rows: declared.filter(row => row.id !== id) }))).toThrow('both admitted sword profiles');
    expect(() => driftwoodSwordProfiles(context({ ...source.items, rows: declared.map(row => row.id === id ? withProfile(row, undefined) : row) }))).toThrow();
    expect(() => driftwoodSwordProfiles(context({ ...source.items, rows: declared.map(row => row.id === id ? withProfile(row, { family: 'bow' }) : row) }))).toThrow();
  }
});
