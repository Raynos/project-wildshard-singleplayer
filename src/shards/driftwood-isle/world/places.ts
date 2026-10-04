/**
 * Driftwood Isle's named places as Sets (E306 / E315 M12, Jake: every named place is a Set; shown by the sets explorer
 * M7 between single models and the whole world). The places are the adventure's discovery list (`DRIFTWOOD_PLACES`,
 * src/shards/driftwood-isle/quest/Places.ts): each one's set lists the models placed there — every copy standing within the place's
 * radius of its middle (resolved through the adventure's POI frames), a member per model. A set owns no geometry; a
 * place's welded ground (the terrain, the Blender cove's tiles) stays world.
 *
 * The Wreck cove is the wreck site as it was built (the shipwreck, its cargo, drift logs and reef rocks, the cove's reef
 * rocks), not a radius. The pier's is the Pier landing: the pier, the boat moored at it and what stands within its
 * radius. `pending` names what a place has that is
 * not on the model contract yet (another lane holds its file). The north and west landings leave the list (E318).
 *
 *   placeDriftwoodPlaces(adventure.place, [hut.placed, lookout.placed, …], { wreck: [...wreck.placed, ...cove.placed] });   // main.ts, after the adventure
 */
import * as THREE from 'three';
import type { Placed } from '@wildshard/engine/models/place';
import { placeSet } from '@wildshard/engine/models/sets';
import type { Place } from '@wildshard/engine/world/interact/types';
import { DRIFTWOOD_PLACES } from '../quest/Places';

const FILE = 'src/shards/driftwood-isle/world/places.ts';

interface PlaceSet {
  /** the set's id */
  readonly id: string;
  readonly name: string;
  /** the named place it is: `driftwood-isle/<DRIFTWOOD_PLACES id>` */
  readonly place: string;
  /** members by what was built there (`explicit[key]`), not by radius */
  readonly explicit?: string;
  readonly pending?: readonly string[];
}

/** the places' sets */
const SETS: readonly PlaceSet[] = [
  { id: 'driftwood-isle/pier-landing', name: 'Pier landing', place: 'driftwood-isle/pier' },
  { id: 'driftwood-isle/wendells-hut', name: "Wendell's hut", place: 'driftwood-isle/hut' },
  { id: 'driftwood-isle/vista-point', name: 'Vista point', place: 'driftwood-isle/vista' },
  { id: 'driftwood-isle/rope-bridge-gully', name: 'The rope bridge', place: 'driftwood-isle/bridge' },
  { id: 'driftwood-isle/zipline-launch', name: 'The zipline', place: 'driftwood-isle/zipline' },
  { id: 'driftwood-isle/lookout-summit', name: 'The lookout', place: 'driftwood-isle/lookout' },
  { id: 'driftwood-isle/wreck-cove', name: 'Wreck cove', place: 'driftwood-isle/wreck', explicit: 'wreck' },
  { id: 'driftwood-isle/sea-cave', name: 'The sea cave', place: 'driftwood-isle/cave' },
  { id: 'driftwood-isle/ring-shrine', name: 'The ring shrine', place: 'driftwood-isle/shrine' },
];

const _b = new THREE.Box3();

/** the copies of `p` whose world box reaches within r of (x, z), as a set's member (null: none there) */
export function within(p: Placed, x: number, z: number, r: number): Placed | null {
  const idx: number[] = [];
  for (let i = 0; i < p.copies; i++) {
    p.copyBox(i, _b);
    const dx = Math.max(_b.min.x - x, 0, x - _b.max.x), dz = Math.max(_b.min.z - z, 0, z - _b.max.z);
    if (dx * dx + dz * dz <= r * r) idx.push(i);
  }
  if (idx.length === 0) return null;
  if (idx.length === p.copies) return p;
  const box = (i: number, target: THREE.Box3): THREE.Box3 => p.copyBox(idx[i] ?? 0, target);
  return { ...p, colliders: [], copies: idx.length, copyBox: box,
    nearest: (pt) => { let bi = -1, bd = Infinity; idx.forEach((_, i) => { const d = box(i, _b).distanceToPoint(pt); if (d < bd) { bd = d; bi = i; } }); return bi; } };
}

/**
 * Register the named places' sets from what the shard placed (`placed`: every placement the world made, null where a
 * builder did not run) and the sets built from a site (`explicit`).
 */
export function placeDriftwoodPlaces(resolve: (p: Place) => { x: number; z: number }, placed: readonly (Placed | null | undefined)[], explicit: Readonly<Record<string, readonly Placed[]>>): void {
  const all = placed.filter((p): p is Placed => p !== null && p !== undefined && p.copies > 0);
  for (const s of SETS) {
    const def = DRIFTWOOD_PLACES.find((d) => `driftwood-isle/${d.id}` === s.place);
    if (def === undefined) throw new Error(`places: no named place ${s.place}`);
    let members: Placed[];
    if (s.explicit !== undefined) members = [...(explicit[s.explicit] ?? [])];
    else {
      const at = resolve(def.at);
      members = all.map((p) => within(p, at.x, at.z, def.r)).filter((m): m is Placed => m !== null);
    }
    placeSet({ id: s.id, name: s.name, file: FILE, place: s.place, members, ...(s.pending === undefined ? {} : { pending: s.pending }) });
  }
}
