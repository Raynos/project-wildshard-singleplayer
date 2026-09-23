/**
 * Nalati Grasslands — the third shard: a high alpine steppe in the Tian Shan, laid out like the real Nalati
 * (docs/plans/NALATI.md, docs/design/nalati/geography-and-map.md §3; map-01 is the layout). Painterly style B
 * (`style: 'painterly'`): no textures, every mesh on `src/world/painterly.ts`.
 *
 * Engine axes: origin at the centre, **+z = north, −x = east**, ±250 m. The slab is a cross-section of the real climb,
 * north → south:
 *
 *   valley floor (−8)  ·  the Kunes river, braided, flowing east → west (toward +x) over grey gravel bars, water −10
 *   ·  the escarpment: a north-facing slope, −9 → +30 with a bench half way, cut by three spruce gullies
 *      (x −170, −60, +135) and the waterfall ravine (x +60), the sky-road switchbacks up the central spur
 *   ·  the Sky Grassland plateau +30 → +36 (the balbal knoll +40, kurgan mounds, the brook)
 *   ·  the Crags massif in the SE corner (peak ≈ +75, snow above +55), a lower snowy spur in the SW corner,
 *      the S road coming in through the saddle between them.
 *
 * Exports the POI coordinates other modules build on (POIs, fauna, the river water): RIVER, BRIDGE, CAMP, PASTURE,
 * SKY_ROAD, BROOK, WATERFALL, EAGLE_ROCK, BALBAL_KNOLL, KURGANS, CRAGS, SW_SPUR, SUMMER_YURTS, CAIRN.
 */
import { Noise2D, smoothstep, clamp, lerp } from '../core/noise';
import { CHUNK_HALF, ROAD_LENGTH } from '../core/config';
import { buildTerrain } from './terrain';
import { spruceMask, NALATI_GULLIES } from '../world/spruceMask';
import type { ChunkDef, ChunkTerrain, RGB, Vec2 } from './ChunkDef';
import thumbnail from './thumbs/nalati-grasslands.jpg';
import heroPortrait from './thumbs/nalati-grasslands-portrait.jpg';
import heroLandscape from './thumbs/nalati-grasslands-landscape.jpg';

const SEED = 0x4a1a;

// ── the geography (engine metres) ─────────────────────────────────────────────────────────────────────────────────

/** The Kunes: water surface height, and the braided corridor's centreline / half-width as functions of x. */
export const RIVER = {
  level: -10,
  /** centreline z at x: enters the east edge (x −250) near z +175, leaves the west edge (x +250) near z +145 */
  z: (x: number): number => 160 - 0.058 * x + 7 * Math.sin(x * 0.013),
  /** half-width of the gravel corridor (narrower at the bridge) */
  half: (x: number): number => (19 + 5 * Math.sin(x * 0.009 + 2.1) + 3 * Math.sin(x * 0.031)) * lerp(0.62, 1, smoothstep(8, 60, Math.abs(x))),
};
/** the timber bridge carrying the N road over the river (deck height; the POI agent builds it) */
export const BRIDGE = { x: 0, z: RIVER.z(0), deckY: -6, span: RIVER.half(0) * 2 + 8 };
/** the spring camp in the valley (6 yurts, corral, hitching rail) and the sheep pasture */
export const CAMP = { x: 95, z: 205, y: -8 };
export const PASTURE = { x: -120, z: 205, y: -8 };
/** the escarpment rim: the plateau's north edge (z, wobbles ±9 m with x) */
export const RIM_Z = -28;
/** the three spruce gullies (x, half-width, depth, wobble) — the spruce planting (`NALATI_GULLIES` in src/world/spruceMask.ts) uses the same x / wobble field */
export const GULLIES: { x: number; half: number; depth: number; wobble: number }[] = [
  { x: -170, half: 30, depth: 11, wobble: 9 },
  { x: -60, half: 26, depth: 9, wobble: 8 },
  { x: 135, half: 30, depth: 10, wobble: 10 },
];
/** the waterfall notch in the rim (the brook falls ~20 m into its own ravine) */
export const WATERFALL = { x: 60, z: -28, top: 30, bottom: 10 };
/** the sky road: 4 hairpins up the central spur from the bridge's south end to the rim */
export const SKY_ROAD: Vec2[] = [
  [0, 140], [4, 124], [36, 106], [41, 98], [-14, 74], [-20, 66], [34, 42], [40, 34], [-12, 10], [-16, 2], [12, -20], [18, -38],
];
const SKY_ROAD_Y: [number, number] = [-8.6, 30.8];
/** the plateau brook: from the Crags' north foot, NW across the Sky Grassland to the waterfall notch */
export const BROOK: Vec2[] = [[-150, -168], [-118, -150], [-80, -146], [-40, -128], [-6, -104], [22, -80], [42, -58], [54, -40], [60, -28]];
export const EAGLE_ROCK = { x: 170, z: -20, top: 50 };
export const BALBAL_KNOLL = { x: 20, z: -170, r: 12, y: 40 };
/** kurgan mounds (the POI agent adds kerbs + stones); `great` = the Golden King's dungeon mound */
export const KURGANS: { x: number; z: number; r: number; h: number; great?: boolean }[] = [
  { x: -140, z: -105, r: 19, h: 6.5, great: true },
  { x: -96, z: -66, r: 8, h: 2.4 }, { x: -122, z: -56, r: 6, h: 1.8 }, { x: -168, z: -70, r: 10, h: 3 },
  { x: -84, z: -100, r: 7, h: 2.1 }, { x: -108, z: -132, r: 11, h: 3.2 }, { x: -172, z: -136, r: 6.5, h: 2 }, { x: -64, z: -76, r: 5.5, h: 1.6 },
];
/** the Crags massif (SE corner) and the lower SW spur; snow above SNOW_LINE */
export const CRAGS = { x: -190, z: -195, peak: 75 };
export const SW_SPUR = { x: 215, z: -222 };
export const SNOW_LINE = 55;
export const SUMMER_YURTS = { x: 95, z: -200 };
/** the Storm Titan's cairn (a stone pile on the open plateau) */
export const CAIRN = { x: -30, z: -60 };

