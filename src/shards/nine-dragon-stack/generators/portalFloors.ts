import { Group } from 'three';
import { BoxCollider, type BoxColliderData } from '@wildshard/sdk/physics';
import { readScene } from '@wildshard/sdk/scene';
import { DECK } from '../data/decks';
import { NINE_FLOOR_PLAN } from '../data/floorPlan';

// First Node physics slice: the floors declared in shard.config.ts. The remaining models,
// crossings, fronts and guard are still an open G320 migration.
const EDGES = ['north', 'east', 'south', 'west'] as const;
type Edge = typeof EDGES[number];
const INWARD = {
  north: { x: 0, z: -1 }, east: { x: -1, z: 0 },
  south: { x: 0, z: 1 }, west: { x: 1, z: 0 },
} as const;

function span(name: string, x0: number, y0: number, z0: number, x1: number, y1: number, z1: number): BoxCollider {
  const box = new BoxCollider(Math.abs(x1 - x0), Math.abs(y1 - y0), Math.abs(z1 - z0), 'stone');
  box.name = name;
  box.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  return box;
}

function deckBox(edge: Edge, name: string, a0: number, a1: number, c0: number, c1: number, y0: number, y1: number): BoxCollider {
  const inward = INWARD[edge];
  const midpointX = -inward.x * NINE_FLOOR_PLAN.cellHalf, midpointZ = -inward.z * NINE_FLOOR_PLAN.cellHalf;
  const ax0 = midpointX + inward.x * a0, ax1 = midpointX + inward.x * a1;
  const az0 = midpointZ + inward.z * a0, az1 = midpointZ + inward.z * a1;
  const xs = inward.x === 0 ? [c0, c1] : [ax0, ax1], zs = inward.x === 0 ? [az0, az1] : [c0, c1];
  return span(name, Math.min(...xs), y0, Math.min(...zs), Math.max(...xs), y1, Math.max(...zs));
}

/** The four road-height decks and Lantern Square, as ordinary Groups with SDK box declarations. */
export function portalFloorScene(): Group {
  const scene = new Group(); scene.name = 'nine.portal-floors';
  const h = NINE_FLOOR_PLAN.openingHalf, c0 = -h - DECK.railT, c1 = h + DECK.railT;
  for (const edge of EDGES) {
    const deck = new Group(); deck.name = `${NINE_FLOOR_PLAN.ids.deckPrefix}${edge}`;
    deck.add(
      deckBox(edge, `${deck.name}.slab`, 0, DECK.depth, c0, c1, -DECK.slab, 0),
      deckBox(edge, `${deck.name}.rail-left`, 0, DECK.depth, -h - DECK.railT, -h, 0, DECK.railH),
      deckBox(edge, `${deck.name}.rail-right`, 0, DECK.depth, h, h + DECK.railT, 0, DECK.railH),
      deckBox(edge, `${deck.name}.wall`, DECK.depth, DECK.depth + DECK.wallT, c0, c1, -DECK.slab, DECK.wallH),
    );
    scene.add(deck);
  }
  const square = new Group(); square.name = NINE_FLOOR_PLAN.ids.square;
  const p = NINE_FLOOR_PLAN.square, y = NINE_FLOOR_PLAN.datum;
  square.add(span(`${square.name}.slab`, p.x0, y - DECK.slab, p.z0, p.x1 + 0.6, y, p.z1 + 0.6));
  scene.add(square);
  return scene;
}

/** Compile the authored scene into the existing portal rows, retaining identities, order and exact doubles. */
export function portalFloorRows(): { id: string; panel: null; initialActive: true; shapes: BoxColliderData[] }[] {
  const scene = portalFloorScene(), description = readScene(scene);
  const shapes = new Map(description.colliders.map(row => [row.id, row.shape]));
  return scene.children.map(floor => ({ id: floor.name, panel: null, initialActive: true, shapes: floor.children.map(object => {
    const shape = shapes.get(object.name);
    if (shape?.kind !== 'box') throw new Error(`Missing authored floor box ${object.name}`);
    return shape;
  }) }));
}
