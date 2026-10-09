/**
 * The Nalati dressing's one-off props (E306 / E315 second pass; were blocks of src/shards/nalati-grasslands/world/dressing/statics.ts,
 * verbatim): fallen spruce logs and bleached driftwood, stumps, ovoo cairns (a stone heap with a lashed pole bundle and
 * khadag ribbons), lone ribbon poles at the viewpoints, the timber gateway where the sky road tops out, and the camps'
 * loose clutter (firewood tipis, dung-cake stacks, chopping blocks with rounds, pots and a bucket, sacks, folded felts,
 * a kumis churn). The sky road's guard fences are the split-rail fence (./fence.ts).
 *
 * Each copy is painted into a kit of its own (a prop's own AO bake) and merged into the dressing's region meshes
 * (src/shards/nalati-grasslands/world/dressing/statics.ts: placed `drawnInto` them); the camps' clutter is one kit, one mesh. A copy
 * draws from its builder's shared rng stream (`rng`, in the old order: so the dressing is bit-identical; the Explorer's
 * specimen draws from its own kit's). The ribbons are the dressing's cloth. Collides: a log as the capsule it draws, an
 * ovoo's heap as a stone prism, a stump / a pole / a gatepost / the bigger clutter as a box (wood).
 */
import * as THREE from 'three';
import type { Rng } from '@wildshard/engine/core/rng';
import { defineModel } from '@wildshard/engine/models/model';
import type { ColliderDesc } from '@wildshard/engine/world/registry';
import { v3, logPainter, M } from '../world/paint';
import { pole, blob, lathe } from '@wildshard/engine/world/geometryKit';
import { painted, type Kit, type Paint } from '../world/painted';
import { prism, type Box } from '../world/solid';

const C = {
  bark: new THREE.Color('#5c4430'), barkGrey: new THREE.Color('#6f6353'), wood: new THREE.Color('#c9a878'),
  drift: new THREE.Color('#b9b1a4'), driftDark: new THREE.Color('#8f877a'),
  moss: new THREE.Color('#62772f'), lichen: new THREE.Color('#bfb06a'),
  stone: new THREE.Color('#99938a'), stoneLight: new THREE.Color('#b5ae9f'), stoneDark: new THREE.Color('#79756e'),
  pole: new THREE.Color('#8f836f'), dung: new THREE.Color('#6e573b'), dungLight: new THREE.Color('#8c7250'),
  clay: new THREE.Color('#a45a3a'), iron: new THREE.Color('#3a3634'), sack: new THREE.Color('#c8b48b'), rope: new THREE.Color('#6a5438'),
  feltRed: new THREE.Color('#b1301d'), feltCream: new THREE.Color('#efe2c2'), feltBlue: new THREE.Color('#2f4f86'), feltOrange: new THREE.Color('#d8782c'),
};
/** khadag / prayer-ribbon colours: sky blue and white first, then the five */
const RIBBONS = ['#6fb0e6', '#f3efe4', '#3f7fcf', '#f3efe4', '#d8402b', '#e8c23a', '#4f9a52', '#8cc2ea'];

type Ground = (x: number, z: number) => number;

/** a prop's params carry the stream its builder shared across props (absent: the kit's own, for the specimen) */
interface Streamed { readonly rng?: Rng }

const up = new THREE.Vector3(0, 1, 0), axis = new THREE.Vector3(), qLog = new THREE.Quaternion();

export interface LogParams extends Streamed {
  /** its ends, relative to the placement (normally the near end: 0, 0; see `logEnds`) */
  readonly ax: number;
  readonly az: number;
  readonly bx: number;
  readonly bz: number;
  readonly r: number;
  /** bleached driftwood on a gravel bar (else a fallen spruce, mossed) */
  readonly drift: boolean;
}

/**
 * A log's ends relative to its placement: it stands at its near end — unless the far end would not come back exactly
 * (a + (b − a) ≠ b in floating point), then at the world origin, its ends as they are: drawn bit-identically either way.
 */
