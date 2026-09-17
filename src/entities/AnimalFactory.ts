import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { Noise2D } from '../core/noise';
import { Rng } from '../core/rng';
import type { Sky } from '../world/Sky';
import { attachFogUniforms, fogUniforms } from '../world/Atmosphere';

/**
 * AnimalFactory — procedural, code-built deer and boar.
 *
 * Every animal is ONE SkinnedMesh (two material groups: fur + hard parts) built from lofted
 * cross-sections ("stations") along spine / neck / leg curves, merged with
 * BufferGeometryUtils.mergeGeometries. Each station carries bone weights, so the neck and legs
 * skin smoothly across joints instead of breaking into rigid tubes. Large-scale coloration
 * (belly, throat, rump patch, dark legs, nose) is baked into vertex colours; a tileable fur
 * albedo + normal detail texture (Canvas2D, streaked along the body axis) is multiplied on top.
 *
 *   const factory = new AnimalFactory(sky);
 *   const model = factory.model('deer', 'stag');        // 'deer' | 'boar', variant 'stag' | 'hind' | 'boar'
 *   const rig = factory.instantiate(model, tintSeed);   // { mesh, bones, materials }
 *
 * Animal-local space: +Z forward (nose), +Y up, origin on the ground under the body centre.
 * Bone names: body, neck1, neck2, head, earL, earR, tail, and per leg
 *   FL/FR: shoulder, carpus, fetlock   BL/BR: hip, stifle, hock   (e.g. 'FL_shoulder').
 * All bones have identity rotation in the bind pose, so Animal.ts can drive them with plain
 * Euler angles relative to rest.
 */

export type AnimalKind = 'deer' | 'boar';
export type AnimalVariant = 'stag' | 'hind' | 'boar';

export interface AnimalDims {
  /** height of the body bone (spine centre) above ground in the bind pose */
  bodyY: number;
  /** half-length of the body capsule along Z (for hit tests) */
  bodyHalfLen: number;
  /** radius of the body capsule */
  bodyRadius: number;
  /** head hit-sphere radius */
  headRadius: number;
  /** rest length of the front leg (shoulder → hoof) — drives stride frequency */
  legLen: number;
  /** foot rest positions (x, z) per leg FL, FR, BL, BR */
  feet: [number, number][];
  /** width of the body (for the corpse's resting height when rolled on its side) */
  halfWidth: number;
}

export interface BoneDef { name: string; parent: string | null; pos: [number, number, number] }

export interface AnimalModel {
  kind: AnimalKind;
  variant: AnimalVariant;
  geometry: THREE.BufferGeometry;
  bones: BoneDef[];
  dims: AnimalDims;
  fur: THREE.MeshPhysicalMaterial;
  hard: THREE.MeshStandardMaterial;
  eye: THREE.MeshPhysicalMaterial;
}

export interface AnimalRig {
  mesh: THREE.SkinnedMesh;
  bones: Record<string, THREE.Bone>;
  materials: THREE.MeshStandardMaterial[];
}

// ─────────────────────────────────────────────────────────────────────────────────────────
// Loft builder
// ─────────────────────────────────────────────────────────────────────────────────────────

interface Station {
  x: number; y: number; z: number;
  rx: number; ry: number;
  top: number; bot: number;       // asymmetric vertical scale (withers hump / deep belly)
  b0: number; b1: number; w1: number; // skin: bone b0 with weight 1-w1, bone b1 with w1
}

type Paint = (out: THREE.Color, x: number, y: number, z: number, nx: number, ny: number, nz: number, part: string, t: number, a: number) => void;

const TEX_M = 0.32; // metres per detail-texture repeat

const _t = new THREE.Vector3(), _side = new THREE.Vector3(), _up = new THREE.Vector3(), _n = new THREE.Vector3(), _c = new THREE.Color();

