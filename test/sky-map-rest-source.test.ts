import { expect, test } from 'vitest';
import { mapSceneRest } from '../src/sdk/bake/mapRest';
import { isletScenes } from '../src/shards/far-reach/generators/isletScene';
import { isletMotionRows } from '../src/shards/far-reach/generators/isletMotion';
import { hashImmutableBytes } from '../src/sdk/immutable';
import { skyMapSources } from '../src/shards/far-reach/generators/bake-map.mjs';

test('the pure map producer refuses an omitted native bank before constructing geometry', async () => {
  await expect(skyMapSources(new Map())).rejects.toThrow('native input inventory differs');
});

test('source islet rest projection detaches callers and refuses incomplete poses', () => {
  const scene = isletScenes(), motion = isletMotionRows();
  const rest = (): ReturnType<typeof mapSceneRest> => mapSceneRest(scene.scene, motion.channels, motion.rest);
  const wire = (): Uint8Array => new TextEncoder().encode(`${JSON.stringify(rest())}\n`);
  const expected = hashImmutableBytes(wire());
  const changed = rest(); changed.nodes['far.islets']?.position.fill(9);
  expect(hashImmutableBytes(wire())).toBe(expected);
  expect(() => mapSceneRest(scene.scene, motion.channels, [])).toThrow('Missing map rest pose');
  expect(() => mapSceneRest({ nodes: [{ id: 'empty', instances: 2 }] }, [], [])).toThrow('Incomplete map rest instance slots');
});
