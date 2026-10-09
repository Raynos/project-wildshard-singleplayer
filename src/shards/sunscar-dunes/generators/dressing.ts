import { BufferGeometry, Color, DoubleSide, Float32BufferAttribute, Group, InstancedMesh, Matrix4, MeshStandardMaterial, Quaternion, Vector3 } from 'three';
import { Rng } from '@wildshard/engine/core/rng';
import { rock } from '@wildshard/engine/world/geometryKit';
import { boxDesc, type ColliderDesc } from '@wildshard/engine/world/registry';
import { BASIN, BRAZIERS, CARAVAN, PLAY_HALF, RIDGES, SEED, SPAWN, TOWER, TRAIL, WELL } from '../data/layout';
import { WIND } from '../world/dunes';
import { signalDunesField } from './tiles';
import { bakeKinds, type PieceBake } from './kinds';

/**
 * The desert's dressing (loop 4; review #13 "something every few metres on the trails", mockups A–C): saltbush shrubs
 * and dry grass tufts gathered in the hollows and along the trail edges, marker posts with faded rags along the crest
 * paths, cairns where the paths fork and arrive, bleached carcasses, dead acacias, and scree at the ridges' feet.
 * Everything is code-built, faceted and vertex-coloured (the props' look), one `InstancedMesh` per kind (one draw each,
 * never multi-draw).
 *
 * Build-time only (SHARD-PLATFORM SF72, SF67 fix 3 "bake the code-built worlds"): baked offline into a static GLB and its
 * collider rows (`scripts/bake-signal-world.mjs` → `public/assets/sunscar-dunes/baked/dressing.glb` + `data/dressing.json`);
 * the client draws the bake (`world/baked.ts`) and builds no dressing mesh. The shapes are the runtime builder's,
 * unchanged. The shrubs and the grass (none since loop 5) swayed in the wind in the client; a kind with instances must
 * not need it: the bake refuses per-instance colours, and the sway would come back to the client with them.
 */

export type V3 = readonly [number, number, number];
export type RGB = readonly [number, number, number];

const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const scale = (a: V3, s: number): V3 => [a[0] * s, a[1] * s, a[2] * s];
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a: V3): V3 => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };

/** A growing non-indexed triangle soup with per-vertex colour; flat normals (the faceted look). */
export class Soup {
  readonly pos: number[] = []; readonly col: number[] = [];
  tri(a: V3, b: V3, c: V3, ca: RGB, cb: RGB = ca, cc: RGB = cb): void {
    this.pos.push(...a, ...b, ...c); this.col.push(...ca, ...cb, ...cc);
  }
  /** an open `sides`-sided prism from a (radius r0, colour c0) to b (r1, c1) */
  prism(a: V3, b: V3, r0: number, r1: number, sides: number, c0: RGB, c1: RGB): void {
    const d = norm(sub(b, a)), u = norm(Math.abs(d[1]) < 0.9 ? cross(d, [0, 1, 0]) : cross(d, [1, 0, 0])), v = cross(d, u);
    const ring = (o: V3, r: number, k: number): V3 => { const t = (k / sides) * Math.PI * 2; return add(o, add(scale(u, Math.cos(t) * r), scale(v, Math.sin(t) * r))); };
    for (let k = 0; k < sides; k++) {
      const a0 = ring(a, r0, k), a1 = ring(a, r0, k + 1), b0 = ring(b, r1, k), b1 = ring(b, r1, k + 1);
      this.tri(a0, a1, b1, c0, c0, c1); this.tri(a0, b1, b0, c0, c1, c1);
    }
  }
  /** a jittered octahedron (a leaf clump, a pebble, a skull) */
  blob(o: V3, rx: number, ry: number, rz: number, c: RGB, rng: Rng, cTop: RGB = c): void {
    const j = (): number => rng.range(0.8, 1.2);
    const px: V3 = [o[0] + rx * j(), o[1], o[2]], nx: V3 = [o[0] - rx * j(), o[1], o[2]], py: V3 = [o[0], o[1] + ry * j(), o[2]];
    const ny: V3 = [o[0], o[1] - ry * j(), o[2]], pz: V3 = [o[0], o[1], o[2] + rz * j()], nz: V3 = [o[0], o[1], o[2] - rz * j()];
    for (const [a, b] of [[px, pz], [pz, nx], [nx, nz], [nz, px]] as const) { this.tri(a, b, py, c, c, cTop); this.tri(b, a, ny, c, c, c); }
  }
  geometry(): BufferGeometry {
    const g = new BufferGeometry();
    g.setAttribute('position', new Float32BufferAttribute(this.pos, 3)); g.setAttribute('color', new Float32BufferAttribute(this.col, 3));
    g.computeVertexNormals(); g.computeBoundingSphere();
    return g;
  }
}

