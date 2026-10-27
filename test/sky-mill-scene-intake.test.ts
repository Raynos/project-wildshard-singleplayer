// oxlint-disable-next-line import/no-nodejs-modules -- Derive the original mill hierarchy from its two tracked native models.
import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { parseWorldScene } from '../src/format/clientChannels';
import { encodeCanonicalJson, hashImmutableBytes } from '../src/sdk/immutable';
import { millSceneSource } from '../src/shards/far-reach/generators/millScene';
import { readMillSceneValues, skyWorldSceneValues, type SkyWorldSceneValues } from '../src/shards/far-reach/generators/worldScenes';
import { originalSkySceneInputs, originalSkyScenes } from './fixtures/sky-scene-source';


const encode = (value: unknown): Uint8Array => new TextEncoder().encode(JSON.stringify(value));
const original = (): Promise<Uint8Array> => millSceneSource(url => readFileSync(`public${url}`));
const checkWorld = (value: SkyWorldSceneValues): void => {
  const wire = new TextEncoder().encode(encodeCanonicalJson(value.scenes));
  expect(wire.byteLength).toBe(329_351);
  expect(hashImmutableBytes(wire)).toBe('27f1bf00f36fecbf34936dff22d2e9791498006a92aa2404236883111f417884');
  expect(value.blobs).toHaveLength(25);
  const records = value.blobs.map(blob => ({ file: blob.file, hash: hashImmutableBytes(blob.bytes) }));
  expect(hashImmutableBytes(new TextEncoder().encode(encodeCanonicalJson(records)))).toBe('e58dbe6a4db6c870a7dfb86d91d5d7fde714c6060bc03b7bd09dd662817fdf56');
};

test('owned mill intake preserves the complete original hierarchy and motion bindings with isolated rows', async () => {
  const bytes = await original();
  expect(bytes.byteLength).toBe(2_200);
  expect(hashImmutableBytes(bytes)).toBe('3a4d921739c9ca69a3a36885fc4020c3ee01d47aa6097df406859a626ef842a8');
  const admitted = readMillSceneValues(bytes);
  expect(admitted.recipe).toEqual(parseWorldScene(admitted.recipe));
  expect(hashImmutableBytes(new TextEncoder().encode(encodeCanonicalJson({ MILL_SCENE: admitted }))))
    .toBe('92fd45fa8c27f9c1dc1e9cc59910bb8ac185b901a9a71199205deb79f9ea83c1');
  const root = admitted.recipe.scene.nodes[0];
  if (root === undefined) throw new Error('Missing original mill root');
  root.children.push('caller-only');
  expect(readMillSceneValues(bytes).recipe.scene.nodes[0]?.children).not.toContain('caller-only');
});

test('fresh scene construction retains the entire original world and every named file with injected mill rows', async () => {
  const bytes = await original(), mill = readMillSceneValues(bytes);
  const { staticScenes, routes, heroes } = await originalSkySceneInputs();
  const injected = skyWorldSceneValues(mill, staticScenes, routes, heroes);
  checkWorld(injected); checkWorld(await originalSkyScenes());
  for (const blob of injected.blobs) blob.bytes.fill(0);
  injected.scenes.steps.length = 0;
  checkWorld(skyWorldSceneValues(readMillSceneValues(bytes), staticScenes, routes, heroes));
  checkWorld(await originalSkyScenes());
  expect(hashImmutableBytes(new TextEncoder().encode(encodeCanonicalJson({ MILL_SCENE: mill }))))
    .toBe('92fd45fa8c27f9c1dc1e9cc59910bb8ac185b901a9a71199205deb79f9ea83c1');
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
