/**
 * The pier (E306 / E315 M1: a model on the contract, src/engine/models/model.ts): a low-poly wooden jetty on pilings,
 * flat-shaded and vertex-coloured, no textures — one mesh, one draw. Driftwood's south pier and its three jetties are
 * four placements of it (src/shards/driftwood-isle/world/Pier.ts is the world side: where each stands, its landing on the sand, its floor).
 *
 * Built in its own space: the origin is the middle of the sea end on the deck's top; the deck runs along +Z for
 * `length` metres, `width` across X; the pilings reach `pileDepth` below the deck. The south pier's LANDING
 * (`landing`) runs on over the shallows and steps down onto the sand — the world measures the sand (the ramp's end and
 * the ground under the two landing posts) and hands it in; it also flies the pennant (E111), a swallowtail on the
 * sea-end bollard that streams downwind (`pennantDir`: the world's wind turned into the pier's frame).
 *
 * Every copy draws from the same rng stream from its start (one `place` per pier, as the old builder seeded each pier
 * alike), so the move is exact. Collides as its posts and bollards (boxes), the deck as one slab, the landing's
 * step-down as a pitched box and the sand-level end as a slab.
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { SEED } from '@wildshard/engine/core/config';
import type { Rng } from '@wildshard/engine/core/rng';
import { defineModel, type ModelContext, type ModelPart } from '@wildshard/engine/models/model';
import type { BoxSpec as Collider } from '@wildshard/engine/physics/box';
import { PATCH_ORDER, patchShader } from '@wildshard/engine/render/shaderPatches';
import { lowPolyMaterial } from '@wildshard/engine/world/lowpolyKit';
import { boxDesc, type ColliderDesc } from '@wildshard/engine/world/registry';
import { patchSway } from '@wildshard/engine/world/wind';

export interface PierLanding {
  /** where the deck starts ramping down (metres from the sea end) */
  readonly rampFrom: number;
  /** the sand the ramp lands on, own y (the deck's top is 0) */
  readonly landY: number;
  /** the ground under the two landing posts (the −X one, then the +X one), own y */
  readonly postGround: readonly [number, number];
}

/** SF46 (G134): a ramp at the sea end from the sand the pier starts on up to the deck (the lowered world's entry sandbars) */
export interface PierSeaRamp {
  /** how far the ramp runs from the sea end, metres */
  readonly run: number;
  /** the sand at the sea end, own y (the deck's top is 0) */
  readonly landY: number;
  /** SF72 (pick (c), flared ramps): the ramp's full width at the sea end, narrowing straight to the deck's width at the
   *  top of its run (Driftwood's 8 m entry socket, so the road's outer lanes walk up it, not into the sea); absent: the
   *  ramp is the deck's width all the way (the straight ramp) */
  readonly flare?: number;
}

export interface PierParams {
  /** the deck's run along +Z, metres (the landing's run included) */
  readonly length: number;
  /** deck width, metres */
  readonly width: number;
  /** how far below the deck the pilings reach (the sea floor is ~6 m down) */
  readonly pileDepth: number;
  /** the step-down onto the sand at the far end, the landing posts and the pennant (the south pier, E43 / E111) */
  readonly landing: PierLanding | null;
  /** the pennant's downwind direction, own xz (unit) */
  readonly pennantDir: readonly [number, number];
  /** where the pennant flies, metres from the sea end: on the −X piling nearest it (E308: half way down the south pier, by
   *  the spawn and the boat); absent = on the sea-end bollard (E111) */
  readonly pennantAt?: number;
  /** a ramp up from the sand at the sea end (absent: the deck is flat to the sea end, over the water) */
  readonly seaRamp?: PierSeaRamp;
}

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

/** the world's prevailing wind, unit xz (wind.ts WX / WZ): the pennant streams this way */
export const PENNANT_WIND = [-0.55, 0.83] as const;

