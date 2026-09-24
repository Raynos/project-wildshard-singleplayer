/**
 * Driftwood's named places and their discovery (A5): walk within a place's radius and it is DISCOVERED — a flag
 * (`seen:<id>`, persisted with the rest of the adventure), a "Discovered · The Lookout" toast, and its name on the full
 * map (src/ui/Map.ts `setPois`). Undiscovered places show as a dim "?" so the map still hints where to go; the quest's
 * live markers are drawn on top (pulsing diamonds).
 */
import type { MapPoi } from '../../ui/Map';
import type { Place } from '../../world/interact/types';
import type { Adventure } from './Adventure';

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

export interface Places {
  /** the full map's list: places (named / "?") + the quest's markers */
  mapPois: () => MapPoi[];
  /** call a few times a second with the player's feet */
  update: (x: number, z: number) => void;
  discovered: (id: string) => boolean;
}

export function installPlaces(adv: Adventure, toast: (t: string) => void): Places {
  const { flags, place } = adv;
  const pts = DRIFTWOOD_PLACES.map((d) => ({ d, p: place(d.at) }));
  const out: MapPoi[] = [];
  return {
    discovered: (id) => flags.has(`seen:${id}`),
    update: (x, z) => {
      for (const { d, p } of pts) {
        if (flags.has(`seen:${d.id}`)) continue;
        if ((p.x - x) ** 2 + (p.z - z) ** 2 < d.r * d.r) { flags.set(`seen:${d.id}`); if (d.id !== 'pier') toast(`Discovered · ${d.label}`); }
      }
    },
    mapPois: () => {
      out.length = 0;
      for (const { d, p } of pts) out.push({ x: p.x, z: p.z, label: d.label, kind: flags.has(`seen:${d.id}`) ? 'place' : 'unknown' });
      for (const m of adv.spine?.markers() ?? []) out.push({ x: m.x, z: m.z, label: m.label, kind: 'quest' });
      return out;
    },
  };
}
