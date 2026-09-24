/**
 * Nalati world layout v2 — "the bowl and the snow ring" (docs/design/nalati/layout-v2.md, the user's pick: map 4,
 * art/nalati-grasslands/round-8-three-zones/map-4-bowl-ring.jpg). Every POI coordinate of the shard, as plain data with
 * NO imports, so the chunk def (src/chunks/nalati-grasslands.ts, which re-exports all of it), the POI clearings, the
 * placers and the fauna can read it at module init without an import cycle. No position is hard-coded anywhere else.
 *
 * Engine axes: origin at the slab centre, **+z = north, +x = WEST, −x = east**, ±250 m. Three zones:
 *   · Nalati Grasslands — the green valley in the north band (z > +125): the braided Kunes, the camp, the pasture
 *   · The Sky Grassland — the golden bowl (z +96 … −48, x ±205), floor +24 … +32, rims +35 … +45
 *   · Snow Lotus Valley + its mountains — the snow ring south + east (+ a west arm): crags to +110, the glacial valley
 *     from the bowl's south rim (+30) down to the S gate (0), the glacier tongue, the meltwater stream
 */

export type XZ = [number, number];

// ── the valley (north) ────────────────────────────────────────────────────────────────────────────────────────────

/** the Kunes water level */
export const RIVER_LEVEL = -10;
/** the Kunes' centreline z at x: flows east → west (toward +x) along the valley's south side, under the bridge (0, +172),
 *  meandering gently (it keeps well north of the escarpment's foot, so the climb to the rim is a slope, not a cliff) */
export function riverZAt(x: number): number {
  return 168 + 4 * Math.exp(-((x / 70) ** 2)) + 5 * Math.sin(x * 0.017) + 3 * Math.sin(x * 0.041 + 1.3) - 3 * Math.sin(1.3);
}
/** half-width of the braided gravel corridor at x (narrower at the bridge) */
export function riverHalfAt(x: number): number {
  const s = Math.min(1, Math.max(0, (Math.abs(x) - 8) / 52));
  return (15 + 3 * Math.sin(x * 0.009 + 2.1) + 2 * Math.sin(x * 0.031)) * (0.62 + 0.38 * s * s * (3 - 2 * s));
}
/** the timber bridge on the N road */
export const BRIDGE_XZ = { x: 0, z: riverZAt(0), deckY: -6 };
/** the spring camp (the hub: yurts, corral, hitching rail, TULPAR) and the fenced sheep pasture */
export const CAMP = { x: 88, z: 212, y: -8 };
export const PASTURE = { x: -120, z: 212, y: -8, r: 32 };

// ── the bowl (the Sky Grassland) ──────────────────────────────────────────────────────────────────────────────────

/** the bowl: a squircle round (x, z) with semi-axes ax / az; floor ≈ +27, rim ≈ +39 */
export const BOWL = { x: 0, z: 24, ax: 205, az: 72, floor: 27, rim: 39 };
/** the north rim line (the top of the escarpment above the valley) — z at x = RIM_N + a ±6 m wobble */
export const RIM_N = 96;
/** the sky road: five switchback legs from the bridge's south end up the escarpment (which is widest here: the rim bows
 *  south, `rimZAt`) to the rim (graded, ~13 %), then on to the ribboned gateway at the top (+120, +70) */
export const SKY_ROAD: XZ[] = [[0, 156], [4, 147], [56, 141], [60, 133], [8, 126], [4, 118], [56, 111], [60, 103], [12, 96], [10, 88], [44, 82], [70, 78], [96, 74], [120, 70]];
/** the index into SKY_ROAD where the graded climb reaches the rim */
export const SKY_ROAD_RIM = 11;
export const EAGLE_ROCK = { x: 180, z: 85, top: 65 };
export const HORSE_PLAINS = { x: 65, z: 36, r: 60 };
/** the kokpar field: an oval of trodden earth (semi-axes rx / rz, turned by rot) */
export const KOKPAR = { x: -61, z: 36, rx: 34, rz: 22, rot: 0.25 };
/** kurgan mounds; `great` = the Golden King's dungeon mound (B13) */
export const KURGANS: { x: number; z: number; r: number; h: number; great?: boolean }[] = [
  { x: -191, z: 75, r: 19, h: 6.5, great: true },
  { x: -92, z: 70, r: 8, h: 2.4 }, { x: -120, z: 94, r: 7, h: 2 }, { x: -98, z: 102, r: 9, h: 2.8 },
  { x: -132, z: 72, r: 6, h: 1.8 }, { x: -80, z: 90, r: 6.5, h: 2 }, { x: -114, z: 60, r: 7.5, h: 2.2 },
];
/** the great kurgan's doorway faces west (+x), toward the bowl and the sky road's gateway */
export const GREAT_KURGAN_DOOR = -Math.PI / 2;
export const SUMMER_YURTS = { x: -91, z: -26 };
/** the ruined watchtower on its rock on the east rim, above the snow ring */
export const WATCHTOWER = { x: -208, z: -38, y: 44 }; // (−214, −9) in the spec sat on the E road's levelled mouth
/** the Storm Titan's Wind Cairn on the bowl's south rim; the Titan stands beyond it over the snow valley */
export const CAIRN = { x: -30, z: -45, y: 34 };

