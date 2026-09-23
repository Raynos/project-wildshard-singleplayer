import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * nalatiArms — the Nalati rider's first-person arms, shared by every Nalati viewmodel (Bow.ts, Sabre.ts, Spear.ts) so
 * all three weapons are held by the same hands (look pass, docs/design/nalati/look-pass.md §7; mockups
 * art/nalati-grasslands/round-1/1-art-style/style-B-painterly.png, round-2/1-combat/*.png).
 *
 * The rider: brown leather gloves (a stitched back, stitched finger seams, a flared gauntlet with a rolled, stitched
 * edge), a thick white fleece cuff, and cream wool sleeves with red Kazakh ram's-horn (qoshqar mùiz) ornament bands,
 * soft fabric folds and a little felt relief on the appliqué. Smooth geometry, every colour painted per vertex (AO in
 * the creases, lighter tops), lit by the shared painterly material (src/world/painterly.ts) — no textures.
 *
 *   gloveFist({ R, mirror?, thumbRing?, span?, yaw? })  → { geometry, wrist, wristDir }
 *        a gloved fist closed round a grip of radius R running along +Y through the origin ("grip space"). Canonical
 *        right hand: the palm on the grip's +X side (the back of the hand faces +X), the thumb on top (+Y) curled over
 *        the index finger, the forearm leaving toward +Z. `mirror` = the left hand (X flipped). `yaw` turns the whole
 *        hand about the grip (+Y) so the forearm points where the arm really goes. `span` scales the finger stack along
 *        Y (1 = 8.5 cm). `thumbRing` = the archer's jade thumb ring. `wrist` / `wristDir`: where the arm piece joins.
 *   riderArm(len, seed?)   → geometry along +Y from the wrist (y = 0): gauntlet → fleece cuff → sleeve, `len` m long
 *   placeArm(obj, wrist, dir)   pose an arm mesh: at `wrist`, its +Y along `dir` (per frame for a rig with an elbow)
 *   forearm(dir, len, gripR, { mirror?, fistLen?, part? })   drop-in for meleeGeo.forearm: the fist in grip space + the
 *        arm lofted along `dir` from its wrist; `part` 'fist' | 'arm' | 'both'. The hand is turned about the grip so its
 *        forearm heads the way `dir` does.
 *   ARM_PAL   the palette (linear)
 *
 * Budget: a fist is ~3.5 k vertices, an arm piece ~12 k (96 around, rows every 3 mm through the ornament bands) —
 * build-time only, nothing here runs per frame except `placeArm`.
 */

const lin = (hex: number): THREE.Color => new THREE.Color(hex).convertSRGBToLinear();
export const ARM_PAL = {
  leather: lin(0x9c7454), leatherLight: lin(0xc49c74), leatherDark: lin(0x5c4230), leatherEdge: lin(0x6e5038),
  thread: lin(0xf0dcae), jade: lin(0xbfe0c4), jadeDark: lin(0x7aa88a),
  fleece: lin(0xf4eee2), fleeceShade: lin(0xcabda6), fleeceDeep: lin(0x9a8c78),
  wool: lin(0xeee2c6), woolShade: lin(0xcdb792), red: lin(0xc0321e), redDeep: lin(0x8a1c12), redLine: lin(0x6a1610), gold: lin(0xd8a84a),
};

// ───────────────────────────── the loft ─────────────────────────────

type Paint = (v: number, a: number, out: THREE.Color) => THREE.Color;
interface LoftOpts {
  /** superellipse exponent of the section: 2 = ellipse, higher = squarer (a hand's back) */
  squareness?: number;
  capStart?: boolean; capEnd?: boolean;
}
const _t = new THREE.Vector3(), _u = new THREE.Vector3(), _s = new THREE.Vector3(), _c = new THREE.Color();
/**
 * Sweep a section along centre points. `ups[i]` orients the section's "thickness" axis (the rest is its "width" axis
 * = tangent × up). `w[i]` / `h[i]` are the half width / half thickness. Indexed, a duplicated seam (so `a` paints
 * round), smooth normals.
 */
function loft(centers: THREE.Vector3[], ups: THREE.Vector3[], w: number[], h: number[], radial: number, paint: Paint, opts: LoftOpts = {}): THREE.BufferGeometry {
  const n = centers.length, e = opts.squareness ?? 2;
  const pos: number[] = [], col: number[] = [], idx: number[] = [];
  for (let i = 0; i < n; i++) {
    const c = centers[i] ?? _t, prev = centers[Math.max(0, i - 1)] ?? c, next = centers[Math.min(n - 1, i + 1)] ?? c;
    _t.subVectors(next, prev).normalize();
    _u.copy(ups[i] ?? ups[0] ?? _u).addScaledVector(_t, -(ups[i] ?? _u).dot(_t)).normalize();
    _s.crossVectors(_t, _u);
    const wi = w[i] ?? 0, hi = h[i] ?? 0;
    for (let k = 0; k <= radial; k++) {
      const th = (k / radial) * Math.PI * 2, ct = Math.cos(th), st = Math.sin(th);
      const cx = Math.sign(ct) * Math.abs(ct) ** (2 / e), sy = Math.sign(st) * Math.abs(st) ** (2 / e);
      pos.push(c.x + _s.x * cx * wi + _u.x * sy * hi, c.y + _s.y * cx * wi + _u.y * sy * hi, c.z + _s.z * cx * wi + _u.z * sy * hi);
      paint(n > 1 ? i / (n - 1) : 0, k / radial, _c); col.push(_c.r, _c.g, _c.b);
    }
  }
  const row = radial + 1;
  for (let i = 0; i < n - 1; i++) for (let k = 0; k < radial; k++) {
    const a = i * row + k, b = a + 1, d = a + row, f = d + 1;
    idx.push(a, d, b, b, d, f);
  }
  const cap = (i: number, flip: boolean) => {
    const c = centers[i]; if (c === undefined) return;
    const ci = pos.length / 3; pos.push(c.x, c.y, c.z);
    paint(n > 1 ? i / (n - 1) : 0, 0, _c); col.push(_c.r, _c.g, _c.b);
    for (let k = 0; k < radial; k++) { const a = i * row + k; if (flip) idx.push(ci, a + 1, a); else idx.push(ci, a, a + 1); }
  };
  if (opts.capStart === true) cap(0, false);
  if (opts.capEnd === true) cap(n - 1, true);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** a smooth ellipsoid painted one colour, darker underneath */
function ellipsoid(center: THREE.Vector3, r: THREE.Vector3, col: THREE.Color, q?: THREE.Quaternion, seg = 10): THREE.BufferGeometry {
  const g = new THREE.SphereGeometry(1, seg, Math.max(4, Math.round(seg * 0.7)));
  g.deleteAttribute('uv');
  g.scale(r.x, r.y, r.z);
  if (q) g.applyQuaternion(q);
  g.translate(center.x, center.y, center.z);
  const p = g.getAttribute('position'), c = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) { const k = 0.82 + 0.18 * Math.min(1, Math.max(0, (p.getY(i) - center.y) / r.y * 0.5 + 0.5)); c[i * 3] = col.r * k; c[i * 3 + 1] = col.g * k; c[i * 3 + 2] = col.b * k; }
  g.setAttribute('color', new THREE.BufferAttribute(c, 3));
  return g;
}

function mergeAll(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  for (const p of parts) for (const k of Object.keys(p.attributes)) if (k !== 'position' && k !== 'normal' && k !== 'color') p.deleteAttribute(k);
  const g = mergeGeometries(parts, false);
  g.computeBoundingSphere();
  return g;
}

/** flip X (a left hand from a right one): scale, re-wind, and re-derive normals */
function mirrorX(g: THREE.BufferGeometry): THREE.BufferGeometry {
  g.scale(-1, 1, 1);
  const idx = g.getIndex();
  if (idx) { const a = idx.array; for (let i = 0; i < a.length; i += 3) { const t = a[i + 1] ?? 0; a[i + 1] = a[i + 2] ?? 0; a[i + 2] = t; } idx.needsUpdate = true; }
  g.computeVertexNormals();
  return g;
}

/** hash noise (build-time only) */
function hash(x: number, y: number): number { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); }
function vnoise(x: number, y: number): number {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

// ───────────────────────────── the gloved fist ─────────────────────────────

export interface FistOpts {
  /** radius of what the fist closes on (a bow grip ~0.02, a sabre grip 0.016, a bowstring 0.009 — a tight fist) */
  R: number;
  mirror?: boolean;
  thumbRing?: boolean;
  /** finger-stack scale along Y (1 = 8.5 cm, a gloved man's hand) */
  span?: number;
  /** turn about the grip (+Y), radians: aims the forearm (canonical +Z) */
  yaw?: number;
}
/** `hook`: the point on the grip axis inside the thumb's curl — where a bowstring sits in a thumb draw */
export interface Fist { geometry: THREE.BufferGeometry; wrist: THREE.Vector3; wristDir: THREE.Vector3; hook: THREE.Vector3 }

/** a point in grip-cylinder coordinates: angle φ (0 = +X, negative toward −Z = the front), radius ρ, height y */
const cyl = (phiDeg: number, rho: number, y: number) => { const p = THREE.MathUtils.degToRad(phiDeg); return new THREE.Vector3(Math.cos(p) * rho, y, Math.sin(p) * rho); };

/** one finger (or the thumb) as a lofted tube through joint points, with knuckle bulges, a rounded tip and a stitched back */
function finger(joints: THREE.Vector3[], r: number, bulgeAt: number[], leather: THREE.Color, dashes: THREE.BufferGeometry[], stitchFrom: number, stitchTo: number): THREE.BufferGeometry {
  const curve = new THREE.CatmullRomCurve3(joints, false, 'centripetal');
  const N = 26;
  const centers: THREE.Vector3[] = [], ups: THREE.Vector3[] = [], w: number[] = [], h: number[] = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N, p = curve.getPoint(t);
    centers.push(p);
    ups.push(new THREE.Vector3(p.x, 0, p.z).normalize()); // "thickness" axis = out from the grip axis: the finger's back
    let k = 1 - 0.14 * t;
    for (const b of bulgeAt) k += 0.1 * Math.exp(-(((t - b) / 0.06) ** 2));
    if (t > 0.86) k *= Math.sqrt(Math.max(0.02, 1 - ((t - 0.86) / 0.14) ** 2)); // rounded tip
    w.push(r * k * 1.06); h.push(r * k * 0.92);
  }
  const g = loft(centers, ups, w, h, 12, (v, a, out) => {
    const back = Math.sin(a * Math.PI * 2);                                   // +1 on the back, −1 facing the grip
    out.copy(leather).lerp(ARM_PAL.leatherLight, Math.max(0, back) * 0.35);
    for (const b of bulgeAt) out.lerp(ARM_PAL.leatherLight, 0.35 * Math.exp(-(((v - b) / 0.05) ** 2)) * Math.max(0, back));
    if (back < -0.2) out.lerp(ARM_PAL.leatherDark, 0.3 * (-back));           // the crease against the grip
    const side = Math.abs(Math.cos(a * Math.PI * 2));
    out.multiplyScalar(1 - 0.2 * side * side);                                 // dark between the fingers
    return out;
  }, { capEnd: true });
  // stitching: a dashed seam of pale thread down the finger's back
  for (let t = stitchFrom; t <= stitchTo; t += 0.07) {
    const p = curve.getPoint(t), tan = curve.getTangent(t), out = new THREE.Vector3(p.x, 0, p.z).normalize();
    const c = p.clone().addScaledVector(out, r * 0.93);
    dashes.push(ellipsoid(c, new THREE.Vector3(0.0009, 0.0009, 0.0026), ARM_PAL.thread, new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), tan), 5));
  }
  return g;
}

