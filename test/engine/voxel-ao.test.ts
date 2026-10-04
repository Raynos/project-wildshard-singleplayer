/**
 * E357 X5: the one `voxelAO` is byte-identical to the three bakes it replaced. The legacy copies below are the bakers as
 * they were at dda15b24 (lowpolyKit `bakeAO`, Nalati paint `bakeSmoothAO`, Nalati glbPaint `bakeVertexAO`), verbatim but
 * for their names; each test bakes one model both ways and compares the colour bytes.
 */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { bakeAO, type AOOptions } from '#engine-internal/world/lowpolyKit';
import { bakeSmoothAO, type AOOpts } from '#shards/nalati-grasslands/world/paint';
import { bakeVertexAO } from '#shards/nalati-grasslands/world/glbPaint';

const SHADE_TINT = new THREE.Color(0.55, 0.55, 0.78);   // paint.ts's


/** a small scene of touching shapes (non-indexed, vertex-coloured, with normals): crevices, overhangs and a floor */
function model(normals = true): THREE.BufferGeometry {
  const parts = [
    new THREE.BoxGeometry(1.2, 0.3, 0.9).translate(0, 0.15, 0),
    new THREE.IcosahedronGeometry(0.45, 1).translate(0.2, 0.6, 0.1),
    new THREE.CylinderGeometry(0.12, 0.16, 1.4, 7).rotateZ(0.4).translate(-0.4, 0.7, -0.2),
    new THREE.BoxGeometry(0.9, 0.08, 0.5).translate(0.1, 1.1, 0.25),
  ].map((g) => g.toNonIndexed());
  const geo = mergeGeometries(parts, false);
  if (!normals) geo.deleteAttribute('normal');
  const n = geo.getAttribute('position').count, col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { col[i * 3] = 0.4 + 0.5 * Math.abs(Math.sin(i * 0.37)); col[i * 3 + 1] = 0.5 + 0.4 * Math.abs(Math.cos(i * 0.21)); col[i * 3 + 2] = 0.3 + 0.2 * Math.abs(Math.sin(i * 0.11)); }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return geo;
}
const bytes = (g: THREE.BufferGeometry): Uint8Array => { const a = g.getAttribute('color').array; return new Uint8Array(a.buffer, a.byteOffset, a.byteLength); };
const same = (a: Uint8Array, b: Uint8Array): boolean => a.length === b.length && a.every((v, i) => v === b[i]);
const ground = (x: number, z: number): number => 0.05 + 0.08 * Math.sin(x * 3.1) * Math.cos(z * 2.3);

describe('voxelAO matches the bakes it replaced, byte for byte', () => {
  const faceCases: [string, AOOptions, boolean][] = [
    ['defaults', {}, true], ['terrain ground', { ground, cell: 0.05 }, true], ['a floor', { floorY: 0, strength: 0.45 }, true],
    ['every knob', { cell: 0.04, dist: 0.3, strength: 0.75, tint: '#334455', downDark: 0.22 }, true], ['no normals', { floorY: 0.1 }, false],
  ];
  for (const [name, o, normals] of faceCases) {
    it(`bakeAO (per face): ${name}`, () => {
      const a = model(normals), b = model(normals), before = bytes(model(normals)).slice();
      legacyBakeAO(a, o); bakeAO(b, o);
      expect(same(bytes(a), before)).toBe(false);
      expect(same(bytes(a), bytes(b))).toBe(true);
    });
  }
  const smoothCases: [string, AOOpts][] = [['defaults', {}], ['terrain ground', { ground, cell: 0.06 }], ['every knob', { cell: 0.05, dist: 0.4, strength: 0.8 }]];
  for (const [name, o] of smoothCases) {
    it(`bakeSmoothAO (welded): ${name}`, () => {
      const a = model(), b = model(), before = bytes(model()).slice();
      legacyBakeSmoothAO(a, o); bakeSmoothAO(b, o);
      expect(same(bytes(a), before)).toBe(false);
      expect(same(bytes(a), bytes(b))).toBe(true);
    });
  }
  it('bakeVertexAO (per vertex, indexed, the plane under the model)', () => {
    const knot = new THREE.TorusKnotGeometry(0.5, 0.18, 64, 10).translate(0, 0.9, 0);
    const blockers = mergeGeometries([knot, new THREE.BoxGeometry(1.6, 0.2, 1.6).translate(0, 0.1, 0)], false);
    const n = blockers.getAttribute('position').count, plain = new Float32Array(n * 3);
    for (let i = 0; i < plain.length; i++) plain[i] = 0.35 + 0.6 * Math.abs(Math.sin(i * 0.13));
    const a = legacyBakeVertexAO(blockers, plain), b = bakeVertexAO(blockers, plain);
    const u = (x: Float32Array): Uint8Array => new Uint8Array(x.buffer, x.byteOffset, x.byteLength);
    expect(same(u(a), u(plain))).toBe(false);
    expect(same(u(a), u(b))).toBe(true);
  });
});

