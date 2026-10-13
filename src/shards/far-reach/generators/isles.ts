import { BufferGeometry, Color, Float32BufferAttribute } from 'three';
import { GeometryPackWriter, type PackedGeometryRows } from '@wildshard/sdk/kit/geometryPack';
import { ISLES, type Isle } from '../data/layout';
import { ISLE_DRAWS } from '../data/isleLook';
import { ISLET } from '../data/isletDesign';
import { apothem } from '../layout';
import { RISING_ISLETS } from '../world/islets';

/**
 * Build-time only (SHARD-PLATFORM M3, offline bakes): every island Sky Reach draws from its builder, baked by
 * `generators/bake-sky-world.mjs` into `baked/isles.bin` (a deflated `@wildshard/sdk/kit/geometryPack`) + `data/isles.json`;
 * the page draws each in the painted island material (world/isle.ts `islandMesh`, normals computed there).
 *
 * A floating island, loop 4 (the targets: a rounded meadow top that rolls over a soil lip, a lumpy keel of warm
 * sandstone strata and lavender shade tapering to a jagged point, small spurs hanging under it). Smooth-shaded,
 * vertex-painted, one draw. The walkable top stays at local y 0 inside the collider's 12-gon: the rim is a soft noisy
 * curve never outside the 12-gon, so no visible ground is unbacked by a collider.
 *
 * Each island's shape grows from its own seeded generator, seeded by one draw: the playable islands' is the last of the
 * ISLE_DRAWS values each takes from the level's cosmetic stream (the page still takes them, so every piece built after the
 * islands keeps its look) under the harness seed; the gate isles' and the moving islets' come from their own fixed streams.
 */
export const ISLE_SHAPE = { segments: 72, topRings: 10, keelRings: 16, spurs: 28 } as const;

function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const hash = (x: number, y: number): number => { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); };
function vnoise(x: number, y: number): number {
  const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi, ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
  const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1);
  return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
}
const fbm = (x: number, y: number): number => vnoise(x, y) * 0.55 + vnoise(x * 2.1 + 7.3, y * 2.1) * 0.3 + vnoise(x * 4.3 - 3.1, y * 4.3) * 0.15;
/** periodic noise round the island (angle a in radians), so the rim closes without a seam */
const ringNoise = (a: number, k: number, seed: number, y = 0): number => fbm(Math.cos(a) * k + seed, Math.sin(a) * k + y);
const smooth = (a: number, b: number, x: number): number => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

/** The island palette (sRGB): meadow ground under the grass, worn path dirt, soil, strata and shade. */
export const ISLE_PALETTE = {
  ground: 0x6d8433, groundGold: 0xa59a46, groundDeep: 0x51652a, path: 0x9a8468, soil: 0x6e4c35,
  sand: 0xbca78c, ochre: 0xa48a72, clay: 0x8c7466, rockGrey: 0x8f8890, mauve: 0x8a7385, violet: 0x5d4c67, moss: 0x6f7d3a,
} as const;

/** The 12-gon's radius at angle `a` (corners at multiples of 30°, as the colliders and the old top). */
function polyRadius(isle: Isle, a: number): number {
  const step = Math.PI / 6, t = ((a % step) + step) % step;
  return apothem(isle) / Math.cos(t - step / 2);
}