/** Colours (linear, 0..1): dusty saltbush, dry straw, weathered wood, faded madder rags, bleached bone. */
const C = {
  stem: [0.14, 0.09, 0.06], leaf: [0.17, 0.16, 0.08], leafTip: [0.3, 0.27, 0.13],
  strawBase: [0.2, 0.12, 0.06], strawTip: [0.66, 0.5, 0.26],
  wood: [0.3, 0.2, 0.14], woodTop: [0.52, 0.4, 0.3], rag: [0.62, 0.14, 0.08], ragEdge: [0.78, 0.36, 0.18],
  bone: [0.6, 0.52, 0.41], boneBuried: [0.42, 0.3, 0.22], deadWood: [0.17, 0.12, 0.1], deadTip: [0.34, 0.27, 0.21],
} as const satisfies Record<string, RGB>;

/** How many of each (one draw per kind). */
// loop 5 (the mockups: big clean sand forms): far fewer rocks and pebbles, scrub kept to the hollows and trail edges
export const DRESSING = { posts: 0, cairns: 0, shrubs: 0, tufts: 0, carcasses: 5, trees: 0, screePerRidge: 6, postEvery: 22, postSide: 3.6, postEnds: 14, outcrops: 0, gravel: 0 } as const; // E399: no outcrops (none in the mockups)

/** A saltbush, 0.9 m tall: four forked stems, dusty grey-green clumps at the tips. */
function shrubGeometry(seed: number): BufferGeometry {
  const s = new Soup(), rng = new Rng(seed);
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + rng.range(-0.4, 0.4), spread = rng.range(0.35, 0.6), h = rng.range(0.55, 0.85);
    const mid: V3 = [Math.cos(a) * spread * 0.45, h * 0.5, Math.sin(a) * spread * 0.45], tip: V3 = [Math.cos(a) * spread, h, Math.sin(a) * spread];
    s.prism([0, -0.05, 0], mid, 0.035, 0.022, 3, C.stem, C.stem); s.prism(mid, tip, 0.022, 0.01, 3, C.stem, C.stem);
    const fork: V3 = [mid[0] + Math.cos(a + 1) * 0.25, h * 0.75, mid[2] + Math.sin(a + 1) * 0.25];
    s.prism(mid, fork, 0.016, 0.008, 3, C.stem, C.stem);
    // many small clumps along the stems and round the tips: a dense dusty crown, not a few big crystals
    for (const [o, r] of [[tip, 0.13], [fork, 0.1], [scale(add(mid, tip), 0.5), 0.11], [mid, 0.09]] as const) for (let k = 0; k < 2; k++) {
      s.blob([o[0] + rng.range(-0.09, 0.09), o[1] + rng.range(-0.05, 0.06), o[2] + rng.range(-0.09, 0.09)], r * rng.range(0.8, 1.3), r * 0.7, r * rng.range(0.8, 1.3), C.leaf, rng, C.leafTip);
    }
  }
  return s.geometry();
}