/** a travelling ripple from the hoist to the fly, across the cloth (object space: the south pier stands unturned).
 * wind.ts's sway mostly leans along the wind, which is along this flag, so on its own it would stretch the pennant
 * rather than wave it */
function patchFlutter(shader: { vertexShader: string }, dir: readonly [number, number]): void {
  const [dx, dz] = dir, n = Math.hypot(dx, dz), sx = (-dz / n).toFixed(3), sz = (dx / n).toFixed(3);
  shader.vertexShader = shader.vertexShader.replace('#include <project_vertex>', `{
    float fw = aSway.x;
    if (fw > 0.0) {
      float ripple = sin(uWindTime * 5.2 - fw * 7.0 + aSway.y) * 0.7 + sin(uWindTime * 8.3 - fw * 11.0) * 0.3;
      transformed += vec3(${sx}, 0.0, ${sz}) * ripple * 0.075 * fw * (0.45 + 0.55 * uGust);
    }
  }
  #include <project_vertex>`);
}

/** the pennant's materials (lit and shadow pass), one pair per shard */
function pennantMaterials(ctx: ModelContext, dir: readonly [number, number]): { lit: THREE.Material; depth: THREE.MeshDepthMaterial } {
  return ctx.once('driftwood-isle/pier:pennant', () => {
    const lit = lowPolyMaterial(ctx.sky, 'pennant', (m) => {
      patchShader(m, 'driftwood.pennant-flutter', PATCH_ORDER.decorate, (sh) => { patchFlutter(sh, dir); });
    });
    const depth = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, side: THREE.DoubleSide });
    patchShader(depth, 'driftwood.pennant-depth', PATCH_ORDER.material, (sh) => { patchSway(sh); patchFlutter(sh, dir); }, { mode: 'replace', key: 'pennant-depth' });
    return { lit, depth };
  });
}

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

/** the deck's top at `along` metres from the sea end, own y: flat, then the landing's step-down onto the sand */
export function pierDeckAt(p: PierParams, along: number): number {
  const rampFrom = p.landing?.rampFrom ?? p.length, landY = p.landing?.landY ?? 0;
  if (p.seaRamp !== undefined && along < p.seaRamp.run) return p.seaRamp.landY * (1 - Math.max(0, along) / p.seaRamp.run);
  if (along <= rampFrom) return 0;
  const t = Math.min(1, (along - rampFrom) / Math.max(0.1, p.length - rampFrom));
  return landY * t;
}

/** the deck's half width at `along` metres from the sea end: half the deck, or on a flared sea ramp (SF72) narrowing
 *  straight from half the flare at the sea end to half the deck at the ramp's top */
export function pierHalfWidthAt(p: PierParams, along: number): number {
  const sea = p.seaRamp, half = p.width / 2;
  if (sea?.flare === undefined || along >= sea.run) return half;
  const t = Math.max(0, along) / sea.run;
  return sea.flare / 2 + (half - sea.flare / 2) * t;
}

/** where the pilings, the bollards and the landing posts stand, own space ([along, across]; −X side first at each station) */
export function pierPosts(p: PierParams): { posts: [number, number][]; bollards: [number, number][] } {
  const posts: [number, number][] = [], bollards: [number, number][] = [];
  const rampFrom = p.landing?.rampFrom ?? p.length;
  for (let a = 1.2; a < rampFrom; a += 3.0) for (const s of [-1, 1]) posts.push([a, s * (pierHalfWidthAt(p, a) + 0.1)]);
  for (const s of [-1, 1]) bollards.push([0.35, s * (pierHalfWidthAt(p, 0.35) + 0.25)]);
  return { posts, bollards };
}

