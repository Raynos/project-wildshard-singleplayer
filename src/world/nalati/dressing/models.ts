/**
 * Dressing models (Nalati, style B): every scatter shape the shard repeats — built once in code, smooth (welded,
 * averaged normals, never faceted), vertex-painted, no textures — to be instanced by `DressLayer` on the ONE shared
 * painterly material (`src/world/painterly.ts`). All shapes stand on their local origin (y = 0 is the ground) at
 * roughly unit size; the placer scales them.
 *
 *   boulderGeo(seed)    a rounded granite boulder: warm / cool grey, moss on the tops, lichen spots, dark foot  (320 tris)
 *   slabGeo(seed)       a flatter, rougher outcrop rock for the slopes                                         (320 tris)
 *   stoneGeo(seed)      a small fieldstone / cobble / river pebble (tinted per instance)                     (80 tris)
 *   juniperGeo(seed)    a low spreading juniper mat, dark blue-green                                           (~400)
 *   roseGeo(seed)       a round wild-rose bush with pink blossom blots                                         (~480)
 *   willowGeo(seed)     a dwarf willow: taller, narrower, silver-green                                        (~400)
 *   lupinGeo(seed)      a clump of purple sage / lupin spikes over a leaf rosette                               (~220)
 *   daisyGeo(seed)      a clump of white edelweiss / daisies and yellow buttercups                               (~200)
 *   reedGeo(seed)       a reed clump with two cattails                                                           (~230)
 *
 * Colours are linear (THREE.Color from sRGB hex). Contact shade: every model darkens toward the painterly shade tint
 * within its bottom ~25 cm, so nothing floats on the grass.
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { Rng } from '../../../core/rng';
import { Noise2D, smoothstep, clamp } from '../../../core/noise';
import { blob, mergeVerticesByPos } from '../paint';

const c = (hex: string): THREE.Color => new THREE.Color(hex);

export const DC = {
  granite: c('#8f8a81'), graniteWarm: c('#a0957f'), graniteCool: c('#7c8185'), rockDark: c('#545357'),
  moss: c('#667a34'), mossLight: c('#94a24c'), lichen: c('#d6cf96'), lichenOrange: c('#c99a58'),
  juniper: c('#2b4630'), juniperBlue: c('#3b5a55'), juniperTop: c('#5f7a42'),
  leaf: c('#46692a'), leafLight: c('#86a24a'), leafDark: c('#2d4a1c'), rose: c('#f3c3d2'), roseDeep: c('#e28aa8'),
  willow: c('#5e7444'), willowLight: c('#a3ad7c'), willowDark: c('#34492a'),
  sage: c('#56359a'), sageMid: c('#8561cf'), sageLight: c('#d2bdf2'), lupinPink: c('#a0529a'), lupinPinkLight: c('#e6b3de'), stem: c('#4d7a2a'),
  daisy: c('#f5f1e6'), daisyCentre: c('#f2c230'), buttercup: c('#f7cc2a'), buttercupDeep: c('#e59a17'),
  reed: c('#3e5a26'), reedMid: c('#71893a'), reedTip: c('#c9b86c'), cattail: c('#5a3a22'),
};

const SHADE = new THREE.Color(0.55, 0.55, 0.78);
const UP = new THREE.Vector3(0, 1, 0);

type Paint = (p: THREE.Vector3, n: THREE.Vector3, out: THREE.Color) => void;

/** strip uv, make sure there are normals, place it, paint every vertex (model space) — returns an indexed part */
function part(g: THREE.BufferGeometry, paint: Paint | THREE.Color, m?: THREE.Matrix4, o: { weld?: boolean; normals?: 'up' | 'keep' } = {}): THREE.BufferGeometry {
  let geo = g;
  if (geo.hasAttribute('uv')) geo.deleteAttribute('uv');
  if (geo.hasAttribute('uv1')) geo.deleteAttribute('uv1');
  if (o.weld === true) { geo = mergeVerticesByPos(geo); geo.computeVertexNormals(); }
  if (!geo.index) { const n = geo.getAttribute('position').count; geo.setIndex(Array.from({ length: n }, (_, i) => i)); }
  if (!geo.hasAttribute('normal')) geo.computeVertexNormals();
  if (m) geo.applyMatrix4(m);
  const pos = geo.getAttribute('position'), nrm = geo.getAttribute('normal');
  if (o.normals === 'up') {
    // foliage: bend the normals toward +y so both faces of a leaf light alike and a clump shades as one soft mass
    const v = new THREE.Vector3();
    for (let i = 0; i < nrm.count; i++) { v.set(nrm.getX(i), nrm.getY(i), nrm.getZ(i)); if (v.y < 0) v.negate(); v.lerp(UP, 0.6).normalize(); nrm.setXYZ(i, v.x, v.y, v.z); }
  }
  const col = new Float32Array(pos.count * 3);
  const p = new THREE.Vector3(), n = new THREE.Vector3(), out = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    if (paint instanceof THREE.Color) out.copy(paint);
    else { p.set(pos.getX(i), pos.getY(i), pos.getZ(i)); n.set(nrm.getX(i), nrm.getY(i), nrm.getZ(i)); paint(p, n, out); }
    col[i * 3] = out.r; col[i * 3 + 1] = out.g; col[i * 3 + 2] = out.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return geo;
}