export function logEnds(ax: number, az: number, bx: number, bz: number): { at: { x: number; z: number }; ends: { ax: number; az: number; bx: number; bz: number } } {
  if (ax + (bx - ax) === bx && az + (bz - az) === bz) return { at: { x: ax, z: az }, ends: { ax: 0, az: 0, bx: bx - ax, bz: bz - az } };
  return { at: { x: 0, z: 0 }, ends: { ax, az, bx, bz } };
}

/** a fallen log between its two ends, lying on the ground, broken branch stubs (driftwood: one forked limb) */
const logPaint: Paint<LogParams> = (kit, at, p, c) => {
  const rng = p.rng ?? kit.rng, ground = c.ground;
  const descs: ColliderDesc[] = [];
  const l = { ax: at.x + p.ax, az: at.z + p.az, bx: at.x + p.bx, bz: at.z + p.bz, r: p.r, drift: p.drift };
  const ya = ground(l.ax, l.az), yb = ground(l.bx, l.bz);
  const sink = l.drift ? 0.35 : 0.3;
  const a = v3(l.ax, ya + l.r * (1 - sink), l.az), b = v3(l.bx, yb + l.r * (1 - sink) * 0.85, l.bz);
  const bark = l.drift ? C.drift : rng.next() < 0.4 ? C.barkGrey : C.bark;
  kit.add(pole(a, b, l.r, l.r * 0.82, l.drift ? 6 : 9), logPainter(a, b, bark, l.drift ? C.driftDark : C.wood), { top: l.drift ? undefined : { color: C.moss, threshold: 0.72, amount: 0.55 }, brush: 0.12 });
  // P1: the log collides as the capsule it draws (it was a box to the ground)
  { const len = a.distanceTo(b); axis.subVectors(b, a).divideScalar(Math.max(1e-6, len)); qLog.setFromUnitVectors(up, axis);
    descs.push({ kind: 'capsule', x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, z: (a.z + b.z) / 2, halfHeight: Math.max(0.05, len / 2 - l.r), radius: l.r * 0.92, rot: { x: qLog.x, y: qLog.y, z: qLog.z, w: qLog.w }, surface: 'wood' }); }
  // broken branch stubs (driftwood: one forked limb)
  const n = l.drift ? 1 : rng.int(2, 4);
  for (let i = 0; i < n; i++) {
    const t = rng.range(0.2, 0.85), q = a.clone().lerp(b, t);
    const ang = rng.range(0, Math.PI * 2), len = l.drift ? rng.range(0.4, 0.9) : rng.range(0.25, 0.6);
    const dir = v3(Math.cos(ang), rng.range(0.1, 0.8), Math.sin(ang)).normalize();
    kit.add(pole(q, q.clone().addScaledVector(dir, len), l.r * 0.28, l.r * 0.12, 5), bark, { brush: 0.1 });
  }
  return { descs };
};

export interface StumpParams extends Streamed { readonly s: number }

/** a spruce stump with its roots spreading into the turf */
const stumpPaint: Paint<StumpParams> = (kit, at, p, c) => {
  const rng = p.rng ?? kit.rng;
  const s = { x: at.x, z: at.z, s: p.s };
  const y = c.ground(s.x, s.z) - 0.08, r = s.s, h = rng.range(0.35, 0.8);
  const g = lathe([[0.001, 0], [r * 1.45, 0], [r * 1.2, 0.1], [r * 1.02, 0.28], [r, h - 0.04], [r * 0.96, h], [r * 0.5, h + rng.range(0, 0.04)], [0.001, h]], 11);
  kit.add(g, (q, n) => (n.y > 0.75 && q.y > h - 0.1 ? (Math.hypot(q.x, q.z) < r * 0.35 ? C.bark : C.wood) : C.bark), { matrix: M(s.x, y, s.z, rng.range(0, 6)), top: { color: C.moss, threshold: 0.95, amount: 0.3 }, brush: 0.12 });
  for (let i = 0; i < 3; i++) {
    const a = rng.range(0, Math.PI * 2), p0 = v3(s.x + Math.cos(a) * r * 0.8, y + 0.2, s.z + Math.sin(a) * r * 0.8);
    kit.add(pole(p0, v3(s.x + Math.cos(a) * r * 2.3, y - 0.05, s.z + Math.sin(a) * r * 2.3), r * 0.28, r * 0.08, 5), C.bark);
  }
  return { boxes: [{ x: s.x, z: s.z, hw: r * 1.1, hd: r * 1.1, rot: 0, yBottom: y - 1, yTop: y + h }] };
};

