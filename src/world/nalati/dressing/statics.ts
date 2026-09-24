/**
 * The dressing's one-off props, merged (PaintKit, the shared POI material): fallen spruce logs and stumps round the
 * gullies, bleached driftwood on the gravel bars, ovoo cairns (stone heaps with a pole bundle and khadag ribbons) and
 * lone ribbon poles at the viewpoints, and the loose clutter round the camps (firewood tipis, dung-cake stacks,
 * chopping blocks with log rounds, pots and buckets, sacks, folded felts).
 *
 * Merged into four region meshes (valley / plateau × east / west) so the frustum still drops the ones behind you;
 * the ribbons go into the dressing's own `Flutter` (one cloth draw for all of them).
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { Rng } from '../../../core/rng';
import { heightAt } from '../../Heightfield';
import { PaintKit, pole, v3, blob, lathe, logPainter, poiMaterial, M } from '../paint';
import type { Flutter } from '../Flutter';
import type { Sky } from '../../Sky';
import type { Collider } from '../../../player/Player';
import type { ColliderDesc } from '../../registry';
import { prism } from '../solid';
import { addFence } from '../props';
import { campClutterSpots, type DressPlan } from './place';

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
const ground: Ground = (x, z) => heightAt(x, z);

export interface Statics { meshes: THREE.Mesh[]; tris: number; colliders: Collider[]; descs: ColliderDesc[] }

export function buildStatics(sky: Sky, plan: DressPlan, flutter: Flutter): Statics {
  const regions = new Map<number, THREE.BufferGeometry[]>();
  const put = (x: number, z: number, g: THREE.BufferGeometry) => {
    const k = (x < 0 ? 0 : 1) + (z > 60 ? 2 : 0);
    let list = regions.get(k); if (!list) regions.set(k, (list = []));
    list.push(g);
  };
  const colliders: Collider[] = [];
  const descs: ColliderDesc[] = [];
  const rng = new Rng(0x0d7e);
  const up = new THREE.Vector3(0, 1, 0), axis = new THREE.Vector3(), qLog = new THREE.Quaternion();

  // ── logs + driftwood (no AO bake: a lone log has nothing to occlude it; the contact shade does the foot) ──
  for (const l of plan.logs) {
    const kit = new PaintKit(rng.int(1, 1e6));
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
      const t = rng.range(0.2, 0.85), p = a.clone().lerp(b, t);
      const ang = rng.range(0, Math.PI * 2), len = l.drift ? rng.range(0.4, 0.9) : rng.range(0.25, 0.6);
      const dir = v3(Math.cos(ang), rng.range(0.1, 0.8), Math.sin(ang)).normalize();
      kit.add(pole(p, p.clone().addScaledVector(dir, len), l.r * 0.28, l.r * 0.12, 5), bark, { brush: 0.1 });
    }
    put((l.ax + l.bx) / 2, (l.az + l.bz) / 2, kit.finish({ ground, aoH: 0.3, aoMin: 0.6, ao: false }));
  }

  // ── stumps ──
  for (const s of plan.stumps) {
    const kit = new PaintKit(rng.int(1, 1e6));
    const y = ground(s.x, s.z) - 0.08, r = s.s, h = rng.range(0.35, 0.8);
    const g = lathe([[0.001, 0], [r * 1.45, 0], [r * 1.2, 0.1], [r * 1.02, 0.28], [r, h - 0.04], [r * 0.96, h], [r * 0.5, h + rng.range(0, 0.04)], [0.001, h]], 11);
    kit.add(g, (p, n) => (n.y > 0.75 && p.y > h - 0.1 ? (Math.hypot(p.x, p.z) < r * 0.35 ? C.bark : C.wood) : C.bark), { matrix: M(s.x, y, s.z, rng.range(0, 6)), top: { color: C.moss, threshold: 0.95, amount: 0.3 }, brush: 0.12 });
    for (let i = 0; i < 3; i++) {
      const a = rng.range(0, Math.PI * 2), p0 = v3(s.x + Math.cos(a) * r * 0.8, y + 0.2, s.z + Math.sin(a) * r * 0.8);
      kit.add(pole(p0, v3(s.x + Math.cos(a) * r * 2.3, y - 0.05, s.z + Math.sin(a) * r * 2.3), r * 0.28, r * 0.08, 5), C.bark);
    }
    put(s.x, s.z, kit.finish({ ground, aoH: 0.35, ao: false }));
    colliders.push({ x: s.x, z: s.z, hw: r * 1.1, hd: r * 1.1, rot: 0, yBottom: y - 1, yTop: y + h });
  }

  // ── ovoo cairns: a stone heap, a lashed pole bundle, ribbons ──
  for (const o of plan.ovoos) {
    const kit = new PaintKit(rng.int(1, 1e6));
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
    descs.push(prism(o.x, o.z, gy - 1, gy + H * 0.95, R * 0.95, 10, 0, 'stone', R * 0.3));   // P1: the heap
    // the pole bundle
    const top = v3(o.x, gy + H + 1.9 * o.s, o.z);
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + rng.range(-0.3, 0.3);
      const b0 = v3(o.x + Math.cos(a) * 0.12, gy + H * 0.6, o.z + Math.sin(a) * 0.12);
      const t0 = top.clone().add(v3(Math.cos(a) * 0.35, rng.range(-0.3, 0.2), Math.sin(a) * 0.35));
      kit.add(pole(b0, t0, 0.045, 0.025, 5), C.pole, { brush: 0.1 });
      // ribbons tied along each pole and streaming from its head
      for (let k = 0; k < 3; k++) {
        const p = b0.clone().lerp(t0, 0.45 + k * 0.22);
        flutter.streamer(p, rng.range(0.9, 1.8), 0.14, RIBBONS[rng.int(0, RIBBONS.length - 1)] ?? '#f3efe4', { droop: 0.35 });
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
    put(o.x, o.z, kit.finish({ ground, aoH: 0.4, ao: { strength: 0.5 } }));
  }

  // ── lone ribbon poles ──
  for (const p of plan.poles) {
    const kit = new PaintKit(rng.int(1, 1e6));
    const gy = ground(p.x, p.z), H = rng.range(3.0, 3.8);
    const top = v3(p.x + rng.range(-0.1, 0.1), gy + H, p.z + rng.range(-0.1, 0.1));
    kit.add(pole(v3(p.x, gy - 0.3, p.z), top, 0.06, 0.04, 6), C.pole, { brush: 0.1, foot: 0.7 });
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2, s = rng.range(0.14, 0.24), x = p.x + Math.cos(a) * 0.35, z = p.z + Math.sin(a) * 0.35;
      kit.add(blob(s, rng, 1, 0.7, 0.25), rng.next() < 0.5 ? C.stone : C.stoneLight, { matrix: M(x, ground(x, z) + s * 0.2, z, rng.range(0, 6)), top: { color: C.lichen, threshold: 0.6, amount: 0.4 } });
    }
    for (let k = 0; k < 5; k++) flutter.streamer(top.clone().add(v3(0, -0.08 - k * 0.1, 0)), rng.range(1.0, 1.9), 0.08, RIBBONS[(k + rng.int(0, 7)) % RIBBONS.length] ?? '#f3efe4', { droop: 0.3 });
    put(p.x, p.z, kit.finish({ ground, aoH: 0.3, ao: false }));
    colliders.push({ x: p.x, z: p.z, hw: 0.45, hd: 0.45, rot: 0, yBottom: gy - 1, yTop: gy + H });
  }

  // ── the sky road's guard fences (the POI fence builder) + the gateway on the rim ──
  for (const run of plan.fences) {
    const kit = new PaintKit(rng.int(1, 1e6));
    addFence(kit, ground, run, colliders, { h: 1.05, spacing: 2.6 });
    const mid = run[Math.floor(run.length / 2)] ?? [0, 0];
    put(mid[0], mid[1], kit.finish({ ground, aoH: 0.3, ao: false }));
  }
  for (const g of plan.gates) {
    const kit = new PaintKit(rng.int(1, 1e6));
    // two stout posts either side of the road, a lintel with a carved cap, ribbons tied along it
    const cx = Math.cos(g.yaw), sx = -Math.sin(g.yaw);   // across the road
    const half = 4.2, H = 3.6;
    const pa = v3(g.x + cx * half, 0, g.z + sx * half), pb = v3(g.x - cx * half, 0, g.z - sx * half);
    pa.y = ground(pa.x, pa.z); pb.y = ground(pb.x, pb.z);
    const top = Math.max(pa.y, pb.y) + H;
    for (const p of [pa, pb]) {
      kit.add(pole(v3(p.x, p.y - 0.4, p.z), v3(p.x, top + 0.25, p.z), 0.16, 0.13, 8), C.pole, { brush: 0.12, foot: 0.7 });
      colliders.push({ x: p.x, z: p.z, hw: 0.25, hd: 0.25, rot: 0, yBottom: p.y - 1, yTop: top });
      for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2, r = rng.range(0.16, 0.24); const x = p.x + Math.cos(a) * 0.4, z = p.z + Math.sin(a) * 0.4; kit.add(blob(r, rng, 1, 0.7, 0.25), C.stone, { matrix: M(x, ground(x, z) + r * 0.2, z, rng.range(0, 6)), top: { color: C.lichen, threshold: 0.6, amount: 0.4 } }); }
    }
    const la = v3(pa.x + cx * 0.5, top, pa.z + sx * 0.5), lb = v3(pb.x - cx * 0.5, top, pb.z - sx * 0.5);
    kit.add(pole(la, lb, 0.13, 0.13, 8), logPainter(la, lb, C.pole, C.wood), { brush: 0.12 });
    kit.add(pole(v3(la.x, top - 0.45, la.z).lerp(v3(lb.x, top - 0.45, lb.z), 0.08), v3(la.x, top - 0.45, la.z).lerp(v3(lb.x, top - 0.45, lb.z), 0.92), 0.06, 0.06, 6), C.pole);
    for (let k = 1; k < 14; k++) flutter.strip(la.clone().lerp(lb, k / 14).add(v3(0, -0.1, 0)), rng.range(0.5, 0.9), 0.11, RIBBONS[k % RIBBONS.length] ?? '#6fb0e6');
    put(g.x, g.z, kit.finish({ ground, aoH: 0.4, ao: false }));
  }

  const meshes: THREE.Mesh[] = [];
  let tris = 0;
  for (const [k, list] of regions) {
    if (list.length === 0) continue;
    const geo = mergeGeometries(list, false);
    for (const g of list) g.dispose();
    geo.computeBoundingSphere();
    const m = new THREE.Mesh(geo, poiMaterial(sky));
    m.name = `nalati-dress-props-${k}`;
    m.castShadow = true; m.receiveShadow = true;
    meshes.push(m);
    tris += geo.getAttribute('position').count / 3;
  }
  return { meshes, tris, colliders, descs };
}

/**
 * The camps' loose clutter as one merged mesh. Built after the POIs are in (`avoid` = the player's colliders then, the
 * POI agent's set pieces among them), so nothing lands inside a stove, a cart or a rug rack.
 */
