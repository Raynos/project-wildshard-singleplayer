// Retain the shipping placement recipe offline over the real native ground and spruce roster.
import { readFileSync } from 'node:fs';
import { encodeCanonicalJson } from '@wildshard/sdk/immutable';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { installBakeEnvironment } from './environment.mjs';
import { prepareNativeTerrain } from './nativeWorld.mjs';
import { byteWriter, jsonBytes, outputHash } from '../bake-output.mjs';
import { dressingPoiColliders } from '../../src/shards/nalati-grasslands/generators/dressingPlan.ts';

/** Build fresh placement data; an original continuous forest law may be supplied by a native geometry author. */
export async function prepareNalatiDressing(dressingRecipe, forestMask) {
  const root = resolve(import.meta.dirname, '../..');
  const environment = installBakeEnvironment(root);


  try {
    const { MANIFEST: NALATI_GRASSLANDS } = await import('../../src/shards/nalati-grasslands/discovery.generated.ts');
    if (forestMask !== undefined && NALATI_GRASSLANDS.forest === undefined) throw new Error('Missing Nalati forest definition');
    const definition = forestMask === undefined ? NALATI_GRASSLANDS : { ...NALATI_GRASSLANDS, forest: { ...NALATI_GRASSLANDS.forest, mask: forestMask } };
    await prepareNativeTerrain(definition, { root, bytes: readFileSync(resolve(root, 'public/assets/baked/nalati-grasslands/terrain.bin')) });
    const { configureGrassField } = await import('@wildshard/game/systems/looks/grassField');
    const { default: NALATI_GRASS_LAYOUT } = await import('../../src/shards/nalati-grasslands/data/grassFieldLayout.json', { with: { type: 'json' } });
    const { pageScope } = await import('@wildshard/engine/app/resources');
    const { RIVER } = await import('../../src/shards/nalati-grasslands/generators/terrainRecipe.ts');
    configureGrassField({ ...NALATI_GRASS_LAYOUT, riverZ: RIVER.z, riverHalf: RIVER.half }, pageScope);
    const [{ bakeForestPlacements }, { SPRUCE_SPECS }, { dressingRockColliders }] = await Promise.all([
      import('@wildshard/sdk/bake/forest'), import('../../src/shards/nalati-grasslands/generators/spruceGeometry.ts'),
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
    const forest = bakeForestPlacements({ seed: definition.seed, treeCount: definition.treeCount,
      forest: definition.forest, heightAt: heightfield.heightAt, normalAt: heightfield.normalAt,
      trailDistance: heightfield.trailDistance, cabinMask: heightfield.cabinMask, pondMask: heightfield.pondMask },
    SPRUCE_SPECS.map(row => ({ trunkRadius: row.trunk, height: row.height })));
    const { trees } = forest;
    const plan = await planDressing(forest);
    const placeRows = JSON.parse(readFileSync(resolve(root, 'src/shards/nalati-grasslands/data/places.json'), 'utf8')).rows;
    const sequence = JSON.parse(readFileSync(resolve(root, 'src/shards/nalati-grasslands/data/worldView.json'), 'utf8')).sequence;
    const poiColliders = dressingPoiColliders(placeRows, sequence, heightAt);
    const avoid = [...poiColliders, ...dressingRockColliders(heightAt,
      (await import('@wildshard/engine/core/tier')).TIER_CONFIG.maxTexture <= 1024,
      { normalAt: heightfield.normalAt, trailDistance: heightfield.trailDistance })];
    const clutter = campClutterSpots(avoid);
    return { plan, clutter, trees: trees.length, avoid: avoid.length };
  } finally {
    const { pageScope } = await import('@wildshard/engine/app/resources');
    pageScope.dispose(); environment.dispose();
  }

}

if (import.meta.main) {
  const recipe = process.argv[2];
  if (recipe !== 'src/shards/nalati-grasslands/generators/dressingPlan.ts') throw new Error('Requires the retained Nalati dressing recipe');
  const { dressingRecipe } = await import(pathToFileURL(resolve(import.meta.dirname, '../..', recipe)).href);
  const { plan, clutter, trees, avoid } = await prepareNalatiDressing(dressingRecipe);
  const root = resolve(import.meta.dirname, '../..');
  const writer = byteWriter(process.argv.includes('--check'), 'nalati-dressing-plan');
  for (const [key, rows] of Object.entries({ ...plan, clutter })) {
    writer.put(resolve(root, `src/shards/nalati-grasslands/data/dressing-${key}.generated.json`), jsonBytes(rows, 0));
  }
  writer.finish();
  console.log(JSON.stringify({ trees, avoid, rows: Object.fromEntries(Object.entries({ ...plan, clutter }).map(([key, rows]) => [key, rows.length])),
    sha256: outputHash(jsonBytes({ plan, clutter }, 0)), canonical: outputHash(new TextEncoder().encode(encodeCanonicalJson({ plan, clutter }))) }));
}