/** on the N road, 18 m in from the gate, facing south: the whole climb ahead (yaw 0 faces −z = south) */
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
const SKY_ROAD_CUM = cumulative(SKY_ROAD);
const BROOK_CUM = cumulative(BROOK);
const gullyNoise = new Noise2D(SEED + 313); // the same wobble field as spruceMask (seed + 313), so the spruce sits in the cut

/** 0 outside → 1 inside the river's gravel corridor (the water can be anywhere in it) */
export function riverMask(x: number, z: number): number {
  const half = RIVER.half(x);
  return smoothstep(half + 3, half - 1, Math.abs(z - RIVER.z(x)));
}

/** where the escarpment is on its way up: 0 at the river's south bank (the foot) → 1 at the rim; unclamped */
function slopeParam(x: number, z: number, n: Noise2D): number {
  const foot = RIVER.z(x) - RIVER.half(x) - 5;
  const rim = RIM_Z + n.get(x * 0.008, 7.7) * 9;
  return (foot - z) / (foot - rim);
}

/** `along` = metres in from the edge, `across` = metres off the road's centreline */
function gateValley(h: number, along: number, across: number): number {
  if (along > 135 || Math.abs(across) > 70 || h <= 0) return h;
  const w = smoothstep(66, 12, Math.abs(across)) * smoothstep(135, 70, along);
  return lerp(h, h * smoothstep(8, 128, along) ** 1.15, w);
}

// ── the landscape ─────────────────────────────────────────────────────────────────────────────────────────────────