// ── the legacy bakers (dda15b24) ──────────────────────────────────────────────────────────────────

// 14 hemisphere directions in a +Z-up tangent frame (cosine-ish spread, fixed so bakes are deterministic)
const HEMI_A: [number, number, number][] = (() => {
  const out: [number, number, number][] = [];
  const rings: [number, number][] = [[0.95, 1], [0.72, 5], [0.38, 8]];
  for (const [cz, n] of rings) {
    const s = Math.sqrt(1 - cz * cz);
    for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2 + cz * 1.7; out.push([Math.cos(a) * s, Math.sin(a) * s, cz]); }
  }
  return out;
})();

/**
 * Darken each face of a non-indexed, vertex-coloured geometry by how enclosed it is. Works in the
 * geometry's own coordinate space (world for placed props, local for creatures).
 */
function legacyBakeAO(geo: THREE.BufferGeometry, o: AOOptions = {}): void {
  if (!geo.hasAttribute('color') || geo.index !== null) return;
  const pos = geo.getAttribute('position');
  const col = geo.getAttribute('color');
  geo.computeBoundingBox();
  const bb = geo.boundingBox;
  if (bb === null) return;
  const ext = new THREE.Vector3().subVectors(bb.max, bb.min);
  const cell = o.cell ?? Math.max(0.12, Math.max(ext.x, ext.y, ext.z) / 72);
  const pad = 2;
  const ox = bb.min.x - pad * cell, oy = bb.min.y - pad * cell, oz = bb.min.z - pad * cell;
  const nx = Math.ceil(ext.x / cell) + pad * 2 + 1, ny = Math.ceil(ext.y / cell) + pad * 2 + 1, nz = Math.ceil(ext.z / cell) + pad * 2 + 1;
  const grid = new Uint8Array(nx * ny * nz);
  const idx = (ix: number, iy: number, iz: number) => (iz * ny + iy) * nx + ix;

  // rasterise triangles: barycentric samples at ≤ 0.7 cell spacing
  const fc = pos.count / 3;
  for (let f = 0; f < fc; f++) {
    const i = f * 3;
    const ax = pos.getX(i), ay = pos.getY(i), az = pos.getZ(i);
    const bx = pos.getX(i + 1) - ax, by = pos.getY(i + 1) - ay, bz = pos.getZ(i + 1) - az;
    const cx = pos.getX(i + 2) - ax, cy = pos.getY(i + 2) - ay, cz = pos.getZ(i + 2) - az;
    const e = Math.max(Math.hypot(bx, by, bz), Math.hypot(cx, cy, cz), Math.hypot(cx - bx, cy - by, cz - bz));
    const n = Math.min(400, Math.max(1, Math.ceil(e / (cell * 0.7))));
    for (let u = 0; u <= n; u++) for (let v = 0; u + v <= n; v++) {
      const s = u / n, t = v / n;
      const ix = Math.floor((ax + bx * s + cx * t - ox) / cell), iy = Math.floor((ay + by * s + cy * t - oy) / cell), iz = Math.floor((az + bz * s + cz * t - oz) / cell);
      grid[idx(ix, iy, iz)] = 1;
    }
  }
  // ground: a column cache of cell indices below the terrain (or a constant floor)
  let groundCell: Int32Array | null = null;
  if (o.ground || o.floorY !== undefined) {
    groundCell = new Int32Array(nx * nz);
    for (let iz = 0; iz < nz; iz++) for (let ix = 0; ix < nx; ix++) {
      const gy = o.ground ? o.ground(ox + (ix + 0.5) * cell, oz + (iz + 0.5) * cell) : (o.floorY ?? 0);
      groundCell[iz * nx + ix] = Math.floor((gy - oy) / cell);
    }
  }
  const solid = (ix: number, iy: number, iz: number): boolean => {
    if (ix < 0 || iz < 0 || ix >= nx || iz >= nz) return false;
    if (groundCell !== null && iy <= (groundCell[iz * nx + ix] ?? -1)) return true;
    if (iy < 0 || iy >= ny) return false;
    return grid[idx(ix, iy, iz)] === 1;
  };

  const dist = o.dist ?? cell * 6;
  const steps = Math.max(3, Math.round(dist / cell));
  const strength = o.strength ?? 0.62, downDark = o.downDark ?? 0.18;
  const tint = new THREE.Color().copy((typeof o.tint === 'string' || o.tint === undefined ? new THREE.Color(o.tint ?? '#4a4466') : o.tint));
  if (!geo.hasAttribute('normal')) geo.computeVertexNormals();
  const nrm = geo.getAttribute('normal');
  const N =new THREE.Vector3(), T = new THREE.Vector3(), B = new THREE.Vector3();
  for (let f = 0; f < fc; f++) {
    const i = f * 3;
    N.set(nrm.getX(i), nrm.getY(i), nrm.getZ(i));
    if (N.lengthSq() < 0.5) continue;
    T.set(Math.abs(N.y) < 0.9 ? 0 : 1, Math.abs(N.y) < 0.9 ? 1 : 0, 0).cross(N).normalize(); B.crossVectors(N, T);
    // start one cell off the face so the face's own cell doesn't occlude it
    const px = (pos.getX(i) + pos.getX(i + 1) + pos.getX(i + 2)) / 3 + N.x * cell * 1.05;
    const py = (pos.getY(i) + pos.getY(i + 1) + pos.getY(i + 2)) / 3 + N.y * cell * 1.05;
    const pz = (pos.getZ(i) + pos.getZ(i + 1) + pos.getZ(i + 2)) / 3 + N.z * cell * 1.05;
    let occ = 0, wsum = 0;
    for (const [hx, hy, hz] of HEMI_A) {
      const dx = T.x * hx + B.x * hy + N.x * hz, dy = T.y * hx + B.y * hy + N.y * hz, dz = T.z * hx + B.z * hy + N.z * hz;
      const w = hz; wsum += w;
      for (let s = 0; s < steps; s++) {
        const d = (s + 0.5) * cell;
        if (solid(Math.floor((px + dx * d - ox) / cell), Math.floor((py + dy * d - oy) / cell), Math.floor((pz + dz * d - oz) / cell))) { occ += w * (1 - (s / steps) * 0.5); break; }
      }
    }
    const a = Math.min(1, (occ / wsum) * strength + Math.max(0, -N.y) * downDark);
    for (let k = 0; k < 3; k++) {
      const v = i + k;
      col.setXYZ(v, col.getX(v) * (1 - a) + col.getX(v) * tint.r * a, col.getY(v) * (1 - a) + col.getY(v) * tint.g * a, col.getZ(v) * (1 - a) + col.getZ(v) * tint.b * a);
    }
  }
  col.needsUpdate = true;
}

