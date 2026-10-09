import { cacheUntilDisposed } from '@wildshard/engine/app/cachedAssets';
/**
 * PaintKit — the model toolbox for Nalati's painterly POIs (B5). The painterly sibling of `lowpolyKit.ts`:
 * every static POI is one merged mesh on the ONE shared painterly material (`src/engine/world/painterly.ts`), so detail
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
import { loadNalatiTexture, type NalatiTexName } from '../look/nalatiTextures';
import { Noise2D, smoothstep } from '@wildshard/engine/core/noise';
import { Rng } from '@wildshard/engine/core/rng';
import { pole } from '@wildshard/engine/world/geometryKit';
import { painterlyMaterial } from '@wildshard/engine/world/painterly';
import type { SkyRig as Sky } from '@wildshard/engine/world/skyRig';
import { voxelAO, aoTint, hemisphere } from '@wildshard/engine/world/voxelAO';

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
  top?: { color: ColorLike; threshold?: number; amount?: number; minY?: number } | undefined;
  /** keep the part faceted (flat normals) — cut timber, planks */
  flat?: boolean;
  /** keep the part's `uv` and put it on the kit's TEXTURED layer (finishTextured / texturedMesh: a painted map) */
  uv?: boolean;
  /** which textured layer (default 'felt'): a kit can carry several, each finished by `texturedMesh(sky, name)` */
  tex?: NalatiTexName;
}

/** contact-shade target: a dusky violet-blue (the painterly shade side), as a colour multiplier */
const SHADE_TINT = new THREE.Color(0.55, 0.55, 0.78);

const tmpA = new THREE.Color();
const toColor = (c: ColorLike, out = tmpA): THREE.Color => (c instanceof THREE.Color ? out.copy(c) : out.set(c));

export interface FinishOpts {
  /** terrain height — contact shade + the AO grid's floor */
  ground?: (x: number, z: number) => number;
  /** contact-shade height (m, default 0.9) and how dark it gets at the ground (default 0.55) */
  aoH?: number;
  aoMin?: number;
  /** baked ambient occlusion (default on); `false` skips it */
  ao?: AOOpts | false;
}

export class PaintKit {
  readonly rng: Rng;
  private parts: THREE.BufferGeometry[] = [];
  /** parts that keep their uv, for a mesh with a painted texture (nalatiTextures.ts) */
  private uvLayers = new Map<NalatiTexName, THREE.BufferGeometry[]>();
  private noise: Noise2D;

  constructor(seed: number) { this.rng = new Rng(seed); this.noise = new Noise2D(seed ^ 0x51f3); }

  get triangleCount(): number { let n = 0; for (const p of this.parts) n += p.getAttribute('position').count / 3; return n; }
  get empty(): boolean { return this.parts.length === 0; }
  get texturedTriangles(): number { let n = 0; for (const l of this.uvLayers.values()) for (const p of l) n += p.getAttribute('position').count / 3; return n; }

