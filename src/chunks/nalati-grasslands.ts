/**
 * Nalati Grasslands — the third shard: a high alpine steppe in the Tian Shan. Painterly style B (`style: 'painterly'`):
 * every mesh on `src/world/painterly.ts`.
 *
 * World layout v2, "the bowl and the snow ring" (docs/design/nalati/layout-v2.md; the user's pick, map 4). Three zones,
 * each with its own colour, north → south:
 *
 *   · NALATI GRASSLANDS (green): the valley floor at −8 in the north band, the braided Kunes (water −10) flowing
 *     east → west under the bridge, the nomad camp, the sheep pasture; the escarpment climbs from the river's south bank
 *     to the north rim (z ≈ +112, +39), the sky road switchbacking up it.
 *   · THE SKY GRASSLAND (golden): a shallow bowl (a squircle round (0, +32), 410 × 160 m) — floor +24 … +32, rims
 *     +35 … +45: the horse plains, the kokpar field, the kurgan field + the great kurgan, the summer camp; Eagle Rock on
 *     the west rim, the ruined watchtower on the east rim.
 *   · SNOW LOTUS VALLEY + its mountains (white / blue-grey): the snow ring south and east of the bowl (the Crags ≈ +105
 *     in the east, the west massif ≈ +95 with the leopard's cave, snow above +55) and the glacial valley cutting south
 *     from the bowl's south rim (+31) to the S gate (0): scree, the glacier tongue off the east crags, the meltwater
 *     stream, snow lotus in the rocks.
 *
 * Engine axes: origin at the centre, **+z = north, −x = east**, ±250 m. Every coordinate lives in `./nalatiLayout.ts`
 * (plain data, re-exported here); `zoneAt(x, z)` gives the three zones' weights for the palettes.
 */
import { Noise2D, smoothstep, clamp, lerp } from '../core/noise';
import { CHUNK_HALF } from '../core/config';
import { buildTerrain } from './terrain';
import { inSpruceClearing } from '../world/nalati/clearings';
import {
  RIVER_LEVEL, riverZAt, riverHalfAt, BRIDGE_XZ, BOWL, RIM_N, SKY_ROAD, SKY_ROAD_RIM, EAGLE_ROCK, KOKPAR, KURGANS, SUMMER_YURTS,
  WATCHTOWER, CAIRN, SNOW_LINE, CRAGS, WEST_CRAGS, snowValleyX, snowValleyHalf, snowValleyFloor, GLACIER, MELT_STREAM,
  LEOPARD_CAVE, ARGYMAQ_PASTURE, N_ROAD_PTS, S_ROAD_PTS, W_ROAD_PTS, E_ROAD_PTS, CAMP_SPUR, BOWL_TRACKS, LONE_SPRUCE,
} from './nalatiLayout';
import type { ChunkDef, ChunkTerrain, RGB, Vec2 } from './ChunkDef';
import thumbnail from './thumbs/nalati-grasslands.jpg';
import heroPortrait from './thumbs/nalati-grasslands-portrait.jpg';
import heroLandscape from './thumbs/nalati-grasslands-landscape.jpg';

export * from './nalatiLayout';

const SEED = 0x4a1a;

// ── the geography (engine metres) ─────────────────────────────────────────────────────────────────────────────────

/** The Kunes: water surface height, and the braided corridor's centreline / half-width as functions of x. */
export const RIVER = { level: RIVER_LEVEL, z: riverZAt, half: riverHalfAt };
/** the timber bridge carrying the N road over the river (deck height; the POI agent builds it) */
export const BRIDGE = { x: BRIDGE_XZ.x, z: BRIDGE_XZ.z, deckY: BRIDGE_XZ.deckY, span: RIVER.half(0) * 2 + 8 };
/** the meltwater stream (Snow Lotus Valley) is `BROOK` to the water / wet-ground / dressing modules; `RIM_Z` = the north
 *  rim's mean z (the top of the escarpment), the band outcrops / wet ground work from */
export { MELT_STREAM as BROOK, RIM_N as RIM_Z } from './nalatiLayout';

/** on the N road, 18 m in from the gate, facing south: the bridge, the escarpment and the bowl ahead (yaw 0 faces −z) */
const SPAWN = { x: 0, z: 232, yaw: 0 };

// ── helpers ───────────────────────────────────────────────────────────────────────────────────────────────────────