function landscape(x: number, z: number, n: Noise2D, n2: Noise2D): number {
  const zc = RIVER.z(x), half = RIVER.half(x);
  const across = z - zc;
  const s = slopeParam(x, z, n), sc = clamp(s, 0, 1);

  // north of the river: the valley floor, gently rolling
  const valley = -8 + n.fbm(x * 0.009, z * 0.009, 3) * 1.1 + smoothstep(200, 250, z) * 0.8;
  // south: the escarpment — a bench a little under half way up, then the steeper upper face to the rim
  const esc = -8.8 + 16.5 * smoothstep(0, 0.42, sc) + 22.3 * smoothstep(0.5, 1, sc);
  // the plateau beyond the rim: rolling, rising ~6 m toward the south mountains
  const rise = clamp((RIM_Z - z) / 190, 0, 1) * 6;
  const rolling = n.fbm(x * 0.0055 + 3.1, z * 0.0055, 3) * 2.4 + n2.fbm(x * 0.02, z * 0.02, 2) * 0.5;
  let h = across > 0 ? valley : esc + smoothstep(0.75, 1.05, s) * (rolling + rise);
  // the braided corridor: grey gravel bars just proud of the water, channels cut below it
  {
    const fp = smoothstep(half + 9, half - 1, Math.abs(across));
    if (fp > 0) {
      let ch = 0;
      const u = across / Math.max(half, 1);
      ch = Math.max(ch, smoothstep(0.28, 0.1, Math.abs(u - 0.62 * Math.sin(x * 0.021 + 0.4))));
      ch = Math.max(ch, smoothstep(0.22, 0.07, Math.abs(u - 0.7 * Math.sin(x * 0.034 + 2.3))) * 0.9);
      ch = Math.max(ch, smoothstep(0.2, 0.06, Math.abs(u + 0.55 - 0.25 * Math.sin(x * 0.017 + 4.4))));  // the deep channel under the south bank
      ch = Math.max(ch, smoothstep(0.18, 0.05, Math.abs(u - 0.2 * Math.sin(x * 0.05 + 1.1))) * 0.7 * smoothstep(-0.3, 0.4, n.get(x * 0.012, 5.5)));
      const bed = -9.72 + n.get(x * 0.06, z * 0.06) * 0.14 + n2.get(x * 0.02, z * 0.03) * 0.12 - ch * 1.7;
      h = lerp(h, bed, fp);
    }
  }
  // gullies: V-cuts down the escarpment, deepest at mid-slope, opening onto the valley floor
  for (const g of GULLIES) {
    const cx = g.x + gullyNoise.get(z * 0.011, g.x * 0.01) * g.wobble;
    const dx = Math.abs(x - cx) / g.half;
    if (dx >= 1) continue;
    const along = smoothstep(-0.02, 0.3, s) * (1 - smoothstep(0.9, 1.08, s));
    h -= g.depth * along * (1 - dx) ** 1.5;
  }
  // the waterfall: a notch in the rim with a sheer head wall, and a narrow ravine below it
  {
    const dx = Math.abs(x - WATERFALL.x - gullyNoise.get(z * 0.02, 9.1) * 3);
    if (dx < 22) {
      const ravine = smoothstep(0.02, 0.35, s) * (1 - smoothstep(0.93, 0.975, s)) * 9 * Math.max(0, 1 - dx / 22) ** 1.3;
      const head = smoothstep(0.55, 0.9, s) * (1 - smoothstep(0.955, 0.985, s)) * 11 * Math.max(0, 1 - dx / 12) ** 1.1;
      h -= ravine + head;
    }
  }
  // the brook across the plateau: a shallow bed, ~3 m wide
  if (z < RIM_Z + 12) {
    const b = polyNearest(x, z, BROOK, BROOK_CUM);
    if (b.d < 8) h -= smoothstep(6.5, 1.2, b.d) * (1.1 + b.f * 0.6);
  }
  // Eagle Rock: a steep knoll on the rim (the tor's granite blocks are a POI mesh on top)
  { const d = Math.hypot(x - EAGLE_ROCK.x, z - EAGLE_ROCK.z) + n2.get(x * 0.08, z * 0.08) * 4; h += smoothstep(30, 9, d) * 11; }
  // the balbal knoll: the highest open point of the plateau, a flat top for the stone ring
  { const d = Math.hypot(x - BALBAL_KNOLL.x, z - BALBAL_KNOLL.z); h += smoothstep(38, BALBAL_KNOLL.r, d) * 5.2; }
  // kurgan mounds: smooth domes
  for (const k of KURGANS) {
    const d = Math.hypot(x - k.x, z - k.z);
    if (d < k.r) { const q = 1 - (d / k.r) ** 2; h += k.h * q ** 1.25; }
  }
  // the S road's saddle between the two massifs
  h -= 7 * smoothstep(70, 10, Math.abs(x)) * smoothstep(-160, -245, z);
  // the Crags: a snowy granite massif in the SE corner
  {
    const d = Math.hypot(x - CRAGS.x, z - CRAGS.z) + n.get(x * 0.02 + 5, z * 0.02) * 16;
    const mass = smoothstep(125, 12, d);
    if (mass > 0) h += mass ** 1.25 * (28 + n2.ridged(x * 0.028, z * 0.028, 4) * 20) + mass * n.fbm(x * 0.09, z * 0.09, 2) * 2.5;
  }
  // the SW spur: lower, a little snow on its crest
  {
    const d = Math.hypot(x - SW_SPUR.x, z - SW_SPUR.z) + n.get(x * 0.025 + 9, z * 0.025) * 12;
    const mass = smoothstep(90, 8, d);
    if (mass > 0) h += mass ** 1.3 * (14 + n2.ridged(x * 0.03 + 4, z * 0.03, 4) * 12);
  }
  // the sky road: a graded bench cut into the slope (cut & fill toward a steady climb from the bridge to the rim)
  if (z < 150 && z > -50 && x > -40 && x < 60) {
    const r = polyNearest(x, z, SKY_ROAD, SKY_ROAD_CUM);
    if (r.d < 11) h = lerp(h, lerp(SKY_ROAD_Y[0], SKY_ROAD_Y[1], r.f), smoothstep(11, 4.5, r.d));
  }
  // small ground detail everywhere
  h += n2.fbm(x * 0.05, z * 0.05, 2) * 0.35;
  // the E, W and S gates: the road must meet the boundary at y = 0 (engine rule) while the land there is +25…+30, so
  // each comes in up a real valley — sloped sides, the floor climbing from 0 at the edge to the land ~125 m in —
  // instead of a sheer slot cut by the road levelling
  h = gateValley(h, x + CHUNK_HALF, z);   // E (x = −250)
  h = gateValley(h, CHUNK_HALF - x, z);   // W (x = +250)
  h = gateValley(h, z + CHUNK_HALF, x);   // S (z = −250)
  return h;
}

