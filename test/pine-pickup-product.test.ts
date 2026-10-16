import * as v from 'valibot';
import { expect, test } from 'vitest';
import { emptyShardfile } from '../src/sdk/author';
import { createShardProduct } from '../src/game/shardfile/shardProduct';
import { SECTIONS } from '../src/shards/pine-hollow/runtime/sections';
import { SECTIONS as AUTHOR_SECTIONS } from '../src/shards/pine-hollow/generators/sectionSchemas.generated';
import rows from '../src/shards/pine-hollow/data/skinPickups.json' with { type: 'json' };

const name = 'custom/skinPickups';
const shardfile = emptyShardfile({ slug: 'pine-pickup-test', name: 'Pine', author: 'Wildshard', revision: 1, seed: 1 });
function product(value: unknown) {
  return createShardProduct({ slug: shardfile.identity.slug, revision: 1, shardfile,
    sections: new Map([[name, value]]), files: new Map(), check: true,
    read: () => Promise.reject(new Error('No pickup bytes expected')) });
}

test('the admitted pickup section preserves all seven rows and rejects incomplete or malformed rosters', () => {
  expect(product(rows).section(name, SECTIONS)).toEqual(rows);
  expect(v.parse(AUTHOR_SECTIONS[name], rows)).toEqual(rows);
  for (const id of Object.keys(rows)) {
    const incomplete = Object.fromEntries(Object.entries(rows).filter(([key]) => key !== id));
    expect(() => product(incomplete).section(name, SECTIONS)).toThrow();
    expect(() => v.parse(AUTHOR_SECTIONS[name], incomplete)).toThrow();
  }
  const malformed = { ...rows, ironhide: { ...rows.ironhide, unique: 'true' } };
  expect(() => product(malformed).section(name, SECTIONS)).toThrow();
  expect(() => v.parse(AUTHOR_SECTIONS[name], malformed)).toThrow();
  expect(() => product({ ...rows, extra: rows.ironhide }).section(name, SECTIONS)).toThrow();
});