function segDist(px: number, pz: number, a: Vec2, b: Vec2): { d: number; t: number } {
  const vx = b[0] - a[0], vz = b[1] - a[1], wx = px - a[0], wz = pz - a[1];
  const l2 = vx * vx + vz * vz;
  const t = l2 > 0 ? clamp((wx * vx + wz * vz) / l2, 0, 1) : 0;
  return { d: Math.hypot(px - (a[0] + vx * t), pz - (a[1] + vz * t)), t };
}
/** nearest distance to a polyline + the arc-length fraction (0..1) of the nearest point */
function polyNearest(px: number, pz: number, poly: Vec2[], cum: number[]): { d: number; f: number } {
  let best = Infinity, f = 0;
  const total = cum[cum.length - 1] ?? 1;
  for (let i = 0; i < poly.length - 1; i++) {
    const a = poly[i], b = poly[i + 1];
    if (!a || !b) continue;
    const r = segDist(px, pz, a, b);
    if (r.d < best) { best = r.d; f = ((cum[i] ?? 0) + r.t * ((cum[i + 1] ?? 0) - (cum[i] ?? 0))) / total; }
  }
  return { d: best, f };
}
function cumulative(poly: Vec2[]): number[] {
  const out = [0];
  for (let i = 1; i < poly.length; i++) { const a = poly[i - 1], b = poly[i]; out.push((out[i - 1] ?? 0) + (a && b ? Math.hypot(b[0] - a[0], b[1] - a[1]) : 0)); }
  return out;
}
/** the graded climb of the sky road: bridge → the rim */
const SKY_CLIMB: Vec2[] = SKY_ROAD.slice(0, SKY_ROAD_RIM + 1);
const SKY_CLIMB_CUM = cumulative(SKY_CLIMB);
const SKY_CLIMB_Y: [number, number] = [-8.6, 30];
const BROOK_CUM = cumulative(MELT_STREAM);
/** a soft minimum (k = blend metres) */
const smin = (a: number, b: number, k: number): number => { const h = clamp(0.5 + (0.5 * (b - a)) / k, 0, 1); return lerp(b, a, h) - k * h * (1 - h); };

/** 0 outside → 1 inside the river's gravel corridor (the water can be anywhere in it) */
export function riverMask(x: number, z: number): number {
  const half = RIVER.half(x);
  return smoothstep(half + 3, half - 1, Math.abs(z - RIVER.z(x)));
}

const rimNoise = new Noise2D(SEED); // buildTerrain's `n` (Noise2D(seed)): the same field the rim wobbles with
const n2Noise = new Noise2D(SEED + 7); // buildTerrain's `n2`
/** the north rim's z at x (the top of the escarpment; it bows ~16 m south round the sky road, so the face is wide there) */
export function rimZAt(x: number): number { return RIM_N + rimNoise.get(x * 0.008, 7.7) * 6 - 16 * Math.exp(-(((x - 36) / 70) ** 2)); }

/** 0 off → 1 on the meltwater stream's bed (~3 m wide): grass and placement keep out of it (it is part of `pondMask`) */
export function brookMask(x: number, z: number): number {
  if (z > -85 || x < -60 || x > 20) return 0;
  return smoothstep(3.2, 1.6, polyNearest(x, z, MELT_STREAM, BROOK_CUM).d);
}

/** the bowl's squircle radius at (x, z): < 1 inside, 1 on the rim line (wobbled ±3.5 %), > 1 beyond */
function bowlQ(x: number, z: number): number {
  const u = Math.abs(x - BOWL.x) / BOWL.ax, v = Math.abs(z - BOWL.z) / BOWL.az;
  return Math.cbrt(u * u * u + v * v * v) + rimNoise.get(x * 0.011 + 3.3, z * 0.011) * 0.035;
}

/** 0..1: how much of the snow ring's mountain mass stands at (x, z) (beyond the bowl's rim, south / east / the west arm) */
function ringMass(x: number, z: number): number {
  const south = smoothstep(-20, -62, z);
  const east = smoothstep(-150, -212, x) * smoothstep(34, -6, z);
  const west = smoothstep(150, 212, x) * smoothstep(-6, -46, z);
  return Math.max(south, east, west);
}

/** the three zones' weights at (x, z): [valley, bowl, snow] (sum 1) — the palettes, the grass, the sound read them */
export function zoneAt(x: number, z: number): [number, number, number] {
  const rz = rimZAt(x), valley = smoothstep(rz + 2, rz + 16, z);
  const snow = (1 - valley) * Math.max(ringMass(x, z) * smoothstep(0.98, 1.1, bowlQ(x, z)), smoothstep(-52, -70, z));
  return [valley, Math.max(0, 1 - valley - snow), snow];
}

// ── the landscape ─────────────────────────────────────────────────────────────────────────────────────────────────