// ── the trails ────────────────────────────────────────────────────────────────────────────────────────────────────

/** the S road across the plateau to the top of the sky road; the W road past Eagle Rock; the E road to the kurgans; the camp spur */
const S_ROAD: Vec2[] = [[0, -CHUNK_HALF], [0, -CHUNK_HALF + ROAD_LENGTH], [-6, -150], [-2, -110], [12, -70], [18, -38]];
const W_ROAD: Vec2[] = [[CHUNK_HALF, 0], [CHUNK_HALF - ROAD_LENGTH, 0], [165, -45], [110, -52], [60, -46], [18, -38]];
const E_ROAD: Vec2[] = [[-CHUNK_HALF, 0], [-CHUNK_HALF + ROAD_LENGTH, 0], [-176, -34], [-150, -60], [-118, -82]];
const N_ROAD: Vec2[] = [[0, CHUNK_HALF], [0, CHUNK_HALF - ROAD_LENGTH], [0, 140]];
const CAMP_SPUR: Vec2[] = [[0, 196], [40, 202], [CAMP.x - 14, CAMP.z]];

const TERRAIN: ChunkTerrain = (() => {
  const base = buildTerrain(SEED, {
    landscape: (x, z, { n, n2 }) => landscape(x, z, n, n2),
    // the four mandated entry roads first (edge midpoint, straight for ROAD_LENGTH), then the sky road + the camp spur
    trails: [S_ROAD, N_ROAD, E_ROAD, W_ROAD, SKY_ROAD, CAMP_SPUR],
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
      const snow = smoothstep(SNOW_LINE - 3, SNOW_LINE + 3, h) * (1 - rock * 0.6);
      const gravel = Math.max(riverMask(x, z) * smoothstep(-8.6, -9.4, h), smoothstep(4.5, 1.6, t.trailDistance(x, z)));
      const grass = Math.max(0, 1 - rock - snow - gravel);
      return [grass + 1e-4, gravel, rock, snow];
    },
  });
  // the river is the shard's water: Player swims / wades in it (pondMask > 0 → waterLevel), grass and placement keep out
  return { ...base, pondMask: riverMask, waterLevel: () => RIVER.level };
})();

// ── the painted ground (Terrain.ts painterly branch) ──────────────────────────────────────────────────────────────

const C = {
  valley: [0.19, 0.36, 0.07] as RGB,      // lush valley green
  valleyLight: [0.34, 0.46, 0.1] as RGB,
  slope: [0.13, 0.28, 0.06] as RGB,       // the shaded escarpment
  plateau: [0.42, 0.47, 0.12] as RGB,     // Sky Grassland gold-green
  plateauGold: [0.6, 0.52, 0.16] as RGB,
  gravel: [0.42, 0.41, 0.37] as RGB,
  gravelWet: [0.25, 0.26, 0.25] as RGB,
  dirt: [0.5, 0.33, 0.13] as RGB,
  rock: [0.33, 0.31, 0.29] as RGB,
  rockLight: [0.5, 0.47, 0.42] as RGB,
  snow: [0.9, 0.93, 0.98] as RGB,
};
const cn = new Noise2D(SEED + 91), cn2 = new Noise2D(SEED + 92);
const mixInto = (o: RGB, c: RGB, t: number): void => { o[0] += (c[0] - o[0]) * t; o[1] += (c[1] - o[1]) * t; o[2] += (c[2] - o[2]) * t; };

