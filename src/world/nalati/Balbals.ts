/**
 * Balbals — the Turkic stone warriors (6th–8th c. kurgan stelae, the Xiaohongnahai stone man): a granite pillar
 * carved into a man holding a cup to his chest with the right hand, the left on a sabre hilt at the belt, a heavy
 * brow, a drooping moustache; lichen on the weathered tops. Static for now — B11 wakes them at dusk.
 *
 * Two carved variants (bare-headed / a pointed cap), each ONE InstancedMesh on the shared painterly material, so the
 * whole shard's balbals (the ring of 9 on the knoll + the ones on kurgan crowns) are two draw calls.
 *
 *   const balbals = buildBalbals(ctx, spots);           // spots: { x, z, yaw }[]  (yaw: the way it faces, 0 = −z)
 *   balbals.statues[i] → { x, y, z, yaw, scale, collider }
 *   balbals.setAwake(i, true)   // B11: hide statue i (the live warrior takes its place) — its collider is disabled too
 *   balbals.setAwake(i, false)  // back to stone
 *
 * Also exports `balbalGeometry(variant)` (feet at y 0, facing −z, 2.1 m) for B11's rig to reuse.
 */
import * as THREE from 'three';
import { PaintKit, M, pole, v3, poiMaterial } from './paint';
import { Noise2D } from '../../core/noise';
import type { Collider } from '../../player/Player';
import type { PoiCtx, PoiPiece } from './types';

const C = {
  stone: new THREE.Color('#8f8b83'),
  stoneWarm: new THREE.Color('#9c9486'),
  carve: new THREE.Color('#5d5a54'),
  lichenGold: new THREE.Color('#c7a24a'),
  lichenGreen: new THREE.Color('#9aa57a'),
};

const lichen = new Noise2D(0xba1b);
/** granite with carved-groove darkening supplied by the caller, plus lichen blotches from 3D-ish noise */
function stonePainter(base: THREE.Color): (p: THREE.Vector3, n: THREE.Vector3) => THREE.Color {
  const out = new THREE.Color();
  return (p, n) => {
    out.copy(base);
    const b = lichen.get(p.x * 4.1 + p.y * 1.7, p.z * 4.3 - p.y * 2.3) * 0.6 + lichen.get(p.x * 11 + p.y * 5, p.z * 11) * 0.4;
    if (b > 0.28) out.lerp(p.y > 1.0 || n.y > 0.3 ? C.lichenGold : C.lichenGreen, Math.min(0.85, (b - 0.28) * 3.5));
    if (n.y < -0.4) out.multiplyScalar(0.8);
    return out;
  };
}

