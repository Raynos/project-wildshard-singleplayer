/**
 * Pine Hollow's named places as Sets (E315 M12, Jake: every named place is a Set). The discovery list
 * (src/shards/pine-hollow/data/layout.generated.ts `PINE_HOLLOW_POIS`) names eighteen places; the Warden's Hollow quest names one more that
 * is not among them (`PINE_HOLLOW_QUEST_PLACES`). Each place's Set lists the models placed there — every copy whose box
 * centre stands within the place's radius, of every `place` call the shard made (the forest's trees and floor, the
 * scatter, the homestead, the landmarks, the crags, the quest's props). A place's welded ground stays world. The mill
 * hamlet's Set is the homestead's own (./cabins.ts, `place: 'pine-hollow/hamlet'`). Sets draw nothing: the world is
 * exactly as it was.
 *
 *   placePineHollowSets(registry);   // main.ts, once the quest has placed its props
 */
import { placedGroups } from '@wildshard/engine/models/place';
import { registerPlaceSets } from '@wildshard/engine/models/sets';
import type { WorldRegistry } from '@wildshard/engine/world/registry';
import LAYOUT from '../data/layout.generated.json' with { type: 'json' };

/** the quest's named places that are not discovery places (the stag's lead ends on the west road) */
export const PINE_HOLLOW_QUEST_PLACES = [
  { id: 'west-road', label: 'The west road', x: 30, z: -2, r: 16 },
] as const;

/** each named place's Set (the hamlet's is the homestead's): its place id and the discovery / quest place it covers */
const PLACE_SETS = [
  { at: 'gate', place: 'pine-hollow/gate' },
  { at: 'crossroads', place: 'pine-hollow/crossroads' },
  { at: 'cabin-1', place: 'pine-hollow/cabin-1' },
  { at: 'cabin-2', place: 'pine-hollow/cabin-2' },
  { at: 'cabin-3', place: 'pine-hollow/cabin-3' },
  { at: 'zipline', place: 'pine-hollow/zipline' },
  { at: 'lookout', place: 'pine-hollow/lookout' },
  { at: 'pond', place: 'pine-hollow/pond' },
  { at: 'waterfall', place: 'pine-hollow/waterfall' },
  { at: 'islet', place: 'pine-hollow/islet' },
  { at: 'dam', place: 'pine-hollow/dam' },
  { at: 'bridge', place: 'pine-hollow/bridge' },
  { at: 'den', place: 'pine-hollow/den' },
  { at: 'cave', place: 'pine-hollow/cave' },
  { at: 'clearing', place: 'pine-hollow/clearing' },
  { at: 'lodge', place: 'pine-hollow/lodge' },
  { at: 'mill', place: 'pine-hollow/mill' },
  { at: 'west-road', place: 'pine-hollow/west-road' },
] as const;

/** Register a Set for every named place (the hamlet's comes from ./cabins.ts); returns how many. */
export function placePineHollowSets(registry: WorldRegistry): number {
  const where = new Map<string, { name: string; x: number; z: number; r: number }>([
    ...LAYOUT.PINE_HOLLOW_POIS.map((p) => [p.id, { name: p.name, x: p.x, z: p.z, r: p.r }] as const),
    ...PINE_HOLLOW_QUEST_PLACES.map((p) => [p.id, { name: p.label, x: p.x, z: p.z, r: p.r }] as const),
  ]);
  const sets = PLACE_SETS.flatMap((s) => { const p = where.get(s.at); return p === undefined ? [] : [{ ...s, ...p, id: s.place }]; });
  return registerPlaceSets(sets, { file: 'src/shards/pine-hollow/world/places.ts', registry,
    centres: { placed: placedGroups(), point: row => row } });
}