/** the back face of a thin part (reversed winding, same normals — foliage lights the same from both sides) */
function twoSided(g: THREE.BufferGeometry): THREE.BufferGeometry {
  const idx = g.index;
  if (!idx) return g;
  const a = Array.from(idx.array as ArrayLike<number>);
  const back: number[] = [];
  for (let i = 0; i + 2 < a.length; i += 3) back.push(a[i] ?? 0, a[i + 2] ?? 0, a[i + 1] ?? 0);
  g.setIndex([...a, ...back]);
  return g;
}

/** merge the parts, then bake the contact shade (bottom `aoH` m pulled toward the painterly shade tint) */
function finish(parts: THREE.BufferGeometry[], aoH = 0.25, aoMin = 0.5): THREE.BufferGeometry {
  const geo = mergeGeometries(parts, false);
  for (const p of parts) p.dispose();
  const pos = geo.getAttribute('position'), col = geo.getAttribute('color');
  for (let i = 0; i < pos.count; i++) {
    const k = aoMin + (1 - aoMin) * smoothstep(-0.05, aoH, pos.getY(i));
    col.setXYZ(i, col.getX(i) * (k + (1 - k) * SHADE.r), col.getY(i) * (k + (1 - k) * SHADE.g), col.getZ(i) * (k + (1 - k) * SHADE.b));
  }
  geo.computeBoundingSphere();
  geo.computeBoundingBox();
  return geo;
}

const _mm = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _pp = new THREE.Vector3(), _ss = new THREE.Vector3();
function M(x: number, y: number, z: number, yaw = 0, sx = 1, sy = sx, sz = sx, pitch = 0, roll = 0): THREE.Matrix4 {
  _e.set(pitch, yaw, roll, 'YXZ');
  return _mm.clone().compose(_pp.set(x, y, z), _q.setFromEuler(_e), _ss.set(sx, sy, sz));
}

// ── rocks ───────────────────────────────────────────────────────────────────────────────────────────

function rockPaint(nz: Noise2D, moss: number, lichen: number): Paint {
  const tmp = new THREE.Color();
  return (p, n, out) => {
    // big soft tone patches (a stroke across the whole face), not speckle
    const n1 = nz.get(p.x * 0.8 + p.y * 0.4, p.z * 0.8 - p.y * 0.3);
    const n2 = nz.get(p.x * 1.6 + 11, p.z * 1.6 + p.y * 1.2);
    const n3 = nz.get(p.x * 3.4 - 7, p.z * 3.4 + p.y * 2.9);
    out.copy(DC.granite).lerp(n1 > 0 ? DC.graniteWarm : DC.graniteCool, Math.min(1, Math.abs(n1) * 1.4) * 0.6);
    // lighter tops, darker undersides, a dark seam here and there
    out.multiplyScalar(0.78 + 0.32 * smoothstep(-0.7, 0.9, p.y + n.y * 0.35));
    out.lerp(DC.rockDark, smoothstep(0.45, 0.75, -n2) * 0.3);
    // moss in patches on the up-facing
    const w = smoothstep(0.55, 0.9, n.y + n2 * 0.45) * smoothstep(0.0, 0.45, n1 + 0.15) * moss;
    if (w > 0) out.lerp(tmp.copy(DC.moss).lerp(DC.mossLight, clamp(0.5 + n3, 0, 1)), w);
    // a few pale lichen rosettes
    const l = smoothstep(0.5, 0.66, n3) * smoothstep(-0.2, 0.3, n.y) * lichen;
    if (l > 0) out.lerp(n1 > 0.45 ? DC.lichenOrange : DC.lichen, l * 0.5);
  };
}