/** the posts' and bollards' legacy boxes, own space (the ocean's foam rings and the melee sweep; `pierColliders` carries them) */
export function pierBoxes(p: PierParams): Collider[] {
  const out: Collider[] = [];
  const postR = 0.17, postTop = 0.95;
  const rampFrom = p.landing?.rampFrom ?? p.length;
  for (let a = 1.2; a < rampFrom; a += 3.0) for (const s of [-1, 1]) out.push({ x: s * (pierHalfWidthAt(p, a) + 0.1), z: a, hw: postR + 0.04, hd: postR + 0.04, rot: 0, yTop: postTop, yBottom: -1 });
  for (const s of [-1, 1]) out.push({ x: s * (pierHalfWidthAt(p, 0.35) + 0.25), z: 0.35, hw: 0.32, hd: 0.32, rot: 0, yTop: 1.35, yBottom: -1 });
  if (p.landing) {
    const [gl, gr] = p.landing.postGround;
    for (const s of [-1, 1]) {
      const gy = s < 0 ? gl : gr, top = gy + 1.5;
      out.push({ x: s * (p.width / 2 + 0.3), z: p.length - 0.4, hw: 0.34, hd: 0.34, rot: 0, yTop: top, yBottom: gy - 1 });
    }
  }
  return out;
}

/**
 * PHYSICS P4, own space: the posts and bollards (the legacy boxes) and every floor the deck describes, as real geometry.
 * The flat deck is one slab (0.3 m: the planks and the bearers under them); the landing's step-down (the south pier,
 * E43) is a real ramp — the planks follow one straight line from the deck to the sand — so it is a thin box pitched to
 * that line, plus the 0.2 m of flat sand-level deck past it.
 */
export function pierColliders(p: PierParams): ColliderDesc[] {
  const halfW = p.width / 2 + 0.25;
  const out: ColliderDesc[] = pierBoxes(p).map((c) => boxDesc(c));
  // a box along the pier: `a0`‥`a1` metres from the sea end, top at `top`, `hy` half thick
  const slab = (a0: number, a1: number, top: number, hy: number, hx = halfW): ColliderDesc => ({ kind: 'box', x: 0, y: top - hy, z: (a0 + a1) / 2, hx, hy, hz: (a1 - a0) / 2, yaw: 0 });
  const length = p.length, rampFrom = p.landing?.rampFrom ?? length, landY = p.landing?.landY ?? 0;
  const ramped = length > rampFrom + 0.1, sea = p.seaRamp;
  out.push(slab(sea === undefined ? -0.2 : sea.run, ramped ? rampFrom : length + 0.2, 0, 0.15));
  if (sea?.flare !== undefined) {
    // SF72: the flared sea-end ramp, a trapezoid slab (a hull): its top face on the line (0, landY) → (run, 0), half the
    // flare wide at the sea end narrowing to half the deck at the top (each + 0.25, as the deck's slab), 0.2 m thick; plus
    // 0.2 m of flat sand-level deck before it, the flare's width
    const wide = sea.flare / 2 + 0.25, hy = 0.2, points: number[] = [];
    for (const [along, half, top] of [[0, wide, sea.landY], [sea.run, halfW, 0]] as const) {
      for (const s of [-1, 1]) for (const dy of [0, -hy]) points.push(s * half, top + dy, along);
    }
    out.push({ kind: 'hull', x: 0, y: 0, z: 0, points: new Float32Array(points) });
    out.push(slab(-0.2, 0, sea.landY, 0.1, wide));
  } else if (sea !== undefined) {
    // SF46: the sea-end ramp, its top face on the line (0, landY) → (run, 0), plus 0.2 m of flat sand-level deck before it
    const rise = -sea.landY, pitch = -Math.atan2(rise, sea.run), half = Math.hypot(sea.run, rise) / 2, hy = 0.1;
    const nAlong = Math.sin(pitch), nUp = Math.cos(pitch);
    out.push({ kind: 'box', x: 0, y: sea.landY / 2 - hy * nUp, z: sea.run / 2 - hy * nAlong, hx: halfW, hy, hz: half, rot: { x: Math.sin(pitch / 2), y: 0, z: 0, w: Math.cos(pitch / 2) } });
    out.push(slab(-0.2, 0, sea.landY, 0.1));
  }
  if (ramped) {
    // the ramp: its top face on the line (rampFrom, 0) → (length, landY); pitched about the pier's across axis
    const run = length - rampFrom, drop = -landY, pitch = Math.atan2(drop, run), half = Math.hypot(run, drop) / 2, hy = 0.1;
    const sx = Math.sin(pitch / 2), cx = Math.cos(pitch / 2);
    // top-face centre, then down the box's own up axis ((0, cos, sin) along the pier) by its half thickness
    const along = (rampFrom + length) / 2, topY = landY / 2;
    const nAlong = Math.sin(pitch), nUp = Math.cos(pitch);
    out.push({ kind: 'box', x: 0, y: topY - hy * nUp, z: along - hy * nAlong, hx: halfW, hy, hz: half, rot: { x: sx, y: 0, z: 0, w: cx } });
    out.push(slab(length, length + 0.2, landY, 0.1));
  }
  return out;
}

