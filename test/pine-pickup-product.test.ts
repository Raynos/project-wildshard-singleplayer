import { expect, test } from 'vitest';
import { emptyShardfile } from '../src/sdk/author';
import { createShardProduct } from '../src/game/shardfile/shardProduct';
import { parseItems } from '../src/format/items';
import { pinePickups } from '../src/shards/pine-hollow/generators/pickups';
import rows from '../src/shards/pine-hollow/data/skinPickups.json' with { type: 'json' };

test('the platform item catalogue preserves all seven pickups and refuses malformed or incomplete author rows', () => {
  const pickups = pinePickups();
  const source = emptyShardfile({ slug: 'pine-pickup-test', name: 'Pine', author: 'Wildshard', revision: 1, seed: 1 });
  const items = parseItems({ ...source.items, pickups });
  const product = createShardProduct({ slug: source.identity.slug, revision: 1, shardfile: { ...source, items },
    sections: new Map([['combat/items', { items }]]), files: new Map(), check: true,
    read: () => Promise.reject(new Error('No pickup bytes expected')) });
  expect(product.section('combat/items').items.pickups).toEqual(pickups);
  expect(product.has('custom/skinPickups')).toBe(false);
  for (const id of Object.keys(rows)) {
    const incomplete = Object.fromEntries(Object.entries(rows).filter(([key]) => key !== id));
    expect(() => pinePickups(incomplete)).toThrow();
  }
  const malformed = { ...rows, ironhide: { ...rows.ironhide, unique: 'true' } };
  expect(() => pinePickups(malformed)).toThrow();
  expect(() => pinePickups({ ...rows, extra: rows.ironhide })).toThrow();
});
