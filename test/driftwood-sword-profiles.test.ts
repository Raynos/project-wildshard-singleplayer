import { sameRuntimeProfile } from '../src/game/plugin/headless';
import { parseItems } from '../src/format/items';
import { expect, test } from 'vitest';
import { encodeCanonicalJson, hashImmutableBytes } from '../src/sdk/immutable';
import { emptyShardfile } from '../src/sdk/author';
import { createShardProduct } from '../src/game/shardfile/shardProduct';
import source from '../src/shards/driftwood-isle/shard.config';

const shardfile = emptyShardfile({ slug: 'sword-profiles-test', name: 'Sword', author: 'Wildshard', revision: 1, seed: 1 });
function context(items: unknown) {
  return { product: createShardProduct({ slug: shardfile.identity.slug, revision: 1, shardfile: { ...shardfile, items: parseItems(items) },
    sections: new Map([['combat/items', { items }]]), files: new Map(), check: true,
    read: () => Promise.reject(new Error('Sword profiles must already be admitted')) }) };
}

// The output writer sorts keys on the wire; item admission reconstructs schema order.
test('canonical section key order cannot change native sword admission', () => {
  const wire: unknown = JSON.parse(encodeCanonicalJson(source.items));
  const admitted = context(wire), profiles = admitted.product.shardfile.items.rows.flatMap(row => row.kind === 'weapon' && row.profile?.family === 'melee' ? [row.profile] : []);
  expect(hashImmutableBytes(new TextEncoder().encode(encodeCanonicalJson(profiles)))).toBe('cd922abc25931f46847366a5c5f44c2fd1137885d9e9dd1acb368764d63813b4');
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
