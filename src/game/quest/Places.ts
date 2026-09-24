/**
 * Driftwood's named places and their discovery (A5): walk within a place's radius and it is DISCOVERED — a flag
 * (`seen:<id>`, persisted with the rest of the adventure), a "Discovered · The Lookout" toast, and its name on the full
 * map (src/ui/Map.ts `setPois`). The discovery itself is the shared quest core's (core.ts `placesWithDiscovery`). Undiscovered places show as a dim "?" so the map still hints where to go; the quest's
 * live markers are drawn on top (pulsing diamonds).
 */
import type { Place } from '../../world/interact/types';
import type { Adventure } from './Adventure';
import { placesWithDiscovery, type Places } from './core';

export interface PlaceDef { id: string; label: string; at: Place; r: number }

export const DRIFTWOOD_PLACES: PlaceDef[] = [
  { id: 'pier', label: 'THE PIER', at: { poi: 'world', x: 0, z: -215 }, r: 40 },
  { id: 'hut', label: 'WENDELL\'S HUT', at: { poi: 'hut', x: 0, z: -2 }, r: 26 },
  { id: 'vista', label: 'VISTA POINT', at: { poi: 'world', x: -46, z: -100 }, r: 14 },
  { id: 'bridge', label: 'ROPE BRIDGE', at: { poi: 'world', x: 24, z: 22 }, r: 18 },
  { id: 'zipline', label: 'ZIPLINE', at: { poi: 'lookout', anchor: 'lookout.zipline', x: 20, z: -30 }, r: 12 },
  { id: 'lookout', label: 'THE LOOKOUT', at: { poi: 'lookout', x: 0, z: 0 }, r: 24 },
  { id: 'wreck', label: 'WRECK COVE', at: { poi: 'wreck', x: 0, z: 0 }, r: 30 },
  { id: 'cave', label: 'SEA CAVE', at: { poi: 'cave', x: 0, z: -4 }, r: 16 },
  { id: 'shrine', label: 'RING SHRINE', at: { poi: 'shrine', x: 0, z: 0 }, r: 26 },
  { id: 'north', label: 'NORTH LANDING', at: { poi: 'world', x: 0, z: 196 }, r: 30 },
  { id: 'west', label: 'WEST LANDING', at: { poi: 'world', x: -170, z: 0 }, r: 30 },
];

export type { Places } from './core';

/** Driftwood's places resolved through the adventure's POI frames, on the shared core's discovery (core.ts) */
export function installPlaces(adv: Adventure, toast: (t: string) => void): Places {
  const pts = DRIFTWOOD_PLACES.map((d) => { const p = adv.place(d.at); return { id: d.id, label: d.label, x: p.x, z: p.z, r: d.r, quiet: d.id === 'pier' }; });
  return placesWithDiscovery(pts, adv.flags, toast, () => adv.spine?.markers() ?? []);
}