/** a rounded boulder, ~1 m radius, ~0.72 m tall above its centre (the placer buries its bottom) */
export function boulderGeo(seed: number, detail = 2): THREE.BufferGeometry {
  const rng = new Rng(seed);
  const g = blob(1, rng, detail, 0.74, 0.3);
  const p = part(g, rockPaint(new Noise2D(seed + 1), 0.85, 1));
  return finish([p], 0.35, 0.55);
}

/** a flatter, longer, rougher outcrop rock (slopes, gully walls) */
export function slabGeo(seed: number, detail = 2): THREE.BufferGeometry {
  const rng = new Rng(seed);
  const g = blob(1, rng, detail, 0.5, 0.42);
  g.scale(1.45, 1, 0.95);
  g.computeVertexNormals();
  const p = part(g, rockPaint(new Noise2D(seed + 2), 0.7, 1.2));
  return finish([p], 0.3, 0.55);
}

/** a small fieldstone / cobble / pebble, ~1 m radius at scale 1 (placed at 0.05 … 0.5) */
export function stoneGeo(seed: number): THREE.BufferGeometry {
  const rng = new Rng(seed);
  const g = blob(1, rng, 1, 0.62, 0.24);
  const p = part(g, rockPaint(new Noise2D(seed + 3), 0.25, 0.6));
  return finish([p], 0.4, 0.6);
}

// ── shrubs ──────────────────────────────────────────────────────────────────────────────────────────

interface LeafSpec {
  /** leaves scattered over the shell of an ellipsoid of radii rx / ry / rz centred at cy (+ a dark core blob inside) */
  n: number; rx: number; ry: number; rz: number; cy: number;
  /** leaf length / width ranges (m, at bush scale 1) */
  len: [number, number]; w: [number, number];
  /** colour of a leaf from its height 0..1 in the bush, how far it sits out on the shell 0..1 and a random 0..1 */
  paint: (h: number, out: number, rnd: number, c: THREE.Color) => void;
  core: THREE.Color;
}

/**
 * A bush as a painted core + a shell of leaf diamonds (two-sided quads, 4 triangles each) — the crown's outline breaks
 * up into leaves and every leaf carries its own shade, which reads as brush strokes the way the mockups' bushes do
 * (a few big smooth lobes read as clay; faceted dabs as low-poly rocks). Leaf normals are the ellipsoid's outward
 * normal, so the crown shades as one soft volume under the cel bands and back faces light like front faces.
 */
