import { expect, test } from 'vitest';
import { mapSceneRest } from '../src/sdk/bake/mapRest';
import { isletScenes } from '../src/shards/far-reach/generators/isletScene';
import { isletMotionRows } from '../src/shards/far-reach/generators/isletMotion';
import { hashImmutableBytes } from '../src/sdk/immutable';
import { discoverGeneration } from '../scripts/generate.mjs';
import { skyMapSources } from '../src/shards/far-reach/generators/bake-map.mjs';

test('the pure map producer refuses an omitted native bank before constructing geometry', async () => {
  await expect(skyMapSources(new Map())).rejects.toThrow('native input inventory differs');
});

test('source islet rest projection retains the complete original wire without a scheduler handoff', () => {
  const scene = isletScenes(), motion = isletMotionRows();
  const rest = (): ReturnType<typeof mapSceneRest> => mapSceneRest(scene.scene, motion.channels, motion.rest);
  const wire = (): Uint8Array => new TextEncoder().encode(`${JSON.stringify(rest())}\n`);
  expect(wire().byteLength).toBe(393_728);
  expect(hashImmutableBytes(wire())).toBe('8de99b7171f84b55305b60e2efabc237180474a8a09edcf87a29ead3071ce267');
  const changed = rest(); changed.nodes['far.islets']?.position.fill(9);
  expect(hashImmutableBytes(wire())).toBe('8de99b7171f84b55305b60e2efabc237180474a8a09edcf87a29ead3071ce267');
  expect(() => mapSceneRest(scene.scene, motion.channels, [])).toThrow('Missing map rest pose');
  expect(() => mapSceneRest({ nodes: [{ id: 'empty', instances: 2 }] }, [], [])).toThrow('Incomplete map rest instance slots');
  const { jobs } = discoverGeneration('.');
  expect(jobs.some(job => job.id === 'sky-map-rest')).toBe(false);
  const map = jobs.find(job => job.id === 'sky-data-map');
  if (map === undefined) throw new Error('Missing retained map producer');
  for (const path of ['src/shards/far-reach/data/isletScenes.generated.json', 'src/shards/far-reach/data/mapRest.generated.json']) {
    expect(map.inputRoots).not.toContain(path);
  }
});
