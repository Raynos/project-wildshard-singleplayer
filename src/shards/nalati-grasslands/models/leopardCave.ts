/**
 * The leopard's cave (E306 / E315 M3; Aqbars' lair, B12): a rock outcrop standing out of a mountain slope with a
 * pitch-dark mouth — jambs of great granite blocks down to the hill either side, a lintel, a capping block with boulders
 * heaped on it, the dark recess behind the mouth (an inside-out box: from outside you look straight into the dark), a thick
 * porch ledge in front with old bones on it (long bones, a ribcage arc, a skull). Used once, on the west massif's north
 * flank (src/shards/nalati-grasslands/world/Crags.ts).
 *
 * The recess must not dig into the terrain (the slope would show inside it), so the whole cave stands proud. Fitted to
 * the ground under it: placed at the mouth with `at.y` = its floor (the highest ground under it + 0.12), `yaw` = the way
 * the mouth faces; the jambs and the porch run down to the slope. Painted into its place's mesh
 * (src/shards/nalati-grasslands/world/painted.ts). Collides: the back wall, the jambs and the porch as boxes, the cave's floor as a slab;
 * its floor (placement) is the porch and the cave.
 */
import * as THREE from 'three';
import { defineModel } from '@wildshard/engine/models/model';
import type { ColliderDesc } from '@wildshard/engine/world/registry';
import { M, v3 } from '../world/paint';
import { pole, blob } from '@wildshard/engine/world/geometryKit';
import { graniteBlock } from '../world/granite';
import { slab, type Box } from '../world/solid';
import { painted, type Paint } from '../world/painted';
import type { Platform } from '../world/types';

export interface LeopardCaveParams {
  /** snow settles on its tops above this height */
  readonly snowLine: number;
}

const C = {
  granite: new THREE.Color('#9a8f80'),
  graniteCool: new THREE.Color('#8c8883'),
  graniteDark: new THREE.Color('#6e675f'),
  snow: new THREE.Color('#f1f4f8'),
  dark: new THREE.Color('#0e0b0a'),
  bone: new THREE.Color('#e3d9c2'),
};

/** the mouth's clear width and height, the dark recess's depth (m) */
const CAVE = { mouthW: 3.2, mouthH: 2.5, depth: 3.0 } as const;

