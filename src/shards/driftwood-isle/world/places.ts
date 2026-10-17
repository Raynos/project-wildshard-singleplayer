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
import type { Placed } from '@wildshard/engine/models/place';
import { registerPlaceSets } from '@wildshard/engine/models/sets';
import type { Place } from '@wildshard/engine/world/interact/types';
import type { AdventureContent } from '@wildshard/format/questStory';

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

/**
 * Register the named places' sets from what the shard placed (`placed`: every placement the world made, null where a
 * builder did not run) and the sets built from a site (`explicit`).
 */
export function placeDriftwoodPlaces(resolve: (p: Place) => { x: number; z: number }, placed: readonly (Placed | null | undefined)[], explicit: Readonly<Record<string, readonly Placed[]>>, places: AdventureContent['places']): void {
  registerPlaceSets(SETS, { file: FILE, members: s => {
    const def = places.find((d) => `driftwood-isle/${d.id}` === s.place);
    if (def === undefined) throw new Error(`places: no named place ${s.place}`);
    if (s.explicit !== undefined) return { whole: explicit[s.explicit] ?? [] };
    return { near: { placed, ...resolve(def.at), r: def.r, mode: 'bounds' } };
  } });
}