export interface OvooParams extends Streamed { readonly s: number }

/** an ovoo cairn: a stone heap in rings, a lashed pole bundle, ribbons along the poles and on ropes to stakes round it */
const ovooPaint: Paint<OvooParams> = (kit, at, p, c) => {
  const rng = p.rng ?? kit.rng, ground = c.ground, flutter = c.flutter;
  const o = { x: at.x, z: at.z, s: p.s };
  const gy = ground(o.x, o.z), R = 1.35 * o.s, H = 1.15 * o.s;
  const stone = { top: { color: C.lichen, threshold: 0.55, amount: 0.4 }, brush: 0.12 };
  for (let ring = 0; ring < 5; ring++) {
    const t = ring / 4, rr = R * (1 - t * 0.85), yy = gy + H * t * 0.9;
    const n = Math.max(3, Math.round(rr * 6.5));
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + ring * 0.7 + rng.range(-0.2, 0.2), s = rng.range(0.2, 0.34) * o.s * (1 - t * 0.3);
      const x = o.x + Math.cos(a) * rr, z = o.z + Math.sin(a) * rr;
      const cc = rng.next() < 0.3 ? C.stoneLight : rng.next() < 0.5 ? C.stoneDark : C.stone;
      kit.add(blob(s, rng, 1, rng.range(0.6, 0.85), 0.25), cc, { ...stone, matrix: M(x, Math.max(yy, ground(x, z)) + s * 0.2, z, rng.range(0, 6)) });
    }
  }
  kit.add(blob(R * 0.8, rng, 2, (H / R) * 0.9, 0.2), C.stone, { matrix: M(o.x, gy - 0.1, o.z) });
  const descs = [prism(o.x, o.z, gy - 1, gy + H * 0.95, R * 0.95, 10, 0, 'stone', R * 0.3)];   // P1: the heap
  // the pole bundle
  const top = v3(o.x, gy + H + 1.9 * o.s, o.z);
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + rng.range(-0.3, 0.3);
    const b0 = v3(o.x + Math.cos(a) * 0.12, gy + H * 0.6, o.z + Math.sin(a) * 0.12);
    const t0 = top.clone().add(v3(Math.cos(a) * 0.35, rng.range(-0.3, 0.2), Math.sin(a) * 0.35));
    kit.add(pole(b0, t0, 0.045, 0.025, 5), C.pole, { brush: 0.1 });
    // ribbons tied along each pole and streaming from its head
    for (let k = 0; k < 3; k++) {
      const q = b0.clone().lerp(t0, 0.45 + k * 0.22);
      flutter.streamer(q, rng.range(0.9, 1.8), 0.14, RIBBONS[rng.int(0, RIBBONS.length - 1)] ?? '#f3efe4', { droop: 0.35 });
    }
  }
  // ropes of ribbons from the bundle down to stakes round the heap
  const a0 = rng.range(0, Math.PI * 2);
  for (let q = 0; q < 3; q++) {
    const sa = a0 + (q / 3) * Math.PI * 2 + rng.range(-0.3, 0.3), sx = o.x + Math.cos(sa) * (R + 1.8), sz = o.z + Math.sin(sa) * (R + 1.8), sy = ground(sx, sz);
    kit.add(pole(v3(sx, sy - 0.2, sz), v3(sx, sy + 0.55, sz), 0.035, 0.03, 5), C.pole);
    const from = top.clone().add(v3(Math.cos(sa) * 0.2, -0.3, Math.sin(sa) * 0.2)), to = v3(sx, sy + 0.5, sz);
    kit.add(pole(from, to, 0.008, 0.008, 3), C.rope);
    for (let k = 1; k < 10; k++) flutter.strip(from.clone().lerp(to, k / 10), rng.range(0.35, 0.6), 0.11, RIBBONS[(k + q * 3) % RIBBONS.length] ?? '#6fb0e6');
  }
  return { descs };
};