/** the high country south of the north rim: the bowl, its rims, the snow ring's mountains (no valley cut, no POI pads) */
function upland(x: number, z: number, n: Noise2D, n2: Noise2D): number {
  const q = bowlQ(x, z);
  // the bowl floor: long golden swells, a little lower in the middle
  const rolling = n.fbm(x * 0.0065 + 3.1, z * 0.0065, 3) * 3.4 + n2.fbm(x * 0.019, z * 0.019, 2);
  const floor = BOWL.floor + rolling - 1.6 * Math.max(0, 1 - q * q);
  const rim = BOWL.rim - 5 * smoothstep(BOWL.z, BOWL.z + BOWL.az, z) + n.get(x * 0.02, z * 0.02) * 3 + n2.get(x * 0.05, z * 0.05) * 1.2; // the north rim ≈ +34
  let h = lerp(floor, rim, smoothstep(0.68, 1.0, q) ** 1.5);
  if (q > 1) {
    const d = (q - 1) * 70; // ≈ metres beyond the rim
    const mass = ringMass(x, z);
    // outside the ring (the NW / NE corners, the W / E strips north of it): a rocky shoulder a few metres over the rim
    h = rim + smoothstep(0, 40, d) * (4 + n.fbm(x * 0.03, z * 0.03, 2) * 3);
    if (mass > 0) {
      // separate peaks and ridges, not a raised plateau: a low shoulder, then big low-frequency ridged peaks, the two
      // massifs' domes under them, and sharp mid-frequency crests
      // (big rounded masses from a low-frequency fbm, each topped by a gentler ridged crest: needles read as spikes)
      const peaks = smoothstep(-0.35, 0.75, n.fbm(x * 0.0085 + 1.7, z * 0.0085 - 2.3, 3)), crest = n2.ridged(x * 0.022, z * 0.022, 3);
      const base = smoothstep(0, 50, d) ** 0.9 * 12;
      const east = smoothstep(135, 10, Math.hypot(x - CRAGS.x, z - CRAGS.z) + n.get(x * 0.02 + 5, z * 0.02) * 16);
      const west = smoothstep(125, 10, Math.hypot(x - WEST_CRAGS.x, z - WEST_CRAGS.z) + n.get(x * 0.02 + 9, z * 0.02) * 14);
      const up = smoothstep(0, 35, d);
      const tall = (peaks ** 1.5 * 44 + crest * peaks * 12) * up + (east ** 1.3 * 26 + west ** 1.3 * 20) * up * (0.55 + 0.45 * peaks);
      h += mass * (base + tall) + mass * n.fbm(x * 0.09, z * 0.09, 2) * 2.2;
    }
  }
  return h;
}

/** the bowl's base height at a point (no pads): what the kokpar field / summer camp pads flatten to */
const padY = (x: number, z: number): number => upland(x, z, rimNoise, n2Noise);
let kokparY: number | null = null, summerY: number | null = null;

/** `along` = metres in from the edge, `across` = metres off the road's centreline */
function gateValley(h: number, along: number, across: number): number {
  if (along > 150 || Math.abs(across) > 75 || h <= 0) return h;
  const w = smoothstep(58, 12, Math.abs(across)) * smoothstep(150, 80, along);
  return lerp(h, h * smoothstep(8, 140, along) ** 1.15, w);
}

