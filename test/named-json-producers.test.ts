import { expect, test } from 'vitest';
import * as v from 'valibot';
import { SCENE_BLOBS } from '../src/shards/pine-hollow/generators/worldScenes';
import { namedJsonSchema } from '../src/sdk/formatJsonSchema';
import { nameBlob } from '../src/sdk/blobs';
import { validateCustomSchema } from '../src/game/shardfile/customSchema';

test('Pine scene producers attach defining schemas and refuse corrupted nested rows', () => {
  expect(SCENE_BLOBS.length).toBeGreaterThan(180);
  for (const blob of SCENE_BLOBS) expect(blob.file.jsonSchema, blob.file.name).toBeDefined();
  const scene = SCENE_BLOBS.find(blob => blob.file.name?.startsWith('scenes/placements/') === true);
  if (scene?.file.jsonSchema === undefined) throw new Error('Missing authored Pine placement');
  const jsonSchema = scene.file.jsonSchema;
  const corrupt: unknown = { ...JSON.parse(new TextDecoder().decode(scene.bytes)), poses: [{ x: 'bad', y: 0, z: 0 }] };
  expect(() => nameBlob('bad/placement.json', 'json', new TextEncoder().encode(JSON.stringify(corrupt)), { jsonSchema })).toThrow('refuses its schema');
  expect(() => validateCustomSchema(jsonSchema, corrupt)).toThrow('refuses its schema');
  expect(() => validateCustomSchema({ ...scene.file.jsonSchema, type: 'made-up' }, {})).toThrow();
});

test('named schema conversion refuses unrecognised author predicates', () => {
  expect(() => namedJsonSchema(v.pipe(v.number(), v.check(n => n === 7)))).toThrow('cannot be converted');
});
