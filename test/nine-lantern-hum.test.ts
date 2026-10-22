import { expect, test } from 'vitest';
import * as v from 'valibot';
import { SampledAudioSceneSchema } from '../src/format/audioScene';
import { parseWorldScenePlacement } from '../src/format/worldScenePlacement';
import { ND_AUDIO } from '../src/shards/nine-dragon-stack/generators/audio';
import { LAYOUT_PLACEMENT_BLOBS } from '../src/shards/nine-dragon-stack/generators/worldScenes';

test('the lanterns hum where each deck ending hangs them: its placement file per world variant', () => {
  const scene = ND_AUDIO.sampledScene; if (scene === undefined) throw new Error('Expected the sampled scene');
  const blobs = new Map(LAYOUT_PLACEMENT_BLOBS.map(blob => [blob.file.name, blob]));
  for (const [variant, file] of Object.entries(scene.points)) {
    const blob = blobs.get(file); if (blob === undefined) throw new Error(`Missing lantern placement ${variant}`);
    const poses = parseWorldScenePlacement(JSON.parse(new TextDecoder().decode(blob.bytes))).poses;
    expect(poses.length).toBeGreaterThan(0);
  }
  expect(scene.points.standalone).not.toBe(scene.points.cell);
  expect(v.safeParse(SampledAudioSceneSchema, { ...scene, points: 'lanterns' }).success).toBe(false);
  expect(v.safeParse(SampledAudioSceneSchema, { ...scene, points: { standalone: scene.points.standalone } }).success).toBe(false);
});
