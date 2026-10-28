import { bakeFullIslandCover } from './islandCover';
import type { DriftwoodIslandFacts } from './islandFacts';
import { islandFoliageGround, islandFoliagePlacements } from './islandDressing';
import { hashImmutableBytes } from '@wildshard/sdk/immutable';
import manifest from '../manifest.json' with { type: 'json' };
import ISLAND_COVER_FILES from '../data/islandCoverFiles.json' with { type: 'json' };

let coverBank: Promise<ReadonlyMap<string, Uint8Array>> | undefined;
/** The streamed cover (GR7: the dressing job's cover outputs): each tier's cover transport and per-cell plants by product
 *  name, baked over the Blender island (`readAsset` its committed public files) on the bound native ground as the dressing
 *  bakes it. Each cover must hash to its committed islandCoverFiles.json row, whose URL and metadata the build names it by.
 *  Built once per build process. */
export function islandCoverBank(readAsset: (url: string) => Uint8Array, facts: DriftwoodIslandFacts): Promise<ReadonlyMap<string, Uint8Array>> {
 coverBank ??= bakeIslandCoverBank(readAsset, facts); return coverBank;
}
async function bakeIslandCoverBank(readAsset: (url: string) => Uint8Array, facts: DriftwoodIslandFacts): Promise<ReadonlyMap<string, Uint8Array>> {
 const placed = islandFoliagePlacements(), files = new Map<string, Uint8Array>(), ground = islandFoliageGround();
 for (const tier of ['phone', 'desktop'] as const) {
  const baked = await bakeFullIslandCover(readAsset, tier === 'phone', placed.tiers[tier].palms.specs, ground, manifest.seed, facts);
  if (hashImmutableBytes(baked.bytes) !== ISLAND_COVER_FILES[tier].hash) throw new Error(`Driftwood ${tier} cover differs from its committed islandCoverFiles.json row`);
  files.set(`world/cover/${tier}.bin`, baked.bytes); files.set(`world/cover/cells/${tier}.bin`, baked.cells);
 }
 return files;
}
