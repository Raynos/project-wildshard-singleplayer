/**
 * PaintKit — the model toolbox for Nalati's painterly POIs (B5). The painterly sibling of `lowpolyKit.ts`:
 * every static POI is one merged mesh on the ONE shared painterly material (`src/world/painterly.ts`), so detail
 * costs triangles, never draw calls — but the shapes stay SMOOTH (normals are computed per part before merging, not
 * per face) and the colour is painted per vertex: a base colour × a soft brush-noise, a darker foot, optional
 * per-face patterns (yurt ornament bands, felt rugs) and a ground-contact shade baked from the terrain at the end.
 *
 *   const kit = new PaintKit(seed);
 *   kit.add(new THREE.CylinderGeometry(0.1, 0.1, 2, 8), C.wood, { matrix: m });          // plain colour
 *   kit.add(lathe, (p) => (p.y > 1.2 ? C.red : C.felt), { matrix: m });                  // per-face pattern (local space)
 *   kit.add(rockGeo, C.granite, { top: { color: C.lichen, threshold: 0.6 } });            // lichen / snow on top faces
 *   const mesh = kit.mesh(sky, { ground: heightAt });                                     // merge + contact shade
 *
 * Helpers: `pole(a, b, r0, r1)` (a smooth round log between two points), `M(x, y, z, yaw, sx, sy, sz)` (a placement
 * matrix), `blob(r, rng)` (a smooth displaced sphere for rocks / stone heaps), `poiMaterial(sky)` (the shared
 * material, cached per sky).
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { Rng } from '../../core/rng';
import { Noise2D, smoothstep } from '../../core/noise';
import { painterlyMaterial } from '../painterly';
import type { Sky } from '../Sky';

export type ColorLike = THREE.Color | string | number;
/** per-face colour from the face centroid + normal, both in the part's LOCAL space (before `matrix`) */
export type Painter = (p: THREE.Vector3, n: THREE.Vector3) => ColorLike;

export interface PaintOpts {
  /** placement applied after painting */
  matrix?: THREE.Matrix4;
  /** whole-part lightness jitter ± (default 0.05) */
  jitter?: number;
  /** soft per-vertex brush noise ± (default 0.07) */
  brush?: number;
  /** colour multiplier at the part's lowest point (default 1 = none) → 1 at its top */
  foot?: number;
  /** blend a colour onto faces whose WORLD normal points up (lichen, snow, turf); `minY` = only above this world height */
  top?: { color: ColorLike; threshold?: number; amount?: number; minY?: number };
  /** keep the part faceted (flat normals) — cut timber, planks */
  flat?: boolean;
}

/** contact-shade target: a dusky violet-blue (the painterly shade side), as a colour multiplier */
const SHADE_TINT = new THREE.Color(0.55, 0.55, 0.78);

const tmpA = new THREE.Color();
const toColor = (c: ColorLike, out = tmpA): THREE.Color => (c instanceof THREE.Color ? out.copy(c) : out.set(c));

export class PaintKit {
  readonly rng: Rng;
  private parts: THREE.BufferGeometry[] = [];
  private noise: Noise2D;

  constructor(seed: number) { this.rng = new Rng(seed); this.noise = new Noise2D(seed ^ 0x51f3); }

  get triangleCount(): number { let n = 0; for (const p of this.parts) n += p.getAttribute('position').count / 3; return n; }
  get empty(): boolean { return this.parts.length === 0; }

