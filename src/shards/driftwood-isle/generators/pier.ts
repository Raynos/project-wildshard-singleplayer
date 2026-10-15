import * as THREE from 'three';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type {Rng} from '@wildshard/sdk/random';
import type {PierParams} from '../assets/contracts/pier';
import {pierDeckAt,pierHalfWidthAt} from '../world/pierLayout';

const C = {
  plank: new THREE.Color('#9a7a56'),
  plankLight: new THREE.Color('#b08d64'),
  plankDark: new THREE.Color('#7c6244'),
  post: new THREE.Color('#6f5638'),
  postTop: new THREE.Color('#8a6d48'),
  rope: new THREE.Color('#d8c48a'),
  ropeDark: new THREE.Color('#b59e6a'),
  brass: new THREE.Color('#d9b45a'),
};

/**
 * The pier's pennant (E111). A swallowtail in the Lookout banner's blues with its white diamond. It flies downwind
 * (wind.ts leans everything toward (-0.55, 0.83)) and flutters in the shared wind.
 *
 * The cloth is one sheet of single-sided triangles on the kit's DoubleSide material. Its own mesh casts a shadow but
 * never receives one. The old flag was a front and a back triangle, coplanar, in the pier's shadow-receiving mesh. It
 * shadowed itself into dark triangular streaks, the same acne as the boat's sail (E110).
 */
const PENNANT = {
  length: 1.75, hoist: 0.72, cols: 7, rows: 4,
  /** the swallowtail's notch, as a share of the length at the centre line */
  notch: 0.3,
  /** where along the length the notch starts to pull the centre line back (E138: from the hoist, it bent every column
   *  line into a chevron, and the sleeve's edge read as a jagged seam across the cloth) */
  notchFrom: 0.4,
  blue: new THREE.Color('#2f5bd0'), dark: new THREE.Color('#1c3c96'), white: new THREE.Color('#e8f0ff'),
};

