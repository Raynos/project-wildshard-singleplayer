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
  granite: c('#a29d93'), graniteWarm: c('#b3a893'), graniteCool: c('#8e9396'), rockDark: c('#5f5e62'),
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

interface DabSpec {
  /** dabs (small displaced icospheres) scattered through an ellipsoid of radii rx / ry / rz, centred at cy */
  n: number; rx: number; ry: number; rz: number; cy: number;
  /** dab radius range, and its vertical squash */
  r: [number, number]; sy: number;
  /** colour of a dab from its height 0..1 in the bush, its outward-facing-ness 0..1 and a random 0..1 */
  paint: (h: number, out: number, rnd: number, c: THREE.Color) => void;
}

/**
 * A bush as a cloud of painted dabs — each a 20-triangle blob with its own shade, so the crown breaks up into brush
 * strokes the way the mockups' bushes do (a few big smooth lobes read as clay). Normals are re-aimed out from the
 * bush centre (blended with the dab's own) so the whole crown shades as one soft volume under the cel bands.
 */
function dabs(rng: Rng, o: DabSpec): THREE.BufferGeometry[] {
  const parts: THREE.BufferGeometry[] = [];
  const col = new THREE.Color(), v = new THREE.Vector3(), w = new THREE.Vector3();
  for (let i = 0; i < o.n; i++) {
    // denser toward the shell than the core (the core is never seen)
    const u = Math.cbrt(0.35 + 0.65 * rng.next()), th = rng.range(0, Math.PI * 2), ph = Math.acos(rng.range(-0.35, 1));
    const x = Math.sin(ph) * Math.cos(th) * u * o.rx, y = o.cy + Math.cos(ph) * u * o.ry, z = Math.sin(ph) * Math.sin(th) * u * o.rz;
    const r = rng.range(o.r[0], o.r[1]);
    const g = blob(r, rng, 0, o.sy, 0.3);
    g.rotateY(rng.range(0, Math.PI * 2));
    g.translate(x, Math.max(y, r * 0.4), z);
    const pos = g.getAttribute('position'), nrm = g.getAttribute('normal');
    for (let k = 0; k < pos.count; k++) {
      v.set(pos.getX(k) / o.rx, (pos.getY(k) - o.cy) / o.ry, pos.getZ(k) / o.rz).normalize();
      w.set(nrm.getX(k), nrm.getY(k), nrm.getZ(k)).lerp(v, 0.7).normalize();
      nrm.setXYZ(k, w.x, w.y, w.z);
    }
    const hN = clamp(y / (o.cy + o.ry), 0, 1), outN = clamp(u, 0, 1);
    o.paint(hN, outN, rng.next(), col);
    parts.push(part(g, col.clone()));
  }
  return parts;
}

export function juniperGeo(seed: number): THREE.BufferGeometry {
  const rng = new Rng(seed);
  const parts = dabs(rng, {
    n: 22, rx: 0.95, ry: 0.32, rz: 0.8, cy: 0.12, r: [0.17, 0.28], sy: 0.6,
    paint: (h, _o, rnd, out) => { out.copy(DC.juniper).lerp(DC.juniperBlue, rnd * 0.7).lerp(DC.juniperTop, smoothstep(0.35, 1, h) * (0.4 + rnd * 0.6)); },
  });
  return finish(parts, 0.2, 0.5);
}