  /** add a geometry (consumed) painted `col` — a colour, or a per-face painter in the part's local space */
  add(g: THREE.BufferGeometry, col: ColorLike | Painter, o: PaintOpts = {}): void {
    if (g.hasAttribute('uv')) g.deleteAttribute('uv');
    if (g.hasAttribute('uv1')) g.deleteAttribute('uv1');
    if (g.hasAttribute('color')) g.deleteAttribute('color');
    let ni: THREE.BufferGeometry;
    if (o.flat === true) {
      if (g.hasAttribute('normal')) g.deleteAttribute('normal');
      ni = g.index ? g.toNonIndexed() : g;
      ni.computeVertexNormals();
    } else {
      if (!g.hasAttribute('normal')) g.computeVertexNormals();
      ni = g.index ? g.toNonIndexed() : g;
    }
    if (ni !== g) g.dispose();
    const pos = ni.getAttribute('position'), nrm = ni.getAttribute('normal');
    const n = pos.count, out = new Float32Array(n * 3);
    const jitter = o.jitter ?? 0.05, brush = o.brush ?? 0.07;
    const kPart = 1 - jitter + this.rng.next() * jitter * 2;
    const c = new THREE.Color();
    if (typeof col === 'function') {
      const p = new THREE.Vector3(), nn = new THREE.Vector3();
      for (let i = 0; i + 2 < n; i += 3) {
        p.set((pos.getX(i) + pos.getX(i + 1) + pos.getX(i + 2)) / 3, (pos.getY(i) + pos.getY(i + 1) + pos.getY(i + 2)) / 3, (pos.getZ(i) + pos.getZ(i + 1) + pos.getZ(i + 2)) / 3);
        nn.set(nrm.getX(i) + nrm.getX(i + 1) + nrm.getX(i + 2), nrm.getY(i) + nrm.getY(i + 1) + nrm.getY(i + 2), nrm.getZ(i) + nrm.getZ(i + 1) + nrm.getZ(i + 2)).normalize();
        toColor(col(p, nn), c);
        for (let j = 0; j < 3; j++) { const q = (i + j) * 3; out[q] = c.r * kPart; out[q + 1] = c.g * kPart; out[q + 2] = c.b * kPart; }
      }
    } else {
      toColor(col, c);
      for (let i = 0; i < n; i++) { const q = i * 3; out[q] = c.r * kPart; out[q + 1] = c.g * kPart; out[q + 2] = c.b * kPart; }
    }
    // darker foot: by local height within the part
    if (o.foot !== undefined && o.foot !== 1) {
      let y0 = Infinity, y1 = -Infinity;
      for (let i = 0; i < n; i++) { const y = pos.getY(i); if (y < y0) y0 = y; if (y > y1) y1 = y; }
      const span = Math.max(1e-3, y1 - y0);
      for (let i = 0; i < n; i++) {
        const k = o.foot + (1 - o.foot) * smoothstep(0, 0.55, (pos.getY(i) - y0) / span);
        out[i * 3] = (out[i * 3] ?? 0) * k; out[i * 3 + 1] = (out[i * 3 + 1] ?? 0) * k; out[i * 3 + 2] = (out[i * 3 + 2] ?? 0) * k;
      }
    }
    ni.setAttribute('color', new THREE.BufferAttribute(out, 3));
    if (o.matrix) ni.applyMatrix4(o.matrix);
    // brush noise + top colour, in world space (so neighbouring parts share the same strokes)
    const top = o.top, topC = top ? toColor(top.color, new THREE.Color()) : null;
    const thr = top?.threshold ?? 0.6, amt = top?.amount ?? 0.85, minY = top?.minY ?? -Infinity;
    const nr = ni.getAttribute('normal');
    for (let i = 0; i < n; i++) {
      const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
      const b = 1 + brush * (this.noise.get(x * 0.9 + y * 0.35, z * 0.9 - y * 0.25) * 0.7 + this.noise.get(x * 3.1, z * 3.1 + y * 2) * 0.3);
      let r = (out[i * 3] ?? 0) * b, gg = (out[i * 3 + 1] ?? 0) * b, bb = (out[i * 3 + 2] ?? 0) * b;
      if (topC && y > minY) {
        const w = smoothstep(thr - 0.12, thr + 0.12, nr.getY(i) + this.noise.get(x * 0.6, z * 0.6) * 0.18) * amt;
        r += (topC.r - r) * w; gg += (topC.g - gg) * w; bb += (topC.b - bb) * w;
      }
      out[i * 3] = r; out[i * 3 + 1] = gg; out[i * 3 + 2] = bb;
    }
    this.parts.push(ni);
  }

  /**
   * Merge everything (the kit is empty afterwards). `ground` bakes a soft contact shade: vertices within `aoH` metres
   * of the terrain are pulled toward a cool shadow tint — what keeps a yurt or a stone from floating on the grass.
   * Faces pointing down lose a little light too.
   */
  finish(o: { ground?: (x: number, z: number) => number; aoH?: number; aoMin?: number } = {}): THREE.BufferGeometry {
    const geo = mergeGeometries(this.parts, false);
    for (const p of this.parts) p.dispose();
    this.parts = [];
    const pos = geo.getAttribute('position'), nrm = geo.getAttribute('normal'), col = geo.getAttribute('color');
    const tint = SHADE_TINT, aoH = o.aoH ?? 0.9, aoMin = o.aoMin ?? 0.55;
    for (let i = 0; i < pos.count; i++) {
      let k = 1 - Math.max(0, -nrm.getY(i)) * 0.18;
      if (o.ground) {
        const h = pos.getY(i) - o.ground(pos.getX(i), pos.getZ(i));
        k *= aoMin + (1 - aoMin) * smoothstep(-0.1, aoH, h);
      }
      const r = col.getX(i), g = col.getY(i), b = col.getZ(i);
      col.setXYZ(i, r * k + r * tint.r * (1 - k), g * k + g * tint.g * (1 - k), b * k + b * tint.b * (1 - k));
    }
    col.needsUpdate = true;
    geo.computeBoundingSphere();
    geo.computeBoundingBox();
    return geo;
  }

