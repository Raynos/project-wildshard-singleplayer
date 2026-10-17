// Retain the shipping placement recipe offline over the real native ground and spruce roster.
import { readFileSync } from 'node:fs';
import { encodeCanonicalJson } from '@wildshard/sdk/immutable';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import * as THREE from 'three';
import { installBakeEnvironment } from './environment.mjs';
import { prepareNativeTerrain } from './nativeWorld.mjs';
import { byteWriter, jsonBytes, outputHash } from '../bake-output.mjs';

async function bakeNalatiDressing(dressingRecipe) {
  const root = resolve(import.meta.dirname, '../..');
  const environment = installBakeEnvironment(root);
  const noop = () => undefined;
  const sky = new Proxy({ setupMaterial: noop, sunDir: new THREE.Vector3(0, 1, 0),
    hemi: new THREE.HemisphereLight(), csm: { lights: [new THREE.DirectionalLight()], update: noop } },
  { get: (target, key) => key in target ? target[key] : typeof key === 'string' && key.endsWith('Color') ? new THREE.Color(1, 1, 1) : undefined });

  try {
    const { NALATI_GRASSLANDS } = await import('../../src/shards/nalati-grasslands/manifest.ts');
    await prepareNativeTerrain(NALATI_GRASSLANDS, { root, bytes: readFileSync(resolve(root, 'public/assets/baked/nalati-grasslands/terrain.bin')) });
    const { configureGrassField } = await import('@wildshard/game/systems/looks/grassField');
    const { NALATI_GRASS_LAYOUT } = await import('../../src/shards/nalati-grasslands/look/grassFieldLayout.ts');
    const { pageScope } = await import('@wildshard/engine/app/resources');
    configureGrassField(NALATI_GRASS_LAYOUT, pageScope);
    const [{ placeForest }, { SPRUCE_SPECS }, { NalatiPOIs }, { buildOutcrops }, { buildCragRock }] = await Promise.all([
      import('@wildshard/engine/world/forest/placement'), import('../../src/shards/nalati-grasslands/world/Spruce.ts'),
      import('../../src/shards/nalati-grasslands/world/index.ts'), import('../../src/shards/nalati-grasslands/outcrops.ts'), import('../../src/shards/nalati-grasslands/cragRock.ts'),
    ]);
    const [layout, terrain, { inPoiClearing }] = await Promise.all([
      import('../../src/shards/nalati-grasslands/layout.ts'), import('../../src/shards/nalati-grasslands/world/terrain.ts'),
      import('../../src/shards/nalati-grasslands/world/clearings.ts'),
    ]);
    const [noise, heightfield, grass, { terrainHeight: heightAt }] = await Promise.all([
      import('@wildshard/engine/core/noise'), import('@wildshard/engine/world/Heightfield'),
      import('@wildshard/game/systems/looks/grassField'), import('@wildshard/engine/world/terrainHeight'),
    ]);
    const { planDressing, campClutterSpots } = dressingRecipe({ layout, ...terrain, ...noise, ...heightfield, ...grass, heightAt, inPoiClearing });
    const { trees, grid } = placeForest(SPRUCE_SPECS.map(row => ({ trunkRadius: row.trunk, height: row.height })));
    const forest = { trees, nearby: (x, z, r) => grid.nearby(x, z, r) };
    const plan = await planDressing(forest);
    const pois = await new NalatiPOIs(sky).buildSliced(() => Promise.resolve());
    const outcrops = buildOutcrops(sky), crags = buildCragRock(sky);
    const avoid = [...pois.colliders, ...outcrops.colliders, ...crags.colliders];
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
