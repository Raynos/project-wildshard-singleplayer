import { expect, test } from 'vitest';
import { parseCapturePoses } from '../src/format/minimap';
import { installDeclaredBakedTerrain } from '../src/engine/world/bakedTerrainField';
import { readNativeTerrain } from '../src/sdk/bake/terrain';
import { driftwoodGroundBytes } from '../src/shards/driftwood-isle/generators/groundRows';
import { driftwoodCapturePoses } from '../src/shards/driftwood-isle/generators/capturePoses';
import { GROUND } from '../src/shards/driftwood-isle/boot/ground';
import source from '../src/shards/driftwood-isle/manifest.json' with { type: 'json' };
import poses from '../src/shards/driftwood-isle/data/boot-poses.generated.json' with { type: 'json' };
import manifest from '../src/shards/driftwood-isle/discovery.generated';

test('offline capture poses preserve all original terrain-bound eyes and angles exactly', () => {
  const terrain = readNativeTerrain(driftwoodGroundBytes());
  installDeclaredBakedTerrain(GROUND.terrain, { seed: terrain.grid.seed, ...terrain });
  const expected = Object.fromEntries(source.captureProbes.map(probe => [probe.name, {
    probe, eye: [probe.x, GROUND.terrain.heightAt(probe.x, probe.z) + 1.68, probe.z],
    yaw: -probe.yaw * 180 / Math.PI, pitch: probe.pitch * 180 / Math.PI, mockup: '', frame: probe.name,
  }]));
  expect(Object.keys(expected)).toEqual(['pier', 'beach', 'wreck']);
  expect(driftwoodCapturePoses()).toEqual(expected);
  expect(poses).toEqual(expected);
});

test('the authored manifest reads independent copies of generated poses without a runtime loader', async () => {
  expect(source.bindings).not.toHaveProperty('posesLoader');
  expect(source.bindings.poses).toEqual({ module: './data/boot-poses.generated.json', export: 'default' });
  if (manifest.dev === undefined) throw new Error('Missing capture pose data');
  const first = await manifest.dev.poses(), second = await manifest.dev.poses();
  expect(first).toEqual(poses);
  expect(second).toEqual(poses);
  expect(first).not.toBe(second);
  expect(first['pier']).not.toBe(second['pier']);
});

test('JSON pose admission refuses malformed vectors, angles and undeclared fields', () => {
  const pose = poses.pier;
  expect(parseCapturePoses(poses)).toEqual(poses);
  expect(() => parseCapturePoses({ pier: { ...pose, eye: [0, 1] } })).toThrow();
  expect(() => parseCapturePoses({ pier: { ...pose, eye: [0, 1, 2, 3] } })).toThrow();
  expect(() => parseCapturePoses({ pier: { ...pose, yaw: Infinity } })).toThrow();
  expect(() => parseCapturePoses({ pier: { ...pose, extra: true } })).toThrow();
});
