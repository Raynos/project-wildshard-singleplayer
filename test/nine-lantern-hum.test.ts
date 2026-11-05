import { expect, test } from 'vitest';
import * as v from 'valibot';
import { SampledAudioSceneSchema, parseSampledAudioPlacement } from '@wildshard/format/audioScene';
import { parseWorldScenePlacement } from '@wildshard/format/worldScenePlacement';
import { ND_AUDIO, nineAudioForScenes } from '../src/shards/nine-dragon-stack/generators/audio';
import { LAYOUT_PLACEMENT_BLOBS, LAYOUT_PLACEMENTS, scenes } from './fixtures/nine-product-inputs';

test('the lanterns hum where each deck ending hangs them: its placement file per world variant', () => {
  const scene = nineAudioForScenes(scenes).sampledScene; if (scene === undefined) throw new Error('Expected the sampled scene');
  const blobs = new Map(LAYOUT_PLACEMENT_BLOBS.map(blob => [blob.file.name, blob]));
  for (const [variant, source] of Object.entries(scene.points)) {
    if (typeof source === 'string') throw new Error('Expected a page member');
    const blob = blobs.get(source.file); if (blob === undefined) throw new Error(`Missing lantern placement ${variant}`);
    const poses = parseSampledAudioPlacement(JSON.parse(new TextDecoder().decode(blob.bytes)), source).poses;
    const original = LAYOUT_PLACEMENTS.find(row => row.id === source.id);
    if (original === undefined) throw new Error('Missing original lantern placement');
    expect(poses).toEqual(parseWorldScenePlacement(original).poses);
    expect(poses.length).toBeGreaterThan(0);
  }
  expect(scene.points.standalone).not.toBe(scene.points.cell);
  expect(v.safeParse(SampledAudioSceneSchema, { ...scene, points: 'lanterns' }).success).toBe(false);
  expect(v.safeParse(SampledAudioSceneSchema, { ...scene, points: { standalone: scene.points.standalone } }).success).toBe(false);
  const before = structuredClone(ND_AUDIO), after = nineAudioForScenes(scenes);
  if (after.sampledScene === undefined || before.sampledScene === undefined) throw new Error('Missing sampled scene');
  after.sampledScene.points = before.sampledScene.points;
  expect(JSON.stringify(after)).toBe(JSON.stringify(before));
});
