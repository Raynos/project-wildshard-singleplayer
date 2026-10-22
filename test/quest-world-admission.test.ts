import { expect, test } from 'vitest';
import { driftwoodJsonBlob } from '../src/shards/driftwood-isle/generators/namedSchemas';
import { driftwoodQuestWorld } from '../src/shards/driftwood-isle/generators/questWorld';
import { validateNamedJsonSchema } from '../src/game/shardfile/customSchema';

const encode = (value: unknown): Uint8Array => new TextEncoder().encode(JSON.stringify(value));

test('the defining named quest world schema preserves the original anchors and POI order', () => {
  const rows = driftwoodQuestWorld(), blob = driftwoodJsonBlob('quests/world.json', 'json', encode(rows));
  if (blob.file.jsonSchema === undefined) throw new Error('Missing defining quest world schema');
  expect(validateNamedJsonSchema(blob.file.jsonSchema, blob.bytes)).toEqual(rows);
  expect(Object.keys(rows.pois)).toEqual(['hut', 'lookout', 'wreck', 'shrine', 'cave']);
});

test('named quest world admission refuses reflected paths and invalid anchor values', () => {
  const rows = driftwoodQuestWorld();
  for (const bad of [{ ...rows, path: ['world', 'pois'] },
    { ...rows, pois: { hut: { anchors: { door: { x: 'wrong', y: 0, z: 0, yaw: 0 } } } } },
    { ...rows, pois: { hut: { anchors: { door: { x: 0, y: 0, z: 0, yaw: Infinity } } } } }])
    expect(() => driftwoodJsonBlob('quests/world.json', 'json', encode(bad))).toThrow('refuses its schema');
});