function landscape(x: number, z: number, n: Noise2D, n2: Noise2D): number {
  const zc = RIVER.z(x), half = RIVER.half(x);
  const across = z - zc;
  const foot = zc - half - 5, rimZ = rimZAt(x);
  const s = (foot - z) / (foot - rimZ); // 0 at the river's south bank → 1 at the north rim

  // north of the river: the valley floor — a 3 m terrace at the gravel, then the meadow rising gently to the N gate
  const dzN = across - half;
  const valley = -8.4 + 3.2 * smoothstep(0, 9, dzN) + 5.2 * smoothstep(8, 80, dzN) ** 0.8 + n.fbm(x * 0.009, z * 0.009, 3) * 0.9;
  let h: number;
  if (across > 0) h = valley;
  else if (s < 1) {
    // the escarpment: a bench under half way, then the steeper upper face to the rim's height
    const top = upland(x, rimZ, n, n2);
    const k = 0.4 * smoothstep(0.02, 0.4, s) + 0.6 * smoothstep(0.55, 0.97, s) ** 1.15;
    h = -8.8 + (top + 8.8) * k;
    // its relief: a comb of lesser ravines every ~34 m and two broken rock bands
    if (s > 0.02) {
      const band = smoothstep(0.06, 0.32, s) * (1 - smoothstep(0.9, 1.0, s));
      const wob = n2.get(z * 0.018, x * 0.004) * 9 + n.get(x * 0.01, z * 0.03) * 5;
      const phase = (x + wob) / 34, kk = Math.round(phase);
      const rib = Math.abs(phase - kk) * 2;
      const depth = 3 + 3.5 * (0.5 + 0.5 * n.get(kk * 3.1, 1.7));
      h -= band * depth * Math.max(0, 1 - rib / 0.62) ** 1.6 * (0.6 + 0.4 * smoothstep(0.3, 0.8, s));
      for (const [s0, amp] of [[0.6, 3.2], [0.83, 2.6]] as const) {
        const brk = smoothstep(-0.25, 0.15, n.get(x * 0.018 + s0 * 10, 4.4));
        const at = s0 + n2.get(x * 0.012, s0 * 20) * 0.05;
        h += amp * brk * (smoothstep(at - 0.012, at + 0.012, s) - smoothstep(at - 0.1, at + 0.1, s));
      }
    }
  } else h = upland(x, z, n, n2);

  // the braided corridor: grey gravel bars just proud of the water, channels cut below it
  {
    const fp = smoothstep(half + 9, half - 1, Math.abs(across));
    if (fp > 0) {
      let ch = 0;
      const u = across / Math.max(half, 1);
      ch = Math.max(ch, smoothstep(0.19, 0.06, Math.abs(u - 0.62 * Math.sin(x * 0.021 + 0.4))));
      ch = Math.max(ch, smoothstep(0.13, 0.04, Math.abs(u - 0.7 * Math.sin(x * 0.034 + 2.3))) * 0.85);
      ch = Math.max(ch, smoothstep(0.15, 0.05, Math.abs(u + 0.58 - 0.22 * Math.sin(x * 0.017 + 4.4))));
      ch = Math.max(ch, smoothstep(0.09, 0.03, Math.abs(u - 0.2 * Math.sin(x * 0.05 + 1.1))) * 0.6 * smoothstep(-0.3, 0.4, n.get(x * 0.012, 5.5)));
      const bed = -9.25 + n.get(x * 0.06, z * 0.06) * 0.18 + n2.get(x * 0.02, z * 0.03) * 0.16 - ch * 1.95;
      h = lerp(h, bed, fp);
    }
  }

  // Snow Lotus Valley: a U-shaped glacial valley cut south through the ring from the bowl's south rim to the S gate
  if (z < -20) {
    const on = smoothstep(-22, -52, z);
    const off = Math.abs(x - snowValleyX(z)) - snowValleyHalf(z);
    const vf = snowValleyFloor(z) + n.fbm(x * 0.03, z * 0.03, 2) * 0.9 + Math.max(0, off) ** 1.28 * 0.62 + Math.max(0, -off) * 0.02;
    h = lerp(h, smin(h, vf, 5), on);
  }
  // the glacier tongue: a smooth convex ice ramp from the east crags down into the valley head
  {
    const ax = GLACIER.x1 - GLACIER.x0, az = GLACIER.z1 - GLACIER.z0, l2 = ax * ax + az * az;
    const t = ((x - GLACIER.x0) * ax + (z - GLACIER.z0) * az) / l2;
    if (t > -0.15 && t < 1.08) {
      const px = GLACIER.x0 + ax * t, pz = GLACIER.z0 + az * t;
      const dp = Math.hypot(x - px, z - pz) + n.get(x * 0.03, z * 0.03) * 3;
      const g = smoothstep(GLACIER.half + 6, GLACIER.half - 6, dp) * smoothstep(-0.15, 0.02, t) * smoothstep(1.08, 0.96, t);
      if (g > 0) {
        const ice = lerp(GLACIER.y0, GLACIER.y1, clamp(t, 0, 1) ** 0.85) + 3.2 * Math.max(0, 1 - (dp / GLACIER.half) ** 2) + n2.get(x * 0.06, z * 0.06) * 0.5;
        h = lerp(h, ice, g);
      }
    }
  }
  // the meltwater stream's bed across the valley head and down the floor
  if (z < -85) {
    const b = polyNearest(x, z, MELT_STREAM, BROOK_CUM);
    if (b.d < 8) h -= smoothstep(6.5, 1.2, b.d) * (1.0 + b.f * 0.5);
  }
  // kurgan mounds: smooth domes
  for (const k of KURGANS) {
    const d = Math.hypot(x - k.x, z - k.z);
    if (d < k.r) { const q = 1 - (d / k.r) ** 2; h += k.h * q ** 1.25; }
  }
  // the sky road: a graded bench cut into the escarpment (a steady climb from the bridge to the rim)
  if (z < 162 && z > 70 && x > -20 && x < 90) {
    const r = polyNearest(x, z, SKY_CLIMB, SKY_CLIMB_CUM);
    if (r.d < 11) h = lerp(h, lerp(SKY_CLIMB_Y[0], SKY_CLIMB_Y[1], r.f), smoothstep(11, 4.5, r.d));
  }
  // flat pads: the kokpar field (an oval of trodden earth), the summer camp
  {
    const c = Math.cos(KOKPAR.rot), sn = Math.sin(KOKPAR.rot), dx = x - KOKPAR.x, dz = z - KOKPAR.z;
    const e = Math.hypot((dx * c - dz * sn) / (KOKPAR.rx + 10), (dx * sn + dz * c) / (KOKPAR.rz + 10));
    if (e < 1) { kokparY ??= padY(KOKPAR.x, KOKPAR.z); h = lerp(h, kokparY, smoothstep(1, 0.72, e)); }
    const ds = Math.hypot(x - SUMMER_YURTS.x, z - SUMMER_YURTS.z);
    if (ds < 26) { summerY ??= padY(SUMMER_YURTS.x, SUMMER_YURTS.z); h = lerp(h, summerY, smoothstep(26, 15, ds)); }
  }
  // small ground detail everywhere
  h += n2.fbm(x * 0.05, z * 0.05, 2) * 0.35;
  // the E, W and S gates: the road meets the boundary at y = 0 (engine rule) while the rims are +35…+45, so each comes
  // in up a real valley (the S gate's is the snow valley's own mouth)
  h = gateValley(h, x + CHUNK_HALF, z);   // E (x = −250)
  h = gateValley(h, CHUNK_HALF - x, z);   // W (x = +250)
  h = gateValley(h, z + CHUNK_HALF, x);   // S (z = −250)
  // soft-max knolls after the gates (so no gate valley cuts them): Eagle Rock's granite shoulder (a +55 crown for the
  // tor, whose blocks stand to +65), the watchtower's rock on the east rim, the Wind Cairn's rise on the south rim
  const knoll = (cx: number, cz: number, top: number, r: number, reach: number, slope: number): void => {
    const d = Math.hypot(x - cx, z - cz) + n2.get(x * 0.08, z * 0.08) * 3;
    if (d >= reach) return;
    const t = top - Math.max(0, d - r) ** 1.12 * slope;
    h += (t - h) * smoothstep(-2, 2, t - h) * smoothstep(reach, reach * 0.62, d);
  };
  knoll(EAGLE_ROCK.x, EAGLE_ROCK.z, EAGLE_ROCK.top - 10, 7, 60, 0.5);
  knoll(WATCHTOWER.x, WATCHTOWER.z, WATCHTOWER.y, 9, 40, 0.7);
  knoll(CAIRN.x, CAIRN.z, CAIRN.y, 6, 26, 0.35);
  // flat shelves cut into the mountainside: the leopard's cave ledge, Argymaq's high pasture
  const shelf = (cx: number, cz: number, y: number, r: number): void => {
    const d = Math.hypot(x - cx, z - cz);
    if (d < r * 1.6) h = lerp(h, y, smoothstep(r * 1.6, r, d));
  };
  shelf(LEOPARD_CAVE.x, LEOPARD_CAVE.z, LEOPARD_CAVE.y, 9);
  shelf(ARGYMAQ_PASTURE.x, ARGYMAQ_PASTURE.z, ARGYMAQ_PASTURE.y, 20);
  return h;
}

