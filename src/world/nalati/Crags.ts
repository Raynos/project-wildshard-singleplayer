/**
 * Crags — rock dressing for the snow ring's two granite massifs (layout v2: the Crags in the east, the west massif with
 * the leopard's cave; the massifs themselves are the chunk def's terrain). Weathered granite outcrops break out of its steep faces (snow settles on their tops above the snow line),
 * a handful of flat LEDGES stick out of the slopes — walkable, the snow leopard's (Aqbars, B12) lookouts — and the
 * LEDGE CAVE at `CRAG_CAVE`: an arch of three great blocks round a pitch-dark mouth, a ledge slab in front of it
 * with old bones on it.
 *
 *   const crags = buildCrags(ctx);   // → { piece, ledges: { x, y, z, r }[], cave: { x, y, z, facing } }
 */
import * as THREE from 'three';
import { PaintKit, M, pole, v3, blob } from './paint';
import { graniteBlock } from './EagleRock';
import { CRAGS, WEST_CRAGS, CRAG_CAVE } from './layout';
import type { Collider } from '../../player/Player';
import type { Platform, PoiCtx, PoiPiece } from './types';

const C = {
  granite: new THREE.Color('#9a8f80'),
  graniteCool: new THREE.Color('#8c8883'),
  graniteDark: new THREE.Color('#6e675f'),
  snow: new THREE.Color('#f1f4f8'),
  lichen: new THREE.Color('#b4a15e'),
  dark: new THREE.Color('#0e0b0a'),
  bone: new THREE.Color('#e3d9c2'),
};

export interface Ledge { x: number; y: number; z: number; r: number }

