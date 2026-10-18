import { boxDesc, type ColliderDesc } from '@wildshard/engine/world/registry';
import type { PierParams } from './pierContract';

/**
 * PHYSICS P4, own space: the posts and bollards (the legacy boxes) and every floor the deck describes, as real geometry.
 * The flat deck is one slab (0.3 m: the planks and the bearers under them); the landing's step-down (the south pier,
 * E43) is a real ramp — the planks follow one straight line from the deck to the sand — so it is a thin box pitched to
 * that line, plus the 0.2 m of flat sand-level deck past it.
 */
export function pierColliders(p: PierParams): ColliderDesc[] {
  const halfW = p.width / 2 + 0.25;
  const out: ColliderDesc[] = pierBoxes(p).map((c) => boxDesc(c));
  // a box along the pier: `a0`‥`a1` metres from the sea end, top at `top`, `hy` half thick
  const slab = (a0: number, a1: number, top: number, hy: number, hx = halfW): ColliderDesc => ({ kind: 'box', x: 0, y: top - hy, z: (a0 + a1) / 2, hx, hy, hz: (a1 - a0) / 2, yaw: 0 });
  const length = p.length, rampFrom = p.landing?.rampFrom ?? length, landY = p.landing?.landY ?? 0;
  const ramped = length > rampFrom + 0.1, sea = p.seaRamp;
  out.push(slab(sea === undefined ? -0.2 : sea.run, ramped ? rampFrom : length + 0.2, 0, 0.15));
  if (sea !== undefined) {
    // SF72: the flared sea-end ramp, a trapezoid slab (a hull): its top face on the line (0, landY) → (run, 0), half the
    // flare wide at the sea end narrowing to half the deck at the top (each + 0.25, as the deck's slab), 0.2 m thick; plus
    // 0.2 m of flat sand-level deck before it, the flare's width
    const wide = sea.flare / 2 + 0.25, hy = 0.2, points: number[] = [];
    // the two ends: the sea end (flare wide, at landY) then the top (deck wide, at 0); each end's four corners
    for (let end = 0; end < 2; end++) {
      const along = end === 0 ? 0 : sea.run, half = end === 0 ? wide : halfW, top = end === 0 ? sea.landY : 0;
      for (const s of [-1, 1]) for (let k = 0; k < 2; k++) { const dy = k === 0 ? 0 : -hy; points.push(s * half, top + dy, along); }
    }
    out.push({ kind: 'hull', x: 0, y: 0, z: 0, points: new Float32Array(points) });
    out.push(slab(-0.2, 0, sea.landY, 0.1, wide));
  }
  if (ramped) {
    // the ramp: its top face on the line (rampFrom, 0) → (length, landY); pitched about the pier's across axis
    const run = length - rampFrom, drop = -landY, pitch = Math.atan2(drop, run), half = Math.hypot(run, drop) / 2, hy = 0.1;
    const sx = Math.sin(pitch / 2), cx = Math.cos(pitch / 2);
    // top-face centre, then down the box's own up axis ((0, cos, sin) along the pier) by its half thickness
    const along = (rampFrom + length) / 2, topY = landY / 2;
    const nAlong = Math.sin(pitch), nUp = Math.cos(pitch);
    out.push({ kind: 'box', x: 0, y: topY - hy * nUp, z: along - hy * nAlong, hx: halfW, hy, hz: half, rot: { x: sx, y: 0, z: 0, w: cx } });
    out.push(slab(length, length + 0.2, landY, 0.1));
  }
  return out;
}

/** The pre-bake post and bollard arithmetic, kept offline with the collider compiler. */
interface Collider { x:number;z:number;hw:number;hd:number;rot:number;yTop:number;yBottom:number }
function pierHalfWidthAt(p: PierParams, along: number): number {
  const sea = p.seaRamp, half = p.width / 2;
  if (sea === undefined || along >= sea.run) return half;
  const t = Math.max(0, along) / sea.run;
  return sea.flare / 2 + (half - sea.flare / 2) * t;
}

function pierBoxes(p: PierParams): Collider[] {
  const out: Collider[] = [];
  const postR = 0.17, postTop = 0.95;
  const rampFrom = p.landing?.rampFrom ?? p.length;
  for (let a = 1.2; a < rampFrom; a += 3.0) for (const s of [-1, 1]) out.push({ x: s * (pierHalfWidthAt(p, a) + 0.1), z: a, hw: postR + 0.04, hd: postR + 0.04, rot: 0, yTop: postTop, yBottom: -1 });
  for (const s of [-1, 1]) out.push({ x: s * (pierHalfWidthAt(p, 0.35) + 0.25), z: 0.35, hw: 0.32, hd: 0.32, rot: 0, yTop: 1.35, yBottom: -1 });
  if (p.landing) {
    const [gl, gr] = p.landing.postGround;
    for (const s of [-1, 1]) {
      const gy = s < 0 ? gl : gr, top = gy + 1.5;
      out.push({ x: s * (p.width / 2 + 0.3), z: p.length - 0.4, hw: 0.34, hd: 0.34, rot: 0, yTop: top, yBottom: gy - 1 });
    }
  }
  return out;
}