function leafBush(rng: Rng, o: LeafSpec): THREE.BufferGeometry[] {
  const parts: THREE.BufferGeometry[] = [];
  const core = blob(1, rng, 1, 1, 0.25);
  core.scale(o.rx * 0.78, o.ry * 0.78, o.rz * 0.78);
  core.translate(0, o.cy, 0);
  core.computeVertexNormals();
  parts.push(part(core, o.core));
  const pos: number[] = [], nrm: number[] = [], col: number[] = [], idx: number[] = [];
  const lc = new THREE.Color(), n = new THREE.Vector3(), t1 = new THREE.Vector3(), t2 = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
  for (let i = 0; i < o.n; i++) {
    const th = rng.range(0, Math.PI * 2), ph = Math.acos(rng.range(-0.45, 1)), u = rng.range(0.82, 1.05);
    const nx = Math.sin(ph) * Math.cos(th), ny = Math.cos(ph), nz = Math.sin(ph) * Math.sin(th);
    const x = nx * o.rx * u, y = o.cy + ny * o.ry * u, z = nz * o.rz * u;
    if (y < 0.02) continue;
    n.set(nx / o.rx, ny / o.ry, nz / o.rz).normalize();
    // the leaf lies roughly tangent to the shell, tipped a little outward and twisted at random
    t1.crossVectors(n, Math.abs(n.y) > 0.9 ? t2.set(1, 0, 0) : up).normalize().applyAxisAngle(n, rng.range(0, Math.PI * 2));
    t2.crossVectors(n, t1).normalize();
    const L = rng.range(o.len[0], o.len[1]), W = rng.range(o.w[0], o.w[1]), tip = rng.range(0.2, 0.5);
    const b = pos.length / 3;
    // diamond: base, left, tip, right
    const px = [x, x + t2.x * W * 0.5 + t1.x * L * 0.4, x + t1.x * L + n.x * L * tip, x - t2.x * W * 0.5 + t1.x * L * 0.4];
    const py = [y, y + t2.y * W * 0.5 + t1.y * L * 0.4, y + t1.y * L + n.y * L * tip, y - t2.y * W * 0.5 + t1.y * L * 0.4];
    const pz = [z, z + t2.z * W * 0.5 + t1.z * L * 0.4, z + t1.z * L + n.z * L * tip, z - t2.z * W * 0.5 + t1.z * L * 0.4];
    o.paint(clamp(y / (o.cy + o.ry), 0, 1), u, rng.next(), lc);
    for (let k = 0; k < 4; k++) {
      pos.push(px[k] ?? 0, Math.max(0.01, py[k] ?? 0), pz[k] ?? 0);
      nrm.push(n.x, n.y, n.z);
      const k2 = k === 0 ? 0.72 : k === 2 ? 1.12 : 1;   // darker at the stalk, lighter at the tip
      col.push(lc.r * k2, lc.g * k2, lc.b * k2);
    }
    idx.push(b, b + 1, b + 2, b, b + 2, b + 3, b, b + 2, b + 1, b, b + 3, b + 2);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  parts.push(g);
  return parts;
}

export function juniperGeo(seed: number): THREE.BufferGeometry {
  const rng = new Rng(seed);
  const parts = leafBush(rng, {
    n: 90, rx: 0.95, ry: 0.36, rz: 0.8, cy: 0.1, len: [0.14, 0.22], w: [0.05, 0.08], core: DC.juniper,
    paint: (h, _o, rnd, out) => { out.copy(DC.juniper).lerp(DC.juniperBlue, rnd * 0.8).lerp(DC.juniperTop, smoothstep(0.35, 1, h) * (0.3 + rnd * 0.7)); },
  });
  return finish(parts, 0.2, 0.5);
}

/** `lite` (phone): 55 leaves instead of 80 */
export function roseGeo(seed: number, lite = false): THREE.BufferGeometry {
  const rng = new Rng(seed);
  const parts = leafBush(rng, {
    n: lite ? 55 : 80, rx: 0.52, ry: 0.44, rz: 0.52, cy: 0.42, len: [0.11, 0.17], w: [0.07, 0.11], core: DC.leafDark,
    paint: (h, _o, rnd, out) => { out.copy(DC.leafDark).lerp(DC.leaf, smoothstep(0.1, 0.7, h) * (0.6 + rnd * 0.4)).lerp(DC.leafLight, smoothstep(0.55, 1, h) * rnd * 0.8); },
  });
  // the wild-rose blossoms: small pale-pink and white five-petal discs sitting on the upper shell
  for (let i = 0; i < 12; i++) {
    const th = rng.range(0, Math.PI * 2), ph = rng.range(0.1, 1.3);
    const x = Math.sin(ph) * Math.cos(th) * 0.56, y = 0.42 + Math.cos(ph) * 0.48, z = Math.sin(ph) * Math.sin(th) * 0.56;
    const g = new THREE.CircleGeometry(rng.range(0.035, 0.05), 5).lookAt(new THREE.Vector3(x, y - 0.42, z));
    g.translate(x, y, z);
    const pc = rng.next() < 0.3 ? DC.daisy : rng.next() < 0.5 ? DC.roseDeep : DC.rose;
    parts.push(twoSided(part(g, (q, _n, out) => { out.copy(pc).lerp(DC.daisyCentre, smoothstep(0.02, 0.0, Math.hypot(q.x - x, q.y - y, q.z - z)) * 0.8); }, undefined, { normals: 'up' })));
  }
  return finish(parts, 0.2, 0.5);
}

export function willowGeo(seed: number): THREE.BufferGeometry {
  const rng = new Rng(seed);
  const parts: THREE.BufferGeometry[] = [];
  // a few bare stems showing at the foot
  for (let i = 0; i < 4; i++) {
    const a = rng.range(0, Math.PI * 2);
    const g = new THREE.CylinderGeometry(0.012, 0.022, 0.55, 4, 1, true).translate(0, 0.27, 0);
    parts.push(part(g, DC.cattail, M(Math.cos(a) * 0.08, 0, Math.sin(a) * 0.08, a, 1, 1, 1, rng.range(-0.3, 0.3), rng.range(-0.3, 0.3))));
  }
  parts.push(...leafBush(rng, {
    n: 90, rx: 0.42, ry: 0.58, rz: 0.42, cy: 0.74, len: [0.14, 0.22], w: [0.035, 0.055], core: DC.willowDark,
    paint: (h, _o, rnd, out) => { out.copy(DC.willowDark).lerp(DC.willow, smoothstep(0.1, 0.7, h) * (0.6 + rnd * 0.4)).lerp(DC.willowLight, smoothstep(0.5, 1, h) * rnd * 0.8); },
  }));
  return finish(parts, 0.2, 0.5);
}

// ── flowers ─────────────────────────────────────────────────────────────────────────────────────────

/** a bent leaf blade (a quad strip), two-sided, normals up-ish */
function leaf(rng: Rng, len: number, w: number, a: number, lean: number, col: THREE.Color, tip: THREE.Color): THREE.BufferGeometry {
  const g = new THREE.PlaneGeometry(w, len, 1, 2);
  g.translate(0, len / 2, 0);
  const pos = g.getAttribute('position');
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i), t = y / len;
    pos.setX(i, pos.getX(i) * (1 - t * 0.7));
    pos.setZ(i, t * t * len * lean);
  }
  g.computeVertexNormals();
  const p = part(g, (q, _n, out) => { out.copy(col).lerp(tip, smoothstep(0, len, q.y)); }, M(0, 0, 0, a + rng.range(-0.2, 0.2)), { normals: 'up' });
  return twoSided(p);
}