// 9 fixed hemisphere directions (z-up tangent frame), cosine-ish spread — deterministic bakes
const HEMI_B: [number, number, number][] = (() => {
  const out: [number, number, number][] = [];
  for (const [cz, n] of [[0.94, 1], [0.66, 3], [0.3, 5]] as const) {
    const sz = Math.sqrt(1 - cz * cz);
    for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2 + cz * 2.1; out.push([Math.cos(a) * sz, Math.sin(a) * sz, cz]); }
  }
  return out;
})();

/** darken a merged, non-indexed, vertex-coloured geometry by how enclosed each vertex position is (smooth: per position) */
function legacyBakeSmoothAO(geo: THREE.BufferGeometry, o: AOOpts = {}): void {
  if (!geo.hasAttribute('color') || !geo.hasAttribute('normal')) return;
  const pos = geo.getAttribute('position'), nrm = geo.getAttribute('normal'), col = geo.getAttribute('color');
  geo.computeBoundingBox();
  const bb = geo.boundingBox;
  if (bb === null) return;
  const ext = new THREE.Vector3().subVectors(bb.max, bb.min);
  let cell = o.cell ?? Math.min(0.8, Math.max(0.15, Math.max(ext.x, ext.y, ext.z) / 140));
  const cellsFor = (c: number) => (Math.ceil(ext.x / c) + 5) * (Math.ceil(ext.y / c) + 5) * (Math.ceil(ext.z / c) + 5);
  while (cellsFor(cell) > 6e6) cell *= 1.25;
  const pad = 2;
  const ox = bb.min.x - pad * cell, oy = bb.min.y - pad * cell, oz = bb.min.z - pad * cell;
  const nx = Math.ceil(ext.x / cell) + pad * 2 + 1, ny = Math.ceil(ext.y / cell) + pad * 2 + 1, nz = Math.ceil(ext.z / cell) + pad * 2 + 1;
  const grid = new Uint8Array(nx * ny * nz);
  const fc = pos.count / 3;
  for (let f = 0; f < fc; f++) {
    const i = f * 3;
    const ax = pos.getX(i), ay = pos.getY(i), az = pos.getZ(i);
    const bx = pos.getX(i + 1) - ax, by = pos.getY(i + 1) - ay, bz = pos.getZ(i + 1) - az;
    const cx = pos.getX(i + 2) - ax, cy = pos.getY(i + 2) - ay, cz = pos.getZ(i + 2) - az;
    const e = Math.max(Math.hypot(bx, by, bz), Math.hypot(cx, cy, cz), Math.hypot(cx - bx, cy - by, cz - bz));
    const n = Math.min(64, Math.max(1, Math.ceil(e / (cell * 0.9))));
    for (let u = 0; u <= n; u++) for (let v = 0; u + v <= n; v++) {
      const s = u / n, t = v / n;
      const gx = Math.floor((ax + bx * s + cx * t - ox) / cell), gy = Math.floor((ay + by * s + cy * t - oy) / cell), gz = Math.floor((az + bz * s + cz * t - oz) / cell);
      grid[(gz * ny + gy) * nx + gx] = 1;
    }
  }
  let groundCell: Int32Array | null = null;
  if (o.ground) {
    groundCell = new Int32Array(nx * nz);
    for (let iz = 0; iz < nz; iz++) for (let ix = 0; ix < nx; ix++) groundCell[iz * nx + ix] = Math.floor((o.ground(ox + (ix + 0.5) * cell, oz + (iz + 0.5) * cell) - oy) / cell);
  }
  const solid = (ix: number, iy: number, iz: number): boolean => {
    if (ix < 0 || iz < 0 || ix >= nx || iz >= nz) return false;
    if (groundCell !== null && iy <= (groundCell[iz * nx + ix] ?? -1e9)) return true;
    if (iy < 0 || iy >= ny) return false;
    return grid[(iz * ny + iy) * nx + ix] === 1;
  };
  // distinct positions → averaged normal → one AO value each
  const key = (i: number) => (Math.round(pos.getX(i) * 200) * 73856093) ^ (Math.round(pos.getY(i) * 200) * 19349663) ^ (Math.round(pos.getZ(i) * 200) * 83492791);
  const slot = new Map<number, number>();
  const which = new Int32Array(pos.count);
  const acc: number[] = [];
  for (let i = 0; i < pos.count; i++) {
    const k = key(i);
    let j = slot.get(k);
    if (j === undefined) { j = acc.length / 6; slot.set(k, j); acc.push(pos.getX(i), pos.getY(i), pos.getZ(i), 0, 0, 0); }
    which[i] = j;
    acc[j * 6 + 3] = (acc[j * 6 + 3] ?? 0) + nrm.getX(i); acc[j * 6 + 4] = (acc[j * 6 + 4] ?? 0) + nrm.getY(i); acc[j * 6 + 5] = (acc[j * 6 + 5] ?? 0) + nrm.getZ(i);
  }
  const nU = acc.length / 6, ao = new Float32Array(nU);
  const dist = o.dist ?? cell * 6, steps = Math.max(3, Math.round(dist / cell));
  const N = new THREE.Vector3(), T = new THREE.Vector3(), Bv = new THREE.Vector3();
  for (let j = 0; j < nU; j++) {
    N.set(acc[j * 6 + 3] ?? 0, acc[j * 6 + 4] ?? 1, acc[j * 6 + 5] ?? 0);
    if (N.lengthSq() < 1e-6) continue;
    N.normalize();
    T.set(Math.abs(N.y) < 0.9 ? 0 : 1, Math.abs(N.y) < 0.9 ? 1 : 0, 0).cross(N).normalize(); Bv.crossVectors(N, T);
    const px = (acc[j * 6] ?? 0) + N.x * cell * 1.1, py = (acc[j * 6 + 1] ?? 0) + N.y * cell * 1.1, pz = (acc[j * 6 + 2] ?? 0) + N.z * cell * 1.1;
    let occ = 0, wsum = 0;
    for (const [hx, hy, hz] of HEMI_B) {
      const dx = T.x * hx + Bv.x * hy + N.x * hz, dy = T.y * hx + Bv.y * hy + N.y * hz, dz = T.z * hx + Bv.z * hy + N.z * hz;
      wsum += hz;
      for (let s = 0; s < steps; s++) {
        const d = (s + 0.5) * cell;
        if (solid(Math.floor((px + dx * d - ox) / cell), Math.floor((py + dy * d - oy) / cell), Math.floor((pz + dz * d - oz) / cell))) { occ += hz * (1 - (s / steps) * 0.6); break; }
      }
    }
    ao[j] = occ / wsum;
  }
  const strength = o.strength ?? 0.6, tint = SHADE_TINT;
  for (let i = 0; i < pos.count; i++) {
    const a = Math.min(1, (ao[which[i] ?? 0] ?? 0) * strength);
    const r = col.getX(i), g = col.getY(i), b = col.getZ(i);
    col.setXYZ(i, r * (1 - a) + r * tint.r * 0.55 * a, g * (1 - a) + g * tint.g * 0.55 * a, b * (1 - a) + b * tint.b * 0.55 * a);
  }
  col.needsUpdate = true;
}

