import { CHUNK_HALF, ENTRY_ASPHALT, ENTRY_WIDTH } from '@wildshard/format/contentBounds';
import { driftwoodGroundSampler } from './groundSampling';
import { DECK_SLAB, DRY_ENTRIES, LANDING_RUN, type DryEntryEdge } from '../data/entryRows';


/** Authored dry ocean footprint in native level coordinates. */
export interface DeckRect { minX: number; minZ: number; maxX: number; maxZ: number }
/** Original legacy ocean foam slab, without any renderer owner. */
export interface DeckSlab { x: number; z: number; hw: number; hd: number; rot: number; yTop: number; yBottom: number }
/** Parameters and transform supplied unchanged to the retained geometry factory. */
export interface DeckPlacement { x: number; y: number; z: number; yaw: number; params: { run: number; bed: number } }
/** Transport containing only numbers and original cardinal keys. */
export interface EntryDeckRows { notice: string; rows: { edge: DryEntryEdge; rect: DeckRect; slab: DeckSlab; placement: DeckPlacement }[] }

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
export function deckRects(edges: readonly DryEntryEdge[]): DeckRect[] {
  return edges.map((edge) => {
    const p = at(edge, 0, -ENTRY_WIDTH / 2), q = at(edge, DECK_RUN, ENTRY_WIDTH / 2);
    return { minX: Math.min(p.x, q.x), minZ: Math.min(p.z, q.z), maxX: Math.max(p.x, q.x), maxZ: Math.max(p.z, q.z) };
  });
}

/** each deck's slab as a legacy box (the ocean's foam collars where it meets the swell) */
export function deckSlabs(edges: readonly DryEntryEdge[]): DeckSlab[] {
  return deckRects(edges).map((r) => ({ x: (r.minX + r.maxX) / 2, z: (r.minZ + r.maxZ) / 2, hw: (r.maxX - r.minX) / 2, hd: (r.maxZ - r.minZ) / 2, rot: 0, yTop: 0, yBottom: -DECK_SLAB }));
}

/** the four decks' placements: each at its edge midpoint, top at road height, its columns down to the deepest seabed
 *  under them (`ground`, level space; never deeper than 14 m) */
export function deckPlacements(edges: readonly DryEntryEdge[], ground: (x: number, z: number) => number): DeckPlacement[] {
  return edges.map((edge) => {
    const f = frame(edge);
    let bed = 0;
    for (const a of [1.4, DECK_RUN / 2, DECK_RUN - 1.4]) for (const c of [-2.7, 2.7]) { const p = at(edge, a, c); bed = Math.min(bed, ground(p.x, p.z)); }
    return { x: f.mx, y: 0, z: f.mz, yaw: f.yaw, params: { run: DECK_RUN, bed: Math.max(-14, bed - 0.4) } };
  });
}

/** Build the complete road-deck placement component from cold authored ground. */
export function driftwoodEntryDeckRows(): EntryDeckRows {
  const rects = deckRects(DRY_ENTRIES), slabs = deckSlabs(DRY_ENTRIES);
  const placements = deckPlacements(DRY_ENTRIES, driftwoodGroundSampler());
  return { notice: 'DO NOT EDIT: generated from original entry frames and cold authored native ground.',
    rows: DRY_ENTRIES.map((edge, index) => {
      const rect = rects[index], slab = slabs[index], placement = placements[index];
      if (rect === undefined || slab === undefined || placement === undefined) throw new Error('Missing authored entry deck');
      return { edge, rect, slab, placement };
    }) };
}
