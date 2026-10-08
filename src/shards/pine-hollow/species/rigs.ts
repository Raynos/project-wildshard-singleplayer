/**
 * Pine Hollow's rigged creature hulls (PINE-HOLLOW-REMASTER PH-M1; baked by `scripts/creature-rig-bake.mjs --chunk
 * pine-hollow`): their names and the one URL each tier loads. Split from pineCreatures.ts (which pulls in three's
 * GLTFLoader) so the boot manifest can declare the files — src/engine/boot/manifest.ts runs in Node too (scripts/bake-packs.mjs).
 * Nalati's own table is src/shards/nalati-grasslands/species/rigs.ts (on its branch); the two never share a hull.
 */
import { TIER } from '@wildshard/engine/core/tier';

export type PineRigName = 'deer-hind' | 'deer-stag' | 'boar' | 'elk-cow' | 'elk-bull' | 'bear-black' | 'bear-brown' | 'antler-king-rig';
/** every rig; 'antler-king-rig' is the Antler King on his own upright rig (E322 F-M1, Jake picked B: src/shards/pine-hollow/combat/kingRig.ts,
 *  baked by scripts/king-rig-bake.mjs), drawn ×2.6 by the fight */
export const PINE_CREATURE_RIGS: readonly PineRigName[] = ['deer-hind', 'deer-stag', 'boar', 'elk-cow', 'elk-bull', 'bear-black', 'bear-brown', 'antler-king-rig'];

/** the file `loadPineRig(name)` fetches on this tier: `<hull>[.phone].rigged.glb` */
export function pineCreatureRigUrl(name: PineRigName, tier: 'phone' | 'desktop' = TIER): string {
  return `/assets/pine-hollow/creatures/${name}${tier === 'phone' ? '.phone' : ''}.rigged.glb`;
}

/** G187 cut 2: the name a coat's baked KTX2 is keyed by in Pine's KTX2 table (scripts/bake-pine-coats.mjs), beside its rig:
 *  `<hull>[.phone].<kind>.<variant>.coat.png` — a name, not a file: only its `/assets/gpu/` stand-in exists, and only the
 *  KTX2 path asks for it (boot/files.ts lists the `.coat.png` entries) */
export function pineCoatUrl(name: PineRigName, kind: string, variant: string, tier: 'phone' | 'desktop' = TIER): string {
  return `procedural:${pineCreatureRigUrl(name, tier).replace(/\.rigged\.glb$/u, `.${kind}.${variant}.coat.png`)}`;
}
