// Copied from the hero lab (src/dev/nd-lab/hero/glb.ts, round-7-lab-hero) into the clean room.
// TRELLIS props → Kit-compatible geometry (lab P4 "hero", E169). A generated prop comes out of
// scripts/img2mesh/driftwood_post.py as a decimated, flat-shaded glb with COLOR_0 (rgb = albedo, a = baked AO). Here
// it becomes one KitX mesh the Jiehua / viewmodel programs draw like any built piece:
// - SMOOTH normals (averaged per position; the faceted look is Driftwood's, not this shard's — the ink line and the
//   2-band ramp need a smooth body), the original flat normal kept as the hull normal;
// - colours either SNAPPED to a palette (the style bible's washes: a TRELLIS atlas must never bring its own colours)
//   or, for metal, reduced to a luminance that modulates one wash (brass keeps its engraved crevices as darker brass);
// - the AO darkens the colour (crevices read as ink-dark), then drops.
import { type BufferGeometry, Color, Matrix4, Mesh, Vector3 } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { KitX, type XLook } from './kitx';

export interface GlbOpt {
  /** the material class / pattern kind written into aPat.x */
  kind: number;
  /** metal mode: colour = wash × (lo + hi·luminance) × AO */
  wash?: number;
  lumLo?: number;
  lumHi?: number;
  /** snap mode: every vertex takes the nearest palette colour (after AO) */
  palette?: readonly number[];
  /**
   * ramp mode (TRELLIS atlases come back dark and muddy): neutral vertices take the ramp step of their luminance
   * relative to the model's brightest (dark → light), saturated ones the hue class colour (skin, red, blue, green)
   */
  ramp?: readonly number[];
  hues?: { skin?: number; red?: number; blue?: number; green?: number };
  /** how much the baked AO darkens (0..1) */
  ao?: number;
  /** drop the triangles in the back `clipBack` share of the glTF z extent (the guard's socket ring) */
  clipBack?: number;
  /** transform applied to the positions (rotation / scale / offset) */
  matrix?: Matrix4;
  line?: number;
}

// the lab glbs are meshopt-compressed + quantised (gltf-transform meshopt): ~3.6x smaller than the post's raw output
const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);

/** the raw triangles of every mesh in a glb, world-transformed, non-indexed-safe */
async function readGlb(url: string): Promise<{ pos: Float32Array; col: Float32Array; ao: Float32Array; idx: Uint32Array }> {
  const gltf = await loader.loadAsync(url);
  gltf.scene.updateMatrixWorld(true);
  const P: number[] = [], C: number[] = [], A: number[] = [], I: number[] = [];
  gltf.scene.traverse((o) => {
    if (!(o instanceof Mesh)) return;
    const g = o.geometry as BufferGeometry;
    const pos = g.getAttribute('position');
    const col = g.getAttribute('color') as ReturnType<BufferGeometry['getAttribute']> | undefined;
    const base = P.length / 3;
    const v = new Vector3();
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld);
      P.push(v.x, v.y, v.z);
      if (col === undefined) { C.push(0.5, 0.5, 0.5); A.push(1); } else {
        C.push(col.getX(i), col.getY(i), col.getZ(i));
        A.push(col.itemSize > 3 ? col.getW(i) : 1);
      }
    }
    const index = g.getIndex();
    if (index === null) for (let i = 0; i < pos.count; i++) I.push(base + i);
    else for (let i = 0; i < index.count; i++) I.push(base + index.getX(i));
  });
  return { pos: new Float32Array(P), col: new Float32Array(C), ao: new Float32Array(A), idx: new Uint32Array(I) };
}

const lum = (r: number, g: number, b: number): number => 0.2126 * r + 0.7152 * g + 0.0722 * b;

