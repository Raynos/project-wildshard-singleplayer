/**
 * The great kurgan's entrance (E306 / E315 M3): a timber-framed dromos head in a burial mound's flank — two massive
 * larch posts and a double lintel, flaring log wing-walls with stones banked against them, a turf hood that carries the
 * mound's line out over the passage, a raised timber threshold with steps down to the grass, and a pitch-dark passage
 * DROMOS_DEPTH in (sealed; B13's dungeon is beyond). Used once, on the Golden King's mound (src/shards/nalati-grasslands/world/KurganField.ts).
 *
 * Fitted to the ground under it: placed at the portal front on the door axis (`at.y` = the passage floor, `yaw` = the
 * way the door faces), its steps run down to the grass at `footY`, its hood's sides and its wing-wall stones follow the
 * terrain. Painted into its place's one mesh (src/shards/nalati-grasslands/world/painted.ts). Collides: the posts, the wing walls and the
 * back wall as boxes, the hood's walkable top in slices, the passage floor as a timber slab, the steps as treads.
 */
import * as THREE from 'three';
import { defineModel } from '@wildshard/engine/models/model';
import type { ColliderDesc } from '@wildshard/engine/world/registry';
import { M, v3 } from '../world/paint';
import { pole, blob } from '@wildshard/engine/world/geometryKit';
import { highest, slab, type Box } from '../world/solid';
import { painted, type Paint } from '../world/painted';
import type { Platform } from '../world/types';

export interface KurganEntranceParams {
  /** the ground at the mound's foot on the door axis (where the steps come down to) */
  readonly footY: number;
}

const C = {
  kerb: new THREE.Color('#948f86'),
  lichen: new THREE.Color('#b9a45a'),
  larch: new THREE.Color('#7a5a3c'),
  larchOld: new THREE.Color('#6d6152'),
  turf: new THREE.Color('#9ab552'),
  turfDark: new THREE.Color('#7f9a42'),
  dark: new THREE.Color('#0d0a08'),
};

/** how far the dark passage goes in behind the portal (m) */
export const DROMOS_DEPTH = 2.2;

