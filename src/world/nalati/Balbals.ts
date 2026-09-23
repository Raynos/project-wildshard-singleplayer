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
 *
 * With `modelsOn()` (glbPaint.ts) both instanced meshes swap to the generated balbal GLB (turned to face −z, scaled to
 * the carved stele's 2.15 m) once it has loaded — same instances, slots, colliders and `setAwake`.
 */
import * as THREE from 'three';
import { PaintKit, M, pole, v3, poiMaterial, mergeVerticesByPos } from './paint';
import { Noise2D } from '../../core/noise';
import type { Collider } from '../../player/Player';
import type { PoiCtx, PoiPiece } from './types';
import { loadNalatiModel, modelsOn, MODEL_SIZE } from './glbPaint';

const C = {
  stone: new THREE.Color('#9a9386'),
  stoneWarm: new THREE.Color('#a69a88'),
  carve: new THREE.Color('#5d5a54'),
  lichenGold: new THREE.Color('#b8a266'),
  lichenGreen: new THREE.Color('#98a07e'),
};

const lichen = new Noise2D(0xba1b);
/** granite with carved-groove darkening supplied by the caller, plus lichen blotches from 3D-ish noise */
function stonePainter(base: THREE.Color): (p: THREE.Vector3, n: THREE.Vector3) => THREE.Color {
  const out = new THREE.Color();
  return (p, n) => {
    out.copy(base);
    const b = lichen.get(p.x * 4.1 + p.y * 1.7, p.z * 4.3 - p.y * 2.3) * 0.6 + lichen.get(p.x * 11 + p.y * 5, p.z * 11) * 0.4;
    if (b > 0.36) out.lerp(p.y > 1.0 || n.y > 0.3 ? C.lichenGold : C.lichenGreen, Math.min(0.5, (b - 0.36) * 2.5));
    if (n.y < -0.4) out.multiplyScalar(0.8);
    return out;
  };
}

/** a stone part: welded, its surface chipped and weathered by noise (amp in metres), smooth-shaded */
function weathered(g: THREE.BufferGeometry, amp: number, seed: number): THREE.BufferGeometry {
  const w = mergeVerticesByPos(g);
  const n = new Noise2D(seed);
  const pos = w.getAttribute('position');
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const len = Math.hypot(x, z) || 1;
    const k = (n.get(x * 7 + y * 3, z * 7 - y * 2) * 0.6 + n.get(x * 17 + 3, y * 17 + z * 5) * 0.4) * amp;
    pos.setXYZ(i, x + (x / len) * k, y + k * 0.3, z + (z / len) * k);
  }
  w.computeVertexNormals();
  return w;
}

/**
 * A balbal in local space: feet at y 0, facing −z, ~2.15 m tall. A squat, heavy stele — the Turkic kurgan warrior:
 * a big head with a heavy brow, deep-set almond eyes, a long wedge nose and a thick moustache curling down past the
 * mouth; the right hand raises a goblet to the chest, the left rests on the sabre at the belt; belt pendants; the stone
 * chipped and weathered, lichen gold on the tops. Variant 1 wears a pointed cap and a short beard.
 */
