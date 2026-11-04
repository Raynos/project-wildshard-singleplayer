import { expect, test } from 'vitest';
import * as v from 'valibot';
import { BuildingLifeDocumentSchema, BuildingLifeLookSchema, BuildingLifeRowsSchema } from '@wildshard/format/buildings';
import { REGISTERED_JSON, validateRegisteredJson } from '@wildshard/format/registeredJson';
import { namedJsonSchema, registeredJsonSchema } from '@wildshard/sdk/formatJsonSchema';
import { encodeCanonicalJson } from '@wildshard/sdk/immutable';
import { nameBlob } from '@wildshard/sdk/blobs';
import { driftwoodJsonBlob } from '../src/shards/driftwood-isle/generators/namedSchemas';
import { emptyShardfile } from '@wildshard/sdk/author';
import { createShardProduct } from '@wildshard/game/shardfile/shardProduct';
import rows from '../src/shards/driftwood-isle/data/buildingLife.json' with { type: 'json' };

const name = 'world/building-life.json';
const encode = (value: unknown) => new TextEncoder().encode(encodeCanonicalJson(value));
const original = v.strictObject({ look: BuildingLifeLookSchema, life: BuildingLifeRowsSchema,
  initialDusk: v.pipe(v.number(), v.finite(), v.minValue(0), v.maxValue(1)) });

test('the whole site-life document keeps exact bytes, defaults and its native root', () => {
  expect(REGISTERED_JSON[name].schema).toBe(BuildingLifeDocumentSchema);
  expect(registeredJsonSchema(name)).toEqual({ ...namedJsonSchema(BuildingLifeDocumentSchema),
    $comment: '@wildshard/format/buildings#BuildingLifeDocumentSchema' });
  const before = encode(rows);
  validateRegisteredJson(name, rows);
  expect(v.parse(BuildingLifeDocumentSchema, rows)).toEqual(v.parse(original, rows));
  expect(driftwoodJsonBlob(name, 'json', before).bytes).toEqual(before);
  expect(driftwoodJsonBlob(name, 'json', before).file.jsonSchema).toEqual(registeredJsonSchema(name));
  const { colors: _colors, params: _params, ...life } = rows.life;
  const omitted = { ...rows, life };
  expect(v.parse(BuildingLifeDocumentSchema, omitted)).toEqual(v.parse(original, omitted));
  expect(nameBlob(name, 'json', encode(omitted), { jsonSchema: registeredJsonSchema(name) }).bytes).toEqual(encode(omitted));
  expect(encode(rows)).toEqual(before);
});

test('complete root admission preserves native refusals and checks before file IO', async () => {
  const invalid: unknown[] = [{ ...rows, extra: true }, { ...rows, initialDusk: -0.1 }, { ...rows, initialDusk: 1.1 },
    { life: rows.life, initialDusk: 0 }, { ...rows, life: { ...rows.life, shared: Array.from({ length: 9 }, () => 'light') } },
    { ...rows, look: { ...rows.look, wheel: Infinity } }];
  for (const value of invalid) {
    expect(() => v.parse(original, value)).toThrow();
    expect(() => validateRegisteredJson(name, value)).toThrow();
  }
  const identity = { slug: 'life-contract', name: 'Site life', author: 'Test', revision: 1, seed: 1 };
  for (const schema of [undefined, {}, { $comment: 'foreign' }]) {
    let reads = 0;
    const product = createShardProduct({ slug: identity.slug, revision: 1, shardfile: emptyShardfile(identity), sections: new Map(),
      files: new Map([[name, { hash: 'a'.repeat(64), url: '/life', ...(schema === undefined ? {} : { jsonSchema: schema }) }]]),
      builtJson: true, read: () => { reads++; return Promise.resolve(encode(rows)); } });
    await expect(product.json(name)).rejects.toThrow('unregistered named JSON is retired');
    expect(reads).toBe(0);
  }
});
