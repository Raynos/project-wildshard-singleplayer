// Retain the shipping placement recipe offline over the real native ground and spruce roster.
import { readFileSync } from 'node:fs';
import { encodeCanonicalJson } from '@wildshard/sdk/immutable';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { installBakeEnvironment } from './environment.mjs';
import { prepareNativeTerrain } from './nativeWorld.mjs';
import { byteWriter, jsonBytes, outputHash } from '../bake-output.mjs';

async function bakeNalatiDressing(dressingRecipe) {
  const root = resolve(import.meta.dirname, '../..');
  const environment = installBakeEnvironment(root);
  const noop = () => undefined;


  try {
    const { NALATI_GRASSLANDS } = await import('../../src/shards/nalati-grasslands/manifest.ts');
    await prepareNativeTerrain(NALATI_GRASSLANDS, { root, bytes: readFileSync(resolve(root, 'public/assets/baked/nalati-grasslands/terrain.bin')) });
    const { configureGrassField } = await import('@wildshard/game/systems/looks/grassField');
    const { NALATI_GRASS_LAYOUT } = await import('../../src/shards/nalati-grasslands/generators/grassFieldLayout.ts');
    const { pageScope } = await import('@wildshard/engine/app/resources');
    const { RIVER } = await import('../../src/shards/nalati-grasslands/generators/terrainRecipe.ts');
    configureGrassField({ ...NALATI_GRASS_LAYOUT, riverZ: RIVER.z, riverHalf: RIVER.half }, pageScope);
    const [{ placeForest }, { SPRUCE_SPECS }, { outcropsPlace, bakeCragRock }] = await Promise.all([
      import('@wildshard/engine/world/forest/placement'), import('../../src/shards/nalati-grasslands/generators/spruceGeometry.ts'),
      import('../../src/shards/nalati-grasslands/generators/places.ts'),
    ]);
    const [layout, terrain, { inPoiClearing }] = await Promise.all([
      import('../../src/shards/nalati-grasslands/generators/layout.ts'), import('../../src/shards/nalati-grasslands/generators/terrainRecipe.ts'),
      import('../../src/shards/nalati-grasslands/generators/terrainRecipe.ts'),
    ]);
    const [noise, heightfield, grass, { terrainHeight: heightAt }] = await Promise.all([
      import('@wildshard/engine/core/noise'), import('@wildshard/engine/world/Heightfield'),
      import('@wildshard/game/systems/looks/grassField'), import('@wildshard/engine/world/terrainHeight'),
    ]);
    const { planDressing, campClutterSpots } = dressingRecipe({ layout, ...terrain, ...noise, ...heightfield, ...grass, heightAt, inPoiClearing });
    const { trees, grid } = placeForest(SPRUCE_SPECS.map(row => ({ trunkRadius: row.trunk, height: row.height })));
    const forest = { trees, nearby: (x, z, r) => grid.nearby(x, z, r) };
    const plan = await planDressing(forest);
    const placeRows = JSON.parse(readFileSync(resolve(root, 'src/shards/nalati-grasslands/data/places.json'), 'utf8')).rows;
    const sequence = JSON.parse(readFileSync(resolve(root, 'src/shards/nalati-grasslands/data/worldView.json'), 'utf8')).sequence;
    const spots = placeRows.find(row => row.name === 'kurgans').anchors.balbalSpots;
    const poiColliders = sequence.flatMap(row => row.name === 'balbals' ? spots.map(spot => {
      const scale = spot.scale ?? 1, y = heightAt(spot.x, spot.z) - .18 * scale;
      return { x: spot.x, z: spot.z, hw: .42 * scale, hd: .33 * scale, rot: -spot.yaw, yBottom: y - 1, yTop: y + 2.2 * scale, ghost: true };
    }) : placeRows.find(place => place.name === row.name)?.colliders ?? []);
    const steps = outcropsPlace({ ground: heightAt, flutter: { streamer: noop, flag: noop, strip: noop }, smoke: { emitter: noop } });
    let step = steps.next(); while (!step.done) step = steps.next();
    const outcrops = step.value, crags = bakeCragRock((await import('@wildshard/engine/core/tier')).TIER_CONFIG.maxTexture <= 1024, heightAt);
    const avoid = [...poiColliders, ...outcrops.colliders, ...crags.colliders];
    for (const part of crags.meshes) part.geometry.dispose();
    const clutter = campClutterSpots(avoid);
    const writer = byteWriter(process.argv.includes('--check'), 'nalati-dressing-plan');
    for (const [key, rows] of Object.entries({ ...plan, clutter })) {
      writer.put(resolve(root, `src/shards/nalati-grasslands/data/dressing-${key}.generated.json`), jsonBytes(rows, 0));
    }
    writer.finish();
    console.log(JSON.stringify({ trees: trees.length, avoid: avoid.length, rows: Object.fromEntries(Object.entries({ ...plan, clutter }).map(([key, rows]) => [key, rows.length])),
      sha256: outputHash(jsonBytes({ plan, clutter }, 0)), canonical: outputHash(new TextEncoder().encode(encodeCanonicalJson({ plan, clutter }))) }));
  } finally {
    const { pageScope } = await import('@wildshard/engine/app/resources');
    pageScope.dispose(); environment.dispose();
  }

}

const recipe = process.argv[2];
if (recipe !== 'src/shards/nalati-grasslands/generators/dressingPlan.ts') throw new Error('Requires the retained Nalati dressing recipe');
const { dressingRecipe } = await import(pathToFileURL(resolve(import.meta.dirname, '../..', recipe)).href);
await bakeNalatiDressing(dressingRecipe);