/** 0 off → 1 on the glacier's ice */
export function glacierMask(x: number, z: number): number {
  const ax = GLACIER.x1 - GLACIER.x0, az = GLACIER.z1 - GLACIER.z0, l2 = ax * ax + az * az;
  const t = ((x - GLACIER.x0) * ax + (z - GLACIER.z0) * az) / l2;
  if (t < -0.2 || t > 1.1) return 0;
  const dp = Math.hypot(x - (GLACIER.x0 + ax * t), z - (GLACIER.z0 + az * t)) + rimNoise.get(x * 0.03, z * 0.03) * 3;
  return smoothstep(GLACIER.half + 1, GLACIER.half - 4, dp) * smoothstep(-0.12, 0.04, t) * smoothstep(1.04, 0.94, t);
}
/** 0 off → 1 on the kokpar field's trodden oval */
export function kokparMask(x: number, z: number): number {
  const c = Math.cos(KOKPAR.rot), sn = Math.sin(KOKPAR.rot), dx = x - KOKPAR.x, dz = z - KOKPAR.z;
  const e = Math.hypot((dx * c - dz * sn) / KOKPAR.rx, (dx * sn + dz * c) / KOKPAR.rz) + rimNoise.get(x * 0.08, z * 0.08) * 0.05;
  return smoothstep(1.02, 0.9, e);
}

// ── the terrain ───────────────────────────────────────────────────────────────────────────────────────────────────

const TERRAIN: ChunkTerrain = (() => {
  const base = buildTerrain(SEED, {
    landscape: (x, z, { n, n2 }) => landscape(x, z, n, n2),
    // the four mandated entry roads first (edge midpoint, straight for ROAD_LENGTH), then the sky road, the camp spur and
    // the bowl's tracks
    trails: [S_ROAD_PTS, N_ROAD_PTS, E_ROAD_PTS, W_ROAD_PTS, SKY_ROAD, CAMP_SPUR, ...BOWL_TRACKS],
    cabinSites: [],
    /**
     * The painterly terrain paints itself (`groundColor` below); this splat is what grass / placement read:
     * [grass, gravel + dirt, rock, snow].
     */
    splat(x, z, t) {
      const h = t.heightAt(x, z);
      const [, ny] = t.normalAt(x, z, 1.0);
      const slope = 1 - ny;
      const rock = smoothstep(0.2, 0.42, slope);
      const snow = Math.max(smoothstep(SNOW_LINE - 3, SNOW_LINE + 3, h), glacierMask(x, z)) * (1 - rock * 0.6);
      const zs = zoneAt(x, z)[2];
      const scree = zs * smoothstep(0.08, 0.2, slope) * (1 - snow) * 0.8;
      const gravel = Math.max(riverMask(x, z) * smoothstep(-8.6, -9.4, h), smoothstep(4.5, 1.6, t.trailDistance(x, z)), kokparMask(x, z), scree);
      const grass = Math.max(0, 1 - rock - snow - gravel);
      return [grass + 1e-4, gravel, rock, snow];
    },
  });
  // the river is the shard's water: Player swims / wades in it (pondMask > 0 → waterLevel), grass and placement keep out
  // (and the meltwater stream: the grass keeps out of its bed; its surface is far above the river level, so nobody swims)
  return { ...base, pondMask: (x, z) => Math.max(riverMask(x, z), brookMask(x, z)), waterLevel: () => RIVER.level };
})();