/** Loft a closed tube through `st` stations with `seg` sides; returns an indexed geometry with position/normal/uv/color/skinIndex/skinWeight. */
let shagAmp = 0; // metres of noise displacement along the ring normal (set per species before lofting)
function loft(st: Station[], seg: number, part: string, paint: Paint, capStart = true, capEnd = true, frame: 'x' | 'z' = 'x'): THREE.BufferGeometry {
  const n = st.length;
  const pos: number[] = [], nor: number[] = [], uv: number[] = [], col: number[] = [], si: number[] = [], sw: number[] = [];
  const idx: number[] = [];
  // arc length along the spine for v
  const along: number[] = [0];
  for (let i = 1; i < n; i++) along.push(along[i - 1] + Math.hypot(st[i].x - st[i - 1].x, st[i].y - st[i - 1].y, st[i].z - st[i - 1].z));
  const total = along[n - 1] || 1;
  let circ = 0;
  for (const s of st) circ += Math.PI * (s.rx + s.ry);
  const uRep = Math.max(1, Math.round(circ / n / TEX_M));
  const ringVerts = seg + 1;
  for (let i = 0; i < n; i++) {
    const s = st[i];
    const p0 = st[Math.max(0, i - 1)], p1 = st[Math.min(n - 1, i + 1)];
    _t.set(p1.x - p0.x, p1.y - p0.y, p1.z - p0.z).normalize();
    // ring frame: 'x' keeps the ring's side axis on +X (no twist along bilateral parts; order stations
    // so the tangent runs +Z or down), 'z' keeps the ring's thin axis facing +Z (ears)
    if (frame === 'x') { _side.set(1, 0, 0).addScaledVector(_t, -_t.x).normalize(); _up.crossVectors(_t, _side).normalize(); }
    else { _side.set(0, 0, 1).cross(_t).normalize(); _up.crossVectors(_t, _side).normalize(); }
    // radius change per metre → tilts normals along the taper
    const dr = ((p1.rx + p1.ry) - (p0.rx + p0.ry)) * 0.5 / Math.max(1e-3, along[Math.min(n - 1, i + 1)] - along[Math.max(0, i - 1)]);
    const t = along[i] / total;
    for (let j = 0; j <= seg; j++) {
      const a = (j / seg) * Math.PI * 2;
      const ca = Math.cos(a), sa = Math.sin(a);
      const vs = sa > 0 ? s.top : s.bot;
      const rx = Math.max(1e-4, s.rx), ry = Math.max(1e-4, s.ry * vs);
      let px = s.x + _side.x * rx * ca + _up.x * ry * sa;
      let py = s.y + _side.y * rx * ca + _up.y * ry * sa;
      let pz = s.z + _side.z * rx * ca + _up.z * ry * sa;
      // ellipse normal: (cos/rx, sin/ry) in the ring frame, then tilt by the taper
      _n.set(_side.x * ca / rx + _up.x * sa / ry, _side.y * ca / rx + _up.y * sa / ry, _side.z * ca / rx + _up.z * sa / ry).normalize();
      _n.addScaledVector(_t, -dr).normalize();
      // shaggy coat: push the surface in/out with noise so the silhouette isn't a smooth tube (big parts only)
      if (shagAmp > 0 && (part === 'body' || part === 'neck' || part === 'head' || part === 'crest')) {
        const amp = shagAmp * Math.min(1, (rx + ry) / 0.25) * (part === 'crest' ? 2.5 : 1);
        const d = paintNoise.fbm(px * 9 + py * 3, pz * 9 - py * 4, 3) * amp;
        px += _n.x * d; py += _n.y * d; pz += _n.z * d;
      }
      pos.push(px, py, pz); nor.push(_n.x, _n.y, _n.z);
      uv.push((j / seg) * uRep, along[i] / TEX_M);
      paint(_c, px, py, pz, _n.x, _n.y, _n.z, part, t, a);
      col.push(_c.r, _c.g, _c.b);
      si.push(s.b0, s.b1, 0, 0); sw.push(1 - s.w1, s.w1, 0, 0);
    }
  }
  for (let i = 0; i < n - 1; i++) for (let j = 0; j < seg; j++) {
    const a = i * ringVerts + j, b = a + 1, c = a + ringVerts, d = c + 1;
    idx.push(a, b, c, b, d, c);
  }
  const cap = (i: number, flip: boolean) => {
    const s = st[i];
    const p0 = st[Math.max(0, i - 1)], p1 = st[Math.min(n - 1, i + 1)];
    _t.set(p1.x - p0.x, p1.y - p0.y, p1.z - p0.z).normalize();
    if (flip) _t.negate();
    const ci = pos.length / 3;
    pos.push(s.x, s.y, s.z); nor.push(_t.x, _t.y, _t.z); uv.push(0.5 * uRep, along[i] / TEX_M);
    paint(_c, s.x, s.y, s.z, _t.x, _t.y, _t.z, part, along[i] / total, 0);
    col.push(_c.r, _c.g, _c.b); si.push(s.b0, s.b1, 0, 0); sw.push(1 - s.w1, s.w1, 0, 0);
    for (let j = 0; j < seg; j++) {
      const a = i * ringVerts + j, b = a + 1;
      if (flip) idx.push(ci, b, a); else idx.push(ci, a, b);
    }
  };
  if (capStart) cap(0, true);
  if (capEnd) cap(n - 1, false);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4));
  g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4));
  g.setIndex(idx);
  // smooth face-averaged normals (more robust than the analytic ring normal on coarse lofts); the
  // duplicated uv-seam vertices get the average of both sides so the seam is invisible
  g.computeVertexNormals();
  const na = g.attributes.normal as THREE.BufferAttribute;
  for (let i = 0; i < n; i++) {
    const a = i * ringVerts, b = a + seg;
    _n.set(na.getX(a) + na.getX(b), na.getY(a) + na.getY(b), na.getZ(a) + na.getZ(b)).normalize();
    na.setXYZ(a, _n.x, _n.y, _n.z); na.setXYZ(b, _n.x, _n.y, _n.z);
  }
  return g;
}

/** Give a plain geometry (sphere) colour + skin attributes for one bone. */
function skinPlain(g: THREE.BufferGeometry, bone: number, part: string, paint: Paint): THREE.BufferGeometry {
  const p = g.attributes.position as THREE.BufferAttribute, nrm = g.attributes.normal as THREE.BufferAttribute;
  const cnt = p.count;
  const col = new Float32Array(cnt * 3), si = new Uint16Array(cnt * 4), sw = new Float32Array(cnt * 4);
  for (let i = 0; i < cnt; i++) {
    paint(_c, p.getX(i), p.getY(i), p.getZ(i), nrm.getX(i), nrm.getY(i), nrm.getZ(i), part, 0.5, 0);
    col[i * 3] = _c.r; col[i * 3 + 1] = _c.g; col[i * 3 + 2] = _c.b;
    si[i * 4] = bone; sw[i * 4] = 1;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.setAttribute('skinIndex', new THREE.BufferAttribute(si, 4));
  g.setAttribute('skinWeight', new THREE.BufferAttribute(sw, 4));
  return g;
}

/** Sweep a tapered tube along a polyline (antler beams, tusks). */
function tube(points: [number, number, number][], r0: number, r1: number, bone: number, part: string, paint: Paint, seg = 7): THREE.BufferGeometry {
  // subdivide for smoothness (catmull-rom)
  const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)), false, 'catmullrom', 0.3);
  const N = Math.max(4, points.length * 4);
  const st: Station[] = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const p = curve.getPoint(t);
    const r = THREE.MathUtils.lerp(r0, r1, Math.pow(t, 0.8));
    st.push({ x: p.x, y: p.y, z: p.z, rx: r, ry: r, top: 1, bot: 1, b0: bone, b1: bone, w1: 0 });
  }
  // rounded tip
  const last = st[st.length - 1];
  st.push({ ...last, x: last.x + (last.x - st[st.length - 2].x) * 0.6, y: last.y + (last.y - st[st.length - 2].y) * 0.6, z: last.z + (last.z - st[st.length - 2].z) * 0.6, rx: r1 * 0.35, ry: r1 * 0.35 });
  return loft(st, seg, part, paint);
}

// ─────────────────────────────────────────────────────────────────────────────────────────
// Procedural fur textures
// ─────────────────────────────────────────────────────────────────────────────────────────

/** periodic value noise on a (px × py) lattice, sampled at (u,v) in [0,1) */
function lattice(px: number, py: number, rng: Rng) {
  const grid = new Float32Array(px * py);
  for (let i = 0; i < grid.length; i++) grid[i] = rng.next();
  const sm = (t: number) => t * t * (3 - 2 * t);
  return (u: number, v: number) => {
    const x = (u * px) % px, y = (v * py) % py;
    const x0 = Math.floor(x), y0 = Math.floor(y);
    const fx = sm(x - x0), fy = sm(y - y0);
    const x1 = (x0 + 1) % px, y1 = (y0 + 1) % py;
    const a = grid[y0 * px + x0], b = grid[y0 * px + x1], c = grid[y1 * px + x0], d = grid[y1 * px + x1];
    return (a + (b - a) * fx) + ((c + (d - c) * fx) - (a + (b - a) * fx)) * fy;
  };
}