/** A dry grass tuft: seven thin blades leaning out from the root, straw at the tips. */
function tuftGeometry(seed: number): BufferGeometry {
  const s = new Soup(), rng = new Rng(seed);
  for (let i = 0; i < 7; i++) {
    const a = rng.range(0, Math.PI * 2), lean = rng.range(0.08, 0.3), h = rng.range(0.3, 0.6), w = 0.035;
    const ox = Math.cos(a) * 0.05, oz = Math.sin(a) * 0.05, px = -Math.sin(a) * w, pz = Math.cos(a) * w;
    s.tri([ox - px, 0, oz - pz], [ox + px, 0, oz + pz], [ox + Math.cos(a) * lean, h, oz + Math.sin(a) * lean], C.strawBase, C.strawBase, C.strawTip);
  }
  return s.geometry();
}

/** A trail marker: a weathered 1.5 m post, a crossbar notch, a faded rag streaming downwind. */
function postGeometry(): BufferGeometry {
  const s = new Soup();
  s.prism([0, -0.3, 0], [0, 1.5, 0], 0.07, 0.055, 5, C.wood, C.woodTop);
  s.prism([-0.18, 1.25, 0], [0.18, 1.25, 0], 0.03, 0.03, 4, C.wood, C.woodTop);
  // the rag (local: streams along +x; the instance turns it downwind), two panels so it kinks
  s.tri([0.05, 1.48, 0], [0.05, 1.1, 0], [0.5, 1.32, 0.08], C.rag, C.rag, C.ragEdge);
  s.tri([0.5, 1.32, 0.08], [0.05, 1.1, 0], [0.46, 1.08, 0.05], C.ragEdge, C.rag, C.rag);
  s.tri([0.5, 1.32, 0.08], [0.46, 1.08, 0.05], [0.88, 1.14, -0.03], C.ragEdge, C.rag, C.ragEdge);
  return s.geometry();
}

/** A bleached carcass half sunk in the sand: a curved spine, seven pairs of ribs, the skull, two leg bones. */
function carcassGeometry(): BufferGeometry {
  const s = new Soup(), rng = new Rng(SEED + 91);
  const spine = (t: number): V3 => [0, 0.3 + Math.sin(t * Math.PI) * 0.12, -1.3 + t * 2.4];
  for (let i = 0; i < 12; i++) s.blob(spine(i / 11), 0.07, 0.06, 0.08, C.bone, rng);
  for (let i = 0; i < 7; i++) {
    const t = 0.25 + i * 0.075, o = spine(t), len = 1 - Math.abs(i - 3) * 0.08;
    for (const side of [-1, 1]) {
      const p1: V3 = [side * 0.3 * len, o[1] + 0.1, o[2] + 0.04], p2: V3 = [side * 0.58 * len, o[1] - 0.06, o[2] + 0.08], p3: V3 = [side * 0.66 * len, -0.18, o[2] + 0.12];
      s.prism(o, p1, 0.025, 0.022, 3, C.bone, C.bone); s.prism(p1, p2, 0.022, 0.02, 3, C.bone, C.bone); s.prism(p2, p3, 0.02, 0.016, 3, C.bone, C.boneBuried);
    }
  }
  const head = spine(1); s.prism(head, [0, 0.42, 1.4], 0.05, 0.045, 4, C.bone, C.bone);
  s.blob([0, 0.3, 1.58], 0.1, 0.09, 0.24, C.bone, rng); s.blob([0, 0.22, 1.72], 0.06, 0.045, 0.13, C.bone, rng);
  s.prism([0.7, -0.05, -0.4], [1.3, 0.02, 0.3], 0.035, 0.03, 4, C.boneBuried, C.bone);
  s.prism([-0.8, -0.05, 0.6], [-1.4, 0.0, 1.1], 0.035, 0.03, 4, C.boneBuried, C.bone);
  return s.geometry();
}