export function balbalGeometry(variant: number, seed = 0xba1): THREE.BufferGeometry {
  const kit = new PaintKit(seed + variant * 17);
  const stone = variant === 0 ? C.stone : C.stoneWarm;
  const paint = stonePainter(stone);
  const carve = stonePainter(C.carve);
  const add = (g: THREE.BufferGeometry, c: (p: THREE.Vector3, n: THREE.Vector3) => THREE.Color) => kit.add(g, c, { brush: 0.1 });
  const s0 = seed + variant * 101;
  // plinth (half buried) and the body: a broad flattened pillar, tapering a little, weathered
  add(weathered(new THREE.CylinderGeometry(0.46, 0.52, 0.5, 12, 2).scale(1, 1, 0.78), 0.05, s0), paint);
  add(weathered(new THREE.CylinderGeometry(0.35, 0.4, 1.34, 20, 8).scale(1, 1, 0.74).translate(0, 0.86, 0), 0.03, s0 + 1), paint);
  add(weathered(new THREE.SphereGeometry(0.36, 20, 8, 0, Math.PI * 2, 0, Math.PI / 2).scale(1.0, 0.36, 0.74).translate(0, 1.52, 0), 0.02, s0 + 2), paint);
  add(new THREE.CylinderGeometry(0.19, 0.22, 0.16, 14).scale(1, 1, 0.9).translate(0, 1.62, 0.01), paint);
  // head: big, a little forward, a flattened face
  const hy = 1.88;
  add(weathered(new THREE.SphereGeometry(0.27, 22, 16).scale(0.95, 1.12, 0.9).translate(0, hy, 0.0), 0.015, s0 + 3), paint);
  add(weathered(new THREE.BoxGeometry(0.4, 0.36, 0.08, 4, 4, 1).translate(0, hy - 0.03, -0.2), 0.008, s0 + 4), paint);
  // the heavy brow ridge (an arch), the deep eye sockets, the almond eyes inside them
  add(pole(v3(-0.16, hy + 0.06, -0.225), v3(0, hy + 0.085, -0.25), 0.035, 0.038, 8), paint);
  add(pole(v3(0, hy + 0.085, -0.25), v3(0.16, hy + 0.06, -0.225), 0.038, 0.035, 8), paint);
  for (const sx of [-1, 1]) {
    add(new THREE.SphereGeometry(0.05, 10, 8).scale(1.3, 0.75, 0.5).translate(sx * 0.085, hy + 0.02, -0.232), carve);
    add(new THREE.SphereGeometry(0.03, 10, 6).scale(1.5, 0.55, 0.5).translate(sx * 0.085, hy + 0.018, -0.245), paint);
    // the moustache: thick, drooping past the mouth, the ends curling out
    add(pole(v3(sx * 0.012, hy - 0.085, -0.268), v3(sx * 0.07, hy - 0.1, -0.258), 0.026, 0.024, 7), paint);
    add(pole(v3(sx * 0.07, hy - 0.1, -0.258), v3(sx * 0.115, hy - 0.16, -0.24), 0.024, 0.018, 7), paint);
    add(pole(v3(sx * 0.115, hy - 0.16, -0.24), v3(sx * 0.14, hy - 0.2, -0.225), 0.018, 0.01, 6), paint);
    add(new THREE.SphereGeometry(0.05, 8, 6).scale(0.45, 1.1, 0.8).translate(sx * 0.255, hy + 0.0, -0.02), paint);    // ears
  }
  // nose: a long wedge from the brow
  { const g = new THREE.CylinderGeometry(0.022, 0.05, 0.17, 4).rotateY(Math.PI / 4).scale(1, 1, 0.9); add(g.translate(0, hy - 0.02, -0.255), paint); }
  add(new THREE.BoxGeometry(0.09, 0.014, 0.02).translate(0, hy - 0.13, -0.245), carve);                                         // mouth
  if (variant === 1) {
    add(weathered(new THREE.ConeGeometry(0.28, 0.32, 18, 2).scale(1, 1, 0.9).translate(0, hy + 0.36, 0.01), 0.012, s0 + 5), paint);
    add(new THREE.TorusGeometry(0.26, 0.028, 5, 20).rotateX(Math.PI / 2).scale(1, 1, 0.9).translate(0, hy + 0.2, 0), paint);
    add(new THREE.ConeGeometry(0.06, 0.14, 6).rotateX(Math.PI).translate(0, hy - 0.26, -0.2), paint);                           // short beard
  } else {
    add(new THREE.TorusGeometry(0.25, 0.026, 5, 20).rotateX(Math.PI / 2 - 0.15).scale(1, 1, 0.9).translate(0, hy + 0.14, 0.02), carve);  // headband
  }
  // right arm (+x) in relief: upper arm down the side, forearm across the chest, the hand holding the goblet
  add(new THREE.CapsuleGeometry(0.075, 0.34, 3, 10).scale(1, 1, 0.65).rotateZ(0.07).translate(0.33, 1.3, -0.12), paint);
  add(pole(v3(0.31, 1.1, -0.22), v3(0.05, 1.24, -0.29), 0.07, 0.06, 10), paint);
  add(new THREE.SphereGeometry(0.068, 10, 8).scale(1.05, 0.9, 0.75).translate(0.03, 1.25, -0.31), paint);
  add(new THREE.CylinderGeometry(0.075, 0.04, 0.14, 12).translate(-0.02, 1.36, -0.31), paint);
  add(new THREE.CylinderGeometry(0.02, 0.02, 0.05, 6).translate(-0.02, 1.27, -0.31), paint);
  add(new THREE.TorusGeometry(0.072, 0.012, 4, 12).rotateX(Math.PI / 2).translate(-0.02, 1.43, -0.31), carve);
  // left arm (−x): hand on the sabre hilt at the belt
  add(new THREE.CapsuleGeometry(0.075, 0.34, 3, 10).scale(1, 1, 0.65).rotateZ(-0.07).translate(-0.33, 1.3, -0.12), paint);
  add(pole(v3(-0.31, 1.1, -0.2), v3(-0.19, 0.95, -0.29), 0.066, 0.056, 10), paint);
  add(new THREE.SphereGeometry(0.064, 10, 8).scale(1, 0.9, 0.75).translate(-0.18, 0.93, -0.3), paint);
  // belt, pendants, the sabre
  add(new THREE.CylinderGeometry(0.385, 0.39, 0.08, 22).scale(1, 1, 0.76).translate(0, 0.86, 0), carve);
  for (const bx of [-0.22, -0.02, 0.18]) add(new THREE.BoxGeometry(0.05, 0.12, 0.025).translate(bx, 0.76, -0.29), paint);
  add(new THREE.BoxGeometry(0.06, 0.66, 0.03).rotateZ(-0.12).translate(-0.24, 0.5, -0.29), paint);
  add(new THREE.BoxGeometry(0.16, 0.035, 0.05).translate(-0.19, 0.86, -0.3), paint);
  const geo = kit.finish({ ao: { cell: 0.035, dist: 0.25, strength: 0.75 } });
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
    s.collider.yTop = awake ? -1e9 : s.y + 2.2 * s.scale;
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
    const collider: Collider = { x: p.x, z: p.z, hw: 0.42 * scale, hd: 0.33 * scale, rot: -p.yaw, yBottom: y - 1, yTop: y + 2.2 * scale };
    const m = M(p.x, y, p.z, p.yaw, scale, scale, scale, 0, p.tilt ?? 0);
    b.meshes[p.variant]?.setMatrixAt(p.slot, m);
    b.statues.push({ x: p.x, y, z: p.z, yaw: p.yaw, scale, tilt: p.tilt ?? 0, variant: p.variant, slot: p.slot, collider });
    colliders.push(collider);
  }
  for (const m of b.meshes) { m.instanceMatrix.needsUpdate = true; m.computeBoundingSphere(); }
  if (modelsOn()) {
    loadNalatiModel(sky, 'balbal', { rim: 0.35, bands: 0.8 }).then((model) => {
      const k = 2.15 / MODEL_SIZE.balbal[1];
      const geo = model.geometry.clone().rotateY(Math.PI).scale(k, k, k);
      for (const m of b.meshes) {
        if (m.count === 0) continue;
        m.geometry = geo; m.material = model.material;
        m.computeBoundingSphere();
      }
      return model;
    }).catch((e: unknown) => { console.warn('[nalati] balbal model failed', e); });
  }
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
