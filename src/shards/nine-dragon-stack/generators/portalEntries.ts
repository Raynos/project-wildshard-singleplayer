import { Group } from 'three';
import { Portal } from '@wildshard/sdk/entries';
import { readScene } from '@wildshard/sdk/scene';
import NINE_FLOOR_PLAN from '../data/layoutPlan.json' with { type: 'json' };
import portals from '../data/portals.json' with { type: 'json' };

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
  const y = NINE_FLOOR_PLAN.Y0, floor = NINE_FLOOR_PLAN.IDS.square;
  const destination = { id: portals.squareArrival.id, at: at(portals.squareArrival.x, y + portals.squareArrival.dy, portals.squareArrival.z), floor, yaw: portals.squareArrival.yawDeg * (Math.PI / 180) };
  const exitAt = at(portals.squareRing.x, y + portals.squareRing.dy, portals.squareRing.z);
  const route = [at(portals.squareArrival.x, y, portals.squareArrival.z), ...portals.routeTurns.map(([x, z]) => { if (x === undefined || z === undefined) throw new Error('Missing portal route coordinate'); return at(x, y, z); }), at(portals.squareRing.x, y, portals.squareRing.z + 3), exitAt];
  for (const { edge, ix, iz } of EDGES) {
    const inset = SOCKET_LENGTH - portals.deckRingShort, half = NINE_FLOOR_PLAN.CELL_HALF;
    const road = { id: `portal.${edge}`, at: at(-ix * half + ix * inset, 0, -iz * half + iz * inset), floor: `${NINE_FLOOR_PLAN.IDS.deckPrefix}${edge}`, yaw: yawAlong(-ix, -iz) };
    const exit = { id: `${portals.squareRing.id}.${edge}`, at: exitAt, floor, yaw: yawAlong(portals.squareRing.nx, portals.squareRing.nz) };
    scene.add(new Portal(edge, { road, destination, exit, links: [{ from: road.id, to: destination.id }, { from: exit.id, to: road.id }], route }));
  }
  return scene;
}

/** Compile these real Portal objects into the existing admitted rows; no authoring object reaches the client. */
export function portalEntryRows(): ReturnType<typeof readScene>['entries'] { return readScene(portalEntryScene()).entries; }

/** Client ring frames and the walked witness route, baked from the same authored portal nodes. */
export function portalPlanRows(): {
  decks: { id: string; edge: typeof EDGES[number]['edge']; mx: number; mz: number; x: number; y: number; z: number; nx: number; nz: number }[];
  square: { id: string; x: number; y: number; z: number; nx: number; nz: number };
  route: [number, number, number][];
  floors: { square: string; deckPrefix: string };
  ring: typeof portals.ring;
} {
  const entries = portalEntryRows();
  const decks = EDGES.map(({ edge, ix, iz }) => {
    const portal = entries.find(row => row.edge === edge)?.portal;
    if (portal === undefined) throw new Error(`Missing authored portal ${edge}`);
    const [x, y, z] = portal.road.at;
    return { id: portal.road.id, edge, mx: -ix * NINE_FLOOR_PLAN.CELL_HALF + 0, mz: -iz * NINE_FLOOR_PLAN.CELL_HALF + 0, x, y, z, nx: ix, nz: iz };
  });
  const first = entries[0]?.portal;
  if (first === undefined) throw new Error('Missing authored square portal');
  const [x, y, z] = first.exit.at;
  return { decks, square: { id: portals.squareRing.id, x, y, z, nx: portals.squareRing.nx, nz: portals.squareRing.nz }, route: first.route, floors: NINE_FLOOR_PLAN.IDS, ring: portals.ring };
}
