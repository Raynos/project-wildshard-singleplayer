/** Fixed world facts compiled beside the existing geometry and foliage products. */
import { CHUNK_HALF } from '@wildshard/engine/core/config';
import type { ColliderDesc } from '@wildshard/engine/world/registry';
import authoredLayout from '../data/layout.json' with { type: 'json' };
import { SHORE_LEVEL, WORLD_DROP } from './landscapeRows';
import { BOAT_LAYOUT } from './boatLayout';
import { ENTRY_DECKS } from './entryDecks';
import shore from '../data/shoreBoulders.generated.json' with { type: 'json' };
import piers from '../data/piers.generated.json' with { type: 'json' };
import foliage from '../data/foliagePlacements.generated.json' with { type: 'json' };

const { BOAT_MOOR } = authoredLayout;

/** Own-space hull walls and floor; also the existing native mover's input. */
export function boatColliders(layout: typeof BOAT_LAYOUT = BOAT_LAYOUT): ColliderDesc[] {
  const { length: LENGTH, beam: BEAM, floor: BOAT_FLOOR } = layout;
  const yTop = 0.8, yBottom = -1.2, wy = (yTop + yBottom) / 2, wh = (yTop - yBottom) / 2, t = 0.08;
  const wall = (x: number, z: number, hx: number, hz: number): ColliderDesc => ({ kind: 'box', x, y: wy, z, hx, hy: wh, hz });
  const floorTop = BOAT_FLOOR, fh = 0.1;
  return [
    wall(-BEAM / 2, 0, t, LENGTH / 2), wall(BEAM / 2, 0, t, LENGTH / 2), wall(0, -LENGTH / 2, BEAM / 2, t), wall(0, LENGTH / 2, BEAM / 2, t),
    { kind: 'box', x: 0, y: floorTop - fh, z: 0, hx: BEAM / 2 - t, hy: fh, hz: LENGTH / 2 - t },
  ];
}

const LOWERED_SEA = SHORE_LEVEL - WORLD_DROP;
const spec = { ...BOAT_MOOR, heading: 0, waterY: LOWERED_SEA };
const { beam, length, floor } = BOAT_LAYOUT;
const h = spec.heading, cs = Math.cos(h), sn = Math.sin(h);
const wall = (lx: number, lz: number, hw: number, hd: number) => ({ x: spec.x + lx * cs + lz * sn, z: spec.z - lx * sn + lz * cs, hw, hd, rot: h === 0 ? 0 : -h, yTop: spec.waterY + 0.8, yBottom: spec.waterY - 1.2 });
/** The boat keeps its live pose; its rest-space facts are compiled offline. */
export const STATIC_BOAT = { spec,
  placement: { x: spec.x, y: spec.waterY, z: spec.z },
  walls: [wall(-beam / 2, 0, 0.08, length / 2), wall(beam / 2, 0, 0.08, length / 2), wall(0, -length / 2, beam / 2, 0.08), wall(0, length / 2, beam / 2, 0.08)],
  floors: [{ x: spec.x, z: spec.z, hw: beam / 2 * 0.8, hd: length / 2 - 0.3, y: spec.waterY + floor, rot: spec.heading }],
  cleats: [-length / 2 + 0.3, length / 2 - 0.3],
  colliders: boatColliders(),
};
const pier = piers.find(row => row.world !== null)?.world;
if (pier === undefined) throw new Error('World gulls require the south pier');
/** Preserve the exact pier, boat, shore, beach order consumed by the seeded flock. */
export const WORLD_GULL_PERCHES = [
  ...pier.posts.map(([x = 0, z = 0]) => ({ x, y: pier.deckY + 1.02, z })),
  ...pier.bollards.map(([x = 0, z = 0]) => ({ x, y: pier.deckY + 1.41, z })),
  { x: -4.2, y: LOWERED_SEA + 0.78, z: -CHUNK_HALF + 6 - 3.0 }, { x: -4.2, y: LOWERED_SEA + 0.7, z: -CHUNK_HALF + 6 + 3.0 },
  ...shore.perches.map(([x = 0, y = 0, z = 0]) => ({ x, y, z })),
  ...foliage.gullPerches,
];
export const SHORE_BOULDERS = { placements: shore.placements, boxes: shore.boxes };

/** Inclusive road-deck floors on the existing rectangular floor host. */
export const ENTRY_FLOORS = ENTRY_DECKS.map(({ slab }) => ({ x: slab.x, z: slab.z, hw: slab.hw, hd: slab.hd, y: slab.yTop, rot: slab.rot }));
