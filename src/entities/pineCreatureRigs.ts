/**
 * Pine Hollow's rigged creature hulls (PINE-HOLLOW-REMASTER PH-M1; baked by `scripts/creature-rig-bake.mjs --chunk
 * pine-hollow`): their names and the one URL each tier loads. Split from pineCreatures.ts (which pulls in three's
 * GLTFLoader) so the boot manifest can declare the files — src/boot/manifest.ts runs in Node too (scripts/bake-packs.mjs).
 * Nalati's own table is src/entities/creatureRigs.ts (on its branch); the two never share a hull.
 */
import { TIER } from '../core/tier';

export type PineRigName = 'deer-hind' | 'deer-stag' | 'boar' | 'elk-cow' | 'elk-bull' | 'bear-black' | 'bear-brown' | 'antler-king';
/** every rig; 'antler-king' is the Bark Warden (PH-M3), bound to the elk's bones and drawn ×2.6 (src/pinehollow/kingModel.ts) */
export const PINE_CREATURE_RIGS: readonly PineRigName[] = ['deer-hind', 'deer-stag', 'boar', 'elk-cow', 'elk-bull', 'bear-black', 'bear-brown', 'antler-king'];

/** the file `loadPineRig(name)` fetches on this tier: `<hull>[.phone].rigged.glb` */
export function pineCreatureRigUrl(name: PineRigName, tier: 'phone' | 'desktop' = TIER): string {
  return `/assets/pine-hollow/creatures/${name}${tier === 'phone' ? '.phone' : ''}.rigged.glb`;
}
