/**
 * Driftwood's offline plant builders and baked point light (sp-o250). Only the shard's generators reach these: the
 * shrine, cove, hut, shipwreck and ground-cover bakes paint their GLBs with them, so none of it ships at runtime. Moved
 * verbatim from the engine's lowpolyKit, which keeps its own copy only while the frozen legacy folder imports it (SF73).
 */
import * as THREE from 'three';
import type { Rng } from '@wildshard/engine/core/rng';
import { log, tris } from '@wildshard/engine/world/geometryKit';
import type { ColorLike } from '@wildshard/engine/world/lowpolyKit';

const tmpColor = new THREE.Color();
const asColor = (c: ColorLike): THREE.Color => (typeof c === 'string' ? tmpColor.set(c) : c);

// ── plants (multi-colour parts: `kit.addParts(fern(rng, 1), { matrix })`) ────────────────────────

/** a geometry + the colour to paint it: plants are a few of these */
export type Part = [THREE.BufferGeometry, ColorLike];

export const PLANT = {
  leaf: '#4f8f34', leafB: '#63a63c', leafDark: '#3c7430', leafLight: '#7fbf4a', stem: '#5b7a34',
  hibiscus: '#e2372c', hibiscusB: '#f0543a', stamen: '#ffd24a', lily: '#4f9a3c', lilyB: '#66ad45', lotus: '#f4f0ea', lotusPink: '#f2b6c6',
  grass: '#7cbc45', grassB: '#95cc55', grassTip: '#b9dc6e',
};

/**
 * A leaf along +z from the origin: a diamond folded along its midrib (the edges ride `fold` × width above it), the tip
 * drooping `droop` × length. 4 triangles.
 */
export function leaf(len: number, w: number, fold = 0.25, droop = 0.3): THREE.BufferGeometry {
  const f = fold * w, mid = len * 0.42;
  const B = [0, 0, 0], L = [-w / 2, f, mid], R = [w / 2, f, mid], M = [0, -f * 0.2, mid], T = [0, -droop * len, len];
  return tris([...B, ...M, ...L, ...B, ...R, ...M, ...M, ...T, ...L, ...M, ...R, ...T]);
}

/** place a leaf: yaw about +y, then tilted up by `pitch` (0 = flat out, π/2 = straight up), at (x, y, z) */
function leafAt(g: THREE.BufferGeometry, yaw: number, pitch: number, x = 0, y = 0, z = 0): THREE.BufferGeometry {
  return g.rotateX(-pitch).rotateY(yaw).translate(x, y, z);
}

/** a fern: 7–9 long narrow fronds fanning out and up from the crown */
export function fern(rng: Rng, size = 1): Part[] {
  const out: Part[] = [];
  const n = rng.int(7, 9);
  for (let i = 0; i < n; i++) {
    const yaw = (i / n) * Math.PI * 2 + rng.range(-0.25, 0.25), len = size * rng.range(0.75, 1.1);
    out.push([leafAt(leaf(len, len * 0.2, 0.18, 0.35), yaw, rng.range(0.45, 0.85)), i % 3 === 0 ? PLANT.leafLight : i % 2 ? PLANT.leaf : PLANT.leafB]);
  }
  return out;
}

/** a broad-leaf clump (taro / monstera): 5–7 wide leaves on short stems */
export function broadClump(rng: Rng, size = 1): Part[] {
  const out: Part[] = [];
  const n = rng.int(5, 7);
  for (let i = 0; i < n; i++) {
    const yaw = (i / n) * Math.PI * 2 + rng.range(-0.3, 0.3), len = size * rng.range(0.6, 0.9), up = rng.range(0.15, 0.45) * size;
    const pitch = rng.range(0.35, 0.8);
    out.push([leafAt(leaf(len, len * 0.62, 0.22, 0.28), yaw, pitch, Math.sin(yaw) * 0.08 * size, up, Math.cos(yaw) * 0.08 * size), i % 2 ? PLANT.leafDark : PLANT.leaf]);
    out.push([log(new THREE.Vector3(0, 0, 0), new THREE.Vector3(Math.sin(yaw) * 0.08 * size, up, Math.cos(yaw) * 0.08 * size), 0.025 * size, 0.02 * size, 3), PLANT.stem]);
  }
  return out;
}

