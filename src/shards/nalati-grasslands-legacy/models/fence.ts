/**
 * The split-rail fence (E306 / E315 second pass; was src/shards/nalati-grasslands/world/props.ts `addFence`): a run of weathered larch
 * posts every ~2.4 m along a polyline, two sagging rails between them, the posts following the ground and leaning a
 * little. The valley roads' fences (src/shards/nalati-grasslands/world/RoadFurniture.ts) and the sky road's guard fences (the dressing,
 * src/shards/nalati-grasslands/world/dressing/statics.ts) are runs of it. Painted into its place's mesh on the timber layer (props.ts
 * GRAIN); one box per straight segment of the run.
 *
 * A copy is a run: `at` is its first point on the ground, `pts` the run's points relative to it (x, z), the first (0, 0).
 */
import type * as THREE from 'three';
import { defineModel } from '@wildshard/engine/models/model';
import type { BoxSpec as Collider } from '@wildshard/engine/physics/box';
import { v3, woodPole } from '../world/paint';
import { GRAIN, WOOD } from '../world/props';
import { painted, type Kit, type Paint } from '../world/painted';
import type { Box } from '../world/solid';

type Ground = (x: number, z: number) => number;

/**
 * A split-rail fence along a polyline (posts every ~2.4 m, two rails, the rails sag slightly). One collider per
 * straight segment. Posts follow the ground.
 */
export function addFence(kit: Kit, ground: Ground, pts: [number, number][], colliders: Collider[], o: { h?: number; spacing?: number } = {}): void {
  const h = o.h ?? 1.15, sp = o.spacing ?? 2.4, rng = kit.rng;
  for (let i = 0; i + 1 < pts.length; i++) {
    const p = pts[i], q = pts[i + 1];
    if (!p || !q) continue;
    const len = Math.hypot(q[0] - p[0], q[1] - p[1]), n = Math.max(1, Math.round(len / sp));
    const posts: THREE.Vector3[] = [];
    for (let k = 0; k <= n; k++) {
      if (k === 0 && i > 0) { const last = posts[posts.length - 1]; if (last) posts.push(last); continue; }
      const t = k / n, x = p[0] + (q[0] - p[0]) * t + rng.range(-0.05, 0.05), z = p[1] + (q[1] - p[1]) * t + rng.range(-0.05, 0.05);
      const y = ground(x, z);
      const lean = rng.range(-0.05, 0.05);
      kit.add(woodPole(v3(x, y - 0.3, z), v3(x + lean, y + h + rng.range(-0.05, 0.08), z + lean * 0.5), 0.075, 0.06, 7, 3), GRAIN, { ...WOOD, jitter: 0.1, foot: 0.7, brush: 0.14 });
      posts.push(v3(x, y, z));
    }
    for (let k = 0; k + 1 < posts.length; k++) {
      const a = posts[k], b = posts[k + 1];
      if (!a || !b) continue;
      for (const ry of [h * 0.45, h * 0.88]) {
        const mid = v3((a.x + b.x) / 2, (a.y + b.y) / 2 + ry - 0.05, (a.z + b.z) / 2);
        kit.add(woodPole(v3(a.x, a.y + ry, a.z), mid, 0.05, 0.05, 6, 2), GRAIN, { ...WOOD, jitter: 0.1, brush: 0.14 });
        kit.add(woodPole(mid, v3(b.x, b.y + ry, b.z), 0.05, 0.05, 6, 2), GRAIN, { ...WOOD, jitter: 0.1, brush: 0.14 });
      }
    }
    const cx = (p[0] + q[0]) / 2, cz = (p[1] + q[1]) / 2, yaw = Math.atan2(q[0] - p[0], q[1] - p[1]);
    const gy = ground(cx, cz);
    colliders.push({ x: cx, z: cz, hw: 0.12, hd: len / 2, rot: -yaw, yBottom: gy - 1.5, yTop: gy + h });
  }
}

export interface FenceParams {
  /** the run's points, relative to the placement: (x, z), the first (0, 0) */
  readonly pts: readonly (readonly [number, number])[];
  /** post height (m) and spacing along the run */
  readonly h: number;
  readonly spacing: number;
}

const paint: Paint<FenceParams> = (kit, at, p, c) => {
  const boxes: Box[] = [];
  addFence(kit, c.ground, p.pts.map(([x, z]): [number, number] => [at.x + x, at.z + z]), boxes, { h: p.h, spacing: p.spacing });
  return { boxes };
};

/**
 * A run's params from its world points: the run stands at its first point, its points relative to it — unless a point
 * would not come back exactly (first + (p − first) ≠ p in floating point: far-apart or opposite-signed coordinates),
 * then it stands at the world origin with its points as they are, so it is drawn and collides bit-identically.
 */
export function fenceRun(pts: readonly (readonly [number, number])[], o: { h?: number; spacing?: number } = {}): { at: { x: number; z: number }; params: FenceParams } {
  const [x0, z0] = pts[0] ?? [0, 0];
  const exact = pts.every(([x, z]) => x0 + (x - x0) === x && z0 + (z - z0) === z);
  const [ax, az] = exact ? [x0, z0] : [0, 0];
  return { at: { x: ax, z: az }, params: { pts: pts.map(([x, z]) => [x - ax, z - az] as const), h: o.h ?? 1.15, spacing: o.spacing ?? 2.4 } };
}

export const fence = defineModel<FenceParams>({
  id: 'nalati-grasslands/fence', name: 'Split-rail fence', category: 'props', pipeline: 'code',
  file: 'src/shards/nalati-grasslands/models/fence.ts', surface: 'wood',
  defaults: { pts: [[0, 0], [0, 7.2], [2.4, 12]], h: 1.15, spacing: 2.4 },
  build: painted(paint, { seed: 0xfe9c, layers: ['rock'] }),
});
