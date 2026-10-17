import { TIER } from '@wildshard/engine/core/tier';
import metadata from '../bootMetadata.generated.json' with { type: 'json' };
/**
 * The Nalati creatures' rigged hulls (scripts/nalati-rig-bake.mjs RIG_BAKES): their names and the one URL each tier
 * loads. Split from glbCreatures.ts (which pulls in three's GLTFLoader) so the boot manifest can declare the files —
 * src/engine/boot/manifest.ts runs in Node too (scripts/bake-packs.mjs).
 */


export type CreatureRigName = 'horse-wild' | 'horse-saddled' | 'wolf' | 'snow-leopard' | 'sheep' | 'eagle' | 'collie' | 'ghost-horse' | 'golden-king';
export const CREATURE_RIGS: readonly CreatureRigName[] = ['horse-wild', 'horse-saddled', 'wolf', 'snow-leopard', 'sheep', 'eagle', 'collie', 'ghost-horse', 'golden-king'];

/** which rigged hull each `kind:variant` wears; every coat wears its hull, recoloured (generators/coats.ts) */
export const CREATURE_HULLS: Readonly<Record<string, CreatureRigName>> = {
  'horse:bay': 'horse-wild', 'horse:chestnut': 'horse-wild', 'horse:dun': 'horse-wild', 'horse:grey': 'horse-wild',
  'horse:black': 'horse-wild', 'horse:foal-bay': 'horse-wild', 'horse:foal-chestnut': 'horse-wild', 'horse:stallion': 'horse-wild',
  'argymaq:stallion': 'horse-wild',
  'horse:camp-bay': 'horse-saddled', 'horse:camp-black': 'horse-saddled', 'horse:tulpar': 'horse-saddled',
  'wolf:grey': 'wolf', 'wolf:tawny': 'wolf', 'wolf:dark': 'wolf', 'wolf:scout': 'wolf', 'wolf:alpha': 'wolf',
  'kokbori:kokbori': 'wolf',
  'leopard:aqbars': 'snow-leopard',
  'eagle:qyran': 'eagle',
  // NALATI-MERGE D1 (N12's leftovers, each made both ways and the better kept: art/nalati-grasslands/round-10-models-merge/):
  // the collie its own hull (on the wolf's it read as a wolf circling the flock), the night riders' spectral war horse
  // (ghostRiders.ts puts its ghost material over it), the Golden King on his humanoid rig (humanoidRigBake.ts)
  'sheepdog:collie': 'collie',
  'ghost-rider:rider': 'ghost-horse', 'ghost-rider:captain': 'ghost-horse',
  'golden-king:king': 'golden-king',
};

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
  return `${metadata.assetFiles.coats}${name}.${kind}.${variant}.coat.webp`;
}