// 14 hemisphere directions (+z up in a tangent frame; lowpolyKit's set, so the two bakes weigh alike)
const HEMI_C: readonly (readonly [number, number, number])[] = (() => {
  const out: [number, number, number][] = [];
  for (const [cz, n] of [[0.95, 1], [0.72, 5], [0.38, 8]] as const) {
    const sn = Math.sqrt(1 - cz * cz);
    for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2 + cz * 1.7; out.push([Math.cos(a) * sn, Math.sin(a) * sn, cz]); }
  }
  return out;
})();
/** a warm umber, not the kit's violet: the painted world's shade is already cool, the crevices should read as earth */
const AO_TINT = new THREE.Color('#5b4636');
const AO_STRENGTH = 0.7, AO_DOWN = 0.22;

/**
 * lowpolyKit's voxel AO, per vertex for a smooth indexed mesh in its own space (the ground is the plane under its
 * bounding box): the triangles are rasterised into an occupancy grid, each vertex marches
 * 14 hemisphere rays from just off its surface, and the occluded fraction (+ a little for facing down) pulls its
 * colour toward AO_TINT. ~5–40 ms per model, once.
 */
function legacyBakeVertexAO(geo: THREE.BufferGeometry, plain: Float32Array): Float32Array {
  const out = plain.slice();
  const pos = geo.getAttribute('position'), nrm = geo.getAttribute('normal');
  if (!geo.boundingBox) geo.computeBoundingBox();
  const box = geo.boundingBox ?? new THREE.Box3();
  const y0 = box.min.y;   // the ground: the model's base (0 for a GLB as loaded; a fitted clone's own bottom)
  const ext = new THREE.Vector3(box.max.x - box.min.x, box.max.y - y0, box.max.z - box.min.z);
  const cell = Math.max(0.03, Math.max(ext.x, ext.y, ext.z) / 64);
  const pad = 3;
  const ox = box.min.x - pad * cell, oy = y0 - pad * cell, oz = box.min.z - pad * cell;
  const nx = Math.ceil(ext.x / cell) + pad * 2 + 1, ny = Math.ceil(ext.y / cell) + pad * 2 + 1, nz = Math.ceil(ext.z / cell) + pad * 2 + 1;
  const grid = new Uint8Array(nx * ny * nz);
  const cellOf = (x: number, y: number, z: number): number => {
    const ix = Math.floor((x - ox) / cell), iy = Math.floor((y - oy) / cell), iz = Math.floor((z - oz) / cell);
    return ix < 0 || iy < 0 || iz < 0 || ix >= nx || iy >= ny || iz >= nz ? -1 : (iz * ny + iy) * nx + ix;
  };
  const index = geo.getIndex();
  const tri = index ? index.count / 3 : pos.count / 3;
  const vi = (t: number, k: number): number => (index ? index.getX(t * 3 + k) : t * 3 + k);
  for (let t = 0; t < tri; t++) {
    const a = vi(t, 0), b = vi(t, 1), c = vi(t, 2);
    const ax = pos.getX(a), ay = pos.getY(a), az = pos.getZ(a);
    const bx = pos.getX(b) - ax, by = pos.getY(b) - ay, bz = pos.getZ(b) - az;
    const cx = pos.getX(c) - ax, cy = pos.getY(c) - ay, cz = pos.getZ(c) - az;
    const e = Math.max(Math.hypot(bx, by, bz), Math.hypot(cx, cy, cz), Math.hypot(cx - bx, cy - by, cz - bz));
    const n = Math.min(200, Math.max(1, Math.ceil(e / (cell * 0.7))));
    for (let u = 0; u <= n; u++) for (let v = 0; u + v <= n; v++) {
      const s = u / n, w = v / n;
      const k = cellOf(ax + bx * s + cx * w, ay + by * s + cy * w, az + bz * s + cz * w);
      if (k >= 0) grid[k] = 1;
    }
  }
  const solid = (x: number, y: number, z: number): boolean => {
    if (y < y0) return true;                                  // the ground the model stands on
    const k = cellOf(x, y, z);
    return k >= 0 && grid[k] === 1;
  };
  const steps = 10, dist = cell * 10;
  const N = new THREE.Vector3(), T = new THREE.Vector3(), B = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    N.set(nrm.getX(i), nrm.getY(i), nrm.getZ(i));
    if (N.lengthSq() < 0.5) continue;
    N.normalize();
    T.set(Math.abs(N.y) < 0.9 ? 0 : 1, Math.abs(N.y) < 0.9 ? 1 : 0, 0).cross(N).normalize(); B.crossVectors(N, T);
    const px = pos.getX(i) + N.x * cell * 1.5, py = pos.getY(i) + N.y * cell * 1.5, pz = pos.getZ(i) + N.z * cell * 1.5;
    let occ = 0, wsum = 0;
    for (const [hx, hy, hz] of HEMI_C) {
      const dx = T.x * hx + B.x * hy + N.x * hz, dy = T.y * hx + B.y * hy + N.y * hz, dz = T.z * hx + B.z * hy + N.z * hz;
      wsum += hz;
      for (let st = 0; st < steps; st++) {
        const d = (st + 0.5) * (dist / steps);
        if (solid(px + dx * d, py + dy * d, pz + dz * d)) { occ += hz * (1 - (st / steps) * 0.5); break; }
      }
    }
    const k = Math.min(1, (occ / wsum) * AO_STRENGTH + Math.max(0, -N.y) * AO_DOWN);
    out[i * 3] = (plain[i * 3] ?? 1) * (1 - k + AO_TINT.r * k);
    out[i * 3 + 1] = (plain[i * 3 + 1] ?? 1) * (1 - k + AO_TINT.g * k);
    out[i * 3 + 2] = (plain[i * 3 + 2] ?? 1) * (1 - k + AO_TINT.b * k);
  }
  return out;
}
