/**
 * Pine Hollow's rigged creature hulls (PINE-HOLLOW-REMASTER PH-M1; baked by `scripts/creature-rig-bake.mjs --chunk
 * pine-hollow`): the files each tier reads per hull. Since SHARD-PLATFORM W2a they are the built product's named blobs
 * (`generators/rigBlobs.mjs`): an image-free rig `models/creatures/<hull>[.phone].rigged.glb` beside its separate KTX2
 * maps `<hull>[.phone].base.ktx2` / `.normal.ktx2`; and the birds' posed rest geometry and atlas KTX2 (`pineBirdFiles`).
 * Nalati's own table is src/shards/nalati-grasslands/species/rigs.ts (on its branch); the two never share a hull.
 */
import { TIER } from '@wildshard/engine/core/tier';
import type { RiggedHullFiles } from '@wildshard/sdk/looks/riggedHulls';

/** a hull's blob prefix on this tier: `models/creatures/<hull>[.phone]` */
const blobPrefix = (name: string, tier: 'phone' | 'desktop'): string => `models/creatures/${name}${tier === 'phone' ? '.phone' : ''}`;

/** every hull's rig and separate maps on this tier, as the product's content-addressed URLs (`RiggedHullUrls.files`) */
export function pineRigFiles(product: { readonly url: (name: string) => string }, hulls: readonly string[], tier: 'phone' | 'desktop' = TIER): Readonly<Record<string, RiggedHullFiles>> {
  return Object.fromEntries(hulls.map((hull) => {
    const prefix = blobPrefix(hull, tier);
    return [hull, { rig: product.url(`${prefix}.rigged.glb`), base: product.url(`${prefix}.base.ktx2`), normal: product.url(`${prefix}.normal.ktx2`) }];
  }));
}

/** G187 cut 2: the name a coat's baked KTX2 is keyed by in Pine's KTX2 table (scripts/bake-coats.mjs), beside the rig's
 *  original public path: `procedural:/assets/pine-hollow/creatures/<hull>[.phone].<kind>.<variant>.coat.png` — a name,
 *  not a file: only its `/assets/gpu/` stand-in exists, and only the KTX2 path asks for it (boot/files.ts lists the
 *  `.coat.png` entries). It stays on the original path when the rig itself is read from the product: it is the coat
 *  cache's identity. */
export function pineCoatUrl(name: string, kind: string, variant: string, tier: 'phone' | 'desktop' = TIER): string {
  return `procedural:/assets/pine-hollow/creatures/${name}${tier === 'phone' ? '.phone' : ''}.${kind}.${variant}.coat.png`;
}