/** height / slope / noise → the painted palette (linear RGB), written into `out` */
function groundColor(x: number, z: number, h: number, slope: number, t: ChunkTerrain, out: RGB): RGB {
  // big soft brush patches, then a finer mottle
  const patch = cn.fbm(x * 0.012, z * 0.012, 3), mottle = cn2.get(x * 0.07, z * 0.07);
  // green: the valley → the slope → the plateau's gold-green, blended on height
  out[0] = C.valley[0]; out[1] = C.valley[1]; out[2] = C.valley[2];
  mixInto(out, C.valleyLight, smoothstep(-0.2, 0.6, patch) * 0.6);
  mixInto(out, C.slope, smoothstep(-6, 4, h) * (1 - smoothstep(20, 29, h)) * smoothstep(0.04, 0.16, slope));
  const plat = smoothstep(22, 31, h);
  if (plat > 0) {
    const pc: RGB = [C.plateau[0], C.plateau[1], C.plateau[2]];
    mixInto(pc, C.plateauGold, smoothstep(0.0, 0.6, patch) * 0.75);
    mixInto(pc, C.valley, smoothstep(0.0, -0.5, patch) * 0.6);
    mixInto(out, pc, plat);
  }
  // mottle so the colour never reads as one flat sheet
  const k = 0.93 + mottle * 0.07;
  out[0] *= k; out[1] *= k; out[2] *= k;
  // gravel bars in the river corridor (darker where wet)
  const rm = riverMask(x, z);
  if (rm > 0) {
    const g = rm * smoothstep(-8.2, -9.2, h);
    mixInto(out, C.gravel, g);
    mixInto(out, C.gravelWet, g * smoothstep(-9.9, -10.4, h));
  }
  // the brook bed and the trails: packed dirt
  const td = t.trailDistance(x, z);
  mixInto(out, C.dirt, smoothstep(3.6 + cn.get(x * 0.2, z * 0.2) * 0.8, 1.2, td) * 0.85);
  // rock on the steep faces (the Crags, the gully walls, the waterfall head, Eagle Rock)
  const rock = smoothstep(0.22, 0.45, slope + (h > 40 ? 0.08 : 0));
  if (rock > 0) { const rc: RGB = [C.rock[0], C.rock[1], C.rock[2]]; mixInto(rc, C.rockLight, smoothstep(-0.3, 0.5, mottle + patch * 0.5)); mixInto(out, rc, rock); }
  // snow above the line, holding on the flatter ledges
  const snow = smoothstep(SNOW_LINE - 2 + patch * 4, SNOW_LINE + 3 + patch * 4, h) * (1 - smoothstep(0.45, 0.7, slope) * 0.7);
  mixInto(out, C.snow, snow);
  return out;
}