  /** add a geometry (consumed) painted `col` — a colour, or a per-face painter in the part's local space */
  add(g: THREE.BufferGeometry, col: ColorLike | Painter, o: PaintOpts = {}): void {
    const keepUv = o.uv === true && g.hasAttribute('uv');
    if (g.hasAttribute('uv') && !keepUv) g.deleteAttribute('uv');
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
      const b = 1 + brush * this.noise.get(x * 1.3 + y * 0.35, z * 1.3 - y * 0.8);
      let r = (out[i * 3] ?? 0) * b, gg = (out[i * 3 + 1] ?? 0) * b, bb = (out[i * 3 + 2] ?? 0) * b;
      if (topC && y > minY) {
        const w = smoothstep(thr - 0.12, thr + 0.12, nr.getY(i) + this.noise.get(x * 0.6, z * 0.6) * 0.18) * amt;
        r += (topC.r - r) * w; gg += (topC.g - gg) * w; bb += (topC.b - bb) * w;
      }
      out[i * 3] = r; out[i * 3 + 1] = gg; out[i * 3 + 2] = bb;
    }
    if (keepUv) {
      const k = o.tex ?? 'felt';
      let l = this.uvLayers.get(k); if (!l) this.uvLayers.set(k, (l = []));
      l.push(ni);
    } else this.parts.push(ni);
  }

  /**
   * Merge everything (the kit is empty afterwards). Then the painted light that makes a model stop reading as plastic:
   *   - `ao` (default on): a smooth baked ambient occlusion — every distinct vertex position fires hemisphere rays
   *     through a voxel grid of the whole POI (and the terrain under it), so crevices, the underside of an eave, the
   *     gaps between crib logs and the foot of every stone darken toward a cool shade tint;
   *   - `ground`: a soft contact shade for vertices within `aoH` metres of the terrain;
   *   - a sky gradient: faces that look up are a touch lighter, faces that look down a touch darker.
   */
  finish(o: FinishOpts = {}): THREE.BufferGeometry {
    const geo = PaintKit.shade(this.parts, o);
    this.parts = [];
    return geo;
  }

  /** the textured layer `name` (parts added with `uv: true`, `tex: name`; default 'felt'), shaded the same way; null when it is empty */
  finishTextured(o: FinishOpts = {}, name: NalatiTexName = 'felt'): THREE.BufferGeometry | null {
    const parts = this.uvLayers.get(name);
    if (!parts || parts.length === 0) return null;
    const geo = PaintKit.shade(parts, o);
    this.uvLayers.delete(name);
    return geo;
  }

  /** finishTextured() on a painterly material carrying the painted `name` texture (lazy-loaded) */
  texturedMesh(sky: Sky, name: NalatiTexName, o: FinishOpts = {}): THREE.Mesh | null {
    const geo = this.finishTextured(o, name);
    if (!geo) return null;
    const m = new THREE.Mesh(geo, texturedMaterial(sky, name));
    m.castShadow = true; m.receiveShadow = true;
    return m;
  }

  private static shade(parts: THREE.BufferGeometry[], o: FinishOpts): THREE.BufferGeometry {
    const geo = mergeGeometries(parts, false);
    for (const p of parts) p.dispose();
    if (o.ao !== false) bakeSmoothAO(geo, { ...o.ao, ...(o.ground ? { ground: o.ground } : {}) });
    const pos = geo.getAttribute('position'), nrm = geo.getAttribute('normal'), col = geo.getAttribute('color');
    const tint = SHADE_TINT, aoH = o.aoH ?? 0.9, aoMin = o.aoMin ?? 0.55;
    for (let i = 0; i < pos.count; i++) {
      const ny = nrm.getY(i);
      let k = ny > 0 ? 1 + ny * 0.07 : 1 + ny * 0.2;
      if (o.ground) {
        const h = pos.getY(i) - o.ground(pos.getX(i), pos.getZ(i));
        k *= aoMin + (1 - aoMin) * smoothstep(-0.1, aoH, h);
      }
      const r = col.getX(i), g = col.getY(i), bl = col.getZ(i);
      if (k >= 1) col.setXYZ(i, r * k, g * k, bl * k);
      else col.setXYZ(i, r * k + r * tint.r * (1 - k), g * k + g * tint.g * (1 - k), bl * k + bl * tint.b * (1 - k));
    }
    col.needsUpdate = true;
    geo.computeBoundingSphere();
    geo.computeBoundingBox();
    return geo;
  }

  /** finish() + a shadow-casting mesh on the shared POI material */
  mesh(sky: Sky, o: FinishOpts = {}): THREE.Mesh {
    const m = new THREE.Mesh(this.finish(o), poiMaterial(sky));
    m.castShadow = true; m.receiveShadow = true;
    return m;
  }
}


const mats = new WeakMap<Sky, THREE.MeshLambertMaterial>();
/** the one painterly material every Nalati POI mesh shares */
export function poiMaterial(sky: Sky): THREE.MeshLambertMaterial {
  let m = mats.get(sky);
  if (!m) { m = painterlyMaterial(sky, { vertexColors: true, rim: 0.35, bands: 0.8 }); mats.set(sky, m); const cached = m; cacheUntilDisposed(cached, () => { if (mats.get(sky) === cached) mats.delete(sky); }); }
  return m;
}

const texMats = new WeakMap<Sky, Map<NalatiTexName, THREE.MeshLambertMaterial>>();
/**
 * The painterly material with a painted map (one per texture name, shared). It starts on a 1×1 white placeholder (the
 * same USE_MAP program, so no recompile) and swaps in the painted tile when it has loaded.
 */
export function texturedMaterial(sky: Sky, name: NalatiTexName): THREE.MeshLambertMaterial {
  let byName = texMats.get(sky);
  if (!byName) { byName = new Map(); texMats.set(sky, byName); }
  let m = byName.get(name);
  if (!m) {
    const mat = painterlyMaterial(sky, { vertexColors: true, rim: 0.3, bands: 0.8 });
    const white = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
    white.colorSpace = THREE.SRGBColorSpace; white.wrapS = white.wrapT = THREE.RepeatWrapping; white.needsUpdate = true;
    mat.map = white;
    loadNalatiTexture(name).then((t) => { mat.map = t; return t; }).catch(() => null);                // on failure the placeholder stays: vertex colour only
    byName.set(name, mat);
    const cache = byName; cacheUntilDisposed(mat, () => { if (cache.get(name) === mat) cache.delete(name); });
    m = mat;
  }
  return m;
}

// ── helpers ─────────────────────────────────────────────────────────────────────────────────────────

const _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s = new THREE.Vector3(), _p = new THREE.Vector3();
/** a placement matrix: translate (x, y, z), yaw about +y (then optional pitch / roll), scale */
export function M(x: number, y: number, z: number, yaw = 0, sx = 1, sy = sx, sz = sx, pitch = 0, roll = 0): THREE.Matrix4 {
  _e.set(pitch, yaw, roll, 'YXZ');
  return new THREE.Matrix4().compose(_p.set(x, y, z), _q.setFromEuler(_e), _s.set(sx, sy, sz));
}

// the smooth primitives live in the engine geometry kit (E357 X5); re-exported for this shard's builders
export const v3 = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);