/** a balbal in local space: feet at y 0, facing −z, ~2.1 m tall */
export function balbalGeometry(variant: number, seed = 0xba1): THREE.BufferGeometry {
  const kit = new PaintKit(seed + variant * 17);
  const stone = variant === 0 ? C.stone : C.stoneWarm;
  const paint = stonePainter(stone);
  const carve = stonePainter(C.carve);
  const add = (g: THREE.BufferGeometry, c: (p: THREE.Vector3, n: THREE.Vector3) => THREE.Color, m?: THREE.Matrix4) => kit.add(g, c, m ? { matrix: m, brush: 0.1 } : { brush: 0.1 });
  // plinth (half buried) and the body: a flattened, slightly tapering pillar with rounded shoulders
  add(new THREE.CylinderGeometry(0.42, 0.48, 0.5, 10).scale(1, 1, 0.75).translate(0, 0.0, 0), paint);
  add(new THREE.CylinderGeometry(0.3, 0.34, 1.36, 16, 5).scale(1, 1, 0.7).translate(0, 0.84, 0), paint);
  add(new THREE.SphereGeometry(0.315, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2).scale(1.02, 0.42, 0.72).translate(0, 1.5, 0), paint);
  add(new THREE.CylinderGeometry(0.16, 0.18, 0.16, 12).scale(1, 1, 0.9).translate(0, 1.6, 0), paint);
  // head: a heavy oval, flattened face
  add(new THREE.SphereGeometry(0.22, 16, 12).scale(0.95, 1.18, 0.88).translate(0, 1.84, 0.0), paint);
  add(new THREE.BoxGeometry(0.34, 0.3, 0.06).translate(0, 1.82, -0.17), paint);                                       // the face plane
  // brow ridge, nose, eyes, moustache, mouth
  add(new THREE.CapsuleGeometry(0.028, 0.26, 3, 8).rotateZ(Math.PI / 2).translate(0, 1.905, -0.205), paint);
  add(new THREE.CylinderGeometry(0.022, 0.045, 0.14, 6).translate(0, 1.83, -0.215), paint);
  for (const sx of [-1, 1]) {
    add(new THREE.SphereGeometry(0.03, 8, 6).scale(1.4, 0.8, 0.5).translate(sx * 0.075, 1.86, -0.2), carve);
    add(pole(v3(sx * 0.012, 1.755, -0.225), v3(sx * 0.095, 1.74, -0.21), 0.02, 0.018, 6), paint);
    add(pole(v3(sx * 0.095, 1.74, -0.21), v3(sx * 0.13, 1.66, -0.19), 0.018, 0.012, 6), paint);
    add(new THREE.SphereGeometry(0.045, 8, 6).scale(0.5, 1.1, 0.8).translate(sx * 0.21, 1.84, -0.01), paint);         // ears
  }
  add(new THREE.BoxGeometry(0.08, 0.012, 0.02).translate(0, 1.71, -0.2), carve);
  // headwear
  if (variant === 1) {
    add(new THREE.ConeGeometry(0.235, 0.26, 14).scale(1, 1, 0.9).translate(0, 2.08, 0.01), paint);
    add(new THREE.TorusGeometry(0.21, 0.025, 5, 16).rotateX(Math.PI / 2).scale(1, 1, 0.9).translate(0, 1.965, 0.0), paint);
  } else {
    add(new THREE.TorusGeometry(0.2, 0.022, 5, 16).rotateX(Math.PI / 2 - 0.15).scale(1, 1, 0.9).translate(0, 1.98, 0.02), carve);
  }
  // right arm (+x): upper arm down the side, forearm across the chest, the hand holding a cup
  add(new THREE.CapsuleGeometry(0.068, 0.3, 3, 8).rotateZ(0.08).translate(0.285, 1.3, -0.1), paint);
  add(pole(v3(0.27, 1.12, -0.17), v3(0.04, 1.23, -0.235), 0.065, 0.055, 8), paint);
  add(new THREE.SphereGeometry(0.06, 8, 6).scale(1, 0.9, 0.8).translate(0.02, 1.24, -0.25), paint);
  add(new THREE.CylinderGeometry(0.06, 0.045, 0.13, 10).translate(-0.02, 1.33, -0.25), paint);
  add(new THREE.TorusGeometry(0.058, 0.012, 4, 10).rotateX(Math.PI / 2).translate(-0.02, 1.395, -0.25), paint);
  // left arm (−x): hand on the sabre hilt at the belt
  add(new THREE.CapsuleGeometry(0.068, 0.3, 3, 8).rotateZ(-0.08).translate(-0.285, 1.3, -0.1), paint);
  add(pole(v3(-0.27, 1.12, -0.16), v3(-0.16, 0.95, -0.24), 0.062, 0.052, 8), paint);
  add(new THREE.SphereGeometry(0.058, 8, 6).translate(-0.15, 0.93, -0.25), paint);
  // belt with pendants, the sabre hanging on the left
  add(new THREE.CylinderGeometry(0.33, 0.335, 0.07, 18).scale(1, 1, 0.72).translate(0, 0.86, 0), carve);
  for (const bx of [-0.18, 0.02, 0.2]) add(new THREE.BoxGeometry(0.04, 0.09, 0.02).translate(bx, 0.78, -0.235), paint);
  add(new THREE.BoxGeometry(0.05, 0.58, 0.03).rotateZ(-0.12).translate(-0.2, 0.52, -0.235), paint);
  add(new THREE.BoxGeometry(0.14, 0.03, 0.04).translate(-0.16, 0.86, -0.245), paint);
  const geo = kit.finish();
  // a soft foot shade (the instances stand on grass)
  const pos = geo.getAttribute('position'), col = geo.getAttribute('color');
  for (let i = 0; i < pos.count; i++) {
    const k = 0.62 + 0.38 * Math.min(1, Math.max(0, pos.getY(i) / 0.5));
    col.setXYZ(i, col.getX(i) * k, col.getY(i) * k, col.getZ(i) * (k * 0.9 + 0.1));
  }
  col.needsUpdate = true;
  return geo;
}

export interface Statue { x: number; y: number; z: number; yaw: number; scale: number; tilt: number; variant: number; slot: number; collider: Collider }

export class Balbals {
  statues: Statue[] = [];
  meshes: THREE.InstancedMesh[] = [];
  private awake: boolean[] = [];

  setAwake(i: number, awake: boolean): void {
    const s = this.statues[i], mesh = this.meshes[s?.variant ?? -1];
    if (!s || !mesh || this.awake[i] === awake) return;
    this.awake[i] = awake;
    mesh.setMatrixAt(s.slot, awake ? new THREE.Matrix4().makeScale(0, 0, 0) : M(s.x, s.y, s.z, s.yaw, s.scale, s.scale, s.scale, 0, s.tilt));
    mesh.instanceMatrix.needsUpdate = true;
    // an awake statue's collider no longer blocks (the warrior carries its own)
    s.collider.yTop = awake ? -1e9 : s.y + 2.1 * s.scale;
    s.collider.yBottom = awake ? -1e9 - 1 : s.y - 1;
  }
}

