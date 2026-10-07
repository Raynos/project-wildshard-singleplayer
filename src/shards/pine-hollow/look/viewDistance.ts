import type { ShardManifest } from '@wildshard/game/shard/manifest';
import { pineMemoryTrim } from '../debug/options';

/**
 * G187 (Jake, 2026-10-07, `art/pine-hollow/round-36-content-cut/` board-view-distance B): on the phone, with the Pine
 * memory trim on (the grid's default), every reach the content-cut board scaled is 75 % of the phone row's: the trees' hi /
 * lo / twig bands, the cabins' detail meshes, the animals' draw, eye and shadow bands, the sun's shadow reach and the
 * pickup orbs. −6.5 MB of GL on the board (the cabin detail meshes that never build); the fog already hides the reach it cuts.
 * The numbers are 0.75 × the phone tier's own (Pine's row where it sets one, else the engine's phone row, render/tiers.ts).
 * Trim off keeps today's reach (the Debug variant).
 */
type TierOverrides = NonNullable<ShardManifest['tiers']>;
type TierKnobs = NonNullable<TierOverrides['phone']>;
const VIEW_B: TierKnobs = {
  treeHiDist: 45, treeLoDist: 97.5, treeTwigDist: 18, cabinDetailDist: 52.5,
  animalHideDist: 112.5, animalShadowDist: 45, animalEyeDist: 33.75, animalOneDrawDist: 75,
  shadowFar: 45, pickupOrbDist: 90,
};

/** Pine's tier rows with view distance B laid over the phone's while the trim is on (read when the level applies its row) */
export function pineTiers(rows: { phone: TierKnobs; desktop: TierKnobs }): TierOverrides {
  return {
    get phone(): TierKnobs { return pineMemoryTrim() ? { ...rows.phone, ...VIEW_B } : rows.phone; },
    desktop: rows.desktop,
  };
}