// ── the snow ring + Snow Lotus Valley (south + east) ──────────────────────────────────────────────────────────────

export const SNOW_LINE = 55;
/** the east massif (the Crags: snow above +55, Argymaq's bench on its flank) and the west massif (the cave, snow lotus) */
export const CRAGS = { x: -180, z: -115, peak: 105 };
export const WEST_CRAGS = { x: 170, z: -130, peak: 95 };
/** Snow Lotus Valley: the floor's centre x at z, its floor half-width, the floor height (+31 at the head → 0 at the S gate) */
export function snowValleyX(z: number): number { return -12 + 8 * Math.sin(z * 0.02 + 1); }
export function snowValleyHalf(z: number): number { return 24 + 6 * Math.sin(z * 0.031 + 0.4); }
export function snowValleyFloor(z: number): number {
  const t = Math.min(1, Math.max(0, (-55 - z) / 190));
  return 31 * (1 - t) ** 1.15;
}
/** the glacier tongue: from the east crags (x0, z0, +y0) spilling west-south-west to its snout (x1, z1, +y1) at the
 *  valley's east side; `half` = its half-width */
export const GLACIER = { x0: -150, z0: -55, y0: 80, x1: -48, z1: -92, y1: 36, half: 24 };
/** the meltwater stream: from the glacier's snout across the valley head and down the valley floor to the S edge */
export const MELT_STREAM: XZ[] = [[-46, -94], [-34, -101], [-24, -113], [-18, -132], [-22, -156], [-16, -180], [-22, -205], [-27, -228], [-29, -250]];
/** Aqbars' cave on the west massif's north flank, the mouth facing north over the bowl (a `rot`: 0 faces −z; the spec's (+175, −98) was deep inside the massif) */
export const LEOPARD_CAVE = { x: 138, z: -68, y: 54, rot: Math.PI * 0.85 };
/** snow lotus clusters in the rocks: the biggest on the west massif's foot (the spec's (+143, −136) sits at +82 on the
 *  massif, out of reach — brought down to +60), the rest on Snow Lotus Valley's walls */
export const SNOW_LOTUS: { x: number; z: number; r: number; n: number }[] = [
  { x: 96, z: -112, r: 14, n: 22 }, { x: 60, z: -150, r: 10, n: 10 }, { x: 12, z: -104, r: 7, n: 6 },
  { x: -52, z: -142, r: 8, n: 7 }, { x: 18, z: -142, r: 7, n: 6 }, { x: -50, z: -182, r: 7, n: 5 },
];

// ── the elites' lairs (B12) ───────────────────────────────────────────────────────────────────────────────────────

/** Kokbori's den: the rocky NE corner of the rim above the kurgan field */
export const KOKBORI_DEN = { x: -172, z: 118 };
/** Qara Batyr's burial cairn on the south rim, west of the valley head */
export const QARA_CAIRN = { x: 82, z: -50 };
/** Argymaq's high pasture: a bench on the Crags' north flank (+52) */
export const ARGYMAQ_PASTURE = { x: -160, z: -72, y: 52 };

// ── the roads (the four mandated entry roads + the spurs) ─────────────────────────────────────────────────────────

export const N_ROAD_PTS: XZ[] = [[0, 250], [0, 190], [0, 156]];
export const S_ROAD_PTS: XZ[] = [[0, -250], [0, -190], [-4, -150], [-2, -110], [4, -76], [2, -50], [0, -20], [6, 12]];
export const W_ROAD_PTS: XZ[] = [[250, 0], [190, 0], [165, 12], [140, 40], [120, 70]];
export const E_ROAD_PTS: XZ[] = [[-250, 0], [-190, 0], [-166, 16], [-142, 42], [-118, 66]];
/** the camp spur: the N road → the camp's east mouth — north of its split-rail fence (RoadFurniture, to x = 60), then
 *  south of the hitching rail + its trough (NALATI-MERGE P4: its end ran into them at (CAMP.x − 17, CAMP.z)) */
