import { Group } from 'three';
import type { BoxColliderData, ColliderPoint } from '@wildshard/sdk/physics';
import { NINE_FLOOR_PLAN } from '../data/floorPlan';
import { floorBoxRows } from './floorBoxes';
import { frontRows } from './fronts';
import { deckCapRows, portalFloorRows } from './portalFloors';

interface TreadFlight { kind: 'treads'; from: ColliderPoint; to: ColliderPoint; width: number; count: number; surface: 'stone' }
/** The native rest-state piece transport; live guard ownership remains with the runtime. */
export interface NinePhysicsPlacement {
  id: string; name: string; category: 'buildings'; file: string;
  colliders: (BoxColliderData | TreadFlight)[]; active: true; surface: 'stone';
  colliderOwner?: string; follows?: { matrix: number[]; rotation: true };
}

function nativeBoxes(shapes: readonly BoxColliderData[]): BoxColliderData[] {
  return shapes.map(({ kind, x, y, z, hx, hy, hz, surface, yaw, rot }) => {
    if (surface !== 'stone' || yaw !== undefined || rot !== undefined) throw new Error('Nine static floor requires its original stone axis-aligned box');
    return { kind, x, y, z, hx, hy, hz, surface };
  });
}

function piece(id: string, name: string, file: string, colliders: NinePhysicsPlacement['colliders']): NinePhysicsPlacement {
  return { id, name, category: 'buildings', file, colliders, active: true, surface: 'stone' };
}

/** Compile the eight floor/front/portal rest placements from retained authoring recipes, in shipping order.
 * The remaining mesh-derived model/crossing placements stay outside this component job.
 * Caps are the standalone bake's original closed road ends; the grid keeps its live open-cap law.
 */
export function ninePhysicsPlacements(): NinePhysicsPlacement[] {
  const boxes = floorBoxRows(), caps = deckCapRows();
  const { stair, datum } = NINE_FLOOR_PLAN;
  const rise = stair.rise / 60, landing = 4, run = (stair.x1 - stair.x0 - 2 * landing) / 60;
  const center = (stair.z0 + stair.z1) / 2, width = stair.z1 - stair.z0;
  const flights: TreadFlight[] = [0, 1, 2].map(index => {
    const x0 = stair.x0 + index * (20 * run + landing), x1 = x0 + 20 * run;
    const y0 = datum + index * 20 * rise;
    return { kind: 'treads', from: { x: x0, y: y0, z: center },
      to: { x: x1, y: y0 + 20 * rise, z: center }, width, count: 20, surface: 'stone' };
  });
  const file = 'src/shards/nine-dragon-stack/world/colliders.ts';
  const floors = piece('nds-floors', 'Lantern Square', 'src/shards/nine-dragon-stack/world/build.ts', [
    ...nativeBoxes(boxes.street), ...flights, ...nativeBoxes(boxes.stairLandings), ...nativeBoxes(boxes.stairTop), ...nativeBoxes(boxes.well),
    ...nativeBoxes(caps.north), ...nativeBoxes(caps.south), ...nativeBoxes(caps.east), ...nativeBoxes(caps.west),
  ]);
  const portals = portalFloorRows().map(row => {
    const result = piece(`nds-${row.id}`, row.id === NINE_FLOOR_PLAN.ids.square ? 'Lantern Square slab' : `Landing deck (${row.id})`,
      'src/shards/nine-dragon-stack/world/entries.ts', nativeBoxes(row.shapes));
    result.colliderOwner = row.id;
    return result;
  });
  // The guard starts closed at the identity rest pose. Its live kinematic object and saved open state are runtime-owned.
  const guard = new Group(); guard.updateWorldMatrix(true, false);
  return [floors, ...portals, piece('nds-fronts', 'The towers', file, nativeBoxes(frontRows())), {
    ...piece('nds-grapple-guard', 'The Well safety cap', file, nativeBoxes(boxes.guard)),
    follows: { matrix: guard.matrixWorld.toArray(), rotation: true },
  }];
}