/** the pennant's cloth, own space: hoisted at (x, z) with its top edge at `yTop`, streaming along `dir` */
function pennantGeometry(x: number, z: number, yTop: number, dir: readonly [number, number], rng: Rng): THREE.BufferGeometry {
  const { length: L, hoist: H, cols, rows, notch, notchFrom } = PENNANT;
  const [dx, dz] = dir, dn = Math.hypot(dx, dz), ax = dx / dn, az = dz / dn, nx = -az, nz = ax;
  // (a along the length 0‥1, v down the hoist 0‥1, side offset off the cloth) → xyz + the sway weight. The cloth's
  // grid passes u and lets the notch pull the centre of the fly end back; the sigil passes a directly, so it stays a diamond
  const P = (a: number, v: number, off = 0, u = a): { p: number[]; w: number } => {
    const half = (H / 2) * (1 - 0.5 * u);
    const y = yTop - H / 2 - 0.12 * u * u + (0.5 - v) * 2 * half;
    const s = Math.sin(a * Math.PI * 2 + 0.6) * 0.09 * a + Math.sin(v * Math.PI) * 0.02 * a + off;
    const d = 0.05 + a * L;
    return { p: [x + ax * d + nx * s, y, z + az * d + nz * s], w: 0.95 * a };
  };
  const pos: number[] = [], col: number[] = [], sway: number[] = [];
  const tri = (a: { p: number[]; w: number }, b: { p: number[]; w: number }, c: { p: number[]; w: number }, color: THREE.Color, jitter: number): void => {
    const k = 1 - jitter + rng.next() * jitter * 2;
    for (const q of [a, b, c]) { pos.push(...q.p); col.push(color.r * k, color.g * k, color.b * k); sway.push(q.w, 0.9); }
  };
  // the cloth: a grid, the first column a darker sleeve round the pole
  for (let c = 0; c < cols; c++) for (let r = 0; r < rows; r++) {
    const u0 = c / cols, u1 = (c + 1) / cols, v0 = r / rows, v1 = (r + 1) / rows, color = c === 0 ? PENNANT.dark : PENNANT.blue;
    // the notch pulls the fly end's centre back; the hoist half (the sleeve's edge, the diamond) keeps straight columns
    const G = (u: number, v: number): { p: number[]; w: number } => P(u - notch * (1 - Math.abs(2 * v - 1)) * Math.max(0, (u - notchFrom) / (1 - notchFrom)), v, 0, u);
    tri(G(u0, v0), G(u0, v1), G(u1, v1), color, 0.04);
    tri(G(u0, v0), G(u1, v1), G(u1, v0), color, 0.04);
  }
  // the Wildshard sigil on both faces, a hair proud of the cloth: a white diamond round a dark one
  const uc = 0.27, vc = 0.5;
  for (const side of [-1, 1]) {
    for (const [du, dv, off, color] of [[0.085, 0.36, 0.028, PENNANT.white], [0.045, 0.19, 0.05, PENNANT.dark]] as const) {
      const o = side * off, m = P(uc, vc, o), tip = [P(uc, vc - dv, o), P(uc + du, vc, o), P(uc, vc + dv, o), P(uc - du, vc, o)];
      for (let i = 0; i < 4; i++) { const a = tip[i], b = tip[(i + 1) % 4]; if (a && b) tri(m, a, b, color, 0.02); }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setAttribute('aSway', new THREE.Float32BufferAttribute(sway, 2));
  return g;
}

/**
 * the deck, the pilings, the bollards, the landing and the pennant pole: one non-indexed vertex-coloured geometry; and
 * the pennant's cloth when there is a landing (it draws from the same stream, between the pole and the kick board)
 */
export function deckGeometry(p: PierParams, rng: Rng): { deck: THREE.BufferGeometry; cloth: THREE.BufferGeometry | null } {
  const { width, pileDepth } = p, deckY = 0;
  const length = p.length, rampFrom = p.landing?.rampFrom ?? length, landY = p.landing?.landY ?? 0;
  const parts: THREE.BufferGeometry[] = [];
  let cloth: THREE.BufferGeometry | null = null;
  const add = (g: THREE.BufferGeometry, col: THREE.Color, jitter = 0.08): void => {
    g.deleteAttribute('uv'); g.deleteAttribute('normal');
    const nonIdx = g.index ? g.toNonIndexed() : g;
    const n = nonIdx.getAttribute('position').count;
    const c = new Float32Array(n * 3);
    // one shade per face (every 3 vertices) so the facets read
    for (let i = 0; i < n; i += 3) {
      const k = 1 - jitter + rng.next() * jitter * 2;
      for (let j = 0; j < 3; j++) { c[(i + j) * 3] = col.r * k; c[(i + j) * 3 + 1] = col.g * k; c[(i + j) * 3 + 2] = col.b * k; }
    }
    nonIdx.setAttribute('color', new THREE.BufferAttribute(c, 3));
    parts.push(nonIdx);
  };
  const put = (g: THREE.BufferGeometry, along: number, across: number, y: number): THREE.BufferGeometry => { g.translate(across, y, along); return g; };
  const deckAt = (along: number): number => pierDeckAt(p, along);

  // ── deck planks across the pier, slightly uneven ──
  const plankW = 0.36, gap = 0.05, thick = 0.12;
  const bearerY = deckY - thick - 0.16;
  for (let a = 0; a < length; a += plankW + gap) {
    const w = 2 * pierHalfWidthAt(p, a + plankW / 2) + 0.3 + rng.range(-0.06, 0.06);
    const g = new THREE.BoxGeometry(w, thick, plankW);
    const dy = rng.range(-0.015, 0.015), tilt = rng.range(-0.012, 0.012);
    g.rotateZ(tilt);
    const shade = rng.next();
    add(put(g, a + plankW / 2, rng.range(-0.03, 0.03), deckAt(a + plankW / 2) - thick / 2 + dy), shade < 0.2 ? C.plankDark : shade > 0.8 ? C.plankLight : C.plank, 0.06);
  }
  // ── two bearers (stringers) under the planks, full length ──
  const flat = rampFrom, seaRun = p.seaRamp?.run ?? 0;
  if (p.seaRamp === undefined) for (const s of [-1, 1]) add(put(new THREE.BoxGeometry(0.22, 0.28, flat + 0.4), flat / 2, s * (width / 2 - 0.35), bearerY), C.plankDark, 0.05);
  else {
    // SF46: the bearers start where the sea-end ramp tops out; the ramp has its own pitched pair
    const rise = -p.seaRamp.landY;
    for (const s of [-1, 1]) add(put(new THREE.BoxGeometry(0.22, 0.28, flat - seaRun + 0.2), (flat + seaRun) / 2, s * (width / 2 - 0.35), bearerY), C.plankDark, 0.05);
    for (const s of [-1, 1]) {
      // SF72: on a flared ramp each bearer runs under its own edge, from the sea end's flare in to the deck's width
      const from = s * (p.seaRamp.flare / 2 - 0.35), to = s * (width / 2 - 0.35), dir = new THREE.Vector3(to - from, rise, seaRun);
      const g = new THREE.BoxGeometry(0.22, 0.28, dir.length());
      g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir.normalize()));
      add(put(g, seaRun / 2, (from + to) / 2, bearerY - rise / 2), C.plankDark, 0.05);
    }
  }
  if (length > flat + 0.1) {
    const drop = deckY - landY, len = Math.hypot(length - flat, drop), ang = Math.atan2(drop, length - flat);
    for (const s of [-1, 1]) {
      const g = new THREE.BoxGeometry(0.22, 0.28, len); g.rotateX(ang);
      add(put(g, (flat + length) / 2, s * (width / 2 - 0.35), bearerY - drop / 2), C.plankDark, 0.05);
    }
  }

  // ── pilings every 3 m each side, cross braces, rope wraps at the top ──
  const postR = 0.17, postTop = deckY + 0.95;
  for (let a = 1.2; a < rampFrom; a += 3.0) {
    for (const s of [-1, 1]) {
      const across = s * (pierHalfWidthAt(p, a) + 0.1);
      const h = postTop - (deckY - pileDepth);
      const g = new THREE.CylinderGeometry(postR * 0.9, postR * 1.15, h, 7);
      g.rotateY(rng.range(0, Math.PI));
      add(put(g, a, across, (postTop + deckY - pileDepth) / 2), C.post, 0.07);
      // cap
      add(put(new THREE.CylinderGeometry(postR * 0.95, postR * 0.95, 0.1, 7), a, across, postTop + 0.02), C.postTop, 0.05);
      // rope wrap: three short 8-sided bands just under the cap (a torus each was 100 tris; the pier is drawn twice with shadows)
      for (let r = 0; r < 3; r++) add(put(new THREE.CylinderGeometry(postR + 0.06, postR + 0.06, 0.08, 8), a, across, postTop - 0.16 - r * 0.1), r === 1 ? C.ropeDark : C.rope, 0.04);
    }
    // cross brace under the deck between the two posts (none under the sea-end ramp: it would cross the walk)
    if (a < seaRun + 0.5) continue;
    const b = new THREE.BoxGeometry(2 * pierHalfWidthAt(p, a) + 0.4, 0.12, 0.12);
    add(put(b, a, 0, bearerY - 0.3), C.plankDark, 0.05);
  }

  // ── mooring bollards at the sea end: two thicker, taller posts with a heavy rope wrap ──
  for (const s of [-1, 1]) {
    const across = s * (pierHalfWidthAt(p, 0.35) + 0.25);
    const top = deckY + 1.35;
    const g = new THREE.CylinderGeometry(0.24, 0.28, top - (deckY - pileDepth), 8);
    add(put(g, 0.35, across, (top + deckY - pileDepth) / 2), C.post, 0.06);
    add(put(new THREE.CylinderGeometry(0.27, 0.27, 0.12, 8), 0.35, across, top + 0.03), C.postTop, 0.05);
    for (let r = 0; r < 5; r++) add(put(new THREE.CylinderGeometry(0.34, 0.34, 0.1, 8), 0.35, across, top - 0.22 - r * 0.11), r % 2 ? C.ropeDark : C.rope, 0.04);
  }
  // ── the landing: two thick rope-wrapped posts where the deck meets the sand ──
  if (p.landing) {
    const [gl, gr] = p.landing.postGround;
    for (const s of [-1, 1]) {
      const across = s * (width / 2 + 0.3), gy = s < 0 ? gl : gr, top = gy + 1.5;
      add(put(new THREE.CylinderGeometry(0.26, 0.3, top - gy + 1.2, 8), length - 0.4, across, (top + gy - 1.2) / 2), C.post, 0.06);
      add(put(new THREE.CylinderGeometry(0.29, 0.29, 0.12, 8), length - 0.4, across, top + 0.03), C.postTop, 0.05);
      for (let r = 0; r < 6; r++) add(put(new THREE.CylinderGeometry(0.36, 0.36, 0.1, 8), length - 0.4, across, top - 0.25 - r * 0.11), r % 2 ? C.ropeDark : C.rope, 0.04);
    }
    // a pennant, so the pier reads from the beach (E111): a taller pole with a brass finial and two rope ties at the
    // hoist; the cloth itself is its own swaying part (pennantGeometry). On the sea-end bollard, or (E308, `pennantAt`) on
    // the −X piling nearest that point — its pole a little taller, so the flag flies at the same height
    const station = p.pennantAt === undefined ? null : 1.2 + 3 * Math.max(0, Math.min(Math.floor((rampFrom - 1.3) / 3), Math.round((p.pennantAt - 1.2) / 3)));
    const pa = station ?? 0.35, px = -(pierHalfWidthAt(p, pa) + (station === null ? 0.25 : 0.1)), top = station === null ? deckY + 1.35 : postTop;
    const poleH = 2.75 + (deckY + 1.35 - top);
    add(put(new THREE.CylinderGeometry(0.045, 0.055, poleH, 6), pa, px, top + poleH / 2), C.post, 0.04);
    add(put(new THREE.CylinderGeometry(0.07, 0.07, 0.05, 6), pa, px, top + poleH + 0.02), C.postTop, 0.04);
    add(put(new THREE.OctahedronGeometry(0.085, 0).scale(1, 1.5, 1), pa, px, top + poleH + 0.16), C.brass, 0.1);
    const hoistTop = top + poleH - 0.12;
    for (const y of [hoistTop - 0.03, hoistTop - PENNANT.hoist + 0.03]) add(put(new THREE.CylinderGeometry(0.075, 0.075, 0.06, 6), pa, px, y), C.rope, 0.04);
    cloth = pennantGeometry(px, pa, hoistTop, p.pennantDir, rng);
  }
  // ── the sea end: a low kick board so the deck reads as an end, not a cut (SF72: none on a flared sea ramp, where it
  // hung at deck height over the ramp's foot; the ramp meets the landing) ──
  if (p.seaRamp === undefined) add(put(new THREE.BoxGeometry(width + 0.3, 0.22, 0.14), 0.02, 0, deckY + 0.05), C.plankDark, 0.05);
  return { deck: mergeGeometries(parts, false), cloth };
}