/**
 * the deck, the pilings, the bollards, the landing and the pennant pole: one non-indexed vertex-coloured geometry; and
 * the pennant's cloth when there is a landing (it draws from the same stream, between the pole and the kick board)
 */
function deckGeometry(p: PierParams, rng: Rng): { deck: THREE.BufferGeometry; cloth: THREE.BufferGeometry | null } {
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
    const rise = -p.seaRamp.landY, len = Math.hypot(seaRun, rise), ang = -Math.atan2(rise, seaRun);
    for (const s of [-1, 1]) add(put(new THREE.BoxGeometry(0.22, 0.28, flat - seaRun + 0.2), (flat + seaRun) / 2, s * (width / 2 - 0.35), bearerY), C.plankDark, 0.05);
    for (const s of [-1, 1]) {
      if (p.seaRamp.flare === undefined) {
        const g = new THREE.BoxGeometry(0.22, 0.28, len); g.rotateX(ang);
        add(put(g, seaRun / 2, s * (width / 2 - 0.35), bearerY - rise / 2), C.plankDark, 0.05);
        continue;
      }
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
  if (p.seaRamp?.flare === undefined) add(put(new THREE.BoxGeometry(width + 0.3, 0.22, 0.14), 0.02, 0, deckY + 0.05), C.plankDark, 0.05);
  return { deck: mergeGeometries(parts, false), cloth };
}

export const pier = defineModel<PierParams>({
  id: 'driftwood-isle/pier', name: 'Pier', category: 'buildings', pipeline: 'code',
  file: 'src/shards/driftwood-isle/models/pier.ts', surface: 'planks',
  defaults: { length: 30, width: 3, pileDepth: 8, landing: null, pennantDir: PENNANT_WIND },
  variants: [
    { id: 'jetty', label: 'Jetty', params: {} },
    { id: 'long', label: 'Long jetty', params: { length: 60, width: 4 } },
    { id: 'landing', label: 'With landing', params: { length: 36, width: 4, landing: { rampFrom: 30.5, landY: -0.8, postGround: [-0.8, -0.8] } } },
  ],
  seed: SEED ^ 0x9e37,
  build: (ctx, p, rng) => {
    const deck = ctx.once('driftwood-isle/pier:deck', () => {
      const m = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.85, metalness: 0 });
      ctx.sky.setupMaterial(m);
      return m;
    });
    const { deck: geometry, cloth } = deckGeometry(p, rng);
    const parts: ModelPart[] = [{ geometry, material: deck, castShadow: true, receiveShadow: true }];
    if (cloth !== null) {
      const { lit, depth } = pennantMaterials(ctx, p.pennantDir);
      parts.push({ geometry: cloth, material: lit, castShadow: true, receiveShadow: false, customDepthMaterial: depth });
    }
    return parts;
  },
  colliders: (p) => pierColliders(p),
});