/** a flower spike of stacked whorls: a 5-sided lathe whose radius swells and pinches up its length, painted in bands */
function spike(r: number, len: number, deep: THREE.Color, mid: THREE.Color, tip: THREE.Color, rng: Rng, sides = 5): THREE.BufferGeometry {
  const prof: [number, number][] = [[0.004, 0]];
  const segs = 4, ph = rng.range(0, 3);
  for (let k = 0; k <= segs; k++) {
    const t = k / segs;
    const swell = k % 2 === 0 ? 1 : 0.72;
    prof.push([Math.max(0.004, r * (1 - t * 0.85) ** 0.6 * swell * (k === 0 ? 0.8 : 1)), t * len]);
  }
  prof.push([0.002, len + r * 0.4]);
  const g = new THREE.LatheGeometry(prof.map(([a, b]) => new THREE.Vector2(a, b)), sides);
  g.rotateY(rng.range(0, Math.PI));
  const w = mergeVerticesByPos(g);
  w.computeVertexNormals();
  return part(w, (p, _n, out) => {
    const t = clamp(p.y / len, 0, 1);
    out.copy(deep).lerp(mid, smoothstep(0, 0.45, t)).lerp(tip, smoothstep(0.45, 1, t));
    out.multiplyScalar(0.9 + 0.2 * Math.sin(t * 22 + ph));
  });
}

/** `lite` (phone): 5 four-sided spikes instead of 7 five-sided (~260 tris instead of ~500) */
export function lupinGeo(seed: number, lite = false): THREE.BufferGeometry {
  const rng = new Rng(seed);
  const parts: THREE.BufferGeometry[] = [];
  const n = lite ? 5 : 7;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + rng.range(-0.5, 0.5), d = i === 0 ? 0 : rng.range(0.06, 0.2);
    const h = rng.range(0.42, 0.72), len = rng.range(0.2, 0.32), r = rng.range(0.05, 0.068);
    const tilt = M(Math.cos(a) * d, 0, Math.sin(a) * d, a, 1, 1, 1, rng.range(0.04, 0.2) * (d > 0 ? 1 : 0.3), 0);
    const base = h - len;
    parts.push(part(new THREE.CylinderGeometry(0.006, 0.01, base + 0.02, 3, 1, true).translate(0, (base + 0.02) / 2, 0), DC.stem, tilt));
    const pal = rng.next();
    const deep = pal < 0.2 ? DC.lupinPink : DC.sage, tip = pal < 0.2 ? DC.lupinPinkLight : DC.sageLight;
    const sp = spike(r * (lite ? 1.1 : 1), len, deep, pal < 0.2 ? DC.lupinPink : DC.sageMid, tip, rng, lite ? 4 : 5);
    sp.translate(0, base, 0);
    sp.applyMatrix4(tilt);
    parts.push(sp);
  }
  // the palmate leaf rosette at the foot
  for (let i = 0; i < 6; i++) parts.push(leaf(rng, rng.range(0.14, 0.24), 0.07, (i / 6) * Math.PI * 2, rng.range(0.8, 1.3), DC.leafDark, DC.leaf));
  return finish(parts, 0.12, 0.6);
}