  /** finish() + a shadow-casting mesh on the shared POI material */
  mesh(sky: Sky, o: { ground?: (x: number, z: number) => number; aoH?: number; aoMin?: number } = {}): THREE.Mesh {
    const m = new THREE.Mesh(this.finish(o), poiMaterial(sky));
    m.castShadow = true; m.receiveShadow = true;
    return m;
  }
}


const mats = new WeakMap<Sky, THREE.MeshLambertMaterial>();
/** the one painterly material every Nalati POI mesh shares */
export function poiMaterial(sky: Sky): THREE.MeshLambertMaterial {
  let m = mats.get(sky);
  if (!m) { m = painterlyMaterial(sky, { vertexColors: true, rim: 0.35, bands: 0.8 }); mats.set(sky, m); }
  return m;
}

// ── helpers ─────────────────────────────────────────────────────────────────────────────────────────

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s = new THREE.Vector3(), _p = new THREE.Vector3();
/** a placement matrix: translate (x, y, z), yaw about +y (then optional pitch / roll), scale */
export function M(x: number, y: number, z: number, yaw = 0, sx = 1, sy = sx, sz = sx, pitch = 0, roll = 0): THREE.Matrix4 {
  _e.set(pitch, yaw, roll, 'YXZ');
  return new THREE.Matrix4().compose(_p.set(x, y, z), _q.setFromEuler(_e), _s.set(sx, sy, sz));
}

const UP = new THREE.Vector3(0, 1, 0);
/** a smooth round pole / log from a to b, radius r0 at a → r1 at b */
export function pole(a: THREE.Vector3, b: THREE.Vector3, r0: number, r1 = r0, sides = 7): THREE.BufferGeometry {
  const d = new THREE.Vector3().subVectors(b, a);
  const len = d.length();
  const g = new THREE.CylinderGeometry(r1, r0, len, sides, 1, false, 0.3);
  g.applyMatrix4(_m.makeRotationFromQuaternion(_q.setFromUnitVectors(UP, d.normalize())));
  g.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
  return g;
}
export const v3 = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);

/** a smooth lumpy stone: an icosphere (detail 2 = 320 faces, 1 = 80) displaced by seeded noise, squashed */
export function blob(r: number, rng: Rng, detail = 1, squash = 0.75, rough = 0.22): THREE.BufferGeometry {
  const g = new THREE.IcosahedronGeometry(r, detail);
  const merged = mergeVerticesByPos(g);
  const pos = merged.getAttribute('position');
  const ox = rng.range(0, 100), oz = rng.range(0, 100);
  const nz = new Noise2D(rng.int(1, 1e6));
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const k = 1 + rough * (nz.get(x / r * 1.3 + ox, z / r * 1.3 + y / r + oz) * 0.75 + nz.get(x / r * 3 + oz, y / r * 3 - ox) * 0.25);
    pos.setXYZ(i, x * k, y * k * squash, z * k);
  }
  merged.computeVertexNormals();
  return merged;
}

/** weld an unindexed / seam-split geometry by position (so displacement keeps it watertight and normals smooth) */
export function mergeVerticesByPos(g: THREE.BufferGeometry): THREE.BufferGeometry {
  const src = g.index ? g.toNonIndexed() : g;
  const pos = src.getAttribute('position');
  const map = new Map<string, number>();
  const verts: number[] = [], idx: number[] = [];
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const key = `${Math.round(x * 1e4)},${Math.round(y * 1e4)},${Math.round(z * 1e4)}`;
    let k = map.get(key);
    if (k === undefined) { k = verts.length / 3; verts.push(x, y, z); map.set(key, k); }
    idx.push(k);
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  out.setIndex(idx);
  if (src !== g) src.dispose();
  g.dispose();
  return out;
}

/** a lathe from a (radius, height) profile, `seg` around; smooth normals */
export function lathe(profile: [number, number][], seg: number): THREE.BufferGeometry {
  const g = new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(r, y)), seg);
  // LatheGeometry duplicates the seam column: weld it so the normals are smooth all the way round
  const w = mergeVerticesByPos(g);
  w.computeVertexNormals();
  return w;
}