export function buildCrags(ctx: PoiCtx): { piece: PoiPiece; ledges: Ledge[]; cave: { x: number; y: number; z: number; facing: number } } {
  const { sky, ground } = ctx;
  const kit = new PaintKit(0xc4a6);
  const rng = kit.rng;
  const colliders: Collider[] = [];
  const platforms: Platform[] = [];
  const snowTop = (minY: number) => ({ top: { color: C.snow, threshold: 0.45, amount: 0.95, minY }, brush: 0.1 });
  const slopeAt = (x: number, z: number) => { const e = 1.5; return Math.hypot(ground(x + e, z) - ground(x - e, z), ground(x, z + e) - ground(x, z - e)) / (2 * e); };
  const downhill = (x: number, z: number) => { const e = 1.5; const gx = ground(x + e, z) - ground(x - e, z), gz = ground(x, z + e) - ground(x, z - e); const l = Math.hypot(gx, gz) || 1; return { x: -gx / l, z: -gz / l }; };
  const cave = CRAG_CAVE, cfx = -Math.sin(cave.rot), cfz = -Math.cos(cave.rot);

  // ── outcrops on the steep faces ──
  const placed: { x: number; z: number; r: number }[] = [];
  const free = (x: number, z: number, r: number) => placed.every((p) => Math.hypot(p.x - x, p.z - z) > p.r + r) && Math.hypot(x - cave.x, z - cave.z) > 14 && x > -249 && z > -249;
  for (let tries = 0; tries < 1400 && placed.length < 60; tries++) {
    const M0 = tries % 2 === 0 ? CRAGS : WEST_CRAGS;                                     // both massifs of the snow ring
    const a = rng.range(0, Math.PI * 2), d = rng.range(14, 105);
    const x = M0.x + Math.cos(a) * d, z = M0.z + Math.sin(a) * d;
    if (Math.abs(x) > 248 || Math.abs(z) > 248) continue;
    const gy = ground(x, z), sl = slopeAt(x, z);
    if (gy < 38 || sl < 0.42) continue;
    // not on a crest (a block on a ridge line floats against the sky): the ground must not be a local high
    let around = 0; for (let k = 0; k < 6; k++) { const t = (k / 6) * Math.PI * 2; around += ground(x + Math.cos(t) * 4, z + Math.sin(t) * 4); }
    if (gy > around / 6 + 0.4) continue;
    const s = rng.range(2.5, 6.0) * (gy > 58 ? 0.8 : 1);
    if (!free(x, z, s * 0.9)) continue;
    placed.push({ x, z, r: s * 0.9 });
    const dh = downhill(x, z), yaw = Math.atan2(dh.x, dh.z) + rng.range(-0.4, 0.4);
    const h = s * rng.range(0.6, 1.1);
    const col = rng.next() < 0.5 ? C.granite : C.graniteCool;
    // sit it on the LOWEST ground under its footprint, half sunk (the uphill side buried, the downhill foot in the slope)
    let low = gy;
    for (let k = 0; k < 8; k++) { const t = (k / 8) * Math.PI * 2; low = Math.min(low, ground(x + Math.cos(t) * s * 0.6, z + Math.sin(t) * s * 0.6)); }
    // a crag is a cluster: 2–3 jointed pillars / slabs leaning together, not one box
    const nb = rng.int(2, 3);
    for (let b = 0; b < nb; b++) {
      const bw = s * rng.range(0.45, 0.75), bh = h * rng.range(0.7, 1.15), bd = s * rng.range(0.4, 0.65);
      const ox = rng.range(-0.35, 0.35) * s, oz = rng.range(-0.25, 0.25) * s;
      const g = rng.next() < 0.7 ? graniteBlock(bw, bh, bd, rng.int(1, 9999), 0.3, 2) : blob(bw * 0.6, rng, 2, 1.1, 0.3);
      kit.add(g, col, { ...snowTop(CRAGS.snowLine - 3), matrix: M(x + ox, low + bh * 0.08, z + oz, yaw + rng.range(-0.5, 0.5), 1, 1, 1, rng.range(-0.18, 0.08), rng.range(-0.15, 0.15)) });
    }
    colliders.push({ x, z, hw: s * 0.55, hd: s * 0.4, rot: -yaw, yBottom: gy - 3, yTop: gy + h * 0.55 });
  }

  // ── ledges: flat slabs jutting from moderate slopes on the west massif's valley-facing flanks (round Aqbars' cave) ──
  const ledges: Ledge[] = [];
  for (let tries = 0; tries < 500 && ledges.length < 6; tries++) {
    const a = rng.range(Math.PI * 0.45, Math.PI * 1.2), d = rng.range(28, 80);            // the N / NE / E flanks (+z / −x)
    const x = WEST_CRAGS.x + Math.cos(a) * d, z = WEST_CRAGS.z + Math.sin(a) * d;
    const gy = ground(x, z), sl = slopeAt(x, z);
    if (gy < 40 || gy > 70 || sl < 0.3 || sl > 1.2 || !free(x, z, 3.2)) continue;
    const dh = downhill(x, z), yaw = Math.atan2(dh.x, dh.z);
    const ux = x - dh.x * 1.6, uz = z - dh.z * 1.6;                                      // the uphill edge sits flush
    const top = Math.max(ground(ux, uz), gy + 0.9);
    const w = rng.range(4.2, 5.8), d2 = rng.range(3.0, 4.0), th = 1.6;
    const px = x + dh.x * 0.6, pz = z + dh.z * 0.6;
    kit.add(graniteBlock(w, th, d2, rng.int(1, 9999), 0.12), C.graniteDark, { ...snowTop(CRAGS.snowLine), matrix: M(px, top - th / 2 + 0.05, pz, yaw) });
    placed.push({ x: px, z: pz, r: 3.2 });
    ledges.push({ x: px, y: top, z: pz, r: Math.min(w, d2) / 2 - 0.3 });
    colliders.push({ x: px, z: pz, hw: w / 2 - 0.3, hd: d2 / 2 - 0.3, rot: -yaw, yBottom: top - 6, yTop: top });
    const cs = Math.cos(yaw), sn = Math.sin(yaw), hw = w / 2 - 0.25, hd = d2 / 2 - 0.25;
    platforms.push((qx, qz) => { const dx = qx - px, dz = qz - pz, lx = dx * cs - dz * sn, lz = dx * sn + dz * cs; return Math.abs(lx) <= hw && Math.abs(lz) <= hd ? top : undefined; });
  }

  // ── the ledge cave: a rock outcrop standing out of the slope with a dark mouth, its floor a ledge ──
  // The recess must not dig into the terrain (the slope would show inside it), so the whole cave stands proud: its
  // back is at `CRAG_CAVE` (where it meets the hill), its mouth 2.8 m out, the porch ledge beyond; big blocks hood it.
  const yawIn = Math.atan2(-cfx, -cfz);
  const O = { x: cave.x + cfx * 3.0, z: cave.z + cfz * 3.0 };                            // the mouth (lz = 0)
  const L = (lx: number, ly: number, lz: number) => v3(O.x - cfx * lz - cfz * lx, ly, O.z - cfz * lz + cfx * lx);
  const mouthW = 3.2, mouthH = 2.5, depth = 3.0;
  let floorY = -Infinity;
  for (const lz of [0, 1, 2, 3]) for (const lx of [-1.6, 0, 1.6]) { const q = L(lx, 0, lz); floorY = Math.max(floorY, ground(q.x, q.z)); }
  floorY += 0.12;
  const porchY = floorY;
  // the recess: an inside-out dark box (its faces point inward, so from outside you look straight into the dark)
  {
    const g = new THREE.BoxGeometry(mouthW + 0.4, mouthH + 0.3, depth, 2, 2, 2);
    const idx = g.index;
    if (idx) { const arr = idx.array; for (let i = 0; i < arr.length; i += 3) { const t = arr[i + 1] ?? 0; arr[i + 1] = arr[i + 2] ?? 0; arr[i + 2] = t; } }
    g.computeVertexNormals();
    const c = L(0, 0, depth / 2 + 0.15);
    kit.add(g, (p) => C.dark.clone().lerp(C.graniteDark, Math.max(0, 0.22 - (p.z + depth / 2) * 0.12)), { matrix: M(c.x, floorY + (mouthH + 0.3) / 2, c.z, yawIn), brush: 0.02, flat: true });
    const bw = L(0, 0, depth + 0.3);
    colliders.push({ x: bw.x, z: bw.z, hw: mouthW / 2 + 0.4, hd: 0.4, rot: -yawIn, yBottom: floorY - 3, yTop: floorY + mouthH + 3 });
  }
  // the hood: jambs either side (down to the hill), a lintel, a great capping block and boulders heaped on it
  for (const sx of [-1, 1]) {
    const j = L(sx * (mouthW / 2 + 1.35), 0, depth / 2);
    const gj = ground(j.x, j.z), hJ = floorY + mouthH + 1.2 - gj + 2;
    kit.add(graniteBlock(2.9, hJ, depth + 2.2, 0xca0 + sx, 0.2), C.granite, { ...snowTop(CRAGS.snowLine), matrix: M(j.x, gj - 2 + hJ / 2, j.z, yawIn + sx * 0.08) });
    colliders.push({ x: j.x, z: j.z, hw: 1.35, hd: (depth + 2) / 2, rot: -(yawIn + sx * 0.08), yBottom: gj - 3, yTop: floorY + mouthH + 1.2 });
  }
  { const li = L(0, 0, 0.3); kit.add(graniteBlock(mouthW + 4.6, 1.6, 2.2, 0xcab, 0.2), C.graniteCool, { ...snowTop(CRAGS.snowLine - 6), matrix: M(li.x, floorY + mouthH + 0.75, li.z, yawIn, 1, 1, 1, 0.06) }); }
  { const cap = L(0.3, 0, depth / 2 + 0.6); kit.add(graniteBlock(mouthW + 6, 3.2, depth + 3.5, 0xcac, 0.28), C.granite, { ...snowTop(CRAGS.snowLine - 8), matrix: M(cap.x, floorY + mouthH + 2.1, cap.z, yawIn + 0.1, 1, 1, 1, -0.12) }); }
  for (let i = 0; i < 4; i++) {
    const p = L(rng.range(-3.5, 3.5), 0, rng.range(1.5, 4.5)), s = rng.range(1.2, 2.2);
    kit.add(blob(s, rng, 2, 0.8, 0.3), C.granite, { ...snowTop(CRAGS.snowLine - 8), matrix: M(p.x, floorY + mouthH + 3.2 + s * 0.2, p.z, rng.range(0, 6)) });
  }
  // the porch ledge in front of the mouth: a thick slab down to the slope (the leopard's lookout)
  const porch = L(0, 0, -2.1);
  {
    const gp = ground(porch.x, porch.z), th = Math.max(1.4, porchY - gp + 1.2);
    kit.add(graniteBlock(6.6, th, 4.4, 0xcafe, 0.1), C.graniteDark, { ...snowTop(CRAGS.snowLine), matrix: M(porch.x, porchY - th / 2 + 0.02, porch.z, yawIn) });
    colliders.push({ x: porch.x, z: porch.z, hw: 3.0, hd: 1.9, rot: -yawIn, yBottom: gp - 3, yTop: porchY });
  }
  { const cs = Math.cos(yawIn), sn = Math.sin(yawIn); platforms.push((qx, qz) => { const dx = qx - porch.x, dz = qz - porch.z, lx = dx * cs - dz * sn, lz = dx * sn + dz * cs; return Math.abs(lx) <= 3.0 && lz <= 2.1 && lz >= -1.95 ? porchY : Math.abs(lx) <= mouthW / 2 && lz > 2.1 && lz < 2.1 + depth ? porchY : undefined; }); }
  // old bones on the porch: a few long bones, a ribcage arc, a skull
  for (let i = 0; i < 6; i++) {
    const p = L(rng.range(-2, 2), 0, rng.range(-3.4, -1.2)), a = rng.range(0, Math.PI);
    kit.add(pole(v3(p.x - Math.cos(a) * 0.3, porchY + 0.05, p.z - Math.sin(a) * 0.3), v3(p.x + Math.cos(a) * 0.3, porchY + 0.05, p.z + Math.sin(a) * 0.3), 0.03, 0.025, 5), C.bone);
  }
  { const p = L(0.8, 0, -1.8); for (let k = 0; k < 5; k++) kit.add(new THREE.TorusGeometry(0.28 - k * 0.02, 0.02, 4, 10, Math.PI).rotateY(Math.PI / 2 + 0.2).translate(k * 0.1, 0, 0), C.bone, { matrix: M(p.x, porchY, p.z, yawIn) }); }
  { const p = L(-1.1, 0, -2.6); kit.add(new THREE.SphereGeometry(0.12, 10, 8).scale(0.9, 0.8, 1.3), C.bone, { matrix: M(p.x, porchY + 0.1, p.z, 0.7) }); }

  const mesh = kit.mesh(sky, { ground, aoH: 1.2 });
  mesh.name = 'nalati-crags';
  return { piece: { name: 'crags', object: mesh, colliders, platforms, tris: mesh.geometry.getAttribute('position').count / 3 }, ledges, cave: { x: porch.x, y: porchY, z: porch.z, facing: cave.rot } };
}