// ── the painted ground (Terrain.ts painterly branch) ──────────────────────────────────────────────────────────────

const C = {
  valley: [0.19, 0.36, 0.07] as RGB,      // the valley: lush green
  valleyLight: [0.32, 0.46, 0.1] as RGB,
  slope: [0.15, 0.29, 0.07] as RGB,       // the shaded escarpment
  plateau: [0.48, 0.46, 0.12] as RGB,     // the Sky Grassland: golden-green
  plateauGold: [0.64, 0.52, 0.16] as RGB,
  alpine: [0.34, 0.36, 0.2] as RGB,       // the snow ring's thin turf between the rocks
  gravel: [0.42, 0.41, 0.37] as RGB,
  gravelWet: [0.25, 0.26, 0.25] as RGB,
  scree: [0.5, 0.5, 0.49] as RGB,
  earth: [0.46, 0.34, 0.2] as RGB,        // the kokpar field's trodden earth
  rock: [0.33, 0.31, 0.29] as RGB,
  rockCool: [0.36, 0.37, 0.4] as RGB,
  rockLight: [0.5, 0.47, 0.42] as RGB,
  snow: [0.9, 0.93, 0.98] as RGB,
  ice: [0.62, 0.78, 0.9] as RGB,
  olive: [0.3, 0.31, 0.08] as RGB,
};
const cn = new Noise2D(SEED + 91), cn2 = new Noise2D(SEED + 92);
const mixInto = (o: RGB, c: RGB, t: number): void => { o[0] += (c[0] - o[0]) * t; o[1] += (c[1] - o[1]) * t; o[2] += (c[2] - o[2]) * t; };

/** height / slope / zone / noise → the painted palette (linear RGB), written into `out` */
function groundColor(x: number, z: number, h: number, slope: number, t: ChunkTerrain, out: RGB): RGB {
  const patch = cn.fbm(x * 0.012, z * 0.012, 3), mottle = cn2.get(x * 0.07, z * 0.07);
  const [, zb, zs] = zoneAt(x, z);
  // the valley's lush green
  out[0] = C.valley[0]; out[1] = C.valley[1]; out[2] = C.valley[2];
  mixInto(out, C.valleyLight, smoothstep(-0.2, 0.6, patch) * 0.6);
  mixInto(out, C.slope, smoothstep(-6, 4, h) * (1 - smoothstep(20, 29, h)) * smoothstep(0.04, 0.16, slope));
  // the bowl's gold-green
  if (zb > 0) {
    const pc: RGB = [C.plateau[0], C.plateau[1], C.plateau[2]];
    mixInto(pc, C.plateauGold, smoothstep(0.0, 0.6, patch) * 0.75);
    mixInto(pc, C.valleyLight, smoothstep(0.0, -0.5, patch) * 0.45);
    mixInto(out, pc, zb * smoothstep(12, 24, h));
  }
  // the snow ring: thin alpine turf, grey scree on every slope
  if (zs > 0) {
    const ac: RGB = [C.alpine[0], C.alpine[1], C.alpine[2]];
    mixInto(ac, C.scree, Math.min(1, smoothstep(0.05, 0.16, slope) * 0.85 + smoothstep(0.2, 0.7, patch) * 0.25));
    mixInto(out, ac, zs);
  }
  const k = 0.93 + mottle * 0.07;
  out[0] *= k; out[1] *= k; out[2] *= k;
  // gravel bars in the river corridor (darker where wet)
  const rm = riverMask(x, z);
  if (rm > 0) {
    const g = rm * smoothstep(-8.2, -9.2, h);
    mixInto(out, C.gravel, g);
    mixInto(out, C.gravelWet, g * smoothstep(-9.9, -10.4, h));
  }
  // the kokpar field's trodden earth
  const km = kokparMask(x, z);
  if (km > 0) mixInto(out, C.earth, km * (0.8 + mottle * 0.15));
  // the roads are drawn per pixel (src/nalati/terrainSurface.ts); here only a worn, browner margin
  const td = t.trailDistance(x, z);
  mixInto(out, C.olive, smoothstep(6.5, 3, td) * 0.45 * (1 - zs));
  // rock on the steep faces: in the snow ring from ~26°, in the green zones only the steepest (the escarpment and the
  // rims stay grassy, the outcrops carry their rock)
  const rock = smoothstep(lerp(0.26, 0.1, zs), lerp(0.46, 0.26, zs), slope + smoothstep(40, 52, h) * 0.08 * zs);
  if (rock > 0) {
    const rc: RGB = [C.rock[0], C.rock[1], C.rock[2]];
    mixInto(rc, C.rockCool, zs * 0.7);
    mixInto(rc, C.rockLight, smoothstep(-0.3, 0.5, mottle + patch * 0.5));
    mixInto(out, rc, rock);
  }
  // snow above the line, holding on the flatter ledges
  const snow = smoothstep(SNOW_LINE - 2 + patch * 5, SNOW_LINE + 3 + patch * 5, h) * (1 - smoothstep(0.45, 0.7, slope) * 0.7);
  mixInto(out, C.snow, snow);
  // the glacier: blue-white ice, crevasse bands across its flow
  const gm = glacierMask(x, z);
  if (gm > 0) {
    const ic: RGB = [C.ice[0], C.ice[1], C.ice[2]];
    mixInto(ic, C.snow, 0.5 + 0.5 * smoothstep(-0.2, 0.4, patch));
    const crev = smoothstep(0.82, 0.95, Math.abs(Math.sin((x * 0.34 + z * 0.94) * 0.55 + cn2.get(x * 0.05, z * 0.05) * 2)));
    mixInto(ic, C.rockCool, crev * 0.55);
    mixInto(out, ic, gm);
  }
  return out;
}