/** load a post-processed TRELLIS glb as Kit-compatible geometry (smooth normals + aHullN-ready) */
export async function loadGlb(url: string, opt: GlbOpt): Promise<BufferGeometry> {
  const raw = await readGlb(url);
  if (opt.clipBack !== undefined && opt.clipBack > 0) {
    let zmin = Infinity, zmax = -Infinity;
    for (let i = 2; i < raw.pos.length; i += 3) { zmin = Math.min(zmin, raw.pos[i] ?? 0); zmax = Math.max(zmax, raw.pos[i] ?? 0); }
    const cut = zmin + (zmax - zmin) * opt.clipBack;
    const keep: number[] = [];
    for (let t = 0; t + 2 < raw.idx.length; t += 3) {
      const i0 = raw.idx[t] ?? 0, i1 = raw.idx[t + 1] ?? 0, i2 = raw.idx[t + 2] ?? 0;
      const zc = ((raw.pos[i0 * 3 + 2] ?? 0) + (raw.pos[i1 * 3 + 2] ?? 0) + (raw.pos[i2 * 3 + 2] ?? 0)) / 3;
      if (zc >= cut) keep.push(i0, i1, i2);
    }
    raw.idx = new Uint32Array(keep);
  }
  const n = raw.pos.length / 3;
  const m = opt.matrix ?? new Matrix4();
  const pos = new Float32Array(raw.pos.length);
  const v = new Vector3();
  for (let i = 0; i < n; i++) {
    v.set(raw.pos[i * 3] ?? 0, raw.pos[i * 3 + 1] ?? 0, raw.pos[i * 3 + 2] ?? 0).applyMatrix4(m);
    pos[i * 3] = v.x;
    pos[i * 3 + 1] = v.y;
    pos[i * 3 + 2] = v.z;
  }
  // smooth normals: area-weighted face normals accumulated per quantised position
  const key = (i: number): string => `${Math.round((pos[i * 3] ?? 0) * 1e4)},${Math.round((pos[i * 3 + 1] ?? 0) * 1e4)},${Math.round((pos[i * 3 + 2] ?? 0) * 1e4)}`;
  const acc = new Map<string, Vector3>();
  const a = new Vector3(), b = new Vector3(), c = new Vector3(), e1 = new Vector3(), e2 = new Vector3();
  for (let t = 0; t + 2 < raw.idx.length; t += 3) {
    const i0 = raw.idx[t] ?? 0, i1 = raw.idx[t + 1] ?? 0, i2 = raw.idx[t + 2] ?? 0;
    a.set(pos[i0 * 3] ?? 0, pos[i0 * 3 + 1] ?? 0, pos[i0 * 3 + 2] ?? 0);
    b.set(pos[i1 * 3] ?? 0, pos[i1 * 3 + 1] ?? 0, pos[i1 * 3 + 2] ?? 0);
    c.set(pos[i2 * 3] ?? 0, pos[i2 * 3 + 1] ?? 0, pos[i2 * 3 + 2] ?? 0);
    const fn = e1.subVectors(b, a).cross(e2.subVectors(c, a));
    for (const i of [i0, i1, i2]) {
      const k = key(i);
      let s = acc.get(k);
      if (s === undefined) { s = new Vector3(); acc.set(k, s); }
      s.add(fn);
    }
  }
  const nrm = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const s = acc.get(key(i)) ?? new Vector3(0, 1, 0);
    const l = s.length() > 1e-12 ? s.length() : 1;
    nrm[i * 3] = s.x / l;
    nrm[i * 3 + 1] = s.y / l;
    nrm[i * 3 + 2] = s.z / l;
  }
  // colours
  const col = new Float32Array(n * 3);
  const aoK = opt.ao ?? 0.7;
  let lmax = 1e-4;
  for (let i = 0; i < n; i++) lmax = Math.max(lmax, lum(raw.col[i * 3] ?? 0, raw.col[i * 3 + 1] ?? 0, raw.col[i * 3 + 2] ?? 0));
  const pal = (opt.palette ?? []).map((h) => new Color(h));
  const wash = new Color(opt.wash ?? 0xffffff);
  for (let i = 0; i < n; i++) {
    const r = raw.col[i * 3] ?? 0, g = raw.col[i * 3 + 1] ?? 0, bb = raw.col[i * 3 + 2] ?? 0;
    const ao = 1 - aoK * (1 - (raw.ao[i] ?? 1));
    let out = new Color(r * ao, g * ao, bb * ao);
    if (opt.ramp !== undefined && opt.ramp.length > 0) {
      const hsl = { h: 0, s: 0, l: 0 };
      new Color(r, g, bb).convertLinearToSRGB().getHSL(hsl);
      const hue = hsl.h * 360;
      const hc = opt.hues ?? {};
      let pick: number | undefined;
      if (hsl.s > 0.28 && hsl.l > 0.06) {
        if ((hue < 40 || hue > 340) && hsl.l > 0.18 && hc.skin !== undefined) pick = hue < 15 || hue > 340 ? (hc.red ?? hc.skin) : hc.skin;
        else if (hue >= 180 && hue < 260) pick = hc.blue;
        else if (hue >= 70 && hue < 170) pick = hc.green;
      }
      if (pick === undefined) {
        const l = Math.min(0.999, Math.max(0, lum(r, g, bb) / lmax) ** 0.75);
        pick = opt.ramp[Math.floor(l * opt.ramp.length)] ?? opt.ramp[0] ?? 0x808080;
      }
      out = new Color(pick).multiplyScalar(0.72 + 0.28 * ao);
    } else if (opt.wash !== undefined) {
      const l = lum(r, g, bb) / lmax;
      const k = ((opt.lumLo ?? 0.4) + (opt.lumHi ?? 0.8) * l) * ao;
      out = wash.clone().multiplyScalar(k);
    } else if (pal.length > 0) {
      let best = pal[0] ?? out, bd = Infinity;
      for (const p of pal) {
        // compare in a perceptual-ish space: sqrt-linear (≈ gamma) RGB
        const d = (Math.sqrt(p.r) - Math.sqrt(out.r)) ** 2 + (Math.sqrt(p.g) - Math.sqrt(out.g)) ** 2 + (Math.sqrt(p.b) - Math.sqrt(out.b)) ** 2;
        if (d < bd) { bd = d; best = p; }
      }
      out = best.clone().multiplyScalar(0.8 + 0.2 * ao);
    }
    col[i * 3] = out.r;
    col[i * 3 + 1] = out.g;
    col[i * 3 + 2] = out.b;
  }
  const look: XLook = { wash: 0xffffff, kind: opt.kind, line: opt.line ?? 1 };
  const x = new KitX();
  x.mesh(pos, nrm, col, raw.idx, look);
  return x.build();
}

