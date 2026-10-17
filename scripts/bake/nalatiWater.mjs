// Nalati's river and brook strips (src/shards/nalati-grasslands/generators/waterStrips.ts), baked over the real native ground.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { installBakeEnvironment } from './environment.mjs';
import { prepareNativeTerrain } from './nativeWorld.mjs';
import { pathToFileURL } from 'node:url';
import { byteWriter, jsonBytes } from '../bake-output.mjs';

const recipe = process.argv[2];
if (recipe !== 'src/shards/nalati-grasslands/generators/waterStrips.ts') throw new Error('Requires the retained Nalati water recipe');

const root = resolve(import.meta.dirname, '../..');
const environment = installBakeEnvironment(root);
try {
  const { NALATI_GRASSLANDS } = await import('../../src/shards/nalati-grasslands/manifest.ts');
  await prepareNativeTerrain(NALATI_GRASSLANDS, { root, bytes: readFileSync(resolve(root, 'public/assets/baked/nalati-grasslands/terrain.bin')) });
  const [{ bakeWaterStrips }, { MELT_STREAM }, { RIVER }, { terrainHeight }, { CHUNK_HALF }] = await Promise.all([
    import(pathToFileURL(resolve(root, recipe)).href), import('../../src/shards/nalati-grasslands/layout.ts'),
    import('../../src/shards/nalati-grasslands/world/terrain.ts'), import('@wildshard/engine/world/terrainHeight'), import('@wildshard/engine/core/config'),
  ]);
  const strips = bakeWaterStrips({ heightAt: terrainHeight, river: RIVER, brook: MELT_STREAM, chunkHalf: CHUNK_HALF });
  const writer = byteWriter(process.argv.includes('--check'), 'nalati-water');
  writer.put(resolve(root, 'src/shards/nalati-grasslands/data/water.generated.json'), jsonBytes(strips, 0));
  writer.finish();
  console.log(JSON.stringify({ vertices: strips.position.length / 3, triangles: strips.index.length / 3 }));
} finally {
  const { pageScope } = await import('@wildshard/engine/app/resources');
  pageScope.dispose(); environment.dispose();
}
