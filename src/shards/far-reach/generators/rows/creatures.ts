/**
 * Sky Reach's baked creature bodies (SHARD-PLATFORM M3, `generators/creatures.ts` → `scripts/bake-sky-rigs.mjs`): the
 * generated sources the generator reads offline and their skin metadata. Runtime asset inventory lives in `boot/files.ts`.
 */
/** The generated sources (C6 / E392: Hunyuan3D-2 GLBs under public/), read only by the bake. */
export const SKY_CREATURE_SOURCES = {
  'storm-roc': '/assets/far-reach/models/roc-hd/roc-hd.glb', 'sky-goat': '/assets/far-reach/models/sky-goat/sky-goat.glb',
  'drift-ray': '/assets/far-reach/models/drift-ray/drift-ray.glb',
} as const;
/** The look numbers each bake carries beside its skin: the species dims and, for the painted Roc, its facet jitter and self-light. */
export interface SkyCreatureExtras {
  dims: { bodyY: number; bodyHalfLen: number; bodyRadius: number; headRadius: number; legLen: number; feet: [number, number][]; halfWidth: number };
  facetJitter?: number; selfLight?: number;
}