/** A gravel patch: a dozen pebbles scattered over a metre, pale and dark (the desert pavement between the dunes). */
function gravelGeometry(seed: number): BufferGeometry {
  const s = new Soup(), rng = new Rng(seed);
  for (let i = 0; i < 12; i++) {
    const r = rng.range(0.03, 0.1), x = rng.range(-0.7, 0.7), z = rng.range(-0.7, 0.7), c: RGB = rng.chance(0.35) ? [0.5, 0.36, 0.26] : [0.2, 0.11, 0.07];
    s.blob([x, r * 0.3, z], r, r * 0.6, r * rng.range(0.8, 1.3), c, rng);
  }
  return s.geometry();
}

/** A dead acacia: a leaning trunk, four limbs to a flat umbrella of bare twigs, sun-greyed. */
function treeGeometry(): BufferGeometry {
  const s = new Soup(), rng = new Rng(SEED + 77), top: V3 = [0.25, 1.6, 0.1];
  s.prism([0, -0.4, 0], top, 0.17, 0.12, 5, C.deadWood, C.deadWood);
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + rng.range(-0.3, 0.3), r = rng.range(1.3, 1.9), h = rng.range(2.5, 3.0);
    const kink: V3 = [top[0] + Math.cos(a) * r * 0.45, (top[1] + h) / 2 + 0.2, top[2] + Math.sin(a) * r * 0.45], end: V3 = [top[0] + Math.cos(a) * r, h, top[2] + Math.sin(a) * r];
    s.prism(top, kink, 0.13, 0.09, 5, C.deadWood, C.deadWood); s.prism(kink, end, 0.09, 0.045, 4, C.deadWood, C.deadTip);
    // a side limb off the kink, and a fan of forked twigs at each end: the flat thorny umbrella
    const side: V3 = [kink[0] + Math.cos(a + 0.9) * 0.9, kink[1] + 0.5, kink[2] + Math.sin(a + 0.9) * 0.9];
    s.prism(kink, side, 0.05, 0.025, 4, C.deadWood, C.deadTip);
    for (const from of [end, side]) for (let k = 0; k < 5; k++) {
      const b = a + rng.range(-1.6, 1.6), l = rng.range(0.35, 0.8), twig: V3 = [from[0] + Math.cos(b) * l, from[1] + rng.range(0.0, 0.3), from[2] + Math.sin(b) * l];
      s.prism(from, twig, 0.025, 0.01, 3, C.deadTip, C.deadTip);
      s.prism(twig, [twig[0] + Math.cos(b + 0.6) * l * 0.5, twig[1] + 0.08, twig[2] + Math.sin(b + 0.6) * l * 0.5], 0.01, 0.005, 3, C.deadTip, C.deadTip);
    }
  }
  return s.geometry();
}

/** The dressing's kinds, in the order they bake. */
export const DRESSING_KINDS = ['shrubs', 'tufts', 'posts', 'cairns', 'carcasses', 'trees', 'scree', 'outcrops', 'gravel'] as const;
export type DressingKind = (typeof DRESSING_KINDS)[number];
export interface Dressing { root: Group; colliders: ColliderDesc[]; counts: Record<DressingKind, number>; meshes: Record<DressingKind, InstancedMesh> }

/** The places the dressing keeps clear of (metres), and the trail bed (graded sand: nothing grows on it). */
const KEEP_CLEAR: readonly { x: number; z: number; r: number }[] = [
  { x: SPAWN.x, z: SPAWN.z, r: 30 }, // E399 (mockup A): clean sand round the spawn
  { x: TOWER.x, z: TOWER.z, r: 14 }, { x: CARAVAN.x, z: CARAVAN.z - 12, r: 26 }, { x: WELL.x, z: WELL.z, r: 6 },
  { x: BASIN.x, z: BASIN.z, r: BASIN.r - 4 }, ...BRAZIERS.map((b) => ({ x: b.x, z: b.z, r: 4 })),
];
const clear = (x: number, z: number, pad = 0): boolean => KEEP_CLEAR.every((c) => Math.hypot(x - c.x, z - c.z) > c.r + pad);

/**
 * Builds the dressing over the dunes. `groundAt` is the terrain height, `trailDistance` the distance to the nearest
 * trail centre line.
 */
