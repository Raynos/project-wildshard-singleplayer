// The banyan's plan as the page holds it (G285): the layout bake restores it (world/layoutBake.ts) from what the tree's
// builder (../generators/banyan.ts) handed on at build time; the canopy's geometry over it is baked too
// (../generators/specimens.ts), so the page reads the plan only for the bake's records.
import type { Vector3 } from 'three';

/** one lump of foliage (the organic lab's `Lump` shape): centre, radii, how high it sits on its shelf, a seed, a wash */
export interface CanopyLump { c: Vector3; r: Vector3; up: number; seed: number; wash: number }
/** what the tree hands on: the canopy's lumps (crown fill first, then the shelves), and where lanterns hang in it */
export interface BanyanPlan { lumps: CanopyLump[]; hangs: Vector3[] }

/** the tree's plan: the canopy's lumps, dressed by the baked crown (world/canopy.ts `buildCanopy`) */
export const banyanOut: { plan: BanyanPlan | null } = { plan: null };
