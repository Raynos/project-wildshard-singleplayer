/**
 * Driftwood's herring gull (runtime/world/Gulls.ts, the GULL_FLOCK row on @wildshard/sdk/looks/ambientFlock), built offline: one faceted, flat-shaded,
 * vertex-coloured gull in its palette (generators/gullsLook.ts) about the graph rig's joints (data/gullGraphLook.ts), each
 * vertex tagged with the part (`aPart`) the graph turns. The flock draws it as the fixed-model template `gull`, loaded
 * through the shard's geometry intake; the flap, head, fold and legs stay posed on the GPU from `aAnim`.
 */
import * as THREE from 'three';
import { Rng } from '@wildshard/engine/core/rng';
import { GULL_RIG } from '../data/gullGraphLook';
import { GULL_PALETTE } from './gullsLook';

/** vertex part ids (aPart): what the vertex shader rotates */
const PART = { body: 0, wingL: 1, wingR: 2, head: 3, legL: 4, legR: 5 } as const;
/** pivots, gull-local (forward = +z, up = +y, right = +x) — the graph's rig turns about the same joints */
type Vec3 = readonly [number, number, number];
const { shoulderX: SHOULDER_X, shoulderY: SHOULDER_Y, elbowX: ELBOW_X } = GULL_RIG;