export function gloveFist(opts: FistOpts): Fist {
  const R = opts.R, sp = (opts.span ?? 1) * 1.12;
  const parts: THREE.BufferGeometry[] = [], dashes: THREE.BufferGeometry[] = [];
  const L = ARM_PAL;
  // ── the back of the hand + palm: a squarish loft from the wrist (+Z) to the knuckle row (front-right of the grip) ──
  const wrist = new THREE.Vector3(R + 0.015, -0.002 * sp, 0.072);
  const knuckle = cyl(-44, R + 0.019, 0.002 * sp);
  const body: THREE.Vector3[] = [], ups: THREE.Vector3[] = [], bw: number[] = [], bh: number[] = [];
  const NB = 12;
  for (let i = 0; i <= NB; i++) {
    const t = i / NB;
    const p = new THREE.Vector3().lerpVectors(wrist, knuckle, t);
    p.x += Math.sin(t * Math.PI) * 0.006;                                                  // the back of the hand arches
    body.push(p);
    const out = new THREE.Vector3(p.x, 0, p.z).normalize();
    ups.push(new THREE.Vector3().lerpVectors(new THREE.Vector3(1, 0, 0), out, t).normalize());
    bw.push((0.03 + 0.013 * Math.min(1, t * 1.4)) * sp * (t > 0.9 ? 1 - (t - 0.9) * 2.5 : 1));
    bh.push(0.019 - 0.004 * t);
  }
  parts.push(loft(body, ups, bw, bh, 20, (v, a, out) => {
    const back = Math.sin(a * Math.PI * 2);
    out.copy(L.leather).lerp(L.leatherLight, Math.max(0, back) * 0.3 * (0.6 + 0.4 * v));
    if (back < -0.3) out.lerp(L.leatherDark, 0.22);                                          // the palm, in the grip's shadow
    return out;
  }, { squareness: 2.6, capEnd: true }));
  // back-of-hand stitching: the glove's three "points" running from the finger valleys toward the wrist
  for (const yk of [0.019, 0, -0.019]) for (let t = 0.35; t <= 0.9; t += 0.09) {
    const p = new THREE.Vector3().lerpVectors(wrist, knuckle, t); p.x += Math.sin(t * Math.PI) * 0.006;
    const out = new THREE.Vector3(p.x, 0, p.z).normalize();
    const c = p.clone().addScaledVector(out, 0.0172 - 0.004 * t); c.y = yk * sp * (0.7 + 0.3 * t);
    const dir = new THREE.Vector3().subVectors(knuckle, wrist).normalize();
    dashes.push(ellipsoid(c, new THREE.Vector3(0.0009, 0.0009, 0.0028), L.thread, new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir), 5));
  }
  // ── four fingers curled round the grip: index on top (the thumb side), pinky at the bottom ──
  const fingers: [number, number, number][] = [[0.029, 0.0112, 0], [0.0095, 0.0116, 4], [-0.0095, 0.011, 2], [-0.028, 0.0098, -8]]; // y, radius, tip angle trim
  for (const [fy, fr, trim] of fingers) {
    const y = fy * sp;
    const j = [cyl(-18, R + 0.02, y), cyl(-48, R + 0.022, y), cyl(-92, R + fr + 0.003, y), cyl(-138, R + fr + 0.001, y * 0.98), cyl(-182, R + fr, y * 0.96), cyl(-222 - trim, R + fr * 0.95, y * 0.95)];
    parts.push(finger(j, fr, [0.2, 0.5, 0.76], L.leather, dashes, 0.18, 0.62));
    // the knuckle bump on the back of the hand
    const kn = cyl(-47, R + 0.029, y);
    parts.push(ellipsoid(kn, new THREE.Vector3(0.0105, 0.0085, 0.0085).multiplyScalar(fr / 0.01), L.leatherLight, new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), THREE.MathUtils.degToRad(47)), 8));
  }
  // ── the thumb: from the heel of the palm, round the back of the grip, its tip over the index finger's middle joint ──
  const ty = 0.043 * sp;
  const thumbJ = [new THREE.Vector3(R + 0.012, 0.022 * sp, 0.05), cyl(28, R + 0.02, 0.034 * sp), cyl(78, R + 0.013, ty), cyl(128, R + 0.011, ty + 0.002), cyl(176, R + 0.011, ty), cyl(204, R + 0.01, ty - 0.002)];
  parts.push(finger(thumbJ, 0.013, [0.35, 0.66], L.leather, dashes, 0.25, 0.7));
  if (opts.thumbRing === true) {
    const c = new THREE.CatmullRomCurve3(thumbJ, false, 'centripetal');
    const p = c.getPoint(0.5), tan = c.getTangent(0.5);
    const ring = new THREE.TorusGeometry(0.0138, 0.0026, 8, 20);
    ring.deleteAttribute('uv');
    ring.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), tan));
    ring.translate(p.x, p.y, p.z);
    const pa = ring.getAttribute('position'), cc = new Float32Array(pa.count * 3);
    for (let i = 0; i < pa.count; i++) { const k = 0.5 + 0.5 * Math.sin(pa.getX(i) * 900 + pa.getY(i) * 700); const col = L.jade.clone().lerp(L.jadeDark, k * 0.5); cc[i * 3] = col.r; cc[i * 3 + 1] = col.g; cc[i * 3 + 2] = col.b; }
    ring.setAttribute('color', new THREE.BufferAttribute(cc, 3));
    parts.push(ring);
  }
  let g = mergeAll([...parts, ...dashes]);
  const wristDir = new THREE.Vector3(0.12, 0, 1).normalize();
  const w = wrist.clone();
  if (opts.mirror === true) { g = mirrorX(g); w.x = -w.x; wristDir.x = -wristDir.x; }
  if (opts.yaw !== undefined && opts.yaw !== 0) {
    const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), opts.yaw);
    g.applyQuaternion(q); w.applyQuaternion(q); wristDir.applyQuaternion(q);
  }
  g.computeBoundingSphere();
  return { geometry: g, wrist: w, wristDir, hook: new THREE.Vector3(0, ty, 0) };
}

