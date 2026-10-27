// Retain the shipping placement recipe offline over the real native ground and spruce roster.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { installBakeEnvironment } from './environment.mjs';
import { prepareNativeTerrain } from './nativeWorld.mjs';

/** Build fresh placement data; an original continuous forest law may be supplied by a native geometry author. */
export async function prepareNalatiDressing(forestMask, scalarBlocks) {
  const root = resolve(import.meta.dirname, '../..');
  const environment = installBakeEnvironment(root);


  try {
    const { MANIFEST: NALATI_GRASSLANDS } = await import('../../src/shards/nalati-grasslands/discovery.generated.ts');
    if (forestMask !== undefined && NALATI_GRASSLANDS.forest === undefined) throw new Error('Missing Nalati forest definition');
    const definition = forestMask === undefined ? NALATI_GRASSLANDS : { ...NALATI_GRASSLANDS, forest: { ...NALATI_GRASSLANDS.forest, mask: forestMask } };
    if (scalarBlocks !== undefined) {
      if (definition.scalarBlocks === undefined) throw new Error('Missing predecessor scalar intake');
      definition.scalarBlocks.prepare(scalarBlocks);
    }
    await prepareNativeTerrain(definition, { root, bytes: readFileSync(resolve(root, 'public/assets/baked/nalati-grasslands/terrain.bin')) });
    const { default: NALATI_GRASS_LAYOUT } = await import('../../src/shards/nalati-grasslands/data/grassFieldLayout.json', { with: { type: 'json' } });
    const { RIVER } = await import('../../src/shards/nalati-grasslands/generators/terrainRecipe.ts');
    const [{ bakeForestPlacements }, { SPRUCE_SPECS }, { bakeNalatiDressingSource }] = await Promise.all([
      import('@wildshard/sdk/bake/forest'), import('../../src/shards/nalati-grasslands/generators/spruceGeometry.ts'),
      import('../../src/shards/nalati-grasslands/generators/dressingSource.ts'),
    ]);
    const [heightfield, { bakeMeadowField }, { terrainHeight: heightAt }] = await Promise.all([
      import('@wildshard/engine/world/Heightfield'), import('@wildshard/sdk/bake/meadow'),
      import('@wildshard/engine/world/terrainHeight'),
    ]);
    const meadow = bakeMeadowField({ seed: definition.seed, half: 250, heightAt,
      normalAt: heightfield.normalAt, splatAt: heightfield.splatAt, trailDistance: heightfield.trailDistance,
      cabinMask: heightfield.cabinMask, pondMask: heightfield.pondMask, waterLevel: heightfield.waterLevel,
      paint: (x, z, y, slope, out) => {
        const paint = definition.groundColor, ground = definition.ground.terrain;
        if (!paint || !ground) return false;
        paint(x, z, y, slope, ground, out); return true;
      }, layout: { ...NALATI_GRASS_LAYOUT, riverZ: RIVER.z, riverHalf: RIVER.half } });
    const forest = bakeForestPlacements({ seed: definition.seed, treeCount: definition.treeCount,
      forest: definition.forest, heightAt: heightfield.heightAt, normalAt: heightfield.normalAt,
      trailDistance: heightfield.trailDistance, cabinMask: heightfield.cabinMask, pondMask: heightfield.pondMask },
    SPRUCE_SPECS.map(row => ({ trunkRadius: row.trunk, height: row.height })));
    const made = await bakeNalatiDressingSource({ heightAt, normalAt: heightfield.normalAt,
      trailDistance: heightfield.trailDistance, inChunk: heightfield.inChunk, trails: heightfield.TRAILS, meadow, forest,
      phone: (await import('@wildshard/engine/core/tier')).TIER_CONFIG.maxTexture <= 1024 });
    return made;
  } finally {
    const { pageScope } = await import('@wildshard/engine/app/resources');
    pageScope.dispose(); environment.dispose();
  }

}

if (import.meta.main) throw new Error('Nalati dressing publication is retired; call the source-owned placement producer');