function makeFurTextures(seed: number, opts: { contrast: number; grizzle: number; normalStrength: number; bristle: number; strandLen: number; root: number }) {
  const S = 512;
  const rng = new Rng(seed);
  // fur strands: narrow across (x, ~2-3 mm at TEX_M), long along (y)
  const f1 = lattice(112, 14, rng), f2 = lattice(224, 28, rng), f3 = lattice(448, 56, rng);
  const m1 = lattice(6, 6, rng), m2 = lattice(12, 12, rng), m3 = lattice(24, 24, rng);
  const ph = lattice(128, 8, rng);       // per-strand phase so root/tip breaks don't line up
  const height = new Float32Array(S * S);
  const albedo = new Float32Array(S * S);
  const L = opts.strandLen;              // strand segments per texture repeat along v
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const u = x / S, v = y / S;
    // wobble the strands so they aren't perfectly parallel
    const wob = (m3(u, v) - 0.5) * 0.03;
    const fur = f1(u + wob, v) * 0.5 + f2(u + wob * 2, v) * 0.3 + f3(u, v) * 0.2;
    const mott = m1(u, v) * 0.55 + m2(u, v) * 0.3 + m3(u, v) * 0.15;
    // root → tip: each strand segment is dark at its root and pale at its tip
    const seg = (v * L + ph(u, v) * 1.7) % 1;
    const tip = seg * seg;
    const i = y * S + x;
    height[i] = fur * 0.7 + tip * 0.3;
    // grizzle: sparse pale guard-hair tips
    const g = opts.grizzle > 0 ? Math.max(0, f2(u * 0.5, v) - 0.68) * 4 * opts.grizzle * (0.4 + tip) : 0;
    albedo[i] = 1 - opts.contrast * (0.55 - fur) - 0.2 * (mott - 0.5) * (1 + opts.bristle) - opts.root * (1 - tip) + g;
  }
  // albedo canvas (values ≤ 1 → material colour is carried by vertex colours)
  const ca = document.createElement('canvas'); ca.width = S; ca.height = S;
  const ga = ca.getContext('2d')!;
  const ia = ga.createImageData(S, S);
  for (let i = 0; i < S * S; i++) {
    const a = Math.min(1, Math.max(0.2, albedo[i] + 0.12));
    const v = Math.round(a * 255);
    ia.data[i * 4] = v; ia.data[i * 4 + 1] = Math.round(v * 0.985); ia.data[i * 4 + 2] = Math.round(v * 0.96); ia.data[i * 4 + 3] = 255;
  }
  ga.putImageData(ia, 0, 0);
  // normal map from the strand height field
  const cn = document.createElement('canvas'); cn.width = S; cn.height = S;
  const gn = cn.getContext('2d')!;
  const inn = gn.createImageData(S, S);
  const k = opts.normalStrength * 18;
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const l = height[y * S + ((x - 1 + S) % S)], r = height[y * S + ((x + 1) % S)];
    const d = height[((y - 1 + S) % S) * S + x], u = height[((y + 1) % S) * S + x];
    let nx = -(r - l) * k, ny = -(u - d) * k * 0.7, nz = 1;
    const len = Math.hypot(nx, ny, nz); nx /= len; ny /= len; nz /= len;
    const i = (y * S + x) * 4;
    inn.data[i] = Math.round((nx * 0.5 + 0.5) * 255); inn.data[i + 1] = Math.round((ny * 0.5 + 0.5) * 255); inn.data[i + 2] = Math.round((nz * 0.5 + 0.5) * 255); inn.data[i + 3] = 255;
  }
  gn.putImageData(inn, 0, 0);
  const map = new THREE.CanvasTexture(ca);
  map.colorSpace = THREE.SRGBColorSpace; map.wrapS = map.wrapT = THREE.RepeatWrapping; map.anisotropy = 8;
  const normalMap = new THREE.CanvasTexture(cn);
  normalMap.wrapS = normalMap.wrapT = THREE.RepeatWrapping; normalMap.anisotropy = 8;
  return { map, normalMap };
}

// ─────────────────────────────────────────────────────────────────────────────────────────
// Species definitions
// ─────────────────────────────────────────────────────────────────────────────────────────

