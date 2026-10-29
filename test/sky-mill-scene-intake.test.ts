// oxlint-disable-next-line import/no-nodejs-modules -- Derive the original mill hierarchy from its two tracked native models.
import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { parseWorldScene } from '../src/format/clientChannels';
import { millSceneSource } from '../src/shards/far-reach/generators/millScene';
import { readMillSceneValues, skyWorldSceneValues } from '../src/shards/far-reach/generators/worldScenes';
import { originalSkySceneInputs, originalSkyScenes } from './fixtures/sky-scene-source';


const encode = (value: unknown): Uint8Array => new TextEncoder().encode(JSON.stringify(value));
const original = (): Promise<Uint8Array> => millSceneSource(url => readFileSync(`public${url}`));
test('owned mill intake preserves the complete original hierarchy and motion bindings with isolated rows', async () => {
  const bytes = await original();
  const admitted = readMillSceneValues(bytes);
  expect(admitted.recipe).toEqual(parseWorldScene(admitted.recipe));
  const root = admitted.recipe.scene.nodes[0];
  if (root === undefined) throw new Error('Missing original mill root');
  root.children.push('caller-only');
  expect(readMillSceneValues(bytes).recipe.scene.nodes[0]?.children).not.toContain('caller-only');
});

test('fresh scene construction owns its mutable rows and blob bytes', async () => {
  const bytes = await original(), mill = readMillSceneValues(bytes);
  const { staticScenes, routes, heroes } = await originalSkySceneInputs();
  const injected = skyWorldSceneValues(mill, staticScenes, routes, heroes);
  const steps = injected.scenes.steps.length;
  const first = injected.blobs.find(blob => blob.bytes.byteLength > 0);
  const originalByte = first?.bytes[0];
  if (first === undefined || originalByte === undefined) throw new Error('Missing mutable scene bytes');
  first.bytes[0] = (originalByte + 1) % 256;
  injected.scenes.steps.length = 0;
  const fresh = skyWorldSceneValues(readMillSceneValues(bytes), staticScenes, routes, heroes);
  expect(fresh.scenes.steps).not.toBe(injected.scenes.steps);
  expect(fresh.scenes.steps).toHaveLength(steps);
  const restored = fresh.blobs.find(blob => blob.file.name === first.file.name);
  expect(restored?.bytes).not.toBe(first.bytes);
  expect(restored?.bytes[0]).toBe(originalByte);
  const ordinary = await originalSkyScenes();
  expect(ordinary.scenes.steps).toHaveLength(steps);
  expect(ordinary.blobs.find(blob => blob.file.name === first.file.name)?.bytes[0]).toBe(originalByte);
});

test('mill intake refuses malformed bytes, envelopes, inventories, recipes and motion bindings', async () => {
  const scene = readMillSceneValues(await original());
  const invalid = [new Uint8Array(), new Uint8Array(16_385), new Uint8Array([255]), encode({}),
    encode({ MILL_SCENE: { ...scene, parts: [] } }), encode({ MILL_SCENE: { ...scene, cloth: ['foreign'] } }),
    encode({ MILL_SCENE: { ...scene, bindings: { ...scene.bindings, hub: { kind: 'group', part: 'foreign' } } } }),
    encode({ MILL_SCENE: { ...scene, bindings: { ...scene.bindings, hubAt: { kind: 'vector', value: [0, null, 0] } } } }),
    encode({ MILL_SCENE: { ...scene, recipe: {} } })];
  for (const bytes of invalid) expect(() => readMillSceneValues(bytes)).toThrow();
});