const paint: Paint<KurganEntranceParams> = (kit, at, p, c) => {
  const rng = kit.rng, ground = c.ground;
  const colliders: Box[] = [];
  const descs: ColliderDesc[] = [];
  const platforms: Platform[] = [];
  const D = at.yaw, fx = -Math.sin(D), fz = -Math.cos(D);                        // the unit vector the door faces
  const front = { x: at.x, z: at.z }, floorY = at.y, footY = p.footY;
  const openH = 2.35, lintelY = floorY + openH, cw = 2.5;                                    // clear width of the doorway
  // local frame: origin at the portal front on the axis, +z pointing INTO the mound, +x across
  const yawIn = Math.atan2(-fx, -fz);                                                      // local +z → world (−fx, −fz)
  const L = (lx: number, ly: number, lz: number) => v3(front.x - fx * lz - fz * lx, ly, front.z - fz * lz + fx * lx);
  const Lm = (lx: number, ly: number, lz: number, sx = 1, sy = 1, sz = 1, pitch = 0) => { const q = L(lx, ly, lz); return M(q.x, q.y, q.z, yawIn, sx, sy, sz, pitch); };
  // posts + double lintel (larch, weathered grey at the top)
  for (const sx of [-1, 1]) {
    kit.add(pole(L(sx * (cw / 2 + 0.22), footY - 0.6, 0.1), L(sx * (cw / 2 + 0.2), lintelY + 0.55, 0.12), 0.25, 0.21, 9), C.larch, { foot: 0.7 });
    kit.add(pole(L(sx * (cw / 2 + 0.25), footY - 0.6, 0.9), L(sx * (cw / 2 + 0.22), lintelY + 0.3, 0.9), 0.2, 0.18, 8), C.larchOld);
    const jp = L(sx * (cw / 2 + 0.22), 0, 0.5);
    colliders.push({ x: jp.x, z: jp.z, hw: 0.3, hd: 0.8, rot: -yawIn, yBottom: footY - 1, yTop: lintelY + 0.6 });
  }
  kit.add(pole(L(-cw / 2 - 0.9, lintelY + 0.22, 0.05), L(cw / 2 + 0.9, lintelY + 0.24, 0.05), 0.27, 0.25, 9), C.larchOld);
  kit.add(pole(L(-cw / 2 - 1.1, lintelY + 0.7, 0.35), L(cw / 2 + 1.1, lintelY + 0.68, 0.35), 0.25, 0.24, 9), C.larch);
  // flaring wing walls: stacked logs from the posts out and down to the foot, stones banked against them
  for (const sx of [-1, 1]) {
    for (let r = 0; r < 7; r++) {
      const y = footY - 0.1 + r * 0.42, lenOut = 3.4 - r * 0.42;
      if (lenOut < 0.5 || y > lintelY + 0.4) break;
      const a = L(sx * (cw / 2 + 0.5), y, 0.3), b = L(sx * (cw / 2 + 0.5 + lenOut * 0.72), y + rng.range(-0.05, 0.05), -lenOut * 0.7);
      kit.add(pole(a, b, 0.2, 0.18, 7), r % 2 === 0 ? C.larch : C.larchOld, { jitter: 0.08 });
    }
    for (let i = 0; i < 6; i++) {
      const q = L(sx * (cw / 2 + rng.range(1.4, 3.4)), 0, rng.range(-2.4, -0.2));
      kit.add(blob(rng.range(0.3, 0.6), rng, 1, 0.7), C.kerb, { matrix: M(q.x, ground(q.x, q.z) + 0.05, q.z, rng.range(0, 6)), top: { color: C.lichen, threshold: 0.5, amount: 0.4 } });
    }
    const wc = L(sx * (cw / 2 + 1.7), 0, -1.0);
    colliders.push({ x: wc.x, z: wc.z, hw: 0.35, hd: 1.6, rot: -(yawIn + sx * 0.7), yBottom: footY - 1, yTop: footY + 1.6 });
  }
  // the passage: dark log walls, a log ceiling, the black back — fading to nothing
  const dep = DROMOS_DEPTH;
  const darkBy = (lz: number, base: THREE.Color) => base.clone().lerp(C.dark, Math.min(1, 0.35 + lz / dep * 0.8));
  for (const sx of [-1, 1]) for (let r = 0; r < 6; r++) {
    const y = floorY + 0.2 + r * 0.4;
    kit.add(pole(L(sx * (cw / 2 + 0.05), y, 0.4), L(sx * (cw / 2 + 0.05), y, dep + 0.1), 0.19, 0.19, 6), darkBy(dep * 0.6, C.larch));
  }
  for (let i = 0; i < 6; i++) kit.add(pole(L(-cw / 2 - 0.3, lintelY + 0.05, 0.5 + i * 0.36), L(cw / 2 + 0.3, lintelY + 0.05, 0.5 + i * 0.36), 0.17, 0.17, 6), darkBy(0.5 + i * 0.36, C.larchOld));
  kit.add(new THREE.BoxGeometry(cw + 0.6, openH + 0.4, 0.3), C.dark, { matrix: Lm(0, floorY + openH / 2, dep + 0.1), brush: 0.02, flat: true });
  kit.add(new THREE.BoxGeometry(cw, 0.08, dep), C.dark.clone().lerp(C.larch, 0.25), { matrix: Lm(0, floorY - 0.04, dep / 2 + 0.2), flat: true });
  // raised timber threshold + steps down to the grass
  kit.add(new THREE.BoxGeometry(cw + 0.5, 0.26, 0.55), C.larchOld, { matrix: Lm(0, floorY - 0.13, 0.15), flat: true });
  const rise = floorY - footY, nSteps = Math.max(0, Math.ceil(rise / 0.34) - 1);
  for (let i = 1; i <= nSteps; i++) {
    const y = floorY - (rise * i) / (nSteps + 1);
    kit.add(new THREE.BoxGeometry(cw - 0.2, 0.2, 0.55), C.larch, { matrix: Lm(0, y - 0.1, -0.2 - i * 0.5), flat: true });
  }
  // turf hood over the passage, carrying the mound's line out to the lintel
  {
    const len = 7.5, segZ = 10, g = new THREE.BoxGeometry(cw + 3.6, 1, len, 10, 1, segZ);
    const pos = g.getAttribute('position');
    for (let i = 0; i < pos.count; i++) {
      const lz = pos.getZ(i) + len / 2, t = lz / len;                            // 0 at the lintel → 1 deep in the mound
      const up = pos.getY(i) > 0;
      const q = L(0, 0, lz), gy = ground(q.x, q.z);
      const topY = lintelY + 1.05 - t * 1.2 + Math.sin(Math.PI * t) * 0.25;           // sinks under the mound behind
      const across = pos.getX(i) / ((cw + 3.6) / 2);
      // the underside arches over the passage (so the hood's front face never closes the doorway)
      const drop = up ? topY - (1 - Math.cos(across * 1.35)) * 1.6 : Math.abs(pos.getX(i)) < cw / 2 + 0.6 ? lintelY + 0.3 : gy - 0.6;
      pos.setXYZ(i, pos.getX(i) * (up ? 0.85 : 1.1), drop, lz - 0.2);
    }
    g.computeVertexNormals();
    kit.add(g, (_p, n) => (n.y > 0.35 ? C.turf : C.turfDark), { matrix: Lm(0, 0, 0), brush: 0.12 });
    // the hood's top is walkable (so you can climb the mound over the entrance), in 4 slices
    for (let s = 0; s < 4; s++) {
      const lz0 = s * (len / 4), lzc = lz0 + len / 8, pc = L(0, 0, lzc);
      const tc = lzc / len, yTop = lintelY + 1.05 - tc * 1.2 + Math.sin(Math.PI * tc) * 0.25 - 0.25;
      const top = Math.max(yTop, ground(pc.x, pc.z));
      // over the passage it only blocks above the lintel; either side of it, all the way down
      colliders.push({ x: pc.x, z: pc.z, hw: cw / 2 + 1.2, hd: len / 8, rot: -yawIn, yBottom: lintelY - 0.1, yTop: top, surface: 'earth' });
      for (const sx of [-1, 1]) { const q = L(sx * (cw / 2 + 0.75), 0, lzc); colliders.push({ x: q.x, z: q.z, hw: 0.55, hd: len / 8, rot: -yawIn, yBottom: footY - 1, yTop: top, surface: 'earth' }); }
    }
    platforms.push((x, z) => {
      const dx = x - front.x, dz = z - front.z, lz = -(dx * fx + dz * fz), lx = dx * fz - dz * fx;
      if (lz < 0.4 || lz > len - 0.2 || Math.abs(lx) > cw / 2 + 1.1) return undefined;
      const t = lz / len;
      return lintelY + 1.05 - t * 1.2 + Math.sin(Math.PI * t) * 0.25 - (1 - Math.cos((lx / ((cw + 3.6) / 2)) * 1.35)) * 1.6;
    });
  }
  // the passage floor + threshold + steps are walkable; the back wall stops you
  platforms.push((x, z) => {
    const dx = x - front.x, dz = z - front.z, lz = -(dx * fx + dz * fz), lx = dx * fz - dz * fx;
    if (Math.abs(lx) > cw / 2) return undefined;
    if (lz >= -0.15 && lz <= dep) return floorY;
    if (lz < -0.15 && lz > -0.2 - (nSteps + 0.5) * 0.5) { const i = Math.ceil((-0.2 - lz) / 0.5 - 0.5); return floorY - (rise * Math.max(1, i)) / (nSteps + 1); }
    return undefined;
  });
  { const bw = L(0, 0, dep + 0.1); colliders.push({ x: bw.x, z: bw.z, hw: cw / 2 + 0.3, hd: 0.3, rot: -yawIn, yBottom: floorY - 2, yTop: lintelY + 2 }); }
  // P1: the passage floor + the threshold as a timber slab, the steps down to the grass as treads (rise ≤ 0.34 m)
  { const pf = L(0, 0, (dep - 0.15) / 2); descs.push(slab(pf.x, pf.z, floorY, 0.6, cw / 2, (dep + 0.15) / 2, yawIn, 'wood')); }
  if (nSteps > 0) {
    // from the grass at the lowest drawn step's foot (the flank falls on past the foot line), rise ≤ 0.33 each
    const run = nSteps * 0.5 + 0.3, a = L(0, 0, -0.15 - run), b = L(0, 0, -0.15);
    const y0 = Math.min(footY, ground(a.x, a.z)) - 0.02, count = Math.max(nSteps + 1, Math.ceil((floorY - y0) / 0.33));
    descs.push({ kind: 'treads', from: { x: a.x, y: y0, z: a.z }, to: { x: b.x, y: floorY, z: b.z }, width: cw - 0.2, count, surface: 'wood' });
  }
  return { boxes: colliders, descs, floor: highest(platforms) };
};

export const kurganEntrance = defineModel<KurganEntranceParams>({
  id: 'nalati-grasslands/kurgan-entrance', name: 'Kurgan entrance', category: 'buildings', pipeline: 'code',
  file: 'src/shards/nalati-grasslands/models/kurganEntrance.ts', surface: 'wood',
  defaults: { footY: -0.9 },
  build: painted(paint, { seed: 0x4b62, fitted: true }),
});
