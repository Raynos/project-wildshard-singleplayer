import { expect, test } from 'vitest';
import * as v from 'valibot';
import { SceneModelSourceSchema, SceneBakeSourceSchema } from '@wildshard/format/sceneSources';
import { sourceBlobs } from './fixtures/sunscar-source-program';
import { originalSkySceneInputs } from './fixtures/sky-scene-source';
import { skySourceBlobs } from '../src/shards/far-reach/generators/sceneSources';

test('both complete native source families admit all five actual author envelopes without changing their wire', async () => {
  const sky = await originalSkySceneInputs();
  const blobs = [...sourceBlobs, ...skySourceBlobs(sky.heroes)];
  expect(blobs).toHaveLength(5);
  for (const { file, bytes } of blobs) {
    const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes), value: unknown = JSON.parse(text);
    v.parse(file.name === 'world/sources/bakes.json' ? SceneBakeSourceSchema : SceneModelSourceSchema, value);
    expect(JSON.stringify(value), file.name).toBe(text);
  }
});

test('source admission refuses untyped extensions and malformed native resources in every branch', () => {
  const model = { rows: { meshes: [], hd: [], meshUrls: {}, hdUrls: {}, hdLooks: {}, aoFloor: 0.2 } };
  const bake = { rows: {}, urls: {} };
  expect(v.parse(SceneModelSourceSchema, model)).toEqual(model);
  expect(v.parse(SceneBakeSourceSchema, bake)).toEqual(bake);
  for (const value of [{ ...model, opaque: {} }, { rows: { ...model.rows, geometryPools: [{ url: 'pool.glb', parts: ['rest'], native: { requireIndex: true, callback: 'source' } }] } },
    { rows: { ...model.rows, hdLooks: { cold: { roughness: Infinity } } } },
    { rows: { ...model.rows, rigs: { bodies: { creatures: [], urls: {}, standIns: {}, fault: 'source', onMap: () => undefined }, looks: [] } } }]) {
    expect(() => v.parse(SceneModelSourceSchema, value)).toThrow();
  }
  for (const value of [{ ...bake, opaque: {} }, { rows: { cold: { kinds: [], colliders: [], hulls: [{ id: 'hull', x: 0, y: 0, z: 0, points: ['bad'] }] } }, urls: {} },
    { ...bake, resources: [{ id: 'plait', url: 'plait.bin', compression: 'gzip', fault: { level: 'warn', message: 'source' } }] },
    { rows: { cold: { kinds: [], colliders: [], rigs: [{ tops: [[0, 1]], local: [] }] } }, urls: {} }]) {
    expect(() => v.parse(SceneBakeSourceSchema, value)).toThrow();
  }
});
