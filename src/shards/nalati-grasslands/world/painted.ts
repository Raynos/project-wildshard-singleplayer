import type * as THREE from 'three';
import type { ModelDef } from '@wildshard/engine/models/model';
import { place, type Placed } from '@wildshard/engine/models/place';
import type { Platform } from './types';
import type { MemberData, SetRegister } from './placeTypes';


/** Placement-only authored floors; all solid construction is baked. */
function highest(floors: readonly Platform[]): Platform {
  return (x, z) => {
    let best: number | undefined;
    for (const floor of floors) { const value = floor(x, z); if (value !== undefined && (best === undefined || value > best)) best = value; }
    return best;
  };
}

/** place one model's copies (`drawnInto` the set's mesh or group): what NalatiSet.register does per model */
export function placeMember<P extends object>(def: ModelDef<P>, m: MemberData, o: SetRegister, object: THREE.Object3D): Placed {
  const floor = m.floors.length === 0 ? undefined : m.floors.length === 1 ? m.floors[0] : highest(m.floors);
  return place<P>(def, m.placements, {
    ctx: o.ctx, draw: m.draw, ...(o.registry === undefined ? {} : { registry: o.registry }),
    drawnInto: { object, boxes: Float32Array.from(m.boxes), colliders: [...m.solid, ...m.descs] },
    piece: { solidFloor: true, ...(floor === undefined ? {} : { floor }), ...(o.split === undefined ? {} : { split: o.split }) },
  });
}