/** a lone ribbon pole at a viewpoint: a pole in a ring of stones, five streamers */
const viewpointPolePaint: Paint<Streamed> = (kit, at, p, c) => {
  const rng = p.rng ?? kit.rng, ground = c.ground;
  const q = { x: at.x, z: at.z };
  const gy = ground(q.x, q.z), H = rng.range(3.0, 3.8);
  const top = v3(q.x + rng.range(-0.1, 0.1), gy + H, q.z + rng.range(-0.1, 0.1));
  kit.add(pole(v3(q.x, gy - 0.3, q.z), top, 0.06, 0.04, 6), C.pole, { brush: 0.1, foot: 0.7 });
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2, s = rng.range(0.14, 0.24), x = q.x + Math.cos(a) * 0.35, z = q.z + Math.sin(a) * 0.35;
    kit.add(blob(s, rng, 1, 0.7, 0.25), rng.next() < 0.5 ? C.stone : C.stoneLight, { matrix: M(x, ground(x, z) + s * 0.2, z, rng.range(0, 6)), top: { color: C.lichen, threshold: 0.6, amount: 0.4 } });
  }
  for (let k = 0; k < 5; k++) c.flutter.streamer(top.clone().add(v3(0, -0.08 - k * 0.1, 0)), rng.range(1.0, 1.9), 0.08, RIBBONS[(k + rng.int(0, 7)) % RIBBONS.length] ?? '#f3efe4', { droop: 0.3 });
  return { boxes: [{ x: q.x, z: q.z, hw: 0.45, hd: 0.45, rot: 0, yBottom: gy - 1, yTop: gy + H }] };
};

/** the gateway where the sky road tops out: two stout posts either side of the road (`at.yaw` = the road's), a lintel,
 *  a rail under it, ribbons tied along it, stones round the feet */
const gatewayPaint: Paint<Streamed> = (kit, at, p, c) => {
  const rng = p.rng ?? kit.rng, ground = c.ground;
  const g = { x: at.x, z: at.z, yaw: at.yaw };
  const boxes: Box[] = [];
  const cx = Math.cos(g.yaw), sx = -Math.sin(g.yaw);   // across the road
  const half = 4.2, H = 3.6;
  const pa = v3(g.x + cx * half, 0, g.z + sx * half), pb = v3(g.x - cx * half, 0, g.z - sx * half);
  pa.y = ground(pa.x, pa.z); pb.y = ground(pb.x, pb.z);
  const top = Math.max(pa.y, pb.y) + H;
  for (const q of [pa, pb]) {
    kit.add(pole(v3(q.x, q.y - 0.4, q.z), v3(q.x, top + 0.25, q.z), 0.16, 0.13, 8), C.pole, { brush: 0.12, foot: 0.7 });
    boxes.push({ x: q.x, z: q.z, hw: 0.25, hd: 0.25, rot: 0, yBottom: q.y - 1, yTop: top });
    for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2, r = rng.range(0.16, 0.24); const x = q.x + Math.cos(a) * 0.4, z = q.z + Math.sin(a) * 0.4; kit.add(blob(r, rng, 1, 0.7, 0.25), C.stone, { matrix: M(x, ground(x, z) + r * 0.2, z, rng.range(0, 6)), top: { color: C.lichen, threshold: 0.6, amount: 0.4 } }); }
  }
  const la = v3(pa.x + cx * 0.5, top, pa.z + sx * 0.5), lb = v3(pb.x - cx * 0.5, top, pb.z - sx * 0.5);
  kit.add(pole(la, lb, 0.13, 0.13, 8), logPainter(la, lb, C.pole, C.wood), { brush: 0.12 });
  kit.add(pole(v3(la.x, top - 0.45, la.z).lerp(v3(lb.x, top - 0.45, lb.z), 0.08), v3(la.x, top - 0.45, la.z).lerp(v3(lb.x, top - 0.45, lb.z), 0.92), 0.06, 0.06, 6), C.pole);
  for (let k = 1; k < 14; k++) c.flutter.strip(la.clone().lerp(lb, k / 14).add(v3(0, -0.1, 0)), rng.range(0.5, 0.9), 0.11, RIBBONS[k % RIBBONS.length] ?? '#6fb0e6');
  return { boxes };
};

