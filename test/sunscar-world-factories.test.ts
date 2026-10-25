// oxlint-disable-next-line import/no-nodejs-modules -- The native recipe proof starts only from its retained author model.
import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { bakeSignalWorldSources } from '../src/shards/sunscar-dunes/generators/worldSources';
import { signalWorldMetadata } from '../src/shards/sunscar-dunes/generators/worldMetadata';
import { whipHeldRecipe, WHIP_HELD_RECIPE } from '../src/shards/sunscar-dunes/generators/rows/heldWeapon';
import { gearSceneRows, GEAR_SCENE_ROWS } from '../src/shards/sunscar-dunes/generators/rows/gearModels';
import { signalSceneSources, SIGNAL_SOURCE_BLOBS } from '../src/shards/sunscar-dunes/generators/sceneSources';
import { signalWorldScenes, SIGNAL_WORLD_SCENES, SIGNAL_SCENE_BLOBS } from '../src/shards/sunscar-dunes/generators/worldScenes';
import { signalSceneOutput } from '../src/shards/sunscar-dunes/generators/sourceOutput';
import { encodeCanonicalJson, hashImmutableBytes } from '../src/sdk/immutable';
import before from './fixtures/sunscar-source-entry.json' with { type: 'json' };

const { files } = await bakeSignalWorldSources(new Uint8Array(readFileSync('src/shards/sunscar-dunes/assets/models/dry-well.glb')));
const physical = (values: ReadonlyMap<string, Uint8Array>) => [...values]
  .map(([name, bytes]) => [name, bytes.length, hashImmutableBytes(bytes)])
  .sort(([a], [b]) => String(a).localeCompare(String(b)));

test('explicit world rows retain every original held, specimen, scene and output byte', () => {
  const world = signalWorldMetadata(files), held = whipHeldRecipe(world.lash);
  expect(held).toEqual(WHIP_HELD_RECIPE);
  expect(gearSceneRows(world, held)).toEqual(GEAR_SCENE_ROWS);
  const sources = signalSceneSources(world);
  expect(sources.map(blob => blob.file)).toEqual(SIGNAL_SOURCE_BLOBS.map(blob => blob.file));
  const scene = signalWorldScenes(world, sources);
  expect(scene.worldScenes).toEqual(SIGNAL_WORLD_SCENES);
  expect(scene.blobs.map(blob => blob.file)).toEqual(SIGNAL_SCENE_BLOBS.map(blob => blob.file));
  const output = signalSceneOutput(scene);
  const bytes = new TextEncoder().encode(encodeCanonicalJson({ ...output, assets: physical(output.assets),
    platform: { ...output.platform, files: physical(output.platform.files) } }));
  expect({ bytes: bytes.length, hash: hashImmutableBytes(bytes) }).toEqual(before.raw.output);
});

test('held and specimen factories read the supplied anchors and lash dimensions', () => {
  const world = signalWorldMetadata(files);
  world.caravan.anchors.y += 1; world.well.anchors.y += 2;
  const brazier = world.braziers.braziers[0]; if (brazier === undefined) throw new Error('Missing original brazier');
  brazier.y += 3; world.lash.along += 4; world.lash.tip[0] += 5;
  const held = whipHeldRecipe(world.lash), gear = gearSceneRows(world, held);
  expect(held.resources.repeats[0].value).toEqual([world.lash.along, 1]);
  expect(held.tip).toEqual(world.lash.tip);
  expect(gear[2].position[1]).toBe(-world.caravan.anchors.y);
  expect(gear[3].position[1]).toBe(-world.well.anchors.y);
  expect(gear[4].position[1]).toBe(-brazier.y);
  expect(gear[0].specimen.recipe).toBe(held);
  const models = signalSceneSources(world)[0]; if (models === undefined) throw new Error('Missing models');
  expect(models.file.hash).not.toBe(SIGNAL_SOURCE_BLOBS[0]?.file.hash);
});

test('each scene assembly owns its mutable arrays and refuses missing declared braziers', () => {
  const world = signalWorldMetadata(files), sources = signalSceneSources(world);
  const first = signalWorldScenes(world, sources), second = signalWorldScenes(world, sources);
  first.worldScenes.steps.pop(); first.blobs.pop();
  expect(second.worldScenes).toEqual(SIGNAL_WORLD_SCENES);
  expect(second.blobs.map(blob => blob.file)).toEqual(SIGNAL_SCENE_BLOBS.map(blob => blob.file));
  world.braziers.braziers.pop();
  expect(() => signalWorldScenes(world, sources)).toThrow('Missing original brazier');
});
