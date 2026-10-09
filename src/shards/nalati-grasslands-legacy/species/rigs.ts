import { TIER } from '@wildshard/engine/core/tier';
import { NALATI_COAT_DIR } from './coatDir';
/**
 * The Nalati creatures' rigged hulls (scripts/nalati-rig-bake.mjs RIG_BAKES): their names and the one URL each tier
 * loads. Split from glbCreatures.ts (which pulls in three's GLTFLoader) so the boot manifest can declare the files —
 * src/engine/boot/manifest.ts runs in Node too (scripts/bake-packs.mjs).
 */


export type CreatureRigName = 'horse-wild' | 'horse-saddled' | 'wolf' | 'snow-leopard' | 'sheep' | 'eagle' | 'collie' | 'ghost-horse' | 'golden-king';
export const CREATURE_RIGS: readonly CreatureRigName[] = ['horse-wild', 'horse-saddled', 'wolf', 'snow-leopard', 'sheep', 'eagle', 'collie', 'ghost-horse', 'golden-king'];

/** the file `loadCreatureRig(name)` fetches on this tier: `<hull>[.phone].rigged.glb` */
export function creatureRigUrl(name: CreatureRigName): string {
  return `/assets/nalati/models/${name}${TIER === 'phone' ? '.phone' : ''}.rigged.glb`;
}

/**
 * The baked coat of hull `name` worn by (kind, variant): `coatAtlas`'s own canvas, painted offline per tier and stored
 * lossless (`<hull>.<kind>.<variant>.coat.webp`, the phone's `.coat.phone.webp` beside it, which `tierUrl` picks), with a
 * KTX2 stand-in in Nalati's KTX2 table. In glTF orientation (unflipped), as the hull's own atlas.
 */
export function nalatiCoatUrl(name: CreatureRigName, kind: string, variant: string): string {
  return `${NALATI_COAT_DIR}${name}.${kind}.${variant}.coat.webp`;
}
