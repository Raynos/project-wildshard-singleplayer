/**
 * A stone stair up a slope the motor cannot climb (NALATI-MERGE P1): flat granite steps laid along a polyline from its
 * foot to its head — straight flights between square landings at the polyline's bends — each step a solid block from
 * under the turf up to its tread, drawn and collided as the same box. The profile follows the ground (every tread over
 * the highest ground under it, + `clear`: no steep turf pokes through under the feet) and is then lifted, never
 * lowered, so no riser is taller than `maxRise`; at the foot, extra steps lead down to the ground. So the rules for a
 * stair hold by construction: rise ≤ `maxRise` (0.32 m), tread ≥ `depth` (0.4 m) — PHYSICS.md: autostep climbs them,
 * never a ramp; a landing at a bend (not two flights' treads overlapping at an angle) keeps every step's top whole.
 *
 *   descs.push(...addStoneStair(kit, ground, [[x0, z0], [x1, z1], [x2, z2]], { width: 1.8 }));
 */
import * as THREE from 'three';
import { M, type PaintKit } from './paint';
import { graniteBlock } from './EagleRock';
import type { ColliderDesc } from '../registry';
import type { Ground } from './types';

const C = { top: new THREE.Color('#b3a58e'), side: new THREE.Color('#7d7264'), lichen: new THREE.Color('#b4a860') };

export interface StairOpts { width?: number; depth?: number; maxRise?: number; clear?: number }

/** one step (or landing): centre, heading, depth along the heading */
interface Step { x: number; z: number; yaw: number; d: number }

export function addStoneStair(kit: PaintKit, ground: Ground, pts: readonly (readonly [number, number])[], o: StairOpts = {}): ColliderDesc[] {
  const width = o.width ?? 1.8, depth = o.depth ?? 0.4, maxRise = o.maxRise ?? 0.32, clear = o.clear ?? 0.12;
  // the flights (between landings of side `width` at every bend) and the landings
  const steps: Step[] = [];
  const last = pts.length - 1;
  for (let k = 1; k <= last; k++) {
    const a = pts[k - 1], b = pts[k];
    if (!a || !b) continue;
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]), yaw = Math.atan2(b[0] - a[0], b[1] - a[1]);
    const s0 = k > 1 ? width / 2 : 0, s1 = len - (k < last ? width / 2 : 0), n = Math.max(1, Math.floor((s1 - s0) / depth)), d = (s1 - s0) / n;   // every tread ≥ depth
    for (let i = 0; i < n; i++) { const t = (s0 + (i + 0.5) * d) / len; steps.push({ x: a[0] + (b[0] - a[0]) * t, z: a[1] + (b[1] - a[1]) * t, yaw, d }); }
    const c = pts[k + 1];
    if (k < last && c) {
      const yaw2 = Math.atan2(c[0] - b[0], c[1] - b[1]), mid = yaw + Math.atan2(Math.sin(yaw2 - yaw), Math.cos(yaw2 - yaw)) / 2;
      steps.push({ x: b[0], z: b[1], yaw: mid, d: width });
    }
  }
  // the ground under each: the highest across and along it (+ clear), the lowest (the block's foot)
  const hi: number[] = [], lo: number[] = [];
  const sample = (s: Step): [number, number] => {
    const ax = Math.cos(s.yaw), az = -Math.sin(s.yaw), fx = Math.sin(s.yaw), fz = Math.cos(s.yaw);
    let h = -Infinity, l = Infinity;
    for (const u of [-0.55, -0.35, -0.15, 0.15, 0.35, 0.55]) for (const v of [-0.6, -0.2, 0.2, 0.6]) {
      const y = ground(s.x + ax * u * width + fx * v * s.d, s.z + az * u * width + fz * v * s.d);
      h = Math.max(h, y); l = Math.min(l, y);
    }
    return [h + clear, l];
  };
  for (const s of steps) { const [h, l] = sample(s); hi.push(h); lo.push(l); }
  // lift so every riser is ≤ maxRise both ways (the stair climbs; a dip in the ground is bridged, not followed down)
  const top = [...hi];
  for (let i = top.length - 2; i >= 0; i--) top[i] = Math.max(top[i] ?? 0, (top[i + 1] ?? 0) - maxRise);
  for (let i = 1; i < top.length; i++) top[i] = Math.max(top[i] ?? 0, (top[i - 1] ?? 0) - maxRise);
  // the foot: while the first step stands more than a step over the ground at its outer edge, lay one more before it,
  // a riser lower (the stair's foot is on walkable ground — the turf there may show through its first treads)
  for (let guard = 0; guard < 24; guard++) {
    const f = steps[0], t0 = top[0];
    if (!f || t0 === undefined || t0 - ground(f.x - Math.sin(f.yaw) * f.d / 2, f.z - Math.cos(f.yaw) * f.d / 2) <= 0.25) break;
    const s: Step = { x: f.x - Math.sin(f.yaw) * (f.d + depth) / 2, z: f.z - Math.cos(f.yaw) * (f.d + depth) / 2, yaw: f.yaw, d: depth };
    const [, l] = sample(s);
    steps.unshift(s); lo.unshift(l); top.unshift(t0 - maxRise);
  }
  const out: ColliderDesc[] = [];
  steps.forEach((s, i) => {
    const y1 = top[i] ?? 0, y0 = Math.min((lo[i] ?? y1) - 0.4, y1 - 0.3), h = y1 - y0;
    // the step: a rough granite block a touch wider than the tread, its top flat at the tread
    kit.add(graniteBlock(width + 0.3, h, s.d + 0.12, 0x5a1 + i, 0.06, 1), (_p, n) => (n.y > 0.6 ? C.top : C.side), { matrix: M(s.x, y0 + h / 2, s.z, s.yaw), top: { color: C.lichen, threshold: 0.75, amount: 0.2 }, brush: 0.1 });
    out.push({ kind: 'box', x: s.x, y: y0 + h / 2, z: s.z, hx: width / 2, hy: h / 2, hz: s.d / 2 + 0.01, yaw: s.yaw, surface: 'stone' });
  });
  return out;
}