/** the camps' loose clutter: 0 firewood tipi · 1 dung-cake stack · 2 chopping block + rounds · 3 pots + bucket · 4 sacks · 5 folded felts · 6 kumis churn */
export const CLUTTER_KINDS = ['Firewood tipi', 'Dung-cake stack', 'Chopping block', 'Pots and a bucket', 'Sacks', 'Folded felts', 'Kumis churn'] as const;

export interface ClutterParams extends Streamed { readonly kind: number }

const clutterPaint: Paint<ClutterParams> = (kit, at, p, c) => {
  const rng = p.rng ?? kit.rng;
  const gy = c.ground(at.x, at.z);
  clutter(kit, rng, c.ground, p.kind, at.x, gy, at.z, at.yaw);
  return p.kind === 0 || p.kind === 1 || p.kind === 6 ? { boxes: [{ x: at.x, z: at.z, hw: 0.55, hd: 0.55, rot: 0, yBottom: gy - 1, yTop: gy + 1.2 }] } : {};
};

/** one loose-clutter group at (x, y, z): 0 firewood tipi · 1 dung-cake stack · 2 chopping block + rounds · 3 pots + bucket · 4 sacks · 5 folded felts · 6 kumis churn */
function clutter(kit: Kit, rng: Rng, ground: Ground, kind: number, x: number, y: number, z: number, yaw: number): void {
  const at = (dx: number, dz: number) => { const c = Math.cos(yaw), s = Math.sin(yaw); const wx = x + dx * c + dz * s, wz = z - dx * s + dz * c; return { x: wx, z: wz, y: ground(wx, wz) }; };
  switch (kind) {
    case 0: { // firewood leaned into a tipi, a few splits on the ground
      const top = v3(x, y + 1.25, z);
      for (let i = 0; i < 11; i++) {
        const a = (i / 11) * Math.PI * 2 + rng.range(-0.15, 0.15), r = rng.range(0.45, 0.62);
        const b = v3(x + Math.cos(a) * r, y - 0.05, z + Math.sin(a) * r);
        kit.add(pole(b, top.clone().add(v3(rng.range(-0.08, 0.08), rng.range(-0.15, 0.1), rng.range(-0.08, 0.08))), rng.range(0.03, 0.05), 0.025, 5), rng.next() < 0.5 ? C.bark : C.barkGrey, { brush: 0.12 });
      }
      for (let i = 0; i < 3; i++) { const p = at(rng.range(0.9, 1.5), rng.range(-0.6, 0.6)); const a = rng.range(0, 6); const b0 = v3(p.x - Math.cos(a) * 0.35, p.y + 0.05, p.z - Math.sin(a) * 0.35), b1 = v3(p.x + Math.cos(a) * 0.35, p.y + 0.05, p.z + Math.sin(a) * 0.35); kit.add(pole(b0, b1, 0.06, 0.06, 5), logPainter(b0, b1, C.bark, C.wood)); }
      break;
    }
    case 1: { // tezek: dried dung cakes stacked into a round pile
      for (let i = 0; i < 9; i++) {
        const rr = 0.42 - i * 0.03;
        kit.add(new THREE.CylinderGeometry(rr, rr + 0.02, 0.1, 10, 1), i % 2 === 0 ? C.dung : C.dungLight, { matrix: M(x + rng.range(-0.03, 0.03), y + i * 0.095, z + rng.range(-0.03, 0.03), rng.range(0, 6), 1, 1, 1, rng.range(-0.06, 0.06), rng.range(-0.06, 0.06)), brush: 0.18 });
      }
      break;
    }
    case 2: { // chopping block, an axe in it, rounds lying about
      kit.add(new THREE.CylinderGeometry(0.28, 0.3, 0.5, 10, 1), (_p, n) => (n.y > 0.7 ? C.wood : C.bark), { matrix: M(x, y, z, yaw).multiply(M(0, 0.25, 0)) });
      const hb = v3(x + 0.05, y + 0.52, z), ht = v3(x + 0.25, y + 1.05, z + 0.1);
      kit.add(pole(hb, ht, 0.022, 0.02, 5), C.wood);
      kit.add(new THREE.BoxGeometry(0.2, 0.08, 0.03), C.iron, { matrix: M(x, y + 0.53, z, 0.4), flat: true });
      for (let i = 0; i < 4; i++) { const p = at(rng.range(-1.2, 1.2), rng.range(0.6, 1.3)); kit.add(new THREE.CylinderGeometry(0.2, 0.2, 0.34, 9, 1), (_q, n) => (Math.abs(n.y) > 0.7 ? C.wood : C.bark), { matrix: M(p.x, p.y + 0.12, p.z, rng.range(0, 6), 1, 1, 1, rng.next() < 0.5 ? Math.PI / 2 : 0) }); }
      break;
    }
    case 3: { // clay pots + a banded wooden bucket
      for (let i = 0; i < 3; i++) {
        const p = at(rng.range(-0.7, 0.7), rng.range(-0.5, 0.5));
        kit.add(lathe([[0.001, 0], [0.14, 0], [0.22, 0.14], [0.2, 0.3], [0.12, 0.38], [0.14, 0.42], [0.12, 0.43], [0.001, 0.36]], 12), C.clay, { matrix: M(p.x, p.y - 0.02, p.z, 0, rng.range(0.8, 1.2)), brush: 0.1 });
      }
      const b = at(0.9, 0.3);
      kit.add(lathe([[0.001, 0], [0.19, 0], [0.23, 0.42], [0.21, 0.42], [0.001, 0.36]], 12), (p) => (Math.abs(p.y - 0.08) < 0.03 || Math.abs(p.y - 0.34) < 0.03 ? C.iron : C.bark), { matrix: M(b.x, b.y - 0.02, b.z) });
      break;
    }
    case 4: { // grain / wool sacks slumped together
      for (let i = 0; i < 3; i++) {
        const p = at(i * 0.36 - 0.36, rng.range(-0.12, 0.12));
        kit.add(blob(0.22, rng, 2, 1.3, 0.12), C.sack, { matrix: M(p.x, p.y + 0.2, p.z, rng.range(0, 6), 1, 1, 0.85, rng.range(-0.2, 0.2), rng.range(-0.25, 0.25)), brush: 0.12 });
        kit.add(new THREE.CylinderGeometry(0.04, 0.05, 0.08, 6), C.rope, { matrix: M(p.x, p.y + 0.48, p.z) });
      }
      break;
    }
    case 6: { // a kumis churn: a tall staved tub with iron hoops, a dasher standing in it, a leather lid
      kit.add(lathe([[0.001, 0], [0.24, 0], [0.26, 0.05], [0.24, 0.62], [0.2, 0.86], [0.21, 0.9], [0.001, 0.88]], 14), (p) => (Math.abs(p.y - 0.12) < 0.03 || Math.abs(p.y - 0.72) < 0.03 ? C.iron : p.y > 0.86 ? C.sack : C.bark), { matrix: M(x, y - 0.03, z, yaw), brush: 0.12 });
      const top = v3(x + 0.04, y + 1.45, z), base = v3(x, y + 0.6, z);
      kit.add(pole(base, top, 0.022, 0.02, 5), C.wood);
      kit.add(new THREE.CylinderGeometry(0.1, 0.1, 0.03, 8), C.wood, { matrix: M(x + 0.04, y + 1.4, z) });
      const b = at(0.55, 0.2);
      kit.add(lathe([[0.001, 0], [0.13, 0], [0.16, 0.26], [0.001, 0.22]], 10), C.bark, { matrix: M(b.x, b.y - 0.02, b.z) });
      break;
    }
    default: { // folded felts stacked on a low stand
      const cols = [C.feltRed, C.feltCream, C.feltBlue, C.feltOrange];
      kit.add(new THREE.BoxGeometry(1.2, 0.18, 0.8), C.bark, { matrix: M(x, y + 0.09, z, yaw), flat: true });
      for (let i = 0; i < 4; i++) kit.add(new THREE.BoxGeometry(1.05 - i * 0.05, 0.13, 0.7 - i * 0.03), cols[i % cols.length] ?? C.feltRed, { matrix: M(x + rng.range(-0.04, 0.04), y + 0.25 + i * 0.13, z, yaw + rng.range(-0.08, 0.08)), flat: true, brush: 0.1 });
      break;
    }
  }
}