/** one gull, gull-local, at ~0.65 m wingspan (the flock scales its instances) */
export function gullGeometry(): THREE.BufferGeometry {
  const p0 = GULL_PALETTE;
  const C = {
    white: new THREE.Color(p0.white), belly: new THREE.Color(p0.belly), grey: new THREE.Color(p0.grey), greyDark: new THREE.Color(p0.greyDark),
    tip: new THREE.Color(p0.tip), beak: new THREE.Color(p0.beak), leg: new THREE.Color(p0.leg), eye: new THREE.Color(p0.eye),
  };
  const pos: number[] = [], col: number[] = [], part: number[] = [];
  const rng = new Rng(0x9011);
  const tri = (a: Vec3, b: Vec3, c: Vec3, colour: THREE.Color, p: number, jitter = 0.05) => {
    pos.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
    const k = 1 - jitter + rng.next() * jitter * 2;
    for (let i = 0; i < 3; i++) { col.push(colour.r * k, colour.g * k, colour.b * k); part.push(p); }
  };
  const quad = (a: Vec3, b: Vec3, c: Vec3, d: Vec3, colour: THREE.Color, p: number, jitter = 0.05) => { tri(a, b, c, colour, p, jitter); tri(a, c, d, colour, p, jitter); };

  // body: a lofted 6-sided fuselage, tail point → 3 rings → nose point. Grey back, white flanks / belly.
  interface Ring { z: number; rx: number; ry: number; y: number }
  const rings: readonly [Ring, Ring, Ring] = [
    { z: -0.17, rx: 0.05, ry: 0.035, y: 0.02 }, { z: -0.02, rx: 0.1, ry: 0.09, y: 0.0 }, { z: 0.11, rx: 0.085, ry: 0.08, y: 0.005 },
  ];
  const sides = 6;
  const ringPt = (r: Ring, k: number): Vec3 => { const a = (k / sides) * Math.PI * 2 + Math.PI / 6; return [Math.cos(a) * r.rx, r.y + Math.sin(a) * r.ry, r.z]; };
  const bodyCol = (k: number) => { const a = (k + 0.5) / sides * Math.PI * 2 + Math.PI / 6; return Math.sin(a) > 0.35 ? C.grey : Math.sin(a) < -0.5 ? C.belly : C.white; };
  const tail: Vec3 = [0, 0.03, -0.31], nose: Vec3 = [0, 0.03, 0.2];
  for (let k = 0; k < sides; k++) {
    const k1 = (k + 1) % sides;
    tri(tail, ringPt(rings[0], k1), ringPt(rings[0], k), bodyCol(k), PART.body);
    for (let r = 0; r < rings.length - 1; r++) {
      const r0 = rings[r], r1 = rings[r + 1];
      if (r0 === undefined || r1 === undefined) continue;
      quad(ringPt(r0, k), ringPt(r0, k1), ringPt(r1, k1), ringPt(r1, k), bodyCol(k), PART.body);
    }
    tri(ringPt(rings[2], k), ringPt(rings[2], k1), nose, bodyCol(k), PART.body);
  }
  // tail fan: a flat wedge behind the tail point
  quad([-0.07, 0.03, -0.36], [0.07, 0.03, -0.36], [0.04, 0.03, -0.2], [-0.04, 0.03, -0.2], C.white, PART.body);
  // head: an icosahedron on the neck, a black eye-facet either side, a wedge beak
  {
    const g = new THREE.IcosahedronGeometry(0.058, 0);
    const p = g.getAttribute('position');
    const hc: Vec3 = [0, 0.11, 0.2];
    for (let i = 0; i < p.count; i += 3) {
      const a: Vec3 = [p.getX(i) + hc[0], p.getY(i) * 0.9 + hc[1], p.getZ(i) * 1.1 + hc[2]];
      const b: Vec3 = [p.getX(i + 1) + hc[0], p.getY(i + 1) * 0.9 + hc[1], p.getZ(i + 1) * 1.1 + hc[2]];
      const c: Vec3 = [p.getX(i + 2) + hc[0], p.getY(i + 2) * 0.9 + hc[1], p.getZ(i + 2) * 1.1 + hc[2]];
      const mx = (a[0] + b[0] + c[0]) / 3 - hc[0], mz = (a[2] + b[2] + c[2]) / 3 - hc[2], my = (a[1] + b[1] + c[1]) / 3 - hc[1];
      const eye = Math.abs(mx) > 0.035 && mz > 0.015 && my > -0.01 && my < 0.04;
      tri(a, b, c, eye ? C.eye : C.white, PART.head, 0.04);
    }
    const bb: Vec3 = [0, 0.1, 0.245], bt: Vec3 = [0, 0.085, 0.345];
    tri([-0.018, bb[1] + 0.012, bb[2]], [0.018, bb[1] + 0.012, bb[2]], bt, C.beak, PART.head, 0.02);
    tri([0.018, bb[1] + 0.012, bb[2]], [0.0, bb[1] - 0.02, bb[2]], bt, C.beak, PART.head, 0.02);
    tri([0.0, bb[1] - 0.02, bb[2]], [-0.018, bb[1] + 0.012, bb[2]], bt, C.beak, PART.head, 0.02);
  }
  // wings: inner panel shoulder→elbow, outer panel elbow→hand, black tip; swept back toward the tip
  for (const side of [-1, 1]) {
    const p = side < 0 ? PART.wingL : PART.wingR;
    const sx = SHOULDER_X * side, ex = ELBOW_X * side, hx = 0.56 * side, tx = 0.72 * side, y = SHOULDER_Y;
    // broad chunky wings (the mockups' birds): a 0.26 chord at the root, the hand swept back to a 0.1 tip
    quad([sx, y, -0.14], [sx, y, 0.12], [ex, y + 0.01, 0.1], [ex, y + 0.01, -0.12], C.grey, p, 0.04);
    quad([ex, y + 0.01, -0.12], [ex, y + 0.01, 0.1], [hx, y + 0.005, 0.04], [hx, y + 0.005, -0.15], C.greyDark, p, 0.04);
    quad([hx, y + 0.005, -0.15], [hx, y + 0.005, 0.04], [tx, y, -0.08], [tx, y, -0.18], C.tip, p, 0.06);
  }
  // legs: two orange sticks from the hip; the feet a small wedge
  for (const side of [-1, 1]) {
    const p = side < 0 ? PART.legL : PART.legR, x = 0.03 * side;
    quad([x - 0.008, -0.05, 0.0], [x + 0.008, -0.05, 0.0], [x + 0.008, -0.17, 0.01], [x - 0.008, -0.17, 0.01], C.leg, p, 0.03);
    tri([x - 0.03, -0.17, 0.05], [x + 0.03, -0.17, 0.05], [x, -0.17, -0.02], C.leg, p, 0.03);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.setAttribute('aPart', new THREE.Float32BufferAttribute(part, 1));
  return geo;
}