// ── smooth baked ambient occlusion ──────────────────────────────────────────────────────────────────

export interface AOOpts {
  /** voxel size (m); default: the bbox fitted into ~180 cells on its longest side, 0.12 … 0.8 */
  cell?: number;
  /** ray length (m, default 7 cells) */
  dist?: number;
  /** 0..1 how dark a fully enclosed vertex goes (default 0.6) */
  strength?: number;
  ground?: (x: number, z: number) => number;
}

// 9 fixed hemisphere directions (z-up tangent frame), cosine-ish spread — deterministic bakes
const HEMI = hemisphere([[0.94, 1], [0.66, 3], [0.3, 5]], 2.1);

/** darken a merged, non-indexed, vertex-coloured geometry by how enclosed each vertex position is (smooth: per position;
 *  the one `voxelAO`, welded) */
export function bakeSmoothAO(geo: THREE.BufferGeometry, o: AOOpts = {}): void {
  if (!geo.hasAttribute('color') || !geo.hasAttribute('normal')) return;
  geo.computeBoundingBox();
  const bb = geo.boundingBox;
  if (bb === null) return;
  const ext = new THREE.Vector3().subVectors(bb.max, bb.min);
  let cell = o.cell ?? Math.min(0.8, Math.max(0.15, Math.max(ext.x, ext.y, ext.z) / 140));
  const cellsFor = (c: number) => (Math.ceil(ext.x / c) + 5) * (Math.ceil(ext.y / c) + 5) * (Math.ceil(ext.z / c) + 5);
  while (cellsFor(cell) > 6e6) cell *= 1.25;
  const dist = o.dist ?? cell * 6;
  const k = voxelAO(geo, {
    box: bb, cell, pad: 2, spacing: 0.9, maxSamples: 64, indexed: false, ...(o.ground ? { ground: { columns: o.ground } } : {}),
    sample: 'weld', offset: 1.1, hemi: HEMI, steps: Math.max(3, Math.round(dist / cell)), stepLen: cell, falloff: 0.6,
    strength: o.strength ?? 0.6, downDark: 0,
  });
  aoTint(geo.getAttribute('color'), k, SHADE_TINT, 0.55);
}

const hash3 = (x: number, y: number, z: number): number => { const h = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453; return h - Math.floor(h); };
/**
 * Weathered timber (E302, NALATI-FINISH B9: the fence rails read as untextured purple-grey boxes): the wood colour, the
 * faces that look up silvered by the weather. The grain itself is the texture of the kit's textured layer, laid along
 * each pole by `woodPole` — a per-face stroke here would split every quad into two triangles of different paint.
 * `gain` scales the result (a textured layer's 1 / tile mean, so the texture keeps the painted colour on average).
 */
export function woodPainter(base: ColorLike, silver: ColorLike = '#b3a792', gain?: THREE.Color): Painter {
  const b = toColor(base, new THREE.Color()), sv = toColor(silver, new THREE.Color()), g = gain ?? new THREE.Color(1, 1, 1), out = new THREE.Color();
  return (_pos, n) => { const up = Math.max(0, n.y); return out.copy(b).lerp(sv, up * up * 0.55).multiply(g); };
}

/**
 * `pole()` with its uv laid for a painted tile as wood grain (the kit's textured layer): the tile squeezed round the
 * pole and stretched along it, so its detail runs as streaks down the timber; a per-pole offset so neighbours differ.
 * `tileAround` / `tileAlong` = metres of the timber one tile covers (defaults: 0.7 m round, 22 m along).
 */
export function woodPole(a: THREE.Vector3, b: THREE.Vector3, r0: number, r1 = r0, sides = 7, segs = 1, tileAround = 0.7, tileAlong = 22): THREE.BufferGeometry {
  const g = pole(a, b, r0, r1, sides, segs);
  const uv = g.getAttribute('uv'), len = a.distanceTo(b), circ = Math.PI * (r0 + r1);
  const ou = hash3(a.x, a.y, a.z), ov = hash3(b.z, b.x, b.y);
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * circ / tileAround + ou, uv.getY(i) * len / tileAlong + ov);
  return g;
}

/** a painter for a log: bark along its length, pale end grain with a darker heart on its cut ends */
export function logPainter(a: THREE.Vector3, b: THREE.Vector3, bark: ColorLike, end: ColorLike = '#c9a878'): Painter {
  const ax = new THREE.Vector3().subVectors(b, a).normalize();
  const bk = toColor(bark, new THREE.Color()), en = toColor(end, new THREE.Color()), heart = en.clone().multiplyScalar(0.7);
  const tmp = new THREE.Vector3();
  return (p, n) => {
    if (Math.abs(n.dot(ax)) < 0.85) return bk;
    const da = tmp.subVectors(p, a).dot(ax), dbb = tmp.subVectors(p, b).dot(ax);
    const c = Math.abs(da) < Math.abs(dbb) ? a : b;
    const r = tmp.subVectors(p, c).addScaledVector(ax, -tmp.dot(ax)).length();
    return r < 0.05 ? heart : en;
  };
}
