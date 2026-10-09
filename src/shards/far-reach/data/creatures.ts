/**
 * Sky Reach's baked creature bodies (SHARD-PLATFORM M3, `generators/creatures.ts` → `scripts/bake-sky-rigs.mjs`): the
 * creatures, the generated sources the generator reads offline, and the skinned GLBs the client loads (`species/bodies.ts`).
 */
export const SKY_CREATURES = ['storm-roc', 'sky-goat', 'drift-ray'] as const;
export type SkyCreature = typeof SKY_CREATURES[number];
/** The generated sources (C6 / E392: Hunyuan3D-2 GLBs under public/), read only by the bake. */
export const SKY_CREATURE_SOURCES = {
  'storm-roc': '/assets/far-reach/models/roc-hd/roc-hd.glb', 'sky-goat': '/assets/far-reach/models/sky-goat/sky-goat.glb',
  'drift-ray': '/assets/far-reach/models/drift-ray/drift-ray.glb',
} as const;
/** The baked skinned bodies the client loads (the Roc's painted map, `storm-roc.webp`, beside them). */
export const SKY_CREATURE_RIGS = {
  'storm-roc': '/assets/far-reach/rigs/storm-roc.glb', 'sky-goat': '/assets/far-reach/rigs/sky-goat.glb',
  'drift-ray': '/assets/far-reach/rigs/drift-ray.glb',
} as const;
/** The look numbers each bake carries beside its skin: the species dims and, for the painted Roc, its facet jitter and self-light. */
export interface SkyCreatureExtras {
  dims: { bodyY: number; bodyHalfLen: number; bodyRadius: number; headRadius: number; legLen: number; feet: [number, number][]; halfWidth: number };
  facetJitter?: number; selfLight?: number;
}
