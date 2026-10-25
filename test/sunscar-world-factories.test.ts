// oxlint-disable-next-line import/no-nodejs-modules -- The native recipe proof starts only from its retained author model.
import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { originalEmberTransport } from './fixtures/signal-inline-embers';
import { bakeSignalWorldSources } from '../src/shards/sunscar-dunes/generators/worldSources';
import { signalWorldMetadata } from '../src/shards/sunscar-dunes/generators/worldMetadata';
import { whipHeldRecipe } from '../src/shards/sunscar-dunes/generators/rows/heldWeapon';
import { gearSceneRows } from '../src/shards/sunscar-dunes/generators/rows/gearModels';
import { signalSceneSources } from '../src/shards/sunscar-dunes/generators/sceneSources';
import { placeBindings } from '../src/shards/sunscar-dunes/generators/restScene';
import { signalWorldScenes } from '../src/shards/sunscar-dunes/generators/worldScenes';
import { signalSceneOutput } from '../src/shards/sunscar-dunes/generators/sourceOutput';
import { encodeCanonicalJson, hashImmutableBytes } from '../src/sdk/immutable';
import { signalQuestMarkers } from '../src/shards/sunscar-dunes/generators/questMarkers';
import { signalQuestPage } from '../src/shards/sunscar-dunes/generators/questPage';
import { signalClientPlan } from '../src/shards/sunscar-dunes/generators/clientPlan';
import { restPools, rigLibrary, held as WHIP_HELD_RECIPE, gear as GEAR_SCENE_ROWS, sourceBlobs as SIGNAL_SOURCE_BLOBS, scene as originalScene,
  markers as QUEST_MARKERS, page as SIGNAL_QUEST_PAGE, client as SIGNAL_CLIENT_PLAN } from './fixtures/sunscar-source-program';
import before from './fixtures/sunscar-source-entry.json' with { type: 'json' };

const SIGNAL_WORLD_SCENES = originalScene.worldScenes, SIGNAL_SCENE_BLOBS = originalScene.blobs;
const { files } = await bakeSignalWorldSources(new Uint8Array(readFileSync('src/shards/sunscar-dunes/assets/models/dry-well.glb')));
const physical = (values: ReadonlyMap<string, Uint8Array>) => [...values]
  .map(([name, bytes]) => [name, bytes.length, hashImmutableBytes(bytes)])
  .sort(([a], [b]) => String(a).localeCompare(String(b)));

test('explicit world rows retain every original held, specimen, scene and output byte', () => {
  const world = signalWorldMetadata(files), held = whipHeldRecipe(world.lash);
  expect(held).toEqual(WHIP_HELD_RECIPE);
  expect(gearSceneRows(world, held)).toEqual(GEAR_SCENE_ROWS);
  const sources = signalSceneSources(world, rigLibrary, restPools);
  expect(sources.map(blob => blob.file)).toEqual(SIGNAL_SOURCE_BLOBS.map(blob => blob.file));
  const scene = signalWorldScenes(world, sources, placeBindings());
  expect(scene.worldScenes).toEqual(SIGNAL_WORLD_SCENES);
  expect(scene.blobs.map(blob => blob.file)).toEqual(SIGNAL_SCENE_BLOBS.map(blob => blob.file));
  const output = signalSceneOutput(scene, SIGNAL_CLIENT_PLAN);
  const old = originalEmberTransport(output.namedFiles, output.assets);
  const bytes = new TextEncoder().encode(encodeCanonicalJson({ ...output, namedFiles: old.namedFiles, assets: physical(old.assets),
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
  const models = signalSceneSources(world, rigLibrary, restPools)[0]; if (models === undefined) throw new Error('Missing models');
  expect(models.file.hash).not.toBe(SIGNAL_SOURCE_BLOBS[0]?.file.hash);
});

test('each scene assembly owns its mutable arrays and refuses missing declared braziers', () => {
  const world = signalWorldMetadata(files), sources = signalSceneSources(world, rigLibrary, restPools);
  const first = signalWorldScenes(world, sources, placeBindings()), second = signalWorldScenes(world, sources, placeBindings());
  first.worldScenes.steps.pop(); first.blobs.pop();
  expect(second.worldScenes).toEqual(SIGNAL_WORLD_SCENES);
  expect(second.blobs.map(blob => blob.file)).toEqual(SIGNAL_SCENE_BLOBS.map(blob => blob.file));
  world.braziers.braziers.pop();
  expect(() => signalWorldScenes(world, sources, placeBindings())).toThrow('Missing original brazier');
});

test('quest policy reads the same verified world anchors without changing saved policy', () => {
  const world = signalWorldMetadata(files), markers = signalQuestMarkers(world);
  expect(markers).toEqual(QUEST_MARKERS);
  const page = signalQuestPage(markers);
  expect(page).toEqual(SIGNAL_QUEST_PAGE);
  expect(hashImmutableBytes(new TextEncoder().encode(JSON.stringify(page))))
    .toBe('50f8d95f610b2ab6faa67abe3ee7c83253ad3d4ca6d833c65a5a21143d27ed9b');
  expect(signalClientPlan(page)).toEqual(SIGNAL_CLIENT_PLAN);
  world.caravan.anchors.logbook[1] += 2;
  world.well.anchors.y += 3; world.tower.anchors.deckY += 4;
  expect(signalQuestMarkers(world)['logbook']?.y).toBe((markers['logbook']?.y ?? 0) + 2);
  expect(signalQuestMarkers(world)['well']?.y).toBe((world.well.anchors.y + 1) + 0.6);
  expect(signalQuestMarkers(world)['tower']?.y).toBe((world.tower.anchors.deckY + 1.1) + 1);
  world.caravan.anchors.logbook.pop();
  expect(() => signalQuestMarkers(world)).toThrow('Invalid authored logbook anchor');
  const fresh = signalWorldMetadata(files); fresh.braziers.braziers.pop();
  expect(() => signalQuestMarkers(fresh)).toThrow('Missing authored waymark');
});

test('source models refuse incomplete, repeated or empty rest pool metadata', () => {
  const world = signalWorldMetadata(files);
  expect(() => signalSceneSources(world, rigLibrary, [])).toThrow('rest pool inventory');
  expect(() => signalSceneSources(world, rigLibrary, [...restPools.slice(0, 2), ...restPools.slice(0, 1)])).toThrow('rest pool inventory');
  expect(() => signalSceneSources(world, rigLibrary, restPools.map(pool => ({ url: pool.url, parts: [] })))).toThrow('rest pool inventory');
});
