import * as THREE from 'three';
import type { PierParams } from './pierContract';
import { pierDeckAt, pierHalfWidthAt } from './pierLayout';
import { PIER_PALETTE as C } from './pier';

/** the stand-in starts here, own z: the sea end's road footprint stays clear (the product's entryway rule) */
export const PIER_COARSE_FROM = 0.01;
/** the near pier's plank overhang past each deck edge, and its planks + bearers' depth under the deck top */
const OVERHANG = 0.15, DEPTH = 0.45;
/** a piling every second near station (the near pier has one every 3 m from 1.2 m): its silhouette from across the bay */
const PILE_STEP = 6, PILE_R = 0.19, POST_TOP = 0.95;

/** the near pennant's cloth blue (pier.ts PENNANT.blue) */
export const PENNANT_BLUE = new THREE.Color('#2f5bd0');

type V = readonly [number, number, number];

/**
 * CO1: the pier's far stand-in (Driftwood's coarse L1 tiles), own space like `deckGeometry` (along +z from the sea end,
 * across x, the deck's top at y 0). Jake saw the long pier pop in from the beach meadow: the coarse tiles had no pier.
 * The near pier is ~10k triangles of planks, so this is drawn from the same layout instead of simplified from them:
 * the deck as one slab on the real deck profile (sea ramp and flare, the flat run, the landing's step-down), the
 * pilings at every second station rising to the near posts' tops, the sea-end bollards, the landing posts and the
 * pennant, all in the pier's own colours. Flat-shaded, non-indexed, position / normal / color; a few hundred triangles.
 */
export function pierCoarse(p: PierParams): THREE.BufferGeometry {
  const pos: number[] = [], col: number[] = [];
  const tri = (a: V, b: V, c: V, color: THREE.Color): void => { for (const v of [a, b, c]) { pos.push(...v); col.push(color.r, color.g, color.b); } };
  /** a quad wound to face `out` */
  const quad = (a: V, b: V, c: V, d: V, out: V, color: THREE.Color): void => {
    const n = new THREE.Vector3(...b).sub(new THREE.Vector3(...a)).cross(new THREE.Vector3(...c).sub(new THREE.Vector3(...a)));
    if (n.dot(new THREE.Vector3(...out)) >= 0) { tri(a, b, c, color); tri(a, c, d, color); } else { tri(a, c, b, color); tri(a, d, c, color); }
  };
  /** an upright square post, `x`, `z` its centre, from `y0` up to `y1`, its top `cap` coloured */
  const post = (x: number, z: number, r: number, y0: number, y1: number, body: THREE.Color, cap: THREE.Color): void => {
    const c: V[] = [[x - r, 0, z - r], [x + r, 0, z - r], [x + r, 0, z + r], [x - r, 0, z + r]];
    for (let i = 0; i < 4; i++) {
      const a = c[i], b = c[(i + 1) % 4];
      if (a === undefined || b === undefined) continue;
      quad([a[0], y0, a[2]], [b[0], y0, b[2]], [b[0], y1, b[2]], [a[0], y1, a[2]], [(a[0] + b[0]) / 2 - x, 0, (a[2] + b[2]) / 2 - z], body);
    }
    const [a, b, d, e] = c;
    if (a && b && d && e) quad([a[0], y1, a[2]], [b[0], y1, b[2]], [d[0], y1, d[2]], [e[0], y1, e[2]], [0, 1, 0], cap);
  };

  // ── the deck: one slab through the profile's corners (pierDeckAt and pierHalfWidthAt are straight between them) ──
  const rampFrom = p.landing?.rampFrom ?? p.length, seaRun = p.seaRamp?.run ?? 0;
  const stations = [...new Set([PIER_COARSE_FROM, seaRun, rampFrom, p.length])].filter(z => z >= PIER_COARSE_FROM && z <= p.length).sort((a, b) => a - b);
  const edge = (z: number): { y: number; hw: number } => ({ y: pierDeckAt(p, z), hw: pierHalfWidthAt(p, z) + OVERHANG });
  for (let i = 0; i + 1 < stations.length; i++) {
    const z0 = stations[i] ?? 0, z1 = stations[i + 1] ?? 0, a = edge(z0), b = edge(z1);
    quad([-a.hw, a.y, z0], [a.hw, a.y, z0], [b.hw, b.y, z1], [-b.hw, b.y, z1], [0, 1, 0], C.plank);
    quad([-a.hw, a.y - DEPTH, z0], [a.hw, a.y - DEPTH, z0], [b.hw, b.y - DEPTH, z1], [-b.hw, b.y - DEPTH, z1], [0, -1, 0], C.plankDark);
    for (const s of [-1, 1]) quad([s * a.hw, a.y, z0], [s * b.hw, b.y, z1], [s * b.hw, b.y - DEPTH, z1], [s * a.hw, a.y - DEPTH, z0], [s, 0, 0], C.plankDark);
  }
  for (const [z, out] of [[stations[0] ?? PIER_COARSE_FROM, -1], [stations.at(-1) ?? p.length, 1]] as const) {
    const e = edge(z);
    quad([-e.hw, e.y, z], [e.hw, e.y, z], [e.hw, e.y - DEPTH, z], [-e.hw, e.y - DEPTH, z], [0, 0, out], C.plankDark);
  }

  // ── pilings at every second near station, from the sea floor to the near posts' tops ──
  for (let a = 1.2; a < rampFrom; a += PILE_STEP) for (const s of [-1, 1]) post(s * (pierHalfWidthAt(p, a) + 0.1), a, PILE_R, -p.pileDepth, POST_TOP, C.post, C.postTop);
  // ── the sea-end bollards, taller and rope-wrapped (the wrap as their cap's colour) ──
  for (const s of [-1, 1]) post(s * (pierHalfWidthAt(p, 0.35) + 0.25), 0.35, 0.3, -p.pileDepth, 1.35, C.post, C.rope);
  if (p.landing !== null) {
    // ── the landing posts where the deck meets the sand ──
    const [gl, gr] = p.landing.postGround;
    for (const s of [-1, 1]) { const gy = s < 0 ? gl : gr; post(s * (p.width / 2 + 0.3), p.length - 0.4, 0.33, gy - 1.2, gy + 1.5, C.post, C.rope); }
    // ── the pennant (E111: it makes the pier read from the beach), on the near pier's pole station, one double-sided sheet ──
    const station = p.pennantAt === undefined ? null : 1.2 + 3 * Math.max(0, Math.min(Math.floor((rampFrom - 1.3) / 3), Math.round((p.pennantAt - 1.2) / 3)));
    const pa = station ?? 0.35, px = -(pierHalfWidthAt(p, pa) + (station === null ? 0.25 : 0.1)), top = station === null ? 1.35 : POST_TOP;
    const poleTop = top + 2.75 + (1.35 - top), hoist = poleTop - 0.12;
    post(px, pa, 0.06, top, poleTop, C.post, C.brass);
    // a sea-end pennant streams back over the road: its sheet stops at the footprint's edge
    const [dx, dz] = p.pennantDir, dn = Math.hypot(dx, dz) || 1, fly: V = [px + (dx / dn) * 1.75, hoist - 0.45, Math.max(PIER_COARSE_FROM, pa + (dz / dn) * 1.75)];
    const flag = PENNANT_BLUE;
    tri([px, hoist, pa], [px, hoist - 0.72, pa], fly, flag); tri([px, hoist, pa], fly, [px, hoist - 0.72, pa], flag);
  }

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.computeVertexNormals();
  return g;
}
