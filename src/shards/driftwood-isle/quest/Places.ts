/**
 * Driftwood's named places and their discovery (A5): walk within a place's radius and it is DISCOVERED — a flag
 * (`seen:<id>`, persisted with the rest of the adventure), a "Discovered · The Lookout" toast, and its name on the full
 * map (src/engine/ui/Map.ts `setPois`). The discovery itself is the shared quest core's (core.ts `placesWithDiscovery`). Undiscovered places show as a dashed ring with a "?" (E309 A) so the map still hints where to go, and three gulls fly you toward the nearest one when you wander or idle (gullGuide.ts, E309 B); the quest's
 * live markers are drawn on top (pulsing diamonds).
 */
import { DRIFTWOOD_PLACES } from '../data/discovery';
import type { Adventure } from './adventure';
import { placesWithDiscovery, type Places } from '@wildshard/engine/quest/view';

/** Driftwood's places resolved through the adventure's POI frames, on the shared core's discovery (core.ts) */
export function installPlaces(adv: Adventure, toast: (t: string) => void): Places {
  const pts = DRIFTWOOD_PLACES.map((d) => { const p = adv.place(d.at); return { id: d.id, label: d.label, x: p.x, z: p.z, r: d.r, quiet: d.id === 'pier' }; });
  return placesWithDiscovery(pts, adv.flags, toast, () => adv.spine?.markers() ?? []);
}
