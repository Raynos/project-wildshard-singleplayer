/**
 * The stone step (E306 / E315 M3): one flat granite block of a stone stair — a rough block a touch wider than its tread,
 * its top flat at the tread, lichen on it, from under the turf up to the step. A stair (src/shards/nalati-grasslands/world/Stair.ts: a
 * route up a slope the motor cannot climb, its rise and tread held by construction) lays them; the watchtower's west
 * shoulder is the one on the shard. Placed at its foot (`at.y`: the block's bottom), `yaw` along the flight. Painted into
 * its place's mesh (src/shards/nalati-grasslands/world/painted.ts). Collides: the block as the box it draws (the tread 1 cm deeper).
 */
import * as THREE from 'three';
import { defineModel } from '@wildshard/engine/models/model';
import { M } from '../world/paint';
import { graniteBlock } from '../world/granite';
import { painted, type Paint } from '../world/painted';

export interface StoneStepParams {
  /** the tread's width across the flight and its depth along it, the block's height (m) */
  readonly width: number;
  readonly depth: number;
  readonly height: number;
  /** its shape's seed (the stair's step number) */
  readonly seed: number;
}

const C = { top: new THREE.Color('#b3a58e'), side: new THREE.Color('#7d7264'), lichen: new THREE.Color('#b4a860') };

const paint: Paint<StoneStepParams> = (kit, at, p) => {
  const h = p.height;
  kit.add(graniteBlock(p.width + 0.3, h, p.depth + 0.12, p.seed, 0.06, 1), (_q, n) => (n.y > 0.6 ? C.top : C.side), { matrix: M(at.x, at.y + h / 2, at.z, at.yaw), top: { color: C.lichen, threshold: 0.75, amount: 0.2 }, brush: 0.1 });
  return { descs: [{ kind: 'box', x: at.x, y: at.y + h / 2, z: at.z, hx: p.width / 2, hy: h / 2, hz: p.depth / 2 + 0.01, yaw: at.yaw, surface: 'stone' }] };
};

export const stoneStep = defineModel<StoneStepParams>({
  id: 'nalati-grasslands/stone-step', name: 'Stone step', category: 'props', pipeline: 'code',
  file: 'src/shards/nalati-grasslands/models/stoneStep.ts', surface: 'stone',
  defaults: { width: 1.8, depth: 0.4, height: 0.6, seed: 0x5a1 },
  build: painted(paint, { seed: 0x70e7 }),
});
