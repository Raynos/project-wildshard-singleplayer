/**
 * The Nalati creatures' rigged hulls (scripts/nalati-rig-bake.mjs RIG_BAKES): their names and the one URL each tier
 * loads. Split from glbCreatures.ts (which pulls in three's GLTFLoader) so the boot manifest can declare the files —
 * src/boot/manifest.ts runs in Node too (scripts/bake-packs.mjs).
 */
import { TIER } from '../core/tier';

export type CreatureRigName = 'horse-wild' | 'horse-saddled' | 'wolf' | 'snow-leopard' | 'sheep' | 'eagle' | 'collie' | 'ghost-horse' | 'golden-king';
export const CREATURE_RIGS: readonly CreatureRigName[] = ['horse-wild', 'horse-saddled', 'wolf', 'snow-leopard', 'sheep', 'eagle', 'collie', 'ghost-horse', 'golden-king'];

/** the file `loadCreatureRig(name)` fetches on this tier: `<hull>[.phone].rigged.glb` */
export function creatureRigUrl(name: CreatureRigName): string {
  return `/assets/nalati/models/${name}${TIER === 'phone' ? '.phone' : ''}.rigged.glb`;
}