function isleGeometry(isle: Isle, draw: number): BufferGeometry {
  const rnd = seeded(Math.floor(draw * 4294967296) ^ Math.round(isle.x * 131 + isle.z * 17));
  const S = ISLE_SHAPE.segments, seed = rnd() * 50, pos: number[] = [], col: number[] = [], idx: number[] = [];
  const c = new Color(), c2 = new Color();
  const vert = (x: number, y: number, z: number, hex: number, mix?: { hex: number; k: number }): number => {
    c.setHex(hex); if (mix) c.lerp(c2.setHex(mix.hex), Math.min(1, Math.max(0, mix.k)));
    pos.push(x, y, z); col.push(c.r, c.g, c.b); return pos.length / 3 - 1;
  };
  // the rim: a soft noisy curve inside the 12-gon
  const rim = Array.from({ length: S }, (_, i) => { const a = (i / S) * Math.PI * 2;
    // loop 5 (council R1C-9): a broken lip, a few sharp bites out of the soft curve
    const notch = 0.09 * Math.max(0, Math.sin(a * 5 + seed * 3)) ** 8 + 0.05 * Math.max(0, Math.sin(a * 11 - seed)) ** 10;
    return Math.min(polyRadius(isle, a) * 0.995, apothem(isle) * (0.94 + 0.08 * ringNoise(a, 1.6, seed) - notch)); });
  const rows: number[][] = [];
  // the meadow top: rings out to the rim, a faint swell inside (≤ 6 cm, under the capsule's tolerance)
  const centre = vert(0, 0.04, 0, ISLE_PALETTE.ground);
  for (let k = 1; k <= ISLE_SHAPE.topRings; k++) {
    const f = Math.sqrt(k / ISLE_SHAPE.topRings), row: number[] = [];
    for (let i = 0; i < S; i++) {
      const a = (i / S) * Math.PI * 2, r = (rim[i] ?? 0) * f, x = Math.cos(a) * r, z = Math.sin(a) * r;
      const wx = x + isle.x, wz = z + isle.z, n = fbm(wx * 0.18, wz * 0.18), n2 = fbm(wx * 0.6 + 9, wz * 0.6);
      c2.setHex(ISLE_PALETTE.groundGold);
      const base = new Color(ISLE_PALETTE.groundDeep).lerp(new Color(ISLE_PALETTE.ground), smooth(0.2, 0.55, n2)).lerp(c2, smooth(0.45, 0.8, n) * 0.8);
      const id = vert(x, 0.05 * (n - 0.5) * (1 - f * f), z, base.getHex()); // no path paint (E392: brownish path faces failed the paint's green test and took the grey cliff rock; the meadow blades clear the paths)
      row.push(id);
    }
    rows.push(row);
  }
  // the lip: the meadow rolls over, soil shows, then the dirt band under it
  const lip: [number, number, number][] = [[1.02, -0.18, 0], [1.035, -0.55, 0.55], [1.0, -1.1, 1], [0.97, -1.7, 1]];
  for (const [rs, y, soil] of lip) {
    const row: number[] = [];
    for (let i = 0; i < S; i++) {
      const a = (i / S) * Math.PI * 2, n = ringNoise(a, 3, seed + 3, y), r = (rim[i] ?? 0) * (rs + 0.03 * (n - 0.5));
      row.push(vert(Math.cos(a) * r, y - 0.25 * n * soil, Math.sin(a) * r, ISLE_PALETTE.groundDeep, { hex: ISLE_PALETTE.soil, k: soil }));
    }
    rows.push(row);
  }
  // the keel: strata bands by depth, lumpy outcrops, warm in its upper half, lavender-violet shade toward the point
  const tipX = (rnd() - 0.5) * isle.r * 0.18, tipZ = (rnd() - 0.5) * isle.r * 0.18;
  for (let k = 1; k <= ISLE_SHAPE.keelRings; k++) {
    const f = k / (ISLE_SHAPE.keelRings + 1), y = -1.7 - (isle.keel - 1.7) * f, row: number[] = [];
    // a crag, not a cone (council R1C-9): full under the lip, ledged where the strata are, then tapering fast to the point
    const ledge = 1 + 0.05 * (((y * 0.42) % 1 + 1) % 1 > 0.7 ? 1 : 0);
    const profile = (1 - f) ** 0.6 * (1 + 0.12 * Math.sin(f * Math.PI)) * ledge;
    for (let i = 0; i < S; i++) {
      const a = (i / S) * Math.PI * 2, lump = ringNoise(a, 2.4, seed + 11, f * 3.5), fine = ringNoise(a, 7, seed + 19, f * 9);
      // vertical crag ridges (fluting) cut through the lumps
      const ridge = Math.abs(Math.sin(a * 9 + lump * 3.2 + seed)) ** 0.6;
      const r = (rim[i] ?? 0) * profile * (0.78 + 0.3 * lump + 0.1 * fine + 0.1 * ridge);
      const x = Math.cos(a) * r + tipX * f * f, z = Math.sin(a) * r + tipZ * f * f;
      // strata: thin warm bands, wavy with the rock
      const band = Math.sin((y + 1.3 * lump) * 1.9) * 0.5 + 0.5, band2 = Math.sin((y + 0.8 * fine) * 4.7) * 0.5 + 0.5;
      const warm = new Color(ISLE_PALETTE.sand).lerp(new Color(ISLE_PALETTE.ochre), band).lerp(new Color(ISLE_PALETTE.clay), band2 * 0.45);
      const shade = smooth(0.25, 0.95, f);
      // moss and vines streak down from the lip (E392: the mockups' keels are grey rock streaked green)
      const moss = (k <= 2 ? smooth(0.55, 0.8, fine) * 0.7 : 0) + smooth(0.62, 0.9, Math.sin(a * 13 + seed) * 0.5 + 0.5) * Math.max(0, 1 - f * 2.2) * 0.55;
      // grey-lavender rock bands between the warm strata, crevices darker than the ridges (council R1C-9 / R1A-1)
      const rock = warm.lerp(new Color(ISLE_PALETTE.rockGrey), smooth(0.55, 0.85, band2) * 0.7)
        .lerp(new Color(ISLE_PALETTE.mauve), shade * 0.75).lerp(new Color(ISLE_PALETTE.violet), smooth(0.6, 1, f) * 0.6)
        .multiplyScalar(0.62 + 0.38 * ridge);
      row.push(vert(x, y, z, rock.getHex(), { hex: ISLE_PALETTE.moss, k: moss }));
    }
    rows.push(row);
  }
  const tip = vert(tipX, -isle.keel, tipZ, ISLE_PALETTE.violet);
  // stitch: centre fan, ring strips, tip fan
  const r0 = rows[0] ?? [];
  for (let i = 0; i < S; i++) idx.push(centre, r0[(i + 1) % S] ?? 0, r0[i] ?? 0);
  for (let k = 0; k + 1 < rows.length; k++) {
    const a = rows[k] ?? [], b = rows[k + 1] ?? [];
    for (let i = 0; i < S; i++) { const j = (i + 1) % S; const ai = a[i] ?? 0, aj = a[j] ?? 0, bi = b[i] ?? 0, bj = b[j] ?? 0; idx.push(ai, aj, bj, ai, bj, bi); }
  }
  const last = rows[rows.length - 1] ?? [];
  for (let i = 0; i < S; i++) idx.push(last[i] ?? 0, last[(i + 1) % S] ?? 0, tip);
  // spurs: little rock fingers hanging from the keel's middle
  for (let s = 0; s < ISLE_SHAPE.spurs; s++) {
    const a = rnd() * Math.PI * 2, f = 0.25 + rnd() * 0.55, y = -1.7 - (isle.keel - 1.7) * f;
    const r = apothem(isle) * (1 - f) ** 0.6 * 0.72, x = Math.cos(a) * r, z = Math.sin(a) * r, len = isle.keel * (0.12 + rnd() * 0.3), w = 0.5 + rnd() * 1.4;
    const ring = [0, 1, 2, 3, 4].map((q) => { const b = (q / 5) * Math.PI * 2; return vert(x + Math.cos(b) * w, y + 0.6, z + Math.sin(b) * w, ISLE_PALETTE.mauve, { hex: ISLE_PALETTE.ochre, k: 0.3 }); });
    const point = vert(x * 0.9, y - len, z * 0.9, ISLE_PALETTE.violet);
    for (let q = 0; q < 5; q++) idx.push(ring[q] ?? 0, ring[(q + 1) % 5] ?? 0, point);
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(pos, 3)); g.setAttribute('color', new Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  return g;
}


/** The cosmetic stream's seed under the harness's page seed (engine/core/rng.ts: fnv1a32(`${0x2545f491}:cosmetic`)). */
const COSMETIC_SEED = 1418055759;
/** A Park-Miller stream, as world/build.ts and world/risingIslet.ts drew the gate isles and the islets. */
function parkMiller(seed: number): () => number { let s = seed; return () => { s = (s * 16807) % 2147483647; return s / 2147483647; }; }
const lastOf = (random: () => number): number => { let draw = 0; for (let i = 0; i < ISLE_DRAWS; i++) draw = random(); return draw; };
/** An island's shape as the builder makes it, its ISLE_DRAWS values taken from `random` (the far proxy's bake decimates it). */
export const builtIsleGeometry = (isle: Isle, random: () => number): BufferGeometry => isleGeometry(isle, lastOf(random));

/** The islands' rows: the pack's rows and each geometry's island id, in the pack's order. */
export interface IsleRows extends PackedGeometryRows { isles: string[] }
/** The playable islands, the four gate isles and the four moving islets (`islet.<edge>`), baked in that order. */
export function bakeSkyIsles(): { bin: Uint8Array; rows: IsleRows } {
  const pack = new GeometryPackWriter('far-reach isles'), isles: string[] = [];
  const add = (id: string, isle: Isle, draw: number): void => { pack.add(isleGeometry(isle, draw)); isles.push(id); };
  const cosmetic = seeded(COSMETIC_SEED), gate = parkMiller(1830), islet = parkMiller(4183);
  for (const isle of ISLES) add(isle.id, isle, lastOf(cosmetic));
  for (const entry of RISING_ISLETS) add(entry.gate.id, entry.gate, lastOf(gate));
  const footprint: Isle = { id: 'islet', x: 0, z: 0, r: ISLET.islet.r, y: 0, keel: ISLET.islet.keel };
  for (const entry of RISING_ISLETS) add(`islet.${entry.edge}`, footprint, lastOf(islet));
  return { bin: pack.bytes(), rows: { ...pack.rows(), isles } };
}