// ───────────────────────────── the arm piece: gauntlet → fleece cuff → sleeve ─────────────────────────────

const GAUNT_END = 0.07, FLEECE_END = 0.13;

/** ram's-horn scroll (0 = wool, 1 = red appliqué) in one tile: `a` across 0..1 (one wave), `b` along the band 0..1.
 *  A continuous wave; at each crest / trough a horn curls back into itself; a small diamond sits in each bay. */
function qoshqar(a: number, b: number): number {
  const ax = 0.55; // the tile is wider round the arm than along it
  const stroke = (d: number, wdt: number) => 1 - THREE.MathUtils.smoothstep(d, wdt * 0.55, wdt);
  const wave = 0.5 + 0.26 * Math.sin(a * Math.PI * 2);
  const slope = 0.26 * Math.PI * 2 * Math.cos(a * Math.PI * 2) * ax;
  let m = stroke(Math.abs(b - wave) / Math.sqrt(1 + slope * slope), 0.085);
  for (const [cx, cy, dir] of [[0.25, 0.76, -1], [0.75, 0.24, 1]] as const) {
    // the horn: an open ring hanging off the crest toward the next bay, and a dot at its heart
    const hx = cx + dir * -0.1, hy = cy + dir * 0.02;
    const dx = (a - hx) * ax, dy = b - hy, r = Math.hypot(dx, dy);
    const open = dir * dx < 0.01 || dir * dy < 0.0;
    if (open) m = Math.max(m, stroke(Math.abs(r - 0.1), 0.06));
    m = Math.max(m, stroke(r, 0.045));
  }
  // diamonds in the bays
  for (const [cx, cy] of [[0.75, 0.8], [0.25, 0.2]] as const) m = Math.max(m, stroke(Math.abs(a - cx) * ax * 1.4 + Math.abs(b - cy), 0.09));
  // border rules
  if (b < 0.06 || b > 0.94) m = 1;
  return Math.min(1, m);
}