export function roseGeo(seed: number): THREE.BufferGeometry {
  const rng = new Rng(seed);
  const parts = dabs(rng, {
    n: 20, rx: 0.5, ry: 0.42, rz: 0.5, cy: 0.42, r: [0.13, 0.2], sy: 0.85,
    paint: (h, _o, rnd, out) => { out.copy(DC.leafDark).lerp(DC.leaf, smoothstep(0.1, 0.7, h)).lerp(DC.leafLight, smoothstep(0.55, 1, h) * rnd); },
  });
  // the wild-rose blossoms: small pale-pink and white dabs sitting on the upper shell
  for (let i = 0; i < 9; i++) {
    const th = rng.range(0, Math.PI * 2), ph = rng.range(0.15, 1.25);
    const x = Math.sin(ph) * Math.cos(th) * 0.52, y = 0.42 + Math.cos(ph) * 0.44, z = Math.sin(ph) * Math.sin(th) * 0.52;
    const g = new THREE.CircleGeometry(rng.range(0.035, 0.05), 5).lookAt(new THREE.Vector3(x, y - 0.42, z));
    g.translate(x * 1.04, y * 1.02, z * 1.04);
    const pc = rng.next() < 0.3 ? DC.daisy : rng.next() < 0.5 ? DC.roseDeep : DC.rose;
    parts.push(twoSided(part(g, (q, _n, out) => { out.copy(pc).lerp(DC.daisyCentre, smoothstep(0.02, 0.0, Math.hypot(q.x - x * 1.04, q.y - y * 1.02, q.z - z * 1.04)) * 0.8); }, undefined, { normals: 'up' })));
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
  parts.push(...dabs(rng, {
    n: 20, rx: 0.42, ry: 0.55, rz: 0.42, cy: 0.72, r: [0.11, 0.17], sy: 1.5,
    paint: (h, _o, rnd, out) => { out.copy(DC.willowDark).lerp(DC.willow, smoothstep(0.1, 0.7, h)).lerp(DC.willowLight, smoothstep(0.5, 1, h) * rnd * 0.7); },
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
function spike(r: number, len: number, deep: THREE.Color, mid: THREE.Color, tip: THREE.Color, rng: Rng): THREE.BufferGeometry {
  const prof: [number, number][] = [[0.004, 0]];
  const segs = 4, ph = rng.range(0, 3);
  for (let k = 0; k <= segs; k++) {
    const t = k / segs;
    const swell = k % 2 === 0 ? 1 : 0.72;
    prof.push([Math.max(0.004, r * (1 - t) ** 0.75 * swell * (k === 0 ? 0.8 : 1)), t * len]);
  }
  prof.push([0.002, len + r * 0.4]);
  const g = new THREE.LatheGeometry(prof.map(([a, b]) => new THREE.Vector2(a, b)), 5);
  g.rotateY(rng.range(0, Math.PI));
  const w = mergeVerticesByPos(g);
  w.computeVertexNormals();
  return part(w, (p, _n, out) => {
    const t = clamp(p.y / len, 0, 1);
    out.copy(deep).lerp(mid, smoothstep(0, 0.45, t)).lerp(tip, smoothstep(0.45, 1, t));
    out.multiplyScalar(0.9 + 0.2 * Math.sin(t * 22 + ph));
  });
}

export function lupinGeo(seed: number): THREE.BufferGeometry {
  const rng = new Rng(seed);
  const parts: THREE.BufferGeometry[] = [];
  const n = 7;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + rng.range(-0.5, 0.5), d = i === 0 ? 0 : rng.range(0.06, 0.2);
    const h = rng.range(0.42, 0.75), len = rng.range(0.2, 0.34), r = rng.range(0.04, 0.055);
    const tilt = M(Math.cos(a) * d, 0, Math.sin(a) * d, a, 1, 1, 1, rng.range(0.04, 0.2) * (d > 0 ? 1 : 0.3), 0);
    const base = h - len;
    parts.push(part(new THREE.CylinderGeometry(0.006, 0.01, base + 0.02, 3, 1, true).translate(0, (base + 0.02) / 2, 0), DC.stem, tilt));
    const pal = rng.next();
    const deep = pal < 0.2 ? DC.lupinPink : DC.sage, tip = pal < 0.2 ? DC.lupinPinkLight : DC.sageLight;
    const sp = spike(r, len, deep, pal < 0.2 ? DC.lupinPink : DC.sageMid, tip, rng);
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
    const h = rng.range(0.22, 0.42), yellow = i % 3 === 2;
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