export const NALATI_GRASSLANDS: ChunkDef = {
  id: 'chunk://local/nalati-grasslands',
  slug: 'nalati-grasslands',
  displayName: 'Nalati Grasslands',
  gridCoords: '(+4, −2)',
  seed: SEED,
  treeCount: 1600,
  biome: 'Alpine steppe',
  experimental: true,
  blurb: 'SUPER EXPERIMENTAL — the Tian Shan steppe, painted: cross the braided Kunes, climb the spruce escarpment and the Sky Grassland opens up, rolling on to the snow mountains. Built live, rough edges everywhere.',
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
          { azimuth: 180, spread: 80, height: 98, rough: 0.05 },    // south: the plateau rolls on, a touch above slab height
          { azimuth: 135, spread: 35, height: 108, rough: 0.12 },   // SE / SW shoulders
          { azimuth: 225, spread: 35, height: 96, rough: 0.08 },
          { azimuth: 0, spread: 50, height: 40, rough: 0.1 },       // north: the far valley side, low
          { azimuth: 90, spread: 18, height: 125, rough: 0.35 },    // east: the gorge walls either side of the Kunes
          { azimuth: 62, spread: 14, height: 95, rough: 0.3 },
          { azimuth: 270, spread: 45, height: 8, rough: 0 },        // west: the valley opens flat toward the Ili
        ],
      },
      // mid: the brown-green Avral range (N), green foothills (S), the gorge's mountains (E)
      {
        r: 1500, base: -150, floor: -150, color: [0.08, 0.14, 0.06], top: [0.26, 0.3, 0.12], snowLine: 0.9, haze: 0.12,
        bands: [
          { azimuth: 0, spread: 60, height: 300, rough: 0.55 },
          { azimuth: 180, spread: 70, height: 250, rough: 0.35 },
          { azimuth: 90, spread: 30, height: 320, rough: 0.6 },
          { azimuth: 270, spread: 40, height: 40, rough: 0.1 },
        ],
      },
      // far: the Nalati range, big and white across the whole south; lower blue ranges round the rest
      {
        r: 2450, base: -200, floor: -200, color: [0.08, 0.11, 0.17], top: [0.2, 0.23, 0.31], snowLine: 0.5, haze: 0.2,
        bands: [
          { azimuth: 180, spread: 95, height: 720, rough: 0.9 },
          { azimuth: 125, spread: 40, height: 560, rough: 0.9 },
          { azimuth: 235, spread: 40, height: 520, rough: 0.9 },
          { azimuth: 20, spread: 70, height: 380, rough: 0.7 },
          { azimuth: 300, spread: 30, height: 170, rough: 0.5 },
        ],
      },
    ],
  },
  groundColor,

  terrain: TERRAIN,

  // the painterly terrain loads none of these (it paints itself); they satisfy the PBR contract
  assets: {
    groundLayers: ['leafy_grass', 'stony_dirt_path', 'rock_ground', 'forest_ground_04'],
    groundTints: [[0.7, 0.85, 0.5], [0.9, 0.84, 0.66], [0.7, 0.7, 0.72], [0.95, 0.95, 0.95]],
    slabRock: 'rock_ground',
  },
  // Tian Shan spruce in the three gullies + a few on the north faces (src/world/Spruce.ts, src/world/spruceMask.ts); the
  // tint multiplies the painted colours, so it stays near-white
  trees: { factory: 'spruce', bark: 'pine_bark', twigAtlas: 'pine_tree_01', noun: 'spruces' },
  forest: {
    spacing: 4.2,
    densityFreq: 0.01,
    clearings: [-2, -1.5], // never a "grove" by the density noise: the spruce mask decides
    maxSlope: 0.6,
    tintHue: 0.3, tintHueJitter: [-0.06, 0.06], tintSat: [0.05, 0.25], tintLight: [0.8, 0.95],
    largeVariantChance: 0.15,
    mask: spruceMask({ gullies: NALATI_GULLIES, normalAt: TERRAIN.normalAt, seed: SEED }),
  },
  fauna: [], // wolves, horses and sheep: the creatures agent (B4)
  sky: {
    hdri: 'kloofendal_48d_partly_cloudy_puresky', // unused: the sky is painted (below)
    painted: { zenith: [0.1, 0.28, 0.85], horizon: [0.62, 0.78, 0.98], ground: [0.3, 0.36, 0.3], glow: [1.0, 0.82, 0.55] },
    sun: { azimuth: 250, elevation: 26 },
    sunColor: [1.0, 0.9, 0.74],
    sunIntensity: 2.4,
    envIntensity: 0.6,
    bgIntensity: 1.0,
    fogSunColor: [1.0, 0.88, 0.7],
    cloudSunColor: [1.0, 0.93, 0.82],
    hemiSky: 0x9cc4ff, hemiGround: 0x5a6a2e, hemiIntensity: 0.5,
    // the ringed giant high in the SSW over the snow range — ahead and to the right from the spawn, lit from the WSW sun
    planet: { azimuth: 205, elevation: 23, size: 26, tilt: 16, roll: -20 },
  },
  atmosphere: {
    fogHeight: -30.0,
    fogHeightFalloff: 0.05,
    fogHeightDensity: 0.0006,
    fogDistDensity: 0.0003,
    volumetricSunColor: [1.0, 0.9, 0.72],
    // thin, high: a clear mountain afternoon (the default forest haze sits exactly on the valley floor and milks it out)
    volumetric: { height: -30, falloff: 0.06, density: 0.0009, strength: 0.35 },
  },
  grade: {
    saturation: 0.42, brightness: 0.0, contrast: 0.14,
    bloomIntensity: 0.25, bloomThreshold: 0.92,
    shadowTint: [0.9, 0.96, 1.1], highTint: [1.05, 1.01, 0.94],
    lift: [0.0, 0.004, 0.018], gain: [1.02, 1.02, 1.0], gamma: 1.0,
  },
  spawn: SPAWN,
};