/**
 * The arm from the wrist, along +Y: a flared leather gauntlet with a rolled, stitched edge (0 … 7 cm), a thick fleece
 * cuff (… 13 cm), then the cream wool sleeve — soft folds, red ornament bands with a little felt relief, the band
 * borders in deep red — running `len` m, well out of frame.
 */
export function riderArm(len = 0.9, seed = 1): THREE.BufferGeometry {
  const L = ARM_PAL;
  const RAD = 96;
  const ys: number[] = [];
  const bands: [number, number][] = [[0.16, 0.28], [0.44, 0.56]];
  const inBand = (y: number) => bands.some(([a, b]) => y > a - 0.02 && y < b + 0.02);
  for (let y = 0; y < len;) {
    ys.push(y);
    y += y < GAUNT_END ? 0.005 : y < FLEECE_END + 0.02 ? 0.003 : inBand(y) ? 0.003 : 0.012;
  }
  ys.push(len);
  const pos: number[] = [], col: number[] = [], idx: number[] = [];
  const c = new THREE.Color();
  for (const y of ys) {
    for (let k = 0; k <= RAD; k++) {
      const a = k / RAD, ph = a * Math.PI * 2;
      let r: number;
      if (y < GAUNT_END) { // gauntlet: flares, a rolled edge at the end
        const t = y / GAUNT_END;
        r = 0.033 + 0.012 * t * t + 0.0022 * Math.exp(-(((t - 0.93) / 0.05) ** 2));
        c.copy(L.leather).lerp(L.leatherLight, 0.25 + 0.2 * Math.sin(ph + 0.4));
        if (t > 0.86) c.lerp(L.leatherEdge, 0.6);
        c.multiplyScalar(0.9 + 0.1 * vnoise(ph * 4, y * 90 + seed));
        if (t < 0.12) c.lerp(L.leatherDark, 0.5 * (1 - t / 0.12));
      } else if (y < FLEECE_END) { // fleece: a fat roll of tufts
        const t = (y - GAUNT_END) / (FLEECE_END - GAUNT_END);
        const tuft = vnoise(ph * 7 + seed, y * 170) * 0.7 + vnoise(ph * 17, y * 380 + seed) * 0.3;
        r = 0.046 + 0.012 * Math.sin(t * Math.PI) ** 0.7 + 0.006 * (tuft - 0.5) * Math.sin(t * Math.PI);
        c.copy(L.fleece).lerp(L.fleeceShade, 0.65 * (1 - tuft)).lerp(L.fleeceDeep, 0.5 * (1 - Math.sin(t * Math.PI)) ** 2);
      } else { // wool sleeve
        const s = y - FLEECE_END;
        const fold = Math.sin(ph * 3 + y * 7 + seed) * 0.6 + Math.sin(ph * 5 - y * 11 + seed * 2) * 0.4;
        const bunch = Math.sin(y * 70) * Math.exp(-s * 9);                                   // fabric bunched against the cuff
        r = 0.047 + Math.min(1, s / 0.35) * 0.014 + 0.0032 * fold + 0.0022 * bunch;
        c.copy(L.wool);
        const band = bands.find(([a0, b0]) => y > a0 - 0.012 && y < b0 + 0.012);
        if (band !== undefined) {
          const [a0, b0] = band;
          const b = (y - a0) / (b0 - a0);
          if (b < 0 || b > 1) { c.copy(L.redDeep); r += 0.0007; }                           // the border lines
          else if (b < 0.1 || b > 0.9) c.copy(L.wool);
          else {
            const m = qoshqar((a * 6) % 1, (b - 0.1) / 0.8);
            c.lerpColors(L.wool, L.red, m); r += 0.0009 * m;                                 // felt appliqué, a hair proud
          }
        } else if (Math.abs(y - 0.33) < 0.006 || Math.abs(y - 0.35) < 0.004) c.copy(L.red);   // pin stripes between the bands
        c.lerp(L.woolShade, 0.35 * Math.max(0, -fold) + 0.4 * Math.exp(-s * 40));             // fold valleys, the fleece's shadow
        c.multiplyScalar(0.94 + 0.08 * vnoise(ph * 30, y * 200 + seed));                      // wool grain
      }
      pos.push(Math.cos(ph) * r, y, Math.sin(ph) * r);
      col.push(c.r, c.g, c.b);
    }
  }
  const row = RAD + 1;
  for (let i = 0; i < ys.length - 1; i++) for (let k = 0; k < RAD; k++) {
    const a = i * row + k, b = a + 1, d = a + row, e = d + 1;
    idx.push(a, d, b, b, d, e);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  // the gauntlet's stitched edge: a ring of pale dashes just inside the roll
  const dashes: THREE.BufferGeometry[] = [g];
  const ey = GAUNT_END * 0.8, er = 0.033 + 0.012 * 0.64 + 0.0006;
  for (let k = 0; k < 40; k++) {
    const ph = (k / 40) * Math.PI * 2;
    dashes.push(ellipsoid(new THREE.Vector3(Math.cos(ph) * er, ey, Math.sin(ph) * er), new THREE.Vector3(0.0026, 0.0009, 0.0009), L.thread, new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -ph + Math.PI / 2), 5));
  }
  const out = mergeAll(dashes);
  out.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, len / 2, 0), len);
  return out;
}