/**
 * Seat a TRELLIS dragon head on the jian IN PROFILE (the targets' pose, round-6 A / B): its crown (glTF +Y) up the
 * blade (+y), its snout (glTF +Z) out to the blade's lower side (−x), its flank (glTF +X) toward the eye (+z). Scaled so
 * its snout-to-back length is `len` m, its centre at (`dx`, `dy`, 0).
 */
export function guardMatrix(bbox: { min: Vector3; max: Vector3 }, len: number, dx: number, dy: number, tilt: number): Matrix4 {
  const basis = new Matrix4().makeBasis(new Vector3(0, 0, 1), new Vector3(0, 1, 0), new Vector3(-1, 0, 0));
  const s = len / Math.max(bbox.max.z - bbox.min.z, 1e-4);
  const c = bbox.min.clone().add(bbox.max).multiplyScalar(0.5);
  const toOrigin = new Matrix4().makeTranslation(-c.x, -c.y, -c.z);
  const tiltM = new Matrix4().makeRotationZ(tilt);
  const lift = new Matrix4().makeTranslation(dx, dy, 0);
  return lift.multiply(tiltM).multiply(basis).multiply(new Matrix4().makeScale(s, s, s)).multiply(toOrigin);
}

/** the bounding box of a glb's positions (glTF space) */
export async function glbBox(url: string): Promise<{ min: Vector3; max: Vector3 }> {
  const raw = await readGlb(url);
  const min = new Vector3(Infinity, Infinity, Infinity), max = new Vector3(-Infinity, -Infinity, -Infinity);
  for (let i = 0; i < raw.pos.length; i += 3) {
    const q = new Vector3(raw.pos[i] ?? 0, raw.pos[i + 1] ?? 0, raw.pos[i + 2] ?? 0);
    min.min(q);
    max.max(q);
  }
  return { min, max };
}
