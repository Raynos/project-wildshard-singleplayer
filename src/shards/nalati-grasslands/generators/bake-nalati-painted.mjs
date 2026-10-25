// Retained transitional painted places/specimens runner; the nine dressing recipes are independent.
import { withPortableMath } from '@wildshard/commons/bake/portableMath';
import { bakeNalatiPlacesOnTerrain } from './places.ts';
import { readNalatiTerrain, writeNalatiParts } from './bake-nalati-places.mjs';

import { prepareNativeTerrain } from '../../../../scripts/bake/nativeWorld.mjs';
import { game } from '@wildshard/game/shard/registry';
import { resolve } from 'node:path';
import { prepareNalatiDressing } from '../../../../scripts/bake/nalatiDressing.mjs';
import { inSpruceClearing, loneSpruceMask, edgeBermAt } from './terrainRecipe.ts';
import { edgeSpruceMask } from './edgeRecipe.ts';

/** Fresh retained native construction; publication remains the CLI's separate responsibility. */
export async function nativeNalatiPlaces() {
  // The shipped static geometry predates the bilinear runtime geography masks.
  // Reconstruct its original forest decisions, without changing the runtime scatter
  // plan or using rounded baked fields to decide which stump exists.
  const dressing = await prepareNalatiDressing((x, z) => inSpruceClearing(x, z) ? 0
    : Math.max(loneSpruceMask(x, z), edgeSpruceMask(x, z, edgeBermAt(x, z))));
  const terrain = readNalatiTerrain();
  await prepareNativeTerrain(game.shard, { root: resolve(import.meta.dirname, '../../../..'), bytes: new Uint8Array(terrain) });

  return bakeNalatiPlacesOnTerrain(terrain, withPortableMath, dressing);
}

if (import.meta.main) {
  const made = await nativeNalatiPlaces();
  writeNalatiParts([{ name: 'places', json: 'places.json', part: made.places },
    { name: 'specimens', json: 'placeSpecimens.json', part: made.specimens }], process.argv.includes('--check'));
}