export const CAMP_SPUR: XZ[] = [[0, 214], [40, 218], [62, 215.5], [CAMP.x - 14, CAMP.z - 5.5]];
/**
 * The footpaths up to the POIs whose ground climbs past the player's 40° (NALATI-MERGE P4): graded (`TerrainSpec.graded`:
 * the terrain cut and filled to ≤ 27° along each — under the 30° past which paths.ts lays walkway boards — and levelled
 * across as a bench) and tracks (gravel on the map and the ground). Each ends where its shelf meets the ground (≤ 5 cm),
 * so no step stands at the top.
 *   EAGLE_TRAIL    from the W road round the knoll's south-west flank onto its crest beside the tor, where the scramble
 *                  starts (the bench lifts the scramble's foot onto the crest: its first ten slabs lay buried under it,
 *                  3 m over the old foot)
 *   CAVE_TRAIL     from the bowl up the cave shelf's east side onto the flat south of Aqbars' cave (the porch is its
 *                  north-east face: round the cave's west wall)
 *   ARGYMAQ_TRAIL  from the bowl up the Crags' north flank in two long legs onto Argymaq's high pasture
 */
export const EAGLE_TRAIL: XZ[] = [[147, 33], [180, 44], [198, 58], [196, 70], [188, 73.8], [178, 73.4], [171.5, 77.5]];
export const CAVE_TRAIL: XZ[] = [[140, -40], [122, -48], [121, -64], [127, -71], [132, -73.5], [137, -73]];
export const ARGYMAQ_TRAIL: XZ[] = [[-166, -32], [-192, -42], [-168, -52], [-160, -60], [-156, -67]];
/** the bowl's tracks: the gateway → the horse plains → the kokpar field → the kurgans; the S road up to the kokpar */
export const BOWL_TRACKS: XZ[][] = [
  [[120, 70], [86, 54], [34, 40], [-26, 38]],
  [[6, 12], [-30, 26]],
  [[-96, 42], [-104, 60]],
];

/** a handful of lone spruces (the forest is cut): centres; the forest mask plants 1–3 trees within ~5 m of each */
export const LONE_SPRUCE: XZ[] = [[152, 126], [-62, 132], [206, 108], [-222, 44], [64, -66], [-44, -176], [34, -206], [196, -40], [-150, 128], [120, 132]];

/** the full map / minimap labels (read at runtime by name: src/ui/Map.ts, Minimap.ts) */
export const NALATI_MAP = {
  zones: [
    { label: 'NALATI GRASSLANDS', x: 30, z: 214 },
    { label: 'SKY GRASSLAND', x: 0, z: 58 },
    { label: 'SNOW LOTUS VALLEY', x: -8, z: -150 },
  ],
  pois: [
    { label: 'NOMAD CAMP', x: CAMP.x, z: CAMP.z },
    { label: 'SHEEP PASTURE', x: PASTURE.x, z: PASTURE.z },
    { label: 'BRIDGE', x: BRIDGE_XZ.x, z: BRIDGE_XZ.z },
    { label: 'KUNES RIVER', x: 150, z: riverZAt(150) },
    { label: 'SKY ROAD', x: 46, z: 128 },
    { label: 'EAGLE ROCK', x: EAGLE_ROCK.x, z: EAGLE_ROCK.z },
    { label: 'HORSE PLAINS', x: HORSE_PLAINS.x, z: HORSE_PLAINS.z },
    { label: 'KOKPAR FIELD', x: KOKPAR.x, z: KOKPAR.z },
    { label: 'KURGAN FIELD', x: -106, z: 83 },
    { label: 'GREAT KURGAN', x: -191, z: 75 },
    { label: 'SUMMER CAMP', x: SUMMER_YURTS.x, z: SUMMER_YURTS.z },
    { label: 'WATCHTOWER', x: WATCHTOWER.x, z: WATCHTOWER.z },
    { label: 'WIND CAIRN', x: CAIRN.x, z: CAIRN.z },
    { label: 'GLACIER', x: -82, z: -81 },
    { label: 'SNOW LEOPARD CAVE', x: LEOPARD_CAVE.x, z: LEOPARD_CAVE.z },
    { label: 'THE CRAGS', x: CRAGS.x, z: CRAGS.z },
    { label: 'SNOW LOTUS', x: 143, z: -136 },
  ],
};