const paint: Paint<LeopardCaveParams> = (kit, at, p, c) => {
  const rng = kit.rng, ground = c.ground;
  const colliders: Box[] = [];
  const descs: ColliderDesc[] = [];
  const snowTop = (minY: number) => ({ top: { color: C.snow, threshold: 0.45, amount: 0.95, minY }, brush: 0.1 });
  const cfx = -Math.sin(at.yaw), cfz = -Math.cos(at.yaw);
  const yawIn = Math.atan2(-cfx, -cfz);
  const O = { x: at.x, z: at.z };                                                          // the mouth (lz = 0)
  const L = (lx: number, ly: number, lz: number) => v3(O.x - cfx * lz - cfz * lx, ly, O.z - cfz * lz + cfx * lx);
  const { mouthW, mouthH, depth } = CAVE;
  const floorY = at.y, porchY = floorY;
  // the recess: an inside-out dark box (its faces point inward, so from outside you look straight into the dark)
  {
    const g = new THREE.BoxGeometry(mouthW + 0.4, mouthH + 0.3, depth, 2, 2, 2);
    const idx = g.index;
    if (idx) { const arr = idx.array; for (let i = 0; i < arr.length; i += 3) { const t = arr[i + 1] ?? 0; arr[i + 1] = arr[i + 2] ?? 0; arr[i + 2] = t; } }
    g.computeVertexNormals();
    const cc = L(0, 0, depth / 2 + 0.15);
    kit.add(g, (q) => C.dark.clone().lerp(C.graniteDark, Math.max(0, 0.22 - (q.z + depth / 2) * 0.12)), { matrix: M(cc.x, floorY + (mouthH + 0.3) / 2, cc.z, yawIn), brush: 0.02, flat: true });
    const bw = L(0, 0, depth + 0.3);
    colliders.push({ x: bw.x, z: bw.z, hw: mouthW / 2 + 0.4, hd: 0.4, rot: -yawIn, yBottom: floorY - 3, yTop: floorY + mouthH + 3 });
  }
  // the hood: jambs either side (down to the hill), a lintel, a great capping block and boulders heaped on it
  for (const sx of [-1, 1]) {
    const j = L(sx * (mouthW / 2 + 1.35), 0, depth / 2);
    const gj = ground(j.x, j.z), hJ = floorY + mouthH + 1.2 - gj + 2;
    kit.add(graniteBlock(2.9, hJ, depth + 2.2, 0xca0 + sx, 0.2), C.granite, { ...snowTop(p.snowLine), matrix: M(j.x, gj - 2 + hJ / 2, j.z, yawIn + sx * 0.08) });
    colliders.push({ x: j.x, z: j.z, hw: 1.35, hd: (depth + 2) / 2, rot: -(yawIn + sx * 0.08), yBottom: gj - 3, yTop: floorY + mouthH + 1.2 });
  }
  { const li = L(0, 0, 0.3); kit.add(graniteBlock(mouthW + 4.6, 1.6, 2.2, 0xcab, 0.2), C.graniteCool, { ...snowTop(p.snowLine - 6), matrix: M(li.x, floorY + mouthH + 0.75, li.z, yawIn, 1, 1, 1, 0.06) }); }
  { const cap = L(0.3, 0, depth / 2 + 0.6); kit.add(graniteBlock(mouthW + 6, 3.2, depth + 3.5, 0xcac, 0.28), C.granite, { ...snowTop(p.snowLine - 8), matrix: M(cap.x, floorY + mouthH + 2.1, cap.z, yawIn + 0.1, 1, 1, 1, -0.12) }); }
  for (let i = 0; i < 4; i++) {
    const q = L(rng.range(-3.5, 3.5), 0, rng.range(1.5, 4.5)), s = rng.range(1.2, 2.2);
    kit.add(blob(s, rng, 2, 0.8, 0.3), C.granite, { ...snowTop(p.snowLine - 8), matrix: M(q.x, floorY + mouthH + 3.2 + s * 0.2, q.z, rng.range(0, 6)) });
  }
  // the porch ledge in front of the mouth: a thick slab down to the slope (the leopard's lookout)
  const porch = L(0, 0, -2.1);
  {
    const gp = ground(porch.x, porch.z), th = Math.max(1.4, porchY - gp + 1.2);
    kit.add(graniteBlock(6.6, th, 4.4, 0xcafe, 0.1), C.graniteDark, { ...snowTop(p.snowLine), matrix: M(porch.x, porchY - th / 2 + 0.02, porch.z, yawIn) });
    colliders.push({ x: porch.x, z: porch.z, hw: 3.0, hd: 1.9, rot: -yawIn, yBottom: gp - 3, yTop: porchY });
    // the cave's own floor, from the porch's back edge in to the back wall (P1: it was a floor function only)
    const cf = L(0, 0, depth / 2 - 0.1);
    descs.push(slab(cf.x, cf.z, porchY, 1.2, mouthW / 2 + 0.3, depth / 2 + 0.25, yawIn, 'rock'));
  }
  const cs = Math.cos(yawIn), sn = Math.sin(yawIn);
  const floor: Platform = (qx, qz) => { const dx = qx - porch.x, dz = qz - porch.z, lx = dx * cs - dz * sn, lz = dx * sn + dz * cs; return Math.abs(lx) <= 3.0 && lz <= 2.1 && lz >= -1.95 ? porchY : Math.abs(lx) <= mouthW / 2 && lz > 2.1 && lz < 2.1 + depth ? porchY : undefined; };
  // old bones on the porch: a few long bones, a ribcage arc, a skull
  for (let i = 0; i < 6; i++) {
    const q = L(rng.range(-2, 2), 0, rng.range(-3.4, -1.2)), a = rng.range(0, Math.PI);
    kit.add(pole(v3(q.x - Math.cos(a) * 0.3, porchY + 0.05, q.z - Math.sin(a) * 0.3), v3(q.x + Math.cos(a) * 0.3, porchY + 0.05, q.z + Math.sin(a) * 0.3), 0.03, 0.025, 5), C.bone);
  }
  { const q = L(0.8, 0, -1.8); for (let k = 0; k < 5; k++) kit.add(new THREE.TorusGeometry(0.28 - k * 0.02, 0.02, 4, 10, Math.PI).rotateY(Math.PI / 2 + 0.2).translate(k * 0.1, 0, 0), C.bone, { matrix: M(q.x, porchY, q.z, yawIn) }); }
  { const q = L(-1.1, 0, -2.6); kit.add(new THREE.SphereGeometry(0.12, 10, 8).scale(0.9, 0.8, 1.3), C.bone, { matrix: M(q.x, porchY + 0.1, q.z, 0.7) }); }
  return { boxes: colliders, descs, floor };
};

export const leopardCave = defineModel<LeopardCaveParams>({
  id: 'nalati-grasslands/leopard-cave', name: "Leopard's cave", category: 'nature', pipeline: 'code',
  file: 'src/shards/nalati-grasslands/models/leopardCave.ts', surface: 'rock',
  defaults: { snowLine: 60 },
  build: painted(paint, { seed: 0xc4a6, fitted: true, finish: { aoH: 1.2 } }),
});