const srgb = (r: number, g: number, b: number) => new THREE.Color().setRGB(r, g, b, THREE.SRGBColorSpace);
const mix = (out: THREE.Color, a: THREE.Color, b: THREE.Color, t: number) => { out.copy(a).lerp(b, THREE.MathUtils.clamp(t, 0, 1)); return out; };
const sstep = (a: number, b: number, x: number) => { const t = THREE.MathUtils.clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

const paintNoise = new Noise2D(4242);

interface Species {
  bones: BoneDef[];
  furParts: THREE.BufferGeometry[];
  hardParts: THREE.BufferGeometry[];
  eyeParts: THREE.BufferGeometry[];
  dims: AnimalDims;
}

function boneIndex(bones: BoneDef[]) {
  const m = new Map<string, number>();
  bones.forEach((b, i) => m.set(b.name, i));
  return (name: string) => { const i = m.get(name); if (i === undefined) throw new Error('no bone ' + name); return i; };
}

/** station helper */
const S = (x: number, y: number, z: number, rx: number, ry: number, b0: number, b1 = b0, w1 = 0, top = 1, bot = 1): Station => ({ x, y, z, rx, ry, top, bot, b0, b1, w1 });

// ── Deer ────────────────────────────────────────────────────────────────────────────────

function deerPaint(): Paint {
  // autumn coat: ~#7a5a3c body, greyer neck/legs, cream belly + throat, pale rump patch with a dark tail stripe
  const body = srgb(0.478, 0.353, 0.235), bodyDark = srgb(0.36, 0.27, 0.19), grey = srgb(0.40, 0.35, 0.30), greyDark = srgb(0.30, 0.26, 0.22);
  const belly = srgb(0.68, 0.62, 0.52), cream = srgb(0.74, 0.68, 0.56), rump = srgb(0.62, 0.57, 0.47);
  const legDark = srgb(0.30, 0.25, 0.20), nose = srgb(0.06, 0.05, 0.05), muzzle = srgb(0.28, 0.24, 0.21), eyeRing = srgb(0.20, 0.16, 0.13), earIn = srgb(0.62, 0.56, 0.48);
  const antler = srgb(0.40, 0.31, 0.22), antlerTip = srgb(0.74, 0.68, 0.58), hoof = srgb(0.10, 0.08, 0.07), eye = srgb(0.02, 0.015, 0.01);
  return (out, x, y, z, nx, ny, nz, part, t, a) => {
    const n1 = paintNoise.fbm(x * 2.5 + 3, z * 2.5 + y * 1.7, 3);
    switch (part) {
      case 'body': {
        out.copy(body);
        mix(out, out, bodyDark, sstep(0.75, 0.95, ny) * sstep(0.12, 0.03, Math.abs(x)) * 0.8);          // dorsal stripe
        mix(out, out, grey, sstep(0.4, 0.75, z) * 0.5);                                              // greyer shoulders
        mix(out, out, belly, sstep(-0.15, -0.7, ny) * 0.9);                                          // cream belly
        const rd = Math.hypot(x * 1.2, (y - 0.98) * 1.3, (z + 0.9) * 0.9);
        mix(out, out, rump, sstep(0.30, 0.16, rd) * (ny > -0.4 ? 0.85 : 0.4));                       // pale rump patch
        mix(out, out, bodyDark, sstep(0.30, 0.16, rd) * sstep(0.05, 0.015, Math.abs(x)) * sstep(0.3, 0.8, ny)); // dark stripe over the tail
        break;
      }
      case 'neck':
        mix(out, grey, body, 0.35);
        mix(out, out, greyDark, sstep(0.6, 0.9, ny) * 0.5);
        mix(out, out, cream, sstep(-0.3, -0.85, ny) * 0.85);                                          // throat
        break;
      case 'head':
        mix(out, grey, body, 0.45);
        mix(out, out, greyDark, sstep(0.4, 0.9, ny) * 0.4 * (1 - sstep(0.55, 0.8, t)));
        mix(out, out, muzzle, sstep(0.62, 0.88, t) * 0.8);
        mix(out, out, cream, sstep(-0.3, -0.8, ny) * sstep(0.35, 0.7, t) * 0.8);                     // chin / lower jaw
        mix(out, out, eyeRing, sstep(0.09, 0.03, Math.hypot(Math.abs(x) - 0.098, (y - 1.735) * 1.2, (z - 1.215) * 0.8)) * 0.9);
        mix(out, out, nose, sstep(0.9, 0.97, t));
        break;
      case 'ear':
        out.copy(greyDark);
        mix(out, out, earIn, sstep(0.1, 0.6, nz) * 0.9);
        mix(out, out, nose, sstep(0.8, 1, t) * 0.6);
        break;
      case 'leg':
        mix(out, grey, legDark, sstep(0.62, 0.3, y));
        mix(out, out, body, 0.25);
        break;
      case 'tail':
        out.copy(bodyDark);
        mix(out, out, rump, sstep(-0.1, -0.7, ny) * 0.9 + sstep(0.5, 1, t) * 0.3);
        break;
      case 'antler':
        mix(out, antler, antlerTip, sstep(0.5, 1, t) * 0.85 + 0.1 * n1);
        break;
      case 'hoof': out.copy(hoof); break;
      case 'eye': out.copy(eye); break;
      default: out.copy(body);
    }
    const m = 1 + 0.10 * n1;
    out.r *= m; out.g *= m; out.b *= m * 0.98;
  };
}

function deerSpecies(stag: boolean): Species {
  shagAmp = 0.005;
  const bones: BoneDef[] = [
    { name: 'body', parent: null, pos: [0, 0.92, -0.05] },
    { name: 'neck1', parent: 'body', pos: [0, 1.04, 0.62] },
    { name: 'neck2', parent: 'neck1', pos: [0, 1.34, 0.86] },
    { name: 'head', parent: 'neck2', pos: [0, 1.68, 1.04] },
    { name: 'earL', parent: 'head', pos: [0.075, 1.79, 1.08] },
    { name: 'earR', parent: 'head', pos: [-0.075, 1.79, 1.08] },
    { name: 'tail', parent: 'body', pos: [0, 1.0, -0.9] },
  ];
  for (const side of ['L', 'R'] as const) {
    const sx = side === 'L' ? 1 : -1;
    bones.push(
      { name: `F${side}_shoulder`, parent: 'body', pos: [sx * 0.15, 0.92, 0.45] },
      { name: `F${side}_carpus`, parent: `F${side}_shoulder`, pos: [sx * 0.15, 0.48, 0.45] },
      { name: `F${side}_fetlock`, parent: `F${side}_carpus`, pos: [sx * 0.15, 0.12, 0.45] },
      { name: `B${side}_hip`, parent: 'body', pos: [sx * 0.14, 0.93, -0.55] },
      { name: `B${side}_stifle`, parent: `B${side}_hip`, pos: [sx * 0.14, 0.58, -0.46] },
      { name: `B${side}_hock`, parent: `B${side}_stifle`, pos: [sx * 0.15, 0.40, -0.61] },
    );
  }
  const B = boneIndex(bones);
  const paint = deerPaint();
  const fur: THREE.BufferGeometry[] = [], hard: THREE.BufferGeometry[] = [], eyes: THREE.BufferGeometry[] = [];
  const body = B('body'), n1 = B('neck1'), n2 = B('neck2'), hd = B('head');

  // torso
  fur.push(loft([
    S(0, 0.99, -0.90, 0.02, 0.02, body),
    S(0, 0.985, -0.89, 0.12, 0.17, body),
    S(0, 0.975, -0.86, 0.19, 0.26, body, body, 0, 1.03, 1.0),
    S(0, 0.97, -0.79, 0.225, 0.29, body, body, 0, 1.06, 0.86),
    S(0, 0.965, -0.66, 0.245, 0.31, body, body, 0, 1.08, 0.86),
    S(0, 0.955, -0.52, 0.25, 0.32, body, body, 0, 1.06, 0.9),
    S(0, 0.94, -0.25, 0.25, 0.33, body, body, 0, 0.99, 1.0),
    S(0, 0.93, 0.05, 0.25, 0.345, body, body, 0, 1.0, 1.08),
    S(0, 0.935, 0.32, 0.245, 0.35, body, body, 0, 1.14, 1.1),
    S(0, 0.955, 0.52, 0.225, 0.34, body, n1, 0.25, 1.15, 1.02),
    S(0, 0.975, 0.70, 0.18, 0.28, body, n1, 0.4, 1.04, 0.9),
    S(0, 0.99, 0.82, 0.10, 0.16, body, n1, 0.5),
    S(0, 1.00, 0.86, 0.02, 0.03, body, n1, 0.5),
  ], 22, 'body', paint));
  // neck
  fur.push(loft([
    S(0, 0.98, 0.50, 0.18, 0.25, body, n1, 0.2),
    S(0, 1.10, 0.70, 0.145, 0.21, body, n1, 0.7),
    S(0, 1.26, 0.82, 0.115, 0.17, n1, n2, 0.3),
    S(0, 1.44, 0.93, 0.095, 0.145, n1, n2, 0.8),
    S(0, 1.58, 1.00, 0.085, 0.125, n2, hd, 0.3),
    S(0, 1.69, 1.04, 0.08, 0.105, n2, hd, 0.8),
    S(0, 1.745, 1.06, 0.06, 0.08, hd),
  ], 16, 'neck', paint, false, true));
  // head: broad skull, deep jaw, tapering muzzle, dark nose
  fur.push(loft([
    S(0, 1.71, 0.99, 0.065, 0.075, hd),
    S(0, 1.745, 1.03, 0.10, 0.115, hd),
    S(0, 1.76, 1.11, 0.112, 0.125, hd, hd, 0, 1.0, 1.02),
    S(0, 1.745, 1.21, 0.108, 0.12, hd, hd, 0, 1.0, 1.1),
    S(0, 1.71, 1.31, 0.088, 0.10, hd, hd, 0, 1.0, 1.15),
    S(0, 1.665, 1.41, 0.068, 0.08, hd, hd, 0, 1.0, 1.15),
    S(0, 1.625, 1.49, 0.056, 0.065, hd, hd, 0, 1.0, 1.1),
    S(0, 1.60, 1.545, 0.047, 0.052, hd),
    S(0, 1.588, 1.57, 0.022, 0.024, hd),
  ], 18, 'head', paint));
  // ears
  for (const sx of [1, -1]) {
    const eb = B(sx > 0 ? 'earL' : 'earR');
    fur.push(loft([
      S(sx * 0.07, 1.78, 1.07, 0.024, 0.014, hd, eb, 0.3),
      S(sx * 0.115, 1.85, 1.05, 0.052, 0.015, eb),
      S(sx * 0.17, 1.93, 1.02, 0.062, 0.013, eb),
      S(sx * 0.225, 2.01, 0.99, 0.048, 0.010, eb),
      S(sx * 0.27, 2.08, 0.965, 0.018, 0.006, eb),
    ], 10, 'ear', paint, true, true, 'z'));
    // eye
    const eye = new THREE.SphereGeometry(0.022, 10, 8);
    eye.translate(sx * 0.098, 1.735, 1.215);
    eyes.push(skinPlain(eye, hd, 'eye', paint));
  }
  // tail
  const tl = B('tail');
  fur.push(loft([
    S(0, 1.00, -0.88, 0.035, 0.035, body, tl, 0.3),
    S(0, 0.93, -0.95, 0.045, 0.04, tl),
    S(0, 0.84, -0.98, 0.035, 0.03, tl),
    S(0, 0.79, -0.99, 0.015, 0.012, tl),
  ], 8, 'tail', paint, false, true));
  // legs
  const feet: [number, number][] = [];
  for (const side of ['L', 'R'] as const) {
    const sx = side === 'L' ? 1 : -1;
    const sh = B(`F${side}_shoulder`), ca = B(`F${side}_carpus`), fe = B(`F${side}_fetlock`);
    fur.push(loft([
      S(sx * 0.13, 0.95, 0.44, 0.10, 0.17, body, sh, 0.3),
      S(sx * 0.15, 0.78, 0.45, 0.085, 0.14, body, sh, 0.8),
      S(sx * 0.155, 0.62, 0.45, 0.062, 0.095, sh),
      S(sx * 0.155, 0.52, 0.45, 0.045, 0.06, sh, ca, 0.5),
      S(sx * 0.155, 0.44, 0.45, 0.034, 0.047, ca),
      S(sx * 0.155, 0.28, 0.45, 0.028, 0.038, ca),
      S(sx * 0.155, 0.16, 0.45, 0.033, 0.044, ca, fe, 0.5),
      S(sx * 0.155, 0.10, 0.46, 0.034, 0.045, fe),
      S(sx * 0.155, 0.06, 0.475, 0.032, 0.04, fe),
    ], 12, 'leg', paint, false, true));
    hard.push(loft([
      S(sx * 0.155, 0.075, 0.475, 0.034, 0.042, fe),
      S(sx * 0.155, 0.04, 0.485, 0.04, 0.05, fe),
      S(sx * 0.155, 0.0, 0.49, 0.037, 0.047, fe),
      S(sx * 0.155, -0.005, 0.49, 0.01, 0.01, fe),
    ], 10, 'hoof', paint));
    feet.push([sx * 0.155, 0.49]);
    const hp = B(`B${side}_hip`), stf = B(`B${side}_stifle`), hk = B(`B${side}_hock`);
    fur.push(loft([
      S(sx * 0.12, 0.96, -0.60, 0.11, 0.21, body, hp, 0.3),
      S(sx * 0.14, 0.80, -0.54, 0.10, 0.18, body, hp, 0.8),
      S(sx * 0.15, 0.66, -0.49, 0.075, 0.12, hp),
      S(sx * 0.15, 0.58, -0.47, 0.058, 0.085, hp, stf, 0.5),
      S(sx * 0.155, 0.50, -0.53, 0.048, 0.068, stf),
      S(sx * 0.155, 0.43, -0.59, 0.04, 0.058, stf, hk, 0.5),
      S(sx * 0.155, 0.36, -0.615, 0.034, 0.047, hk),
      S(sx * 0.155, 0.20, -0.61, 0.028, 0.038, hk),
      S(sx * 0.155, 0.10, -0.605, 0.035, 0.045, hk),
      S(sx * 0.155, 0.06, -0.60, 0.032, 0.04, hk),
    ], 12, 'leg', paint, false, true));
    hard.push(loft([
      S(sx * 0.155, 0.075, -0.60, 0.034, 0.042, hk),
      S(sx * 0.155, 0.04, -0.595, 0.04, 0.05, hk),
      S(sx * 0.155, 0.0, -0.59, 0.037, 0.047, hk),
      S(sx * 0.155, -0.005, -0.59, 0.01, 0.01, hk),
    ], 10, 'hoof', paint));
    feet.push([sx * 0.155, -0.59]);
  }
  // antlers
  if (stag) {
    for (const sx of [1, -1]) {
      const beam: [number, number, number][] = [[sx * 0.055, 1.81, 1.08], [sx * 0.09, 1.95, 1.03], [sx * 0.15, 2.10, 0.98], [sx * 0.21, 2.28, 0.99], [sx * 0.25, 2.44, 1.04], [sx * 0.27, 2.56, 1.10]];
      hard.push(tube(beam, 0.046, 0.015, hd, 'antler', paint));
      const tine = (from: [number, number, number], to: [number, number, number], mid: [number, number, number], r0 = 0.026) => hard.push(tube([from, mid, to], r0, 0.007, hd, 'antler', paint, 6));
      tine([sx * 0.07, 1.88, 1.04], [sx * 0.11, 2.02, 1.27], [sx * 0.09, 1.97, 1.16]);           // brow
      tine([sx * 0.13, 2.05, 0.99], [sx * 0.16, 2.24, 1.20], [sx * 0.145, 2.16, 1.10]);         // bez
      tine([sx * 0.20, 2.25, 0.99], [sx * 0.34, 2.36, 1.14], [sx * 0.27, 2.32, 1.06]);          // trez
      tine([sx * 0.25, 2.46, 1.05], [sx * 0.20, 2.66, 1.18], [sx * 0.23, 2.57, 1.11], 0.02);   // crown fwd
      tine([sx * 0.26, 2.50, 1.07], [sx * 0.40, 2.66, 1.02], [sx * 0.33, 2.59, 1.05], 0.02);   // crown out
    }
  }
  // sort feet in FL, FR, BL, BR order (loop pushed FL, BL, FR, BR)
  const feetOrdered: [number, number][] = [feet[0], feet[2], feet[1], feet[3]];
  return {
    bones, furParts: fur, hardParts: hard, eyeParts: eyes,
    dims: { bodyY: 0.92, bodyHalfLen: 0.72, bodyRadius: 0.33, headRadius: 0.17, legLen: 0.92, feet: feetOrdered, halfWidth: 0.27 },
  };
}

// ── Boar ────────────────────────────────────────────────────────────────────────────────

function boarPaint(): Paint {
  // dark grey-brown with grizzled pale bristle tips along the spine, pale tusks
  const base = srgb(0.27, 0.21, 0.16), grizzle = srgb(0.50, 0.42, 0.32), dark = srgb(0.13, 0.10, 0.08), black = srgb(0.06, 0.05, 0.045);
  const snout = srgb(0.16, 0.09, 0.08), tusk = srgb(0.90, 0.86, 0.74), hoof = srgb(0.09, 0.075, 0.065), eye = srgb(0.02, 0.015, 0.01), cheek = srgb(0.40, 0.36, 0.30);
  return (out, x, y, z, nx, ny, nz, part, t, a) => {
    const n1 = paintNoise.fbm(x * 4 + 11, z * 4 + y * 3, 3);
    switch (part) {
      case 'body':
        out.copy(base);
        mix(out, out, grizzle, sstep(-0.1, 0.9, ny) * (0.22 + 0.35 * sstep(-0.3, 0.5, n1)));           // grizzled back
        mix(out, out, dark, sstep(-0.3, -0.8, ny) * 0.85);
        break;
      case 'neck': case 'head':
        out.copy(base);
        mix(out, out, cheek, sstep(0.55, 0.85, t) * sstep(0.3, 0.9, Math.abs(nx)) * 0.75);            // pale cheek whiskers
        mix(out, out, grizzle, sstep(0.2, 0.9, ny) * 0.3);
        mix(out, out, dark, sstep(-0.3, -0.8, ny) * 0.75);
        mix(out, out, black, sstep(0.9, 0.98, t));
        break;
      case 'snout': out.copy(snout); break;
      case 'crest': mix(out, dark, grizzle, sstep(0.0, 0.5, ny) * (0.35 + 0.3 * n1)); break;
      case 'ear': out.copy(dark); mix(out, out, base, sstep(0.1, 0.6, nz) * 0.6); break;
      case 'leg': mix(out, base, dark, sstep(0.45, 0.2, y)); break;
      case 'tail': mix(out, dark, black, sstep(0.6, 1, t)); break;
      case 'tusk': mix(out, srgb(0.55, 0.48, 0.40), tusk, sstep(0.0, 0.45, t)); break;
      case 'hoof': out.copy(hoof); break;
      case 'eye': out.copy(eye); break;
      default: out.copy(base);
    }
    const m = 1 + 0.14 * n1;
    out.r *= m; out.g *= m; out.b *= m;
  };
}

function boarSpecies(): Species {
  shagAmp = 0.016;
  const bones: BoneDef[] = [
    { name: 'body', parent: null, pos: [0, 0.62, -0.02] },
    { name: 'neck1', parent: 'body', pos: [0, 0.69, 0.55] },
    { name: 'neck2', parent: 'neck1', pos: [0, 0.70, 0.66] },
    { name: 'head', parent: 'neck2', pos: [0, 0.70, 0.78] },
    { name: 'earL', parent: 'head', pos: [0.09, 0.85, 0.82] },
    { name: 'earR', parent: 'head', pos: [-0.09, 0.85, 0.82] },
    { name: 'tail', parent: 'body', pos: [0, 0.71, -0.62] },
  ];
  for (const side of ['L', 'R'] as const) {
    const sx = side === 'L' ? 1 : -1;
    bones.push(
      { name: `F${side}_shoulder`, parent: 'body', pos: [sx * 0.14, 0.58, 0.42] },
      { name: `F${side}_carpus`, parent: `F${side}_shoulder`, pos: [sx * 0.14, 0.30, 0.42] },
      { name: `F${side}_fetlock`, parent: `F${side}_carpus`, pos: [sx * 0.14, 0.10, 0.42] },
      { name: `B${side}_hip`, parent: 'body', pos: [sx * 0.13, 0.58, -0.45] },
      { name: `B${side}_stifle`, parent: `B${side}_hip`, pos: [sx * 0.14, 0.36, -0.36] },
      { name: `B${side}_hock`, parent: `B${side}_stifle`, pos: [sx * 0.14, 0.24, -0.48] },
    );
  }
  const B = boneIndex(bones);
  const paint = boarPaint();
  const fur: THREE.BufferGeometry[] = [], hard: THREE.BufferGeometry[] = [], eyes: THREE.BufferGeometry[] = [];
  const body = B('body'), n1 = B('neck1'), n2 = B('neck2'), hd = B('head');
  // torso: barrel with shoulder hump, narrower hips (y is raised 0.07 vs the first draft: legs were too short)
  const Y = 0.07;
  fur.push(loft([
    S(0, 0.55 + Y, -0.64, 0.02, 0.02, body),
    S(0, 0.545 + Y, -0.625, 0.12, 0.16, body),
    S(0, 0.54 + Y, -0.58, 0.19, 0.24, body, body, 0, 1.0, 1.0),
    S(0, 0.54 + Y, -0.48, 0.225, 0.27, body, body, 0, 1.04, 1.0),
    S(0, 0.55 + Y, -0.30, 0.26, 0.32, body, body, 0, 1.06, 1.06),
    S(0, 0.55 + Y, -0.05, 0.275, 0.335, body, body, 0, 1.14, 1.08),
    S(0, 0.56 + Y, 0.18, 0.285, 0.34, body, body, 0, 1.30, 1.06),
    S(0, 0.58 + Y, 0.36, 0.285, 0.34, body, n1, 0.15, 1.38, 1.02),
    S(0, 0.60 + Y, 0.52, 0.26, 0.32, body, n1, 0.5, 1.30, 0.96),
    S(0, 0.62 + Y, 0.66, 0.21, 0.26, n1, n2, 0.5, 1.12, 0.95),
    S(0, 0.625 + Y, 0.78, 0.175, 0.21, n2, hd, 0.6, 1.06, 0.98),
  ], 22, 'body', paint, true, false));
  // head: heavy wedge from the neck to a narrow snout, held low
  fur.push(loft([
    S(0, 0.625 + Y, 0.76, 0.18, 0.215, n2, hd, 0.5, 1.06, 0.98),
    S(0, 0.615 + Y, 0.90, 0.155, 0.185, hd, hd, 0, 1.05, 1.0),
    S(0, 0.585 + Y, 1.02, 0.125, 0.145, hd, hd, 0, 1.0, 1.08),
    S(0, 0.535 + Y, 1.14, 0.095, 0.11, hd, hd, 0, 1.0, 1.12),
    S(0, 0.48 + Y, 1.25, 0.072, 0.082, hd, hd, 0, 1.0, 1.12),
    S(0, 0.44 + Y, 1.33, 0.058, 0.064, hd),
    S(0, 0.425 + Y, 1.37, 0.052, 0.054, hd),
  ], 18, 'head', paint, false, true));
  // snout disc
  hard.push(loft([
    S(0, 0.425 + Y, 1.365, 0.054, 0.056, hd),
    S(0, 0.42 + Y, 1.395, 0.062, 0.064, hd),
    S(0, 0.418 + Y, 1.405, 0.057, 0.059, hd),
    S(0, 0.418 + Y, 1.408, 0.02, 0.02, hd),
  ], 14, 'snout', paint));
  // tusks (lower, curving up and out)
  for (const sx of [1, -1]) {
    hard.push(tube([[sx * 0.05, 0.43 + Y, 1.22], [sx * 0.078, 0.45 + Y, 1.265], [sx * 0.10, 0.50 + Y, 1.28], [sx * 0.105, 0.55 + Y, 1.275]], 0.016, 0.004, hd, 'tusk', paint, 6));
    const eb = B(sx > 0 ? 'earL' : 'earR');
    fur.push(loft([
      S(sx * 0.08, 0.76 + Y, 0.84, 0.03, 0.015, hd, eb, 0.3),
      S(sx * 0.11, 0.83 + Y, 0.82, 0.05, 0.015, eb),
      S(sx * 0.14, 0.90 + Y, 0.80, 0.045, 0.013, eb),
      S(sx * 0.165, 0.96 + Y, 0.78, 0.025, 0.01, eb),
      S(sx * 0.175, 0.985 + Y, 0.77, 0.008, 0.005, eb),
    ], 10, 'ear', paint, true, true, 'z'));
    const eye = new THREE.SphereGeometry(0.016, 10, 8);
    eye.translate(sx * 0.115, 0.625 + Y, 0.97);
    eyes.push(skinPlain(eye, hd, 'eye', paint));
  }
  // bristle crest along the spine (a jagged fin), stations rear → front so the ring 'up' is +Y
  const crestSt: Station[] = [];
  const crestPts: [number, number, number, number, number, number][] = [
    // z, y, ry, b0, b1, w1
    [0.86, 0.78, 0.02, hd, hd, 0], [0.74, 0.86, 0.06, n2, hd, 0.5], [0.58, 0.93, 0.09, n1, n2, 0.5], [0.42, 0.985, 0.10, body, n1, 0.4],
    [0.26, 0.965, 0.09, body, body, 0], [0.08, 0.915, 0.075, body, body, 0], [-0.12, 0.875, 0.06, body, body, 0], [-0.32, 0.85, 0.045, body, body, 0], [-0.5, 0.82, 0.025, body, body, 0], [-0.58, 0.80, 0.01, body, body, 0],
  ];
  const crng = new Rng(77);
  crestPts.reverse().forEach(([z, y, ry, b0, b1, w1]) => crestSt.push(S(0, y - 0.04 + Y, z, 0.022, ry * (0.85 + crng.next() * 0.3), b0, b1, w1, 1, 0.3)));
  fur.push(loft(crestSt, 6, 'crest', paint));
  // tail with tuft
  const tl = B('tail');
  fur.push(loft([
    S(0, 0.63 + Y, -0.62, 0.028, 0.028, body, tl, 0.3),
    S(0, 0.52 + Y, -0.69, 0.02, 0.02, tl),
    S(0, 0.40 + Y, -0.72, 0.016, 0.016, tl),
    S(0, 0.33 + Y, -0.73, 0.03, 0.03, tl),
    S(0, 0.27 + Y, -0.735, 0.022, 0.022, tl),
    S(0, 0.24 + Y, -0.74, 0.008, 0.008, tl),
  ], 8, 'tail', paint, false, true));
  // legs
  const feet: [number, number][] = [];
  for (const side of ['L', 'R'] as const) {
    const sx = side === 'L' ? 1 : -1;
    const sh = B(`F${side}_shoulder`), ca = B(`F${side}_carpus`), fe = B(`F${side}_fetlock`);
    fur.push(loft([
      S(sx * 0.13, 0.66, 0.40, 0.13, 0.19, body, sh, 0.3),
      S(sx * 0.145, 0.50, 0.42, 0.105, 0.15, body, sh, 0.8),
      S(sx * 0.15, 0.37, 0.42, 0.072, 0.095, sh),
      S(sx * 0.15, 0.31, 0.42, 0.054, 0.066, sh, ca, 0.5),
      S(sx * 0.15, 0.22, 0.42, 0.046, 0.056, ca),
      S(sx * 0.15, 0.13, 0.42, 0.045, 0.055, ca, fe, 0.5),
      S(sx * 0.15, 0.07, 0.43, 0.042, 0.052, fe),
    ], 12, 'leg', paint, false, true));
    hard.push(loft([
      S(sx * 0.145, 0.07, 0.43, 0.036, 0.045, fe),
      S(sx * 0.145, 0.035, 0.44, 0.042, 0.052, fe),
      S(sx * 0.145, 0.0, 0.445, 0.038, 0.048, fe),
      S(sx * 0.145, -0.005, 0.445, 0.01, 0.01, fe),
    ], 10, 'hoof', paint));
    feet.push([sx * 0.145, 0.445]);
    const hp = B(`B${side}_hip`), stf = B(`B${side}_stifle`), hk = B(`B${side}_hock`);
    fur.push(loft([
      S(sx * 0.11, 0.62, -0.50, 0.13, 0.20, body, hp, 0.3),
      S(sx * 0.135, 0.49, -0.43, 0.11, 0.16, body, hp, 0.8),
      S(sx * 0.145, 0.38, -0.38, 0.076, 0.098, hp, stf, 0.5),
      S(sx * 0.15, 0.30, -0.43, 0.056, 0.07, stf),
      S(sx * 0.15, 0.25, -0.475, 0.048, 0.06, stf, hk, 0.5),
      S(sx * 0.15, 0.15, -0.465, 0.045, 0.055, hk),
      S(sx * 0.15, 0.07, -0.45, 0.042, 0.052, hk),
    ], 12, 'leg', paint, false, true));
    hard.push(loft([
      S(sx * 0.145, 0.07, -0.45, 0.036, 0.045, hk),
      S(sx * 0.145, 0.035, -0.445, 0.042, 0.052, hk),
      S(sx * 0.145, 0.0, -0.44, 0.038, 0.048, hk),
      S(sx * 0.145, -0.005, -0.44, 0.01, 0.01, hk),
    ], 10, 'hoof', paint));
    feet.push([sx * 0.145, -0.44]);
  }
  const feetOrdered: [number, number][] = [feet[0], feet[2], feet[1], feet[3]];
  return {
    bones, furParts: fur, hardParts: hard, eyeParts: eyes,
    dims: { bodyY: 0.62, bodyHalfLen: 0.65, bodyRadius: 0.33, headRadius: 0.2, legLen: 0.58, feet: feetOrdered, halfWidth: 0.29 },
  };
}

// ─────────────────────────────────────────────────────────────────────────────────────────
// Factory
// ─────────────────────────────────────────────────────────────────────────────────────────

export class AnimalFactory {
  private models = new Map<string, AnimalModel>();
  private deerTex?: { map: THREE.Texture; normalMap: THREE.Texture };
  private boarTex?: { map: THREE.Texture; normalMap: THREE.Texture };

  constructor(private sky: Sky) {}

  model(kind: AnimalKind, variant: AnimalVariant): AnimalModel {
    const key = kind + ':' + variant;
    let m = this.models.get(key);
    if (m) return m;
    const sp = kind === 'deer' ? deerSpecies(variant === 'stag') : boarSpecies();
    const furGeo = mergeGeometries(sp.furParts, false)!;
    const hardGeo = mergeGeometries(sp.hardParts, false)!;
    const eyeGeo = mergeGeometries(sp.eyeParts, false)!;
    const geometry = mergeGeometries([furGeo, hardGeo, eyeGeo], true)!;
    for (const g of [...sp.furParts, ...sp.hardParts, ...sp.eyeParts, furGeo, hardGeo, eyeGeo]) g.dispose();
    geometry.computeBoundingSphere();
    geometry.boundingSphere!.radius += 0.6; // animated legs / neck / corpse roll never leave this
    geometry.computeBoundingBox();

    const tex = kind === 'deer'
      ? (this.deerTex ??= makeFurTextures(101, { contrast: 0.8, grizzle: 0.15, normalStrength: 1.6, bristle: 0, strandLen: 24, root: 0.14 }))
      : (this.boarTex ??= makeFurTextures(202, { contrast: 1.0, grizzle: 0.6, normalStrength: 2.2, bristle: 0.6, strandLen: 12, root: 0.24 }));
    // MeshPhysicalMaterial for the sheen term (soft velvet), plus a backlit Fresnel rim patched in below
    const fur = new THREE.MeshPhysicalMaterial({
      map: tex.map, normalMap: tex.normalMap, normalScale: new THREE.Vector2(1.0, 1.0),
      roughness: kind === 'deer' ? 0.82 : 0.88, metalness: 0, vertexColors: true, color: new THREE.Color(1.0, 1.0, 1.0),
      sheen: kind === 'deer' ? 0.3 : 0.15, sheenRoughness: 0.7, sheenColor: kind === 'deer' ? new THREE.Color(0.45, 0.36, 0.26) : new THREE.Color(0.35, 0.3, 0.24),
    });
    const rim = kind === 'deer' ? new THREE.Color(1.0, 0.72, 0.42) : new THREE.Color(0.9, 0.7, 0.45);
    fur.userData.rimColor = rim;
    this.patchFur(fur, kind);
    const hard = new THREE.MeshStandardMaterial({ roughness: 0.5, metalness: 0, vertexColors: true, color: new THREE.Color(1, 1, 1), normalMap: tex.normalMap, normalScale: new THREE.Vector2(0.35, 0.35) });
    const eye = new THREE.MeshPhysicalMaterial({ roughness: 0.1, metalness: 0, vertexColors: true, color: new THREE.Color(1, 1, 1), clearcoat: 1, clearcoatRoughness: 0.05, envMapIntensity: 1.5 });
    this.sky.setupMaterial(fur); this.sky.setupMaterial(hard); this.sky.setupMaterial(eye);
    m = { kind, variant, geometry, bones: sp.bones, dims: sp.dims, fur, hard, eye };
    this.models.set(key, m);
    return m;
  }

  /** Fur shader patch: Fresnel-lit tip colour that glows when the sun is behind the animal (backlit edges). */
  private patchFur(fur: THREE.MeshPhysicalMaterial, kind: AnimalKind) {
    const rim = fur.userData.rimColor as THREE.Color;
    fur.onBeforeCompile = (shader) => {
      attachFogUniforms(shader);
      shader.uniforms.furRimColor = { value: rim };
      shader.uniforms.furSunDir = fogUniforms.fogSunDir;
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <clipping_planes_pars_fragment>', `#include <clipping_planes_pars_fragment>
          uniform vec3 furRimColor; uniform vec3 furSunDir;`)
        .replace('#include <opaque_fragment>', `
          {
            vec3 V = normalize( vViewPosition );
            float ndv = saturate( dot( normal, V ) );
            vec3 sunV = normalize( ( viewMatrix * vec4( furSunDir, 0.0 ) ).xyz );
            float back = saturate( dot( sunV, -V ) );                // looking toward the sun → the coat's tips light up
            float fres = pow( 1.0 - ndv, 3.2 );
            float rimAmt = fres * ( 0.04 + 1.2 * back * back );
            outgoingLight += furRimColor * rimAmt * ( 0.15 + 0.85 * diffuseColor.rgb * 2.2 );
          }
          #include <opaque_fragment>`);
    };
    fur.customProgramCacheKey = () => 'animal-fur-' + kind;
  }

  /** Build a SkinnedMesh + skeleton for one animal. `tint` (0..1) slightly varies the fur colour per individual. */
  instantiate(model: AnimalModel, tint = 0.5): AnimalRig {
    const bones: Record<string, THREE.Bone> = {};
    const list: THREE.Bone[] = [];
    for (const d of model.bones) {
      const b = new THREE.Bone();
      b.name = d.name;
      const parent = d.parent ? model.bones.find((p) => p.name === d.parent)! : null;
      b.position.set(d.pos[0] - (parent ? parent.pos[0] : 0), d.pos[1] - (parent ? parent.pos[1] : 0), d.pos[2] - (parent ? parent.pos[2] : 0));
      bones[d.name] = b; list.push(b);
      if (d.parent) bones[d.parent].add(b);
    }
    const fur = model.fur.clone();
    fur.userData.rimColor = model.fur.userData.rimColor;
    this.patchFur(fur, model.kind);           // clone() does not carry onBeforeCompile
    const v = (tint - 0.5) * 0.2;
    fur.color.setRGB(1.0 + v, 1.0 + v * 0.9, 1.0 + v * 0.7);
    this.sky.setupMaterial(fur);
    const mesh = new THREE.SkinnedMesh(model.geometry, [fur, model.hard, model.eye]);
    mesh.add(bones.body);
    mesh.updateMatrixWorld(true);
    mesh.bind(new THREE.Skeleton(list));
    mesh.castShadow = true; mesh.receiveShadow = true;
    mesh.frustumCulled = true;
    return { mesh, bones, materials: [fur, model.hard, model.eye] };
  }
}