/** per-vertex masks for the per-pixel ground detail: [gravel, rock, snow] */
function surfaceAt(x: number, z: number, h: number, slope: number): [number, number, number] {
  const zs = zoneAt(x, z)[2];
  const gravel = Math.max(riverMask(x, z) * smoothstep(-8.3, -9.1, h), zs * smoothstep(0.05, 0.16, slope) * 0.8);
  const rock = smoothstep(lerp(0.26, 0.1, zs), lerp(0.46, 0.26, zs), slope + smoothstep(40, 52, h) * 0.08 * zs);
  const patch = cn.fbm(x * 0.012, z * 0.012, 3);
  const snow = Math.max(smoothstep(SNOW_LINE - 2 + patch * 5, SNOW_LINE + 3 + patch * 5, h) * (1 - smoothstep(0.45, 0.7, slope) * 0.7), glacierMask(x, z));
  return [gravel, rock * (1 - snow * 0.5), snow];
}

/** the forest is cut: 1–3 lone spruces within ~5 m of each LONE_SPRUCE spot */
function loneSpruceMask(x: number, z: number): number {
  let m = 0;
  for (const [sx, sz] of LONE_SPRUCE) { const d = Math.hypot(x - sx, z - sz); if (d < 6) m = Math.max(m, smoothstep(6, 3, d)); }
  return m;
}

