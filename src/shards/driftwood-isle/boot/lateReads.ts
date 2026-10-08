import { filePolicy } from '@wildshard/engine/boot/filePolicy';
import type { TexMode } from '@wildshard/engine/boot/gpuFiles';
import { publicBytes } from '@wildshard/engine/boot/tables';
import type { Tier } from '@wildshard/engine/core/tier';
import { GPU_FILES } from '../ktx2.generated';

/** the painted horizon's day / night strips (src/engine/world/HorizonMatte.ts reads them after boot) */
const HORIZON = ['/assets/horizon/driftwood-isle-day.webp', '/assets/horizon/driftwood-isle-night.webp'];
const ISLAND = '/assets/models/driftwood-blender/';
const CAPTAIN = '/assets/models/driftwood-hero/captain/captain.glb';

/**
 * What the island reads after boot (E357 S4.1, 08 §6.1 step 7), in the order shardPrefetch.ts listed them for an open-water
 * shard: the learned LUT, the horizon strips, the Blender spawn cove's GLB + its data + lightmaps + its baked cover splat
 * (SF67, scripts/bake-island-cover.mjs), and the Drowned Captain.
 */
export function lateReads(tier: Tier, tex: TexMode = 'img'): string[] {
  const { gpu } = filePolicy(tier, tex, GPU_FILES);
  const lm = tier === 'phone' ? '.phone.webp' : '.webp';
  return ['/assets/lut/driftwood-isle.bin', ...HORIZON.map(gpu), gpu(`${ISLAND}island.glb`), `${ISLAND}island.json`, `${ISLAND}placements.bin`,
    gpu(`${ISLAND}lm-ao${lm}`), gpu(`${ISLAND}lm-bounce${lm}`), `/assets/baked/driftwood-isle/island-cover.${tier}.bin`, gpu(CAPTAIN)].filter((url) => url in publicBytes());
}
