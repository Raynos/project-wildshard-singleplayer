import { Group } from 'three';
import { Portal } from '@wildshard/sdk/entries';
import { readScene } from '@wildshard/sdk/scene';
import { NINE_FLOOR_PLAN } from '../data/floorPlan';
import { DECK_RING_SHORT, SQUARE_ARRIVAL_AT, SQUARE_RING, SQUARE_ROUTE_TURNS } from '../data/portals';

// The fixed 15 m socket is the format's entry contract; the ring stands one authored metre short of its end.
const SOCKET_LENGTH = 15;
const EDGES = [
  { edge: 'north', ix: 0, iz: -1 }, { edge: 'east', ix: -1, iz: 0 },
  { edge: 'south', ix: 0, iz: 1 }, { edge: 'west', ix: 1, iz: 0 },
] as const;
const at = (x: number, y: number, z: number): [number, number, number] => [x + 0, y + 0, z + 0];
const yawAlong = (dx: number, dz: number): number => Math.atan2(-dx, -dz) + 0;

/** The current four portal-link sockets as ordinary SDK objects; G224 replaced the unbuilt lantern lifts. */
export function portalEntryScene(): Group {
  const scene = new Group(); scene.name = 'nine.portal-links';
  const y = NINE_FLOOR_PLAN.datum, floor = NINE_FLOOR_PLAN.ids.square;
  const destination = { id: SQUARE_ARRIVAL_AT.id, at: at(SQUARE_ARRIVAL_AT.x, y + SQUARE_ARRIVAL_AT.dy, SQUARE_ARRIVAL_AT.z), floor, yaw: SQUARE_ARRIVAL_AT.yawDeg * (Math.PI / 180) };
  const exitAt = at(SQUARE_RING.x, y + SQUARE_RING.dy, SQUARE_RING.z);
  const route = [at(SQUARE_ARRIVAL_AT.x, y, SQUARE_ARRIVAL_AT.z), ...SQUARE_ROUTE_TURNS.map(([x, z]) => at(x, y, z)), at(SQUARE_RING.x, y, SQUARE_RING.z + 3), exitAt];
  for (const { edge, ix, iz } of EDGES) {
    const inset = SOCKET_LENGTH - DECK_RING_SHORT, half = NINE_FLOOR_PLAN.cellHalf;
    const road = { id: `portal.${edge}`, at: at(-ix * half + ix * inset, 0, -iz * half + iz * inset), floor: `${NINE_FLOOR_PLAN.ids.deckPrefix}${edge}`, yaw: yawAlong(-ix, -iz) };
    const exit = { id: `${SQUARE_RING.id}.${edge}`, at: exitAt, floor, yaw: yawAlong(SQUARE_RING.nx, SQUARE_RING.nz) };
    scene.add(new Portal(edge, { road, destination, exit, links: [{ from: road.id, to: destination.id }, { from: exit.id, to: road.id }], route }));
  }
  return scene;
}

/** Compile these real Portal objects into the existing admitted rows; no authoring object reaches the client. */
export function portalEntryRows(): ReturnType<typeof readScene>['entries'] { return readScene(portalEntryScene()).entries; }