export const NALATI_GRASSLANDS: ChunkDef = {
  id: 'chunk://local/nalati-grasslands',
  slug: 'nalati-grasslands',
  displayName: 'Nalati Grasslands',
  gridCoords: '(+4, −2)',
  seed: SEED,
  treeCount: 40,
  biome: 'Alpine steppe',
  experimental: true,
  blurb: 'SUPER EXPERIMENTAL — the Tian Shan steppe, painted: cross the braided Kunes, tame a steppe horse and hunt wolves from the saddle across the golden bowl of the Sky Grassland, break the Golden King in his kurgan, and ride out a storm to face the Storm Titan. Snow Lotus Valley waits in the snow ring. Built live, rough edges everywhere.',
  thumbnail, heroPortrait, heroLandscape,
  style: 'painterly',
  weapon: 'sword', // the Driftwood sword until the bow / sabre land (B2 / B3)
  // (the camera's far plane is 2.6 km: every ring stays inside 2.5 km)
  horizon: {
    cloudSea: true,
    rings: [
      // near: the plateau rolling on past the veil at slab height (S / SE / SW), dropping away to the valley (N) and a gorge (E)
      {
        r: 800, base: -60, floor: -60, color: [0.16, 0.3, 0.06], top: [0.36, 0.46, 0.11], snowLine: 2, haze: 0.06,
        bands: [
          { azimuth: 180, spread: 80, height: 36, rough: 0.05 },    // south: the plateau rolls on, low — the painted range shows over it
          { azimuth: 135, spread: 35, height: 70, rough: 0.12 },    // SE / SW shoulders
          { azimuth: 225, spread: 35, height: 64, rough: 0.08 },
          { azimuth: 0, spread: 50, height: 40, rough: 0.1 },       // north: the far valley side, low
          { azimuth: 90, spread: 18, height: 125, rough: 0.35 },    // east: the gorge walls either side of the Kunes
          { azimuth: 62, spread: 14, height: 95, rough: 0.3 },
          { azimuth: 270, spread: 45, height: 8, rough: 0 },        // west: the valley opens flat toward the Ili
        ],
      },
      // mid: the brown-green Avral range (N), green foothills (S), the gorge's mountains (E)
      {
        r: 1400, base: -150, floor: -150, color: [0.08, 0.14, 0.06], top: [0.24, 0.29, 0.12], snowLine: 0.92, haze: 0.12,
        bands: [
          { azimuth: 0, spread: 60, height: 290, rough: 0.55 },
          { azimuth: 180, spread: 70, height: 230, rough: 0.35 },
          { azimuth: 90, spread: 30, height: 310, rough: 0.6 },
          { azimuth: 270, spread: 40, height: 40, rough: 0.1 },
        ],
      },
      // the Nalati snow range itself is the painted 360° backdrop (src/world/PaintedBackdrop.ts): no far rings here
    ],
  },
  groundColor,
  surfaceAt,

  terrain: TERRAIN,

  // the painterly terrain loads none of these (it paints itself); they satisfy the PBR contract
  assets: {
    groundLayers: ['leafy_grass', 'stony_dirt_path', 'rock_ground', 'forest_ground_04'],
    groundTints: [[0.7, 0.85, 0.5], [0.9, 0.84, 0.66], [0.7, 0.7, 0.72], [0.95, 0.95, 0.95]],
    slabRock: 'rock_ground',
  },
  // the spruce forest is cut (layout v2): a handful of lone Tian Shan spruces (src/world/Spruce.ts) at LONE_SPRUCE; the
  // tint multiplies the painted colours, so it stays near-white
  trees: { factory: 'spruce', bark: 'pine_bark', twigAtlas: 'pine_tree_01', noun: 'spruces' },
  forest: {
    spacing: 4.2,
    densityFreq: 0.01,
    clearings: [-2, -1.5], // never a "grove" by the density noise: the spruce mask decides
    maxSlope: 0.6,
    tintHue: 0.3, tintHueJitter: [-0.06, 0.06], tintSat: [0.05, 0.25], tintLight: [0.8, 0.95],
    largeVariantChance: 0.15,
    mask: (x: number, z: number) => (inSpruceClearing(x, z) ? 0 : loneSpruceMask(x, z)), // never in a POI (clearings.ts)
  },
  fauna: [], // wolves, horses and sheep: the creatures agent (B4)
  sky: {
    hdri: 'kloofendal_48d_partly_cloudy_puresky', // unused: the sky is painted (below)
    painted: { zenith: [0.1, 0.28, 0.85], horizon: [0.62, 0.78, 0.98], ground: [0.3, 0.36, 0.3], glow: [0.5, 0.4, 0.25] },
    sun: { azimuth: 250, elevation: 26 },
    sunColor: [1.0, 0.85, 0.64], // a warm late-afternoon key (look pass lever 2: warm light, cool painted shade)
    sunIntensity: 2.8,
    envIntensity: 0.6,
    bgIntensity: 1.0,
    fogSunColor: [1.0, 0.88, 0.7],
    cloudSunColor: [1.0, 0.93, 0.82],
    hemiSky: 0x9cc4ff, hemiGround: 0x7a7436, hemiIntensity: 0.5, // a warm bounce off the grass lifts every shade side — kept low enough for strong value contrast (look pass lever 2)
    // the ringed giant high in the SSW over the snow range — ahead and to the right from the spawn, lit from the WSW sun
    planet: { azimuth: 205, elevation: 23, size: 26, tilt: 2, roll: -20 },
  },
  atmosphere: {
    fogHeight: -30.0,
    fogHeightFalloff: 0.05,
    fogHeightDensity: 0.0006,
    fogDistDensity: 0.002, // the painterly aerial perspective (Atmosphere.ts paintedAir), pushed hard for the 500 m slab: ~20 % at 150 m, 45 % at 500 m
    volumetricSunColor: [1.0, 0.9, 0.72],
    // thin, high: a clear mountain afternoon (the default forest haze sits exactly on the valley floor and milks it out)
    volumetric: { height: -30, falloff: 0.06, density: 0.0009, strength: 0.35 },
  },
  grade: {
    // (the painterly chain tone-maps with Khronos Neutral, which keeps the saturation AgX bleached — Game.buildPainterlyChain)
    saturation: 0.1, brightness: 0.0, contrast: 0.15,
    bloomIntensity: 0.35, bloomThreshold: 0.86,
    shadowTint: [0.9, 0.96, 1.1], highTint: [1.05, 1.01, 0.94],
    lift: [0.0, 0.004, 0.018], gain: [1.02, 1.02, 1.0], gamma: 1.0,
  },
  spawn: SPAWN,
};