export function buildDressing(groundAt: (x: number, z: number) => number, trailDistance: (x: number, z: number) => number): Dressing {
  const root = new Group(), colliders: ColliderDesc[] = [], rng = new Rng(SEED * 13 + 5);
  const m = new Matrix4(), q = new Quaternion(), p = new Vector3(), sc = new Vector3(), up = new Vector3(0, 1, 0), tint = new Color();
  const place = (mesh: InstancedMesh, i: number, x: number, y: number, z: number, yaw: number, s: number, sy = s): void => {
    q.setFromAxisAngle(up, yaw); m.compose(p.set(x, y, z), q, sc.set(s, sy, s)); mesh.setMatrixAt(i, m);
  };
  const hollow = (x: number, z: number): number => {
    const mean = (groundAt(x + 10, z) + groundAt(x - 10, z) + groundAt(x, z + 10) + groundAt(x, z - 10)) / 4;
    return mean - groundAt(x, z); // > 0 in a hollow
  };
  const material = (): MeshStandardMaterial => new MeshStandardMaterial({ vertexColors: true, roughness: 0.95, flatShading: true, side: DoubleSide });
  const range = (half: number): number => rng.range(-half, half);
  const downwind = Math.atan2(-WIND.z, WIND.x); // a yaw that turns local +x along the wind

  // Shrubs: in clumps of 1–4 in the hollows and beside the trails (never on the trail bed, the crests mostly bare).
  const shrubs = new InstancedMesh(shrubGeometry(SEED + 1), material(), DRESSING.shrubs);
  let ns = 0;
  for (let tries = 0; ns < DRESSING.shrubs && tries < DRESSING.shrubs * 30; tries++) {
    const cx = range(PLAY_HALF - 6), cz = range(PLAY_HALF - 6), td = trailDistance(cx, cz);
    const byTrail = td > 3 && td < 14, low = hollow(cx, cz) > 0.25, open = rng.chance(0.05); // a quarter of the clumps on the open slopes
    if (!(byTrail || low || open) || !clear(cx, cz, 1) || td < 3) continue;
    const n = 1 + Math.floor(rng.range(0, 4));
    for (let k = 0; k < n && ns < DRESSING.shrubs; k++) {
      const x = cx + rng.range(-3, 3), z = cz + rng.range(-3, 3);
      if (trailDistance(x, z) < 2.6 || !clear(x, z)) continue;
      const s = rng.range(0.8, 2.0);
      place(shrubs, ns, x, groundAt(x, z) - 0.04, z, rng.range(0, 6.3), s, s * rng.range(0.75, 1.1));
      shrubs.setColorAt(ns, tint.setRGB(rng.range(0.85, 1.15), rng.range(0.85, 1.1), rng.range(0.8, 1.05))); ns++;
    }
  }
  shrubs.count = ns;

  // Grass tufts: dense drifts in the hollows and along the trail edges, a few on the open slopes.
  const tufts = new InstancedMesh(tuftGeometry(SEED + 2), material(), DRESSING.tufts);
  let nt = 0;
  for (let tries = 0; nt < DRESSING.tufts && tries < DRESSING.tufts * 20; tries++) {
    const cx = range(PLAY_HALF - 4), cz = range(PLAY_HALF - 4), td = trailDistance(cx, cz), low = hollow(cx, cz);
    const want = (td > 2.2 && td < 7 ? 0.7 : 0) + (low > 0.3 ? 0.6 : 0) + 0.02; // and a sparse scatter on the open slopes
    if (rng.next() > want || !clear(cx, cz)) continue;
    const n = 3 + Math.floor(rng.range(0, 6));
    for (let k = 0; k < n && nt < DRESSING.tufts; k++) {
      const x = cx + rng.range(-1.8, 1.8), z = cz + rng.range(-1.8, 1.8);
      if (trailDistance(x, z) < 2) continue;
      const s = rng.range(0.7, 1.4);
      place(tufts, nt, x, groundAt(x, z) - 0.03, z, rng.range(0, 6.3), s, s * rng.range(0.8, 1.3));
      tufts.setColorAt(nt, tint.setRGB(rng.range(0.85, 1.15), rng.range(0.85, 1.1), rng.range(0.85, 1.05))); nt++;
    }
  }
  tufts.count = nt;

  // Marker posts along every trail, every `postEvery` m, alternating sides; a cairn where each trail leaves and arrives.
  const postSpots: { x: number; z: number }[] = [], cairnSpots: { x: number; z: number }[] = [];
  for (const line of TRAIL) {
    let carried = 10, side = 1;
    for (let i = 0; i + 1 < line.length; i++) {
      const [ax, az] = line[i] ?? [0, 0], [bx, bz] = line[i + 1] ?? [0, 0], len = Math.hypot(bx - ax, bz - az), tx = (bx - ax) / len, tz = (bz - az) / len;
      let d = carried;
      for (; d < len; d += DRESSING.postEvery) {
        const x = ax + tx * d - tz * DRESSING.postSide * side, z = az + tz * d + tx * DRESSING.postSide * side; side = -side;
        // none within `postEnds` m of a trail's ends (the places, and the hero cameras on the path there)
        const [fx, fz] = line[0] ?? [0, 0], [lx, lz] = line[line.length - 1] ?? [0, 0];
        // E399 (the mockups show no trail stakes; the council read them as clutter): `posts` caps them, now none; the tracker
        // and the trail bed lead
        if (postSpots.length < DRESSING.posts && clear(x, z, 2) && Math.hypot(x - fx, z - fz) > DRESSING.postEnds && Math.hypot(x - lx, z - lz) > DRESSING.postEnds) postSpots.push({ x, z });
      }
      carried = d - len;
    }
    const [sx, sz] = line[0] ?? [0, 0], [s2x, s2z] = line[1] ?? [0, 0], [ex, ez] = line[line.length - 1] ?? [0, 0], [e2x, e2z] = line[line.length - 2] ?? [0, 0];
    const ls = Math.hypot(s2x - sx, s2z - sz), le = Math.hypot(ex - e2x, ez - e2z);
    // the departure cairn 9 m out, 2.6 m to the side (the spawn view stays clear); the arrival cairn 10 m short. E399: the
    // mockups show no trail markers (a cairn's red rag lay in mock-B's foreground): `cairns` caps them, now none
    const dep = { x: sx + (s2x - sx) / ls * 9 + (s2z - sz) / ls * 2.6, z: sz + (s2z - sz) / ls * 9 - (s2x - sx) / ls * 2.6 };
    if (cairnSpots.length < DRESSING.cairns && clear(dep.x, dep.z)) cairnSpots.push(dep);
    if (cairnSpots.length < DRESSING.cairns) cairnSpots.push({ x: ex - (ex - e2x) / le * 10 + (ez - e2z) / le * 2.6, z: ez - (ez - e2z) / le * 10 - (ex - e2x) / le * 2.6 });
  }
  const posts = new InstancedMesh(postGeometry(), material(), postSpots.length);
  postSpots.forEach((s, i) => {
    const y = groundAt(s.x, s.z);
    q.setFromAxisAngle(up, downwind + rng.range(-0.3, 0.3));
    const lean = new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), rng.range(-0.08, 0.08));
    m.compose(p.set(s.x, y, s.z), q.multiply(lean), sc.set(1, rng.range(0.85, 1.1), 1)); posts.setMatrixAt(i, m);
    colliders.push(boxDesc({ x: s.x, z: s.z, hw: 0.08, hd: 0.08, rot: 0, yBottom: y - 0.3, yTop: y + 1.45 }, 'wood'));
  });

  // Cairns: three or four flat stones stacked, smallest on top.
  const stoneGeo = rock(1, 0, new Rng(SEED + 31), 0.5, 0.25);
  const cairns = new InstancedMesh(stoneGeo, new MeshStandardMaterial({ color: 0x7a4a34, roughness: 0.95, flatShading: true }), cairnSpots.length * 4);
  let nc = 0;
  for (const c of cairnSpots) {
    let y = groundAt(c.x, c.z) - 0.05;
    for (let k = 0, s = rng.range(0.42, 0.5); k < 4 && s > 0.12; k++, s *= 0.72) {
      place(cairns, nc++, c.x + rng.range(-0.05, 0.05), y + s * 0.3, c.z + rng.range(-0.05, 0.05), rng.range(0, 6.3), s, s * 0.9); y += s * 0.55;
    }
    colliders.push(boxDesc({ x: c.x, z: c.z, hw: 0.4, hd: 0.4, rot: 0, yBottom: groundAt(c.x, c.z) - 0.3, yTop: y }, 'rock'));
  }
  cairns.count = nc;

  // Carcasses: by the caravan path, near the well, on the bowl's rim (the Matriarch's), two in open hollows.
  const carcassSpots: { x: number; z: number; yaw: number }[] = [
    { x: -40, z: 46, yaw: 0.9 }, { x: WELL.x - 13, z: WELL.z + 9, yaw: -0.6 }, { x: BASIN.x + 30, z: BASIN.z + BASIN.r - 8, yaw: 2.2 },
    { x: 70, z: 60, yaw: 1.7 }, { x: -110, z: 70, yaw: -2.1 },
  ];
  const carcasses = new InstancedMesh(carcassGeometry(), material(), carcassSpots.length);
  carcassSpots.forEach((c, i) => {
    // lie along the slope: the ground's normal from its height differences, then the carcass's own yaw about it
    const nrm = new Vector3(groundAt(c.x - 1, c.z) - groundAt(c.x + 1, c.z), 2, groundAt(c.x, c.z - 1) - groundAt(c.x, c.z + 1)).normalize();
    const tilt = new Quaternion().setFromUnitVectors(up, nrm), s = rng.range(0.9, 1.15);
    m.compose(p.set(c.x, groundAt(c.x, c.z) - 0.32, c.z), tilt.multiply(q.setFromAxisAngle(up, c.yaw)), sc.set(s, s, s)); carcasses.setMatrixAt(i, m);
  });

  // Dead acacias in the low ground: a landmark framing the well (E399: none at the caravan, mockup B shows none).
  const treeSpots: { x: number; z: number }[] = [{ x: WELL.x + 12, z: WELL.z - 9 }];
  for (let tries = 0; treeSpots.length < DRESSING.trees && tries < 400; tries++) {
    const x = range(PLAY_HALF - 20), z = range(PLAY_HALF - 20);
    if (hollow(x, z) < 0.8 || trailDistance(x, z) < 10 || !clear(x, z, 8) || treeSpots.some((t) => Math.hypot(t.x - x, t.z - z) < 45)) continue;
    treeSpots.push({ x, z });
  }
  const trees = new InstancedMesh(treeGeometry(), material(), treeSpots.length);
  treeSpots.forEach((t, i) => {
    const y = groundAt(t.x, t.z), s = rng.range(0.9, 1.3);
    place(trees, i, t.x, y, t.z, rng.range(0, 6.3), s);
    colliders.push(boxDesc({ x: t.x + 0.12 * s, z: t.z, hw: 0.18 * s, hd: 0.18 * s, rot: 0, yBottom: y - 0.4, yTop: y + 1.6 * s }, 'wood'));
  });

  // Scree: broken sandstone at each ridge's feet.
  const scree = new InstancedMesh(rock(1, 0, new Rng(SEED + 41), 0.6, 0.3), new MeshStandardMaterial({ color: 0x7c4430, roughness: 0.95, flatShading: true }), RIDGES.length * DRESSING.screePerRidge);
  let nr = 0;
  for (const r of RIDGES) for (let k = 0; k < DRESSING.screePerRidge; k++) {
    const along = rng.range(-0.6, 0.6) * r.len, across = (rng.chance(0.5) ? 1 : -1) * rng.range(r.h * 0.6, r.h * 1.6);
    const x = r.x + Math.sin(r.yaw) * along + Math.cos(r.yaw) * across, z = r.z + Math.cos(r.yaw) * along - Math.sin(r.yaw) * across;
    if (trailDistance(x, z) < 3) continue;
    const s = rng.range(0.18, 0.65);
    place(scree, nr++, x, groundAt(x, z) - s * 0.2, z, rng.range(0, 6.3), s, s * rng.range(0.6, 1));
  }
  scree.count = nr;

  // Outcrops: clusters of big wind-cut sandstone blocks off the paths, the middle distance's landmarks (the large collide).
  const outcrop = new InstancedMesh(rock(1, 1, new Rng(SEED + 51), 0.75, 0.3), new MeshStandardMaterial({ color: 0x8a4a2e, roughness: 0.95, flatShading: true }), DRESSING.outcrops * 5);
  let no = 0, clusters = 0;
  for (let tries = 0; clusters < DRESSING.outcrops && tries < 2000; tries++) {
    const cx = range(PLAY_HALF - 12), cz = range(PLAY_HALF - 12), td = trailDistance(cx, cz);
    if (td < 9 || td > 45 || !clear(cx, cz, 10)) continue;
    clusters++;
    const n = 3 + Math.floor(rng.range(0, 3)), big = rng.range(2.2, 4.8);
    for (let k = 0; k < n; k++) {
      const s = k === 0 ? big : big * rng.range(0.3, 0.7), x = cx + (k === 0 ? 0 : rng.range(-big, big) * 1.2), z = cz + (k === 0 ? 0 : rng.range(-big, big) * 1.2);
      if (trailDistance(x, z) < 4) continue;
      const y = groundAt(x, z) - s * 0.3, yaw = rng.range(0, 6.3), sy = s * rng.range(0.6, 1.2);
      place(outcrop, no++, x, y, z, yaw, s, sy);
      if (s > 1.1) colliders.push(boxDesc({ x, z, hw: s * 0.7, hd: s * 0.7, rot: -yaw, yBottom: y - s * 0.5, yTop: y + sy * 0.55 }, 'rock'));
    }
  }
  outcrop.count = no;

  // Gravel: pebble patches in the hollows and along the trail edges (the near ground's surface detail).
  const gravel = new InstancedMesh(gravelGeometry(SEED + 61), material(), DRESSING.gravel);
  let ng = 0;
  for (let tries = 0; ng < DRESSING.gravel && tries < DRESSING.gravel * 20; tries++) {
    const x = range(PLAY_HALF - 4), z = range(PLAY_HALF - 4), td = trailDistance(x, z);
    if (rng.next() > (td > 1.6 && td < 6 ? 0.8 : 0) + (hollow(x, z) > 0.5 ? 0.5 : 0) || !clear(x, z)) continue;
    place(gravel, ng++, x, groundAt(x, z) - 0.02, z, rng.range(0, 6.3), rng.range(0.8, 1.8), 1);
  }
  gravel.count = ng;

  for (const mesh of [shrubs, tufts, posts, cairns, carcasses, trees, scree, outcrop, gravel]) {
    mesh.instanceMatrix.needsUpdate = true; if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere(); mesh.castShadow = false; mesh.receiveShadow = false; root.add(mesh);
  }
  return { root, colliders,
    counts: { shrubs: ns, tufts: nt, posts: postSpots.length, cairns: cairnSpots.length, carcasses: carcassSpots.length, trees: treeSpots.length, scree: nr, outcrops: no, gravel: ng },
    meshes: { shrubs, tufts, posts, cairns, carcasses, trees, scree, outcrops: outcrop, gravel } };
}

/** The dressing baked on the manifest's own dune field: each non-empty kind one GLB node, the builder's own colliders. */
export function bakeSignalDressing(): PieceBake {
  const field = signalDunesField(), built = buildDressing(field.heightAt, field.trailDistance);
  return bakeKinds('dressing', DRESSING_KINDS.map((kind) => [kind, built.meshes[kind]] as const), built.colliders);
}