/** place balbals at the given spots (y from the terrain), `tilt` leans a few of them like weathered stones */
export function buildBalbals(ctx: PoiCtx, spots: { x: number; z: number; yaw: number; scale?: number; tilt?: number }[]): { piece: PoiPiece; balbals: Balbals } {
  const { sky, ground } = ctx;
  const b = new Balbals();
  const colliders: Collider[] = [];
  const counts = [0, 0];
  const placed = spots.map((s, i) => {
    const variant = (i * 7 + 3) % 3 === 0 ? 1 : 0;
    const slot = counts[variant] ?? 0; counts[variant] = slot + 1;
    return { ...s, variant, slot };
  });
  const group = new THREE.Group();
  group.name = 'nalati-balbals';
  let tris = 0;
  for (let v = 0; v < 2; v++) {
    const n = counts[v] ?? 0;
    if (n === 0) { b.meshes.push(new THREE.InstancedMesh(new THREE.BufferGeometry(), poiMaterial(sky), 0)); continue; }
    const geo = balbalGeometry(v);
    const mesh = new THREE.InstancedMesh(geo, poiMaterial(sky), n);
    mesh.castShadow = true; mesh.receiveShadow = true;
    mesh.name = `nalati-balbals-${v}`;
    b.meshes.push(mesh);
    group.add(mesh);
    tris += (geo.getAttribute('position').count / 3) * n;
  }
  for (const p of placed) {
    const scale = p.scale ?? 1;
    const y = ground(p.x, p.z) - 0.18 * scale;
    const collider: Collider = { x: p.x, z: p.z, hw: 0.36 * scale, hd: 0.28 * scale, rot: -p.yaw, yBottom: y - 1, yTop: y + 2.1 * scale };
    const m = M(p.x, y, p.z, p.yaw, scale, scale, scale, 0, p.tilt ?? 0);
    b.meshes[p.variant]?.setMatrixAt(p.slot, m);
    b.statues.push({ x: p.x, y, z: p.z, yaw: p.yaw, scale, tilt: p.tilt ?? 0, variant: p.variant, slot: p.slot, collider });
    colliders.push(collider);
  }
  for (const m of b.meshes) { m.instanceMatrix.needsUpdate = true; m.computeBoundingSphere(); }
  return { piece: { name: 'balbals', object: group, colliders, platforms: [], tris }, balbals: b };
}

/** the ring's spots on the knoll: 9 stones facing outward (the watchers), a little irregular */
export function balbalRingSpots(cx: number, cz: number, r: number, n: number, seed = 0xb9): { x: number; z: number; yaw: number; scale: number; tilt: number }[] {
  const out: { x: number; z: number; yaw: number; scale: number; tilt: number }[] = [];
  let s = seed;
  const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + (rnd() - 0.5) * 0.12, rr = r + (rnd() - 0.5) * 0.8;
    const fx = Math.cos(a), fz = Math.sin(a);
    out.push({ x: cx + fx * rr, z: cz + fz * rr, yaw: Math.atan2(-fx, -fz) + (rnd() - 0.5) * 0.3, scale: 0.95 + rnd() * 0.22, tilt: rnd() < 0.25 ? (rnd() - 0.5) * 0.16 : 0 });
  }
  return out;
}

/** the circle's ground dressing: a flat offering stone in the middle with a few small stones and a bowl on it, fallen stones */
export function buildBalbalCircleDressing(ctx: PoiCtx, cx: number, cz: number, r: number): PoiPiece {
  const { sky, ground } = ctx;
  const kit = new PaintKit(0xb1c1);
  const rng = kit.rng;
  const colliders: Collider[] = [];
  const gy = ground(cx, cz);
  const stone = { top: { color: C.lichenGold, threshold: 0.55, amount: 0.4 }, brush: 0.1 };
  kit.add(new THREE.CylinderGeometry(1.5, 1.7, 0.45, 9), C.stone, { ...stone, matrix: M(cx, gy + 0.12, cz, 0.3, 1, 1, 0.8) });
  kit.add(new THREE.CylinderGeometry(0.2, 0.14, 0.12, 12).translate(0, 0.41, 0), new THREE.Color('#8a5a2e'), { matrix: M(cx + 0.3, gy, cz - 0.1) });
  for (let i = 0; i < 6; i++) { const a = rng.range(0, 6.28), d = rng.range(0.3, 1.1); kit.add(new THREE.SphereGeometry(rng.range(0.06, 0.12), 7, 5), C.stoneWarm, { matrix: M(cx + Math.cos(a) * d, gy + 0.38, cz + Math.sin(a) * d * 0.8) }); }
  colliders.push({ x: cx, z: cz, hw: 1.4, hd: 1.1, rot: -0.3, yBottom: gy - 1, yTop: gy + 0.34 });
  for (let i = 0; i < 4; i++) {
    const a = rng.range(0, Math.PI * 2), d = r + rng.range(-3, 4);
    const x = cx + Math.cos(a) * d, z = cz + Math.sin(a) * d;
    kit.add(new THREE.CapsuleGeometry(0.3, 1.2, 3, 10).rotateZ(Math.PI / 2).scale(1, 0.75, 0.8), C.stone, { ...stone, matrix: M(x, ground(x, z) + 0.12, z, rng.range(0, 6)) });
  }
  const mesh = kit.mesh(sky, { ground });
  mesh.name = 'nalati-balbal-circle';
  return { name: 'balbalCircle', object: mesh, colliders, platforms: [(x, z) => (Math.hypot((x - cx) / 1.5, (z - cz) / 1.2) < 1 ? gy + 0.34 : undefined)], tris: mesh.geometry.getAttribute('position').count / 3 };
}