export function daisyGeo(seed: number): THREE.BufferGeometry {
  const rng = new Rng(seed);
  const parts: THREE.BufferGeometry[] = [];
  const n = 8;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + rng.range(-0.4, 0.4), d = rng.range(0.03, 0.22);
    const h = rng.range(0.22, 0.42), yellow = i % 2 === 1;
    const lean = rng.range(0.05, 0.3);
    const tilt = M(Math.cos(a) * d, 0, Math.sin(a) * d, a, 1, 1, 1, lean, 0);
    parts.push(part(new THREE.CylinderGeometry(0.005, 0.008, h, 3, 1, true).translate(0, h / 2, 0), DC.stem, tilt));
    // the head: a 7-point disc (centre + rim), faced up and out, painted centre → rim
    const r = yellow ? rng.range(0.022, 0.03) : rng.range(0.03, 0.045);
    const disc = new THREE.CircleGeometry(r, 7).rotateX(-Math.PI / 2 + 0.55).translate(0, h, 0);
    const cy = h;
    const head = part(disc, (p, _n, out) => {
      const rr = Math.hypot(p.x, p.y - cy, p.z) / r;
      if (yellow) out.copy(DC.buttercupDeep).lerp(DC.buttercup, smoothstep(0.1, 0.8, rr));
      else out.copy(DC.daisyCentre).lerp(DC.daisy, smoothstep(0.15, 0.55, rr));
    }, tilt, { normals: 'up' });
    parts.push(twoSided(head));
  }
  for (let i = 0; i < 4; i++) parts.push(leaf(rng, rng.range(0.1, 0.16), 0.035, (i / 4) * Math.PI * 2 + 0.4, rng.range(0.8, 1.3), DC.leafDark, DC.leaf));
  return finish(parts, 0.1, 0.6);
}

export function reedGeo(seed: number): THREE.BufferGeometry {
  const rng = new Rng(seed);
  const parts: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 9; i++) {
    const a = rng.range(0, Math.PI * 2), d = rng.range(0, 0.18);
    const len = rng.range(0.9, 1.6);
    const g = new THREE.PlaneGeometry(0.035, len, 1, 3).translate(0, len / 2, 0);
    const pos = g.getAttribute('position'), bend = rng.range(0.1, 0.4);
    for (let k = 0; k < pos.count; k++) { const t = pos.getY(k) / len; pos.setX(k, pos.getX(k) * (1 - t * 0.85)); pos.setZ(k, t * t * len * bend); }
    g.computeVertexNormals();
    parts.push(twoSided(part(g, (p, _n, out) => { const t = p.y / 1.5; out.copy(DC.reed).lerp(DC.reedMid, smoothstep(0, 0.5, t)).lerp(DC.reedTip, smoothstep(0.55, 1, t)); }, M(Math.cos(a) * d, 0, Math.sin(a) * d, a), { normals: 'up' })));
  }
  for (let i = 0; i < 2; i++) {
    const a = rng.range(0, Math.PI * 2), d = rng.range(0.04, 0.14), h = rng.range(1.1, 1.45);
    const tilt = M(Math.cos(a) * d, 0, Math.sin(a) * d, a, 1, 1, 1, rng.range(0.03, 0.12), 0);
    parts.push(part(new THREE.CylinderGeometry(0.006, 0.009, h, 3, 1, true).translate(0, h / 2, 0), DC.reedMid, tilt));
    parts.push(part(new THREE.CylinderGeometry(0.022, 0.022, 0.16, 5, 1, false).translate(0, h - 0.1, 0), DC.cattail, tilt));
  }
  return finish(parts, 0.2, 0.55);
}