export function buildCampClutter(sky: Sky, avoid: readonly Collider[]): { mesh: THREE.Mesh | null; colliders: Collider[]; tris: number; spots: number } {
  const rng = new Rng(0xc1a7);
  const kit = new PaintKit(0xc1a8);
  const colliders: Collider[] = [];
  const spots = campClutterSpots(avoid);
  for (const s of spots) {
    const gy = ground(s.x, s.z);
    clutter(kit, rng, s.kind, s.x, gy, s.z, s.yaw);
    if (s.kind === 0 || s.kind === 1 || s.kind === 6) colliders.push({ x: s.x, z: s.z, hw: 0.55, hd: 0.55, rot: 0, yBottom: gy - 1, yTop: gy + 1.2 });
  }
  if (kit.empty) return { mesh: null, colliders, tris: 0, spots: 0 };
  const mesh = kit.mesh(sky, { ground, aoH: 0.35, ao: { strength: 0.45 } });
  mesh.name = 'nalati-dress-camp-clutter';
  return { mesh, colliders, tris: mesh.geometry.getAttribute('position').count / 3, spots: spots.length };
}

/** one loose-clutter group at (x, y, z): 0 firewood tipi · 1 dung-cake stack · 2 chopping block + rounds · 3 pots + bucket · 4 sacks · 5 folded felts · 6 kumis churn */
function clutter(kit: PaintKit, rng: Rng, kind: number, x: number, y: number, z: number, yaw: number): void {
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
