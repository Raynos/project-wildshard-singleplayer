import { Vector3 } from 'three';
import type { BoxColliderData } from '@wildshard/sdk/physics';
import { SEED, TOWER } from '../data/layout';
import { STRINGS } from '../data/strings';
import { signalHeightAt } from './landscape';
import type { SignalPhysicsPlacement } from './physicsPlacements';

// Retained dimensions from the shipping frame recipe. Drawing stays with its existing geometry owner.
const STAIR = { count: 30, run: 0.42, width: 1.3, x: 0.75 } as const;
const SLAB = 0.5, HEADROOM = 2.3;
interface FootBox { x: number; z: number; hw: number; hd: number; rot: number; yBottom: number; yTop: number }
function box(c: FootBox, surface: 'wood' | 'metal'): BoxColliderData {
  return { kind: 'box', x: c.x, y: (c.yTop + c.yBottom) / 2, z: c.z,
    hx: c.hw, hy: Math.max(0.005, (c.yTop - c.yBottom) / 2), hz: c.hd, yaw: -c.rot, surface };
}

/** Compile the tower legs, deck, rails, thirty open stairs and bowl from authored terrain.
 * No model, material, scene, retained tower JSON or world constructor supplies a collider.
 */
export function signalTowerPhysicsPlacements(seed = SEED): SignalPhysicsPlacement[] {
  const groundAt = signalHeightAt(seed), { x: cx, z: cz, deck, half } = TOWER;
  const y = groundAt(cx, cz), deckY = y + deck, colliders: BoxColliderData[] = [];
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
    const x = sx * half, z = sz * half, foot = Math.min(y, groundAt(cx + x, cz + z)) - 0.6;
    colliders.push(box({ x: cx + x, z: cz + z, hw: 0.12, hd: 0.12, rot: 0, yBottom: foot, yTop: deckY }, 'wood'));
  }
  colliders.push(box({ x: cx, z: cz, hw: half + 0.3, hd: half + 0.3, rot: 0, yBottom: deckY - 0.2, yTop: deckY }, 'wood'));
  const railH = 1.0, edge = half + 0.25;
  for (const [x, z, w, d] of [[0, -edge, edge * 2, 0.08], [-edge, 0, 0.08, edge * 2], [edge, 0, 0.08, edge * 2], [-edge * 0.6, edge, edge * 0.8, 0.08]] as const) {
    colliders.push(box({ x: cx + x, z: cz + z, hw: Math.max(0.04, w / 2), hd: Math.max(0.04, d / 2), rot: 0, yBottom: deckY, yTop: deckY + railH }, 'wood'));
  }
  // Preserve the original top/foot construction and arithmetic order, including open high treads.
  const top = new Vector3(cx + STAIR.x, deckY, cz + edge), foot = new Vector3(top.x, 0, top.z + STAIR.count * STAIR.run);
  foot.y = groundAt(foot.x, foot.z);
  const rise = (top.y - foot.y) / STAIR.count, hx = STAIR.width / 2, hz = STAIR.run / 2;
  for (let index = 0; index < STAIR.count; index++) {
    const z = foot.z - (index + 0.5) * STAIR.run, treadTop = foot.y + (index + 1) * rise;
    const sand = Math.max(groundAt(foot.x - hx, z - hz), groundAt(foot.x + hx, z - hz), groundAt(foot.x - hx, z + hz), groundAt(foot.x + hx, z + hz));
    const bottom = treadTop - SLAB - sand >= HEADROOM ? treadTop - SLAB : Math.min(foot.y, sand) - 0.2, hy = (treadTop - bottom) / 2;
    colliders.push({ kind: 'box', x: foot.x, y: bottom + hy, z, hx, hy, hz, surface: 'wood' });
  }
  colliders.push(box({ x: cx - 0.4, z: cz - 0.5, hw: 0.4, hd: 0.4, rot: 0, yBottom: deckY, yTop: deckY + 1.15 }, 'metal'));
  return [{ id: 'sunscar.tower', name: STRINGS.tower, category: 'buildings',
    file: 'src/shards/sunscar-dunes/generators/tower.ts', colliders, active: true,
    owner: 'piece:sunscar.tower', surface: 'wood' }];
}