// ── the models ────────────────────────────────────────────────────────────────────────────────────────────────────

const FILE = 'src/shards/nalati-grasslands/models/dressingProps.ts';

export const fallenLog = defineModel<LogParams>({
  id: 'nalati-grasslands/fallen-log', name: 'Fallen log', category: 'nature', pipeline: 'code', file: FILE, surface: 'wood',
  defaults: { ax: 0, az: 0, bx: 4.5, bz: 1.2, r: 0.3, drift: false },
  variants: [{ id: 'spruce', label: 'Spruce', params: {} }, { id: 'driftwood', label: 'Driftwood', params: { drift: true, r: 0.22 } }],
  build: painted(logPaint, { seed: 0xd701, finish: { aoH: 0.3, aoMin: 0.6, ao: false } }),
});
export const stump = defineModel<StumpParams>({
  id: 'nalati-grasslands/stump', name: 'Spruce stump', category: 'nature', pipeline: 'code', file: FILE, surface: 'wood',
  defaults: { s: 0.3 }, build: painted(stumpPaint, { seed: 0xd702, finish: { aoH: 0.35, ao: false } }),
});
export const ovoo = defineModel<OvooParams>({
  id: 'nalati-grasslands/ovoo', name: 'Ovoo cairn', category: 'props', pipeline: 'code', file: FILE, surface: 'stone',
  defaults: { s: 1 }, build: painted(ovooPaint, { seed: 0xd703, finish: { aoH: 0.4, ao: { strength: 0.5 } } }),
});
export const viewpointPole = defineModel<Streamed>({
  id: 'nalati-grasslands/viewpoint-pole', name: 'Viewpoint ribbon pole', category: 'props', pipeline: 'code', file: FILE, surface: 'wood',
  defaults: {}, build: painted(viewpointPolePaint, { seed: 0xd704, finish: { aoH: 0.3, ao: false } }),
});
export const skyGateway = defineModel<Streamed>({
  id: 'nalati-grasslands/sky-gateway', name: 'Sky road gateway', category: 'props', pipeline: 'code', file: FILE, surface: 'wood',
  defaults: {}, build: painted(gatewayPaint, { seed: 0xd705, finish: { aoH: 0.4, ao: false } }),
});
export const campClutter = defineModel<ClutterParams>({
  id: 'nalati-grasslands/camp-clutter', name: 'Camp clutter', category: 'props', pipeline: 'code', file: FILE, surface: 'wood',
  defaults: { kind: 0 },
  variants: CLUTTER_KINDS.map((label, kind) => ({ id: label.toLowerCase().replaceAll(' ', '-'), label, params: { kind } })),
  build: painted(clutterPaint, { seed: 0xc1a8, finish: { aoH: 0.35, ao: { strength: 0.45 } } }),
});
