/**
 * G170 (SHARD-PLATFORM SF46, Jake's C3-R2-C1 pick: "road decks over the water"): where Driftwood's four road decks stand.
 * Each is the platform's 8 × 15 m socket (its floor is the platform's collider, `installEntrySockets`; in the grid the road
 * look draws its asphalt on top) carried on, `LANDING_RUN` further in, over the shardfile's declared landing (sea.ts
 * ENTRY_LANDINGS, the socket-landing proof); the pier or jetty ramps up from there. The model is ../models/entryDeck.ts.
 * The ocean is clipped out under each whole deck (`deckRects`) so no crest pokes through the asphalt.
 */
import { CHUNK_HALF, ENTRY_ASPHALT, ENTRY_WIDTH } from '@wildshard/engine/core/config';
import type { Placement } from '@wildshard/engine/models/model';
import type { BoxSpec } from '@wildshard/engine/physics/box';
import { DECK_SLAB, type EntryDeckParams } from '../models/entryDeck';
import { LANDING_RUN, type DryEntryEdge, type DryRect } from './sea';

/** how far in from the cell edge each deck runs: the 15 m socket plus the declared landing */
export const DECK_RUN = ENTRY_ASPHALT + LANDING_RUN;

/** an entry's frame: its edge midpoint, the inward unit axis and the model's yaw (its +Z turned to run in) */
function frame(edge: DryEntryEdge): { mx: number; mz: number; ix: number; iz: number; yaw: number } {
  switch (edge) {
    case 'north': return { mx: 0, mz: CHUNK_HALF, ix: 0, iz: -1, yaw: Math.PI };
    case 'south': return { mx: 0, mz: -CHUNK_HALF, ix: 0, iz: 1, yaw: 0 };
    case 'east': return { mx: CHUNK_HALF, mz: 0, ix: -1, iz: 0, yaw: -Math.PI / 2 };
    case 'west': return { mx: -CHUNK_HALF, mz: 0, ix: 1, iz: 0, yaw: Math.PI / 2 };
    default: throw new Error('Invalid entry edge');
  }
}

/** a point `a` in from the edge and `c` across (x for north / south, z for east / west) in level space */
function at(edge: DryEntryEdge, a: number, c: number): { x: number; z: number } {
  const f = frame(edge);
  return f.ix === 0 ? { x: c, z: f.mz + f.iz * a } : { x: f.mx + f.ix * a, z: c };
}

/** each deck's footprint (the socket and its landing, the full 8 m across): the ocean's dry rectangles under the decks */
export function deckRects(edges: readonly DryEntryEdge[]): DryRect[] {
  return edges.map((edge) => {
    const p = at(edge, 0, -ENTRY_WIDTH / 2), q = at(edge, DECK_RUN, ENTRY_WIDTH / 2);
    return { minX: Math.min(p.x, q.x), minZ: Math.min(p.z, q.z), maxX: Math.max(p.x, q.x), maxZ: Math.max(p.z, q.z) };
  });
}

/** each deck's slab as a legacy box (the ocean's foam collars where it meets the swell) */
export function deckSlabs(edges: readonly DryEntryEdge[]): BoxSpec[] {
  return deckRects(edges).map((r) => ({ x: (r.minX + r.maxX) / 2, z: (r.minZ + r.maxZ) / 2, hw: (r.maxX - r.minX) / 2, hd: (r.maxZ - r.minZ) / 2, rot: 0, yTop: 0, yBottom: -DECK_SLAB }));
}

/** whether (x, z) is on a deck (its floor for placement and footsteps: road height) */
export function onDeck(rects: readonly DryRect[], x: number, z: number): boolean {
  return rects.some((r) => x >= r.minX && x <= r.maxX && z >= r.minZ && z <= r.maxZ);
}

/** the four decks' placements: each at its edge midpoint, top at road height, its columns down to the deepest seabed
 *  under them (`ground`, level space; never deeper than 14 m) */
export function deckPlacements(edges: readonly DryEntryEdge[], ground: (x: number, z: number) => number): Placement<EntryDeckParams>[] {
  return edges.map((edge) => {
    const f = frame(edge);
    let bed = 0;
    for (const a of [1.4, DECK_RUN / 2, DECK_RUN - 1.4]) for (const c of [-2.7, 2.7]) { const p = at(edge, a, c); bed = Math.min(bed, ground(p.x, p.z)); }
    return { x: f.mx, y: 0, z: f.mz, yaw: f.yaw, params: { run: DECK_RUN, bed: Math.max(-14, bed - 0.4) } };
  });
}
