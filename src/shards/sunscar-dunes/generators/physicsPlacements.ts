import { Vector3 } from 'three';
import type { BoxColliderData } from '@wildshard/sdk/physics';
import { BRAZIERS, CARAVAN, WELL } from '../data/layout';
import { CRATES, HORSE, WELL_RIG } from '../data/places';
import { STRINGS } from '../data/strings';
import { signalHeightAt } from './landscape';

// A static native horse contact is outside the narrower serialized prop contact set.
/** Signal native box transport, retaining the existing caravan horse's flesh contact. */
export interface SignalBoxColliderData extends Omit<BoxColliderData, 'surface'> {
  surface?: NonNullable<BoxColliderData['surface']> | 'flesh';
}

/** Native placement transport; live fires, crank, bodies and prompts remain their existing owners. */
export interface SignalPhysicsPlacement {
  id: string; name: string; category: 'props' | 'buildings'; file: string;
  colliders: SignalBoxColliderData[]; active: true; owner: string; surface: 'wood' | 'stone';
}

type Surface = NonNullable<SignalBoxColliderData['surface']>;
interface FootBox { x: number; z: number; hw: number; hd: number; rot: number; yBottom: number; yTop: number }
function box(c: FootBox, surface: Surface): SignalBoxColliderData {
  return { kind: 'box', x: c.x, y: (c.yTop + c.yBottom) / 2, z: c.z,
    hx: c.hw, hy: Math.max(0.005, (c.yTop - c.yBottom) / 2), hz: c.hd, yaw: -c.rot, surface };
}
const TENT = { x: -8.2, z: 2.6, yaw: 0.35, w: 2.6, h: 1.9, d: 3.0 } as const;
function piece(id: string, name: string, category: SignalPhysicsPlacement['category'], colliders: SignalBoxColliderData[], surface: SignalPhysicsPlacement['surface']): SignalPhysicsPlacement {
  return { id, name, category, file: 'src/shards/sunscar-dunes/generators/places.ts', colliders, active: true, owner: `piece:${id}`, surface };
}

/** Compile the caravan, well and three waymark recipes on the exact authored dune field.
 * No recorded collider/height output, model builder, terrain service or world constructor is read.
 */
export function signalPhysicsPlacements(): SignalPhysicsPlacement[] {
  const groundAt = signalHeightAt(), y = groundAt(CARAVAN.x, CARAVAN.z), up = new Vector3(0, 1, 0);
  const world = (x: number, z: number): Vector3 => new Vector3(x, 0, z).applyAxisAngle(up, CARAVAN.yaw).add(new Vector3(CARAVAN.x, y, CARAVAN.z));
  const body = world(0, 0), horse = world(HORSE.x, HORSE.z), tent = world(TENT.x, TENT.z), crates = world(CRATES.x, CRATES.z);
  const caravan = piece('sunscar.caravan', STRINGS.caravan, 'props', [
    box({ x: body.x, z: body.z, hw: 1.1, hd: 2.3, rot: -CARAVAN.yaw, yBottom: y - 1, yTop: y + 1.9 }, 'wood'),
    box({ x: horse.x, z: horse.z, hw: 0.35, hd: 1.1, rot: -CARAVAN.yaw, yBottom: y - 0.3, yTop: y + HORSE.h }, 'flesh'),
    box({ x: tent.x, z: tent.z, hw: TENT.w / 2, hd: TENT.d / 2, rot: -(CARAVAN.yaw + TENT.yaw), yBottom: y - 0.5, yTop: y + TENT.h }, 'felt'),
    box({ x: crates.x, z: crates.z, hw: CRATES.half, hd: CRATES.half, rot: -CARAVAN.yaw, yBottom: y - 0.5, yTop: y + 0.84 + 0.52 }, 'wood'),
  ], 'wood');
  const wy = groundAt(WELL.x, WELL.z), r = WELL_RIG.r, stones = [];
  for (let index = 0; index < 12; index++) {
    const angle = (index / 12) * Math.PI * 2;
    stones.push(box({ x: WELL.x + Math.sin(angle) * r, z: WELL.z + Math.cos(angle) * r, hw: 0.38, hd: 0.24, rot: -angle, yBottom: wy - 0.5, yTop: wy + 0.78 }, 'stone'));
  }
  for (const side of [-1, 1]) stones.push(box({ x: WELL.x + side * (r + 0.15), z: WELL.z, hw: 0.1, hd: 0.1, rot: 0, yBottom: wy, yTop: wy + 2.3 }, 'wood'));
  const poleY = groundAt(WELL.x - 2.6, WELL.z + 1.4);
  stones.push(box({ x: WELL.x - 2.6, z: WELL.z + 1.4, hw: 0.07, hd: 0.07, rot: 0, yBottom: poleY - 0.3, yTop: poleY + 6.5 }, 'wood'));
  const well = piece('sunscar.well', STRINGS.well, 'buildings', stones, 'stone');
  const braziers = BRAZIERS.map(({ x, z }, index) => {
    const by = Math.min(groundAt(x, z), groundAt(x + 0.5, z + 0.5), groundAt(x - 0.5, z - 0.5), groundAt(x + 0.5, z - 0.5), groundAt(x - 0.5, z + 0.5));
    return piece(`sunscar.brazier.${String(index)}`, STRINGS.waymark, 'props', [
      box({ x, z, hw: 0.85, hd: 0.85, rot: -0.12, yBottom: by - 0.3, yTop: by }, 'stone'),
      box({ x, z, hw: 0.45, hd: 0.45, rot: 0, yBottom: by, yTop: by + 1.75 }, 'stone'),
    ], 'stone');
  });
  return [caravan, well, ...braziers];
}
