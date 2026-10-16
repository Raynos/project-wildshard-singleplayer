// Pine Hollow's cabin looks as data (SHARD-PLATFORM M3, look-family rows): the look.materials ids the door and the
// moss-bound kinds wear (their SF59 graphs are built at build time, generators/cabinGraphs.ts) and how the
// homestead moves and lights (CABIN_LIFE: @wildshard/sdk/props/buildingLife).
import type { BuildingLifeLook } from '../runtime/props/buildingLife';
import type { CABIN_MOSS_BINDINGS } from './cabinAssembly';

/** the look.materials id the cabin doors wear */
export const CABIN_DOOR_LOOK = 'pine-cabin-door';

/** the look.materials id each moss-bound cabin kind wears (CABIN_MOSS_BINDINGS: the roof, the stone) */
export const CABIN_MOSS_LOOKS = { roof: 'pine-cabin-moss-roof', stone: 'pine-cabin-moss-stone' } as const satisfies Record<typeof CABIN_MOSS_BINDINGS[number]['key'], string>;

/**
 * The homestead as a living place (world/homestead.ts hands it to @wildshard/sdk/props/buildingLife): a door swings in
 * 0.6 s to 1.85 rad; fires and lamps flicker by 28 % on three waves; fires read 0.7 + 0.3 × night, lamps 0.1 + 0.9 ×
 * night, the window glass 0.2 + 0.8 × night; hung lanterns sway; indoors (over a room or within 3 m of the door) the room
 * lamp (rank 2) and the hearth (rank 3) take the phone's pooled pair first.
 */
export const CABIN_LIFE: BuildingLifeLook = {
  door: { seconds: 0.6, angle: 1.85 },
  flicker: { depth: 0.28, waves: [[11, 1, 0.5], [23.7, 2.3, 0.3], [3.1, 1, 0.2]] },
  fire: [0.7, 0.3],
  lamp: [0.1, 0.9],
  glass: [0.2, 0.8],
  swing: { z: [[1.35, 1, 0.05], [2.9, 1.7, 0.015]], x: [1.1, 0.03] },
  indoor: { doorRadius: 3, ranks: [2, 3] },
};