const _y = new THREE.Vector3(0, 1, 0), _d = new THREE.Vector3();
/** pose an arm mesh (built along +Y from the wrist) at `wrist`, heading along `dir` (same space as the mesh's parent) */
export function placeArm(obj: THREE.Object3D, wrist: THREE.Vector3, dir: THREE.Vector3): void {
  obj.position.copy(wrist);
  obj.quaternion.setFromUnitVectors(_y, _d.copy(dir).normalize());
}

/**
 * Drop-in for `meleeGeo.forearm` (Sabre.ts / Spear.ts): the fist in grip space (grip along +Y through the origin),
 * turned about the grip so the forearm heads along `dir`'s horizontal part, plus the arm lofted along `dir` from the
 * wrist. `mirror` = a left hand. `fistLen` = the finger stack (8.5 cm default). `part` picks the fist, the arm or both.
 */
export function forearm(dir: THREE.Vector3, len = 0.6, gripR = 0.017, opts: { mirror?: boolean; fistLen?: number; part?: 'fist' | 'arm' | 'both' } = {}): THREE.BufferGeometry {
  const d = dir.clone().normalize(), part = opts.part ?? 'both';
  // canonical forearm heads along +Z (+ a little +X): turn the hand about Y so it heads along d's XZ projection
  const baseYaw = Math.atan2(opts.mirror === true ? -0.12 : 0.12, 1);
  const yaw = Math.hypot(d.x, d.z) > 0.15 ? Math.atan2(d.x, d.z) - baseYaw : 0;
  const fist = gloveFist({ R: gripR, mirror: opts.mirror ?? false, span: (opts.fistLen ?? 0.085) / 0.085, yaw });
  const parts: THREE.BufferGeometry[] = [];
  if (part !== 'arm') parts.push(fist.geometry);
  if (part !== 'fist') {
    const arm = riderArm(len, opts.mirror === true ? 2 : 1);
    const start = fist.wrist.clone().addScaledVector(d, -0.018); // the gauntlet laps over the back of the hand
    arm.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(_y, d));
    arm.translate(start.x, start.y, start.z);
    parts.push(arm);
  }
  return parts.length === 1 && parts[0] ? parts[0] : mergeAll(parts);
}
