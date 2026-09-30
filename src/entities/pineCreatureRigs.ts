/**
 * Pine Hollow's rigged creature hulls (PINE-HOLLOW-REMASTER PH-M1; baked by `scripts/creature-rig-bake.mjs --chunk
 * pine-hollow`): their names and the one URL each tier loads. Split from pineCreatures.ts (which pulls in three's
 * GLTFLoader) so the boot manifest can declare the files — src/boot/manifest.ts runs in Node too (scripts/bake-packs.mjs).
 * Nalati's own table is src/entities/creatureRigs.ts (on its branch); the two never share a hull.
 */
import { TIER } from '../core/tier';

export type PineRigName = 'deer-hind' | 'deer-stag' | 'boar' | 'elk-cow' | 'elk-bull' | 'bear-black' | 'bear-brown' | 'antler-king' | 'antler-king-rig';
/** every rig; 'antler-king' is the Bark Warden (PH-M3), bound to the elk's bones and drawn ×2.6 (src/pinehollow/kingModel.ts) */
export const PINE_CREATURE_RIGS: readonly PineRigName[] = ['deer-hind', 'deer-stag', 'boar', 'elk-cow', 'elk-bull', 'bear-black', 'bear-brown', 'antler-king'];
/** E322 F-M1: the Antler King on his own upright rig (src/pinehollow/kingRig.ts, baked by
 *  scripts/king-rig-bake.mjs) — Debug ▸ Antler King rig = B only, so it is loaded on that choice and never in the boot pack */
export const KING_OWN_RIG: PineRigName = 'antler-king-rig';

/** the file `loadPineRig(name)` fetches on this tier: `<hull>[.phone].rigged.glb` */
export function pineCreatureRigUrl(name: PineRigName, tier: 'phone' | 'desktop' = TIER): string {
  return `/assets/pine-hollow/creatures/${name}${tier === 'phone' ? '.phone' : ''}.rigged.glb`;
}
