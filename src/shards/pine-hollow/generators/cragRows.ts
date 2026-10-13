/** Pine's author-only crag facts; the live native reader keeps ownership until its Scene consumer replaces it. */
import { BEAR_CAVE } from '../data/layout';

/** Original view profiles; they do not choose a renderer or install a world. */
export type CragTier = 'phone' | 'desktop';
/** Original module identities from the retained kit GLBs. */
export const CRAG_IDS = ['cliff-a', 'cliff-b', 'cliff-c', 'buttress', 'slab', 'tor-a', 'tor-b', 'boulder-a', 'boulder-b', 'boulder-c', 'scree-a', 'scree-b'] as const;
/** Original lookout skyline module. */
export const CRAG_HERO = 'hero';
/** One authored module identity. */
export type CragId = (typeof CRAG_IDS)[number] | typeof CRAG_HERO;
/** Original module footprint before scaling. */
export interface CragSize { hw: number; hd: number; h: number }
/** Kit footprints, with the optional hero module. */
export type CragSizes = Record<(typeof CRAG_IDS)[number], CragSize> & Partial<Record<typeof CRAG_HERO, CragSize>>;
/** Exact original placement record. */
export interface CragPlace { id: CragId; x: number; y: number; z: number; yaw: number; scale: number; tiltX: number; tiltZ: number }
/** Retained skin sampling tile size. */
export const SKIN_TILE = 64;
/** Original near and far lattice steps, in metres. */
export const SKIN_STEPS: Record<CragTier, readonly [number, number]> = { phone: [1.0, 2.6], desktop: [0.7, 2.0] };
/** Original cave-local coordinates; no physics service or model is loaded. */
export function caveLocal(x: number, z: number): [number, number] {
  const c = Math.cos(BEAR_CAVE.rot), s = Math.sin(BEAR_CAVE.rot), dx = x - BEAR_CAVE.x, dz = z - BEAR_CAVE.z;
  return [dx * c - dz * s, dx * s + dz * c];
}
/** Original packed skin block sizes, including index alignment. */
export function skinBytes(vertices: number, indices: number): number {
  const pad4 = (bytes: number): number => Math.ceil(bytes / 4) * 4;
  return pad4(vertices * 12) + pad4(vertices * 4) + pad4(indices * 2);
}
/** Native skin record, kept as a byte oracle during the Scene migration. */
export interface CragRows { places: CragPlace[]; skin: Record<CragTier, { bin: string; bytes: number; tiles: [number, number, number, number][] }> }