/** a hibiscus flower facing +y at the origin: five red petals and a yellow stamen */
export function hibiscus(r = 0.14): Part[] {
  const out: Part[] = [];
  for (let k = 0; k < 5; k++) {
    const a = (k / 5) * Math.PI * 2, b = a + Math.PI / 5, c = a - Math.PI / 5;
    const v = [0, 0, 0, Math.cos(c) * r * 0.75, r * 0.25, Math.sin(c) * r * 0.75, Math.cos(a) * r, r * 0.35, Math.sin(a) * r,
      0, 0, 0, Math.cos(a) * r, r * 0.35, Math.sin(a) * r, Math.cos(b) * r * 0.75, r * 0.25, Math.sin(b) * r * 0.75];
    out.push([tris(v), k % 2 ? PLANT.hibiscus : PLANT.hibiscusB]);
  }
  out.push([new THREE.ConeGeometry(r * 0.1, r * 0.9, 4).translate(0, r * 0.45, 0), PLANT.stamen]);
  return out;
}

/** a hibiscus bush: a broad-leaf clump with 3–5 flowers on top */
export function hibiscusBush(rng: Rng, size = 1): Part[] {
  const out = broadClump(rng, size);
  const n = rng.int(3, 5);
  for (let k = 0; k < n; k++) {
    const a = rng.range(0, Math.PI * 2), d = rng.range(0.1, 0.45) * size, y = rng.range(0.35, 0.6) * size, m = new THREE.Matrix4().makeRotationX(rng.range(-0.6, 0.6)).premultiply(new THREE.Matrix4().makeTranslation(Math.cos(a) * d, y, Math.sin(a) * d));
    for (const [g, c] of hibiscus(0.12 * size + 0.04)) out.push([g.applyMatrix4(m), c]);
  }
  return out;
}

/** a lily pad lying flat at y = 0: an 8-segment disc with a notch */
export function lilyPad(r: number, rot = 0): THREE.BufferGeometry {
  const v: number[] = [];
  for (let k = 0; k < 8; k++) {
    if (k === 0) continue;
    const a0 = rot + (k / 8) * Math.PI * 2, a1 = rot + ((k + 1) / 8) * Math.PI * 2;
    v.push(0, 0.01, 0, Math.cos(a1) * r, 0, Math.sin(a1) * r, Math.cos(a0) * r, 0, Math.sin(a0) * r);
  }
  return tris(v);
}

/** a lotus: six raised white petals round a yellow heart */
export function lotus(r = 0.16): Part[] {
  const out: Part[] = [];
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2, w = r * 0.45;
    const tip = [Math.cos(a) * r, r * 0.8, Math.sin(a) * r], l = [Math.cos(a + 0.6) * w, r * 0.15, Math.sin(a + 0.6) * w], rr = [Math.cos(a - 0.6) * w, r * 0.15, Math.sin(a - 0.6) * w];
    out.push([tris([0, 0, 0, ...l, ...tip, 0, 0, 0, ...tip, ...rr]), k % 2 ? PLANT.lotus : PLANT.lotusPink]);
  }
  out.push([new THREE.CylinderGeometry(r * 0.25, r * 0.2, r * 0.3, 5).translate(0, r * 0.2, 0), PLANT.stamen]);
  return out;
}

/** a grass tuft: 5–8 bent blades (one triangle each) */
export function grassTuft(rng: Rng, h = 0.4): Part[] {
  const out: Part[] = [];
  const n = rng.int(5, 8);
  for (let k = 0; k < n; k++) {
    const a = rng.range(0, Math.PI * 2), lean = rng.range(0.15, 0.55), hh = h * rng.range(0.6, 1.1), w = h * 0.09;
    const ox = Math.cos(a) * 0.05, oz = Math.sin(a) * 0.05, tx = ox + Math.cos(a) * hh * lean, tz = oz + Math.sin(a) * hh * lean;
    const px = -Math.sin(a) * w, pz = Math.cos(a) * w;
    out.push([tris([ox - px, 0, oz - pz, ox + px, 0, oz + pz, tx, hh, tz]), k % 3 === 0 ? PLANT.grassTip : k % 2 ? PLANT.grass : PLANT.grassB]);
  }
  return out;
}

/** a hanging vine strand from `top` down `len` m, a leaf pair every 0.3 m (in the plane across `across`) */
export function vineStrand(top: THREE.Vector3, len: number, across: THREE.Vector3, rng: Rng): Part[] {
  const out: Part[] = [];
  const bot = top.clone().add(new THREE.Vector3(rng.range(-0.1, 0.1), -len, rng.range(-0.1, 0.1)));
  const w = across.clone().normalize().multiplyScalar(0.035);
  out.push([tris([top.x - w.x, top.y, top.z - w.z, top.x + w.x, top.y, top.z + w.z, bot.x, bot.y, bot.z]), PLANT.stem]);
  for (let s = 0.25; s < len; s += 0.3) {
    const p = top.clone().lerp(bot, s / len), side = rng.next() < 0.5 ? 1 : -1, l = rng.range(0.1, 0.17);
    const tip = p.clone().addScaledVector(w, side * l / 0.035 * 0.9).add(new THREE.Vector3(0, -l * 0.6, 0));
    const b1 = p.clone().add(new THREE.Vector3(0, -l * 0.25, 0)).addScaledVector(w, side * 1.5);
    out.push([tris([p.x, p.y, p.z, b1.x, b1.y, b1.z, tip.x, tip.y, tip.z]), rng.next() < 0.5 ? PLANT.leaf : PLANT.leafB]);
  }
  return out;
}

// ── baked point light ─────────────────────────────────────────────────────────────────────────────

export interface BakedLight { x: number; y: number; z: number; color: ColorLike; /** metres to zero */ range: number; /** 0..~2 */ intensity: number }

/**
 * Bake warm lantern / ember light into the vertex colours (after `finish`, so the AO is under it): every face that
 * FACES a light within its range is lifted toward colour × light (smooth falloff × N·L). No shadowing — a face behind a
 * wall that faces the light still catches it — so keep ranges inside the room they light. Runtime cost: none, which is
 * the point (no point light in every shader, no program recompile when a lantern goes out).
 */
export function bakeLight(geo: THREE.BufferGeometry, lights: BakedLight[]): void {
  if (!geo.hasAttribute('color') || geo.index !== null || lights.length === 0) return;
  const pos = geo.getAttribute('position'), col = geo.getAttribute('color');
  if (!geo.hasAttribute('normal')) geo.computeVertexNormals();
  const nrm = geo.getAttribute('normal');
  const lc = lights.map((l) => asColor(l.color).clone());
  for (let i = 0; i < pos.count; i += 3) {
    const cx = (pos.getX(i) + pos.getX(i + 1) + pos.getX(i + 2)) / 3, cy = (pos.getY(i) + pos.getY(i + 1) + pos.getY(i + 2)) / 3, cz = (pos.getZ(i) + pos.getZ(i + 1) + pos.getZ(i + 2)) / 3;
    const nx = nrm.getX(i), ny = nrm.getY(i), nz = nrm.getZ(i);
    let r = 0, g = 0, b = 0;
    for (let k = 0; k < lights.length; k++) {
      const l = lights[k], c = lc[k];
      if (l === undefined || c === undefined) continue;
      const dx = l.x - cx, dy = l.y - cy, dz = l.z - cz, d = Math.hypot(dx, dy, dz);
      if (d >= l.range) continue;
      const ndl = d < 1e-4 ? 1 : Math.max(0, (dx * nx + dy * ny + dz * nz) / d);
      const f = (1 - d / l.range) ** 1.4 * (0.35 + 0.65 * ndl) * l.intensity;
      r += c.r * f; g += c.g * f; b += c.b * f;
    }
    if (r + g + b <= 0) continue;
    for (let j = 0; j < 3; j++) {
      const v = i + j;
      col.setXYZ(v, col.getX(v) * (1 + r * 2.2) + r * 0.16, col.getY(v) * (1 + g * 2.2) + g * 0.16, col.getZ(v) * (1 + b * 2.2) + b * 0.16);
    }
  }
  col.needsUpdate = true;
}
