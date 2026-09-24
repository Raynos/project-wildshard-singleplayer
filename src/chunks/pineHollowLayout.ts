/**
 * Pine Hollow world layout v2 — Map D, layout A "the ridge north" (docs/plans/PINE-HOLLOW-REMASTER.md §2 B1 / §4, Jake's
 * pick: art/pine-hollow/round-1-map/A-ridge-north.jpg). Every coordinate of the shard as plain data with NO imports, so the
 * chunk def (src/chunks/pine-hollow.ts), the placers, the fauna and the walk check (scripts/pine-hollow-walkcheck.mjs) read
 * one source. No Pine Hollow position is hard-coded anywhere else.
 *
 * ── Axis convention (verified in code, 2026-09-24) ──────────────────────────────────────────────────────────────────
 * Origin at the slab centre, ±250 m. **+z = NORTH, +x = WEST, −x = EAST.**
 *   · src/ui/HUD.ts `bearingTo` / the compass band: heading = 180 − yaw°, 0 = north = +Z, 90 = east = −X.
 *   · src/ui/Minimap.ts paints u = HALF − x (east → right), v = HALF − z (north → up).
 *   · ChunkDef.spawn: yaw π faces +Z, the compass' north. `yaw` faces (−sin yaw, −cos yaw) in x / z.
 * So a map-A pixel (col, row) on the 1254² board maps to x = 250 − col·0.41, z = 250 − row·0.41 (≈, the board's own rim
 * trimmed). Today's names were written before anyone checked: the old "East cabin" at x = +62 is WEST of the crossroads
 * and the old "Bear den" at (−150, −150) was SOUTH-EAST. v2 renames / moves them to match the compass.
 *
 * ── Heights (metres, the pond's still water is the datum the rest keeps clear of) ───────────────────────────────────
 *   still pond −3 · creek bed −3.4 → −9 at the south edge · mill hamlet ≈ −0.5 · the Hollow +1 … +4 · old-growth +2 … +9 ·
 *   the Den's floor +9 · the ridge foot +4 → crags +40 … +55 · the pass +3 · the fire lookout's crag +42.
 * Everything a player stands on outside the pond basin and the creek bed stays above the pond's water line, so grass,
 * undergrowth and the animals' dry-ground test (all keyed on `waterLevel()`) treat only those two as water.
 */

export type XZ = [number, number];

// ── the Hollow (centre) ─────────────────────────────────────────────────────────────────────────────────────────────

/** the south-gate spawn: unchanged from v1 (the S entry road's inner end, facing north) */
export const SPAWN = { x: 0, z: -235, yaw: Math.PI };
/** where every path meets */
export const CROSSROADS = { x: 0, z: -10 };
/** the three log cabins (src/world/Cabin.ts builds one per site) — none moved in v2, two renamed (see CABIN_NAMES) */
export const CABIN_SITES: { x: number; z: number; rot: number }[] = [
  { x: -14, z: -34, rot: 0.35 },  // the ranger's cabin (v1 "Hollow cabin"): SE of the crossroads, as on map A
  { x: 62, z: 30, rot: -1.1 },    // the west cabin (v1 "East cabin" — it is west on the compass)
  { x: 118, z: 142, rot: 2.4 },   // the ridge cabin, at the ridge's foot on the way to the Den
];
export const CABIN_NAMES = ["Ranger's cabin", 'West cabin', 'Ridge cabin'] as const;

// ── the Ridge (the whole north edge) ────────────────────────────────────────────────────────────────────────────────

/**
 * The ridge massif: its southern foot runs at z = `ridgeFootZ(x)`, the crags climb `rise` m to the crest `climb` m
 * further north, and it spans x ∈ [east … west] (fading out toward the Den's corner past `westFade`). The N entry road
 * crosses it through a pass `passHalf` m wide (floor) that opens to full height by `passOpen`.
 */
export const RIDGE = { rise: 42, climb: 46, westFade: [150, 185] as [number, number], passHalf: 13, passOpen: 34, passFloor: 3 };
export function ridgeFootZ(x: number): number {
  // the foot bows south around the pond's waterfall (x ≈ −85) and north over the pass (x ≈ 0)
  return 164 + 6 * Math.sin(x * 0.021 + 0.7) + 4 * Math.sin(x * 0.053) - 12 * Math.exp(-(((x + 86) / 34) ** 2)) + 8 * Math.exp(-((x / 40) ** 2));
}
/** the fire-lookout tower's crag-top pad (on the pass's west shoulder, ≈ +42) */
export const LOOKOUT = { x: 36, z: 214, r: 7 };
/**
 * The lookout trail: from the den spur along the ridge's foot, then one long diagonal traverse east across the face to the
 * pad (≈ 25° off the contour, so the face's own grade along it stays ≤ 0.55 and the graded shelf barely cuts or fills).
 * No hairpins: at a sharp switchback the two legs' graded shelves meet on the bisector with a step, and a leg that climbs
 * the face head-on is graded as a half-cut / half-fill embankment that starts metres above the ground (physics-baseline
 * --trails got stuck on both in the first drafts).
 */
export const LOOKOUT_TRAIL: XZ[] = [[150, 142], [146, 158], [110, 178], [76, 196], [LOOKOUT.x, LOOKOUT.z]];
/** the zipline: from the lookout's deck (`top` above the pad) south to a landing platform in the Hollow, N of the crossroads */
export const ZIPLINE = { from: { x: LOOKOUT.x, z: LOOKOUT.z, deck: 11 }, to: { x: 4, z: 20, deck: 3 }, corridor: 5 };

// ── the Still pond, the waterfall, the creek ────────────────────────────────────────────────────────────────────────

/** the still pond (north-centre-east, at the ridge's foot): water level `level`, basin floor `floor` at its centre */
export const POND = { x: -100, z: 110, r: 30, level: -3, floor: -6 };
/** the islet (the canoe secret, PH-U22): a low wooded mound `top` m above the water */
export const ISLET = { x: -94, z: 118, r: 8, top: 1.4 };
/** the waterfall: the creek's head spills off the ridge at `lip` and falls into the pond at `foot` */
export const WATERFALL = { lip: { x: -86, z: 178, y: 30 }, foot: { x: -88, z: 146 } };
/** the stream on the ridge top that feeds the lip (a shallow channel, carved) */
export const RIDGE_STREAM: XZ[] = [[-70, 236], [-78, 214], [-84, 194], [WATERFALL.lip.x, WATERFALL.lip.z]];
/**
 * The creek: from the pond's SE outlet, over the beaver dam (the sill where it leaves the pond's water square), south-east
 * under the E road's footbridge, past the watermill and off the slab's south edge. Bed = `CREEK_BED` along it.
 */
export const CREEK: XZ[] = [
  [-118, 92], [-130, 76], [-138, 64], [-146, 38], [-151, 6], [-156, -24], [-170, -58], [-184, -92], [-192, -122],
  [-197, -150], [-204, -186], [-212, -220], [-218, -250],
];
/** the beaver dam: a sill at the pond's water line where the outlet leaves the pond (index into CREEK) */
export const BEAVER_DAM = { x: -138, z: 64, at: 2 };
/** creek bed: half-width of the flat bed, bank slope (rise / run, ~31°), bed height at the outlet and at the south edge */
export const CREEK_BED = { half: 2.6, bank: 0.6, outlet: POND.level - 0.45, sill: POND.level + 0.2, afterDam: POND.level - 1.0, edge: -9 };
/** the E road's footbridge over the creek */
export const CREEK_BRIDGE = { x: -151, z: -3 };

// ── the Den (NW corner) ─────────────────────────────────────────────────────────────────────────────────────────────

/** the Den: a rock-walled bowl in the NW corner; floor at `floor`, walls rise to `wall` behind (north and west) */
export const DEN = { x: 190, z: 186, r: 26, floor: 9, wall: 36 };
/** the bear cave's mouth, at the foot of the den's north-west wall, facing south-east toward the path (`rot`: yaw the mouth faces) */
export const BEAR_CAVE = { x: 200, z: 200, rot: Math.atan2(1, 1) }; // faces (−sin, −cos) = SE on the compass (−x, −z)

// ── the Old-growth (west) and the King's clearing ───────────────────────────────────────────────────────────────────

/** the old-growth: a soft-edged ellipse of dense giant forest over the west third */
export const OLD_GROWTH = { x: 150, z: -40, ax: 105, az: 175 };
/** the Antler King's clearing: flat to `r` (the boss arena), blending out by `blend`; empty of trees to `clear` */
export const KINGS_CLEARING = { x: 150, z: -30, r: 30, blend: 42, clear: 38 };
/** the standing stones: a broken ring round the arena (7 stones, a gap facing the path in from the north) */
export const STANDING_STONES: XZ[] = [0, 1, 2, 3, 4, 5, 6].map((i): XZ => {
  const a = Math.PI * 0.28 + i * ((Math.PI * 2 - Math.PI * 0.56) / 6);
  return [Math.round((KINGS_CLEARING.x + Math.sin(a) * 24) * 10) / 10, Math.round((KINGS_CLEARING.z + Math.cos(a) * 24) * 10) / 10];
});

// ── the Mill hamlet (SE) ────────────────────────────────────────────────────────────────────────────────────────────

/** the hamlet's flat pad on the creek's west bank (the creek's gully is carved after the pad, so the bank stays sharp) */
export const HAMLET = { x: -150, z: -138, r: 32, blend: 46 };
/** building sites (the asset lane builds them; `rot` = yaw the front door faces) */
export const HAMLET_SITES = {
  lodge: { x: -162, z: -118, rot: 2.6 },          // the hunting lodge (contract board)
  trader: { x: -126, z: -120, rot: 2.2 },
  miller: { x: -142, z: -162, rot: 0.0 },         // the miller's house
  mill: { x: -181, z: -144, rot: -1.6 },          // the watermill, its wheel in the creek at `wheel`
  wheel: { x: -191, z: -144 },
  shed: { x: -118, z: -150, rot: 1.2 },
};

// ── the roads (the four mandated entry roads first, then the spurs) ────────────────────────────────────────────────

export const S_ROAD: XZ[] = [[0, -250], [0, -190], [-8, -150], [-30, -95], [-22, -40], [CROSSROADS.x, CROSSROADS.z]];
export const N_ROAD: XZ[] = [[0, 250], [0, 190], [-2, 160], [2, 118], [4, 70], [ZIPLINE.to.x, ZIPLINE.to.z], [CROSSROADS.x, CROSSROADS.z]];
export const W_ROAD: XZ[] = [[250, 0], [190, 0], [162, 6], [120, 12], [84, 16], [58, 12], [28, -2], [CROSSROADS.x, CROSSROADS.z]];
export const E_ROAD: XZ[] = [[-250, 0], [-190, 0], [CREEK_BRIDGE.x, CREEK_BRIDGE.z], [-112, -12], [-62, -18], [-30, -14], [CROSSROADS.x, CROSSROADS.z]];
/** N road → NW, south of the ridge cabin (a stub to its porch), toward the Den (ends ~40 m short of its floor: bear country) */
export const DEN_TRAIL: XZ[] = [[4, 72], [40, 94], [82, 116], [104, 124], [126, 128], [150, 142], [168, 158]];
/** the spurs: every zone joined to the roads */
export const SPURS: Record<string, XZ[]> = {
  den: DEN_TRAIL,
  /** W road → south into the King's clearing, entering through the stones' gap */
  clearing: [[162, 6], [156, -4]],
  /** N road → east to the pond's west shore (the islet in view) and round to the waterfall's foot — ≥ 37 m from the pond's
   *  centre, above its water line (the shore dish reaches ~33 m) */
  pond: [[4, 76], [-30, 86], [-60, 98], [-63, 116], [-68, 134], [-78, 148]],
  /** E road → south down the creek's west bank to the hamlet */
  hamletN: [[-112, -12], [-128, -50], [-140, -88], [-148, -116]],
  /** S road → east to the hamlet */
  hamletW: [[-14, -122], [-58, -130], [-100, -138], [-128, -138]],
  /** the den spur → the ridge cabin's porch */
  ridgeCabin: [[112, 125], [114, 132]],
  /** the lookout trail (graded) */
  lookout: LOOKOUT_TRAIL,
};
/** the paths graded to a walkable profile (TerrainSpec.graded) and their max rise / run */
export const GRADED = { paths: [LOOKOUT_TRAIL], maxGrade: 0.55 };

// ── named places (the Explore pins, the compass-true names) ─────────────────────────────────────────────────────────

/** every POI (the Explore pins); `foot` = the spot the walk check (scripts/pine-hollow-walkcheck.mjs) must reach on foot
 *  from the spawn — the POI itself, or the shore / bank beside a water one — or null (the islet is the canoe secret) */
export const PINE_HOLLOW_POIS: { id: string; name: string; x: number; z: number; r: number; foot: XZ | null }[] = [
  { id: 'gate', name: 'South gate', x: SPAWN.x, z: SPAWN.z + 20, r: 18, foot: [SPAWN.x, SPAWN.z + 20] },
  { id: 'crossroads', name: 'Crossroads', x: CROSSROADS.x, z: CROSSROADS.z, r: 16, foot: [CROSSROADS.x, CROSSROADS.z] },
  { id: 'cabin-1', name: CABIN_NAMES[0], x: -14, z: -34, r: 12, foot: [-14, -34] },
  { id: 'cabin-2', name: CABIN_NAMES[1], x: 62, z: 30, r: 12, foot: [62, 30] },
  { id: 'cabin-3', name: CABIN_NAMES[2], x: 118, z: 142, r: 12, foot: [118, 142] },
  { id: 'zipline', name: 'Zipline landing', x: ZIPLINE.to.x, z: ZIPLINE.to.z, r: 10, foot: [ZIPLINE.to.x, ZIPLINE.to.z] },
  { id: 'lookout', name: 'Fire lookout', x: LOOKOUT.x, z: LOOKOUT.z, r: 16, foot: [LOOKOUT.x, LOOKOUT.z] },
  { id: 'pond', name: 'Still pond', x: POND.x, z: POND.z, r: 36, foot: [-64, 112] },
  { id: 'waterfall', name: 'Waterfall', x: WATERFALL.foot.x, z: WATERFALL.foot.z + 4, r: 18, foot: [-80, 150] },
  { id: 'islet', name: 'The islet', x: ISLET.x, z: ISLET.z, r: 10, foot: null },
  { id: 'dam', name: 'Beaver dam', x: BEAVER_DAM.x, z: BEAVER_DAM.z, r: 10, foot: [BEAVER_DAM.x + 7, BEAVER_DAM.z + 3] },
  { id: 'bridge', name: 'Creek bridge', x: CREEK_BRIDGE.x, z: CREEK_BRIDGE.z, r: 10, foot: [CREEK_BRIDGE.x + 7, CREEK_BRIDGE.z - 2] },
  { id: 'den', name: 'The Den', x: DEN.x, z: DEN.z, r: 26, foot: [DEN.x, DEN.z] },
  { id: 'cave', name: 'Bear cave', x: BEAR_CAVE.x, z: BEAR_CAVE.z, r: 12, foot: [BEAR_CAVE.x - 3, BEAR_CAVE.z - 3] },
  { id: 'clearing', name: "King's clearing", x: KINGS_CLEARING.x, z: KINGS_CLEARING.z, r: 34, foot: [KINGS_CLEARING.x, KINGS_CLEARING.z] },
  { id: 'hamlet', name: 'Mill hamlet', x: HAMLET.x, z: HAMLET.z, r: 40, foot: [HAMLET.x, HAMLET.z] },
  { id: 'lodge', name: 'Hunting lodge', x: HAMLET_SITES.lodge.x, z: HAMLET_SITES.lodge.z, r: 12, foot: [HAMLET_SITES.lodge.x, HAMLET_SITES.lodge.z] },
  { id: 'mill', name: 'Watermill', x: HAMLET_SITES.mill.x, z: HAMLET_SITES.mill.z, r: 12, foot: [HAMLET_SITES.mill.x, HAMLET_SITES.mill.z] },
];

/** the zone labels (the full map / minimap, and the §4 table) */
export const PINE_HOLLOW_ZONES: { label: string; x: number; z: number }[] = [
  { label: 'THE RIDGE', x: -10, z: 222 },
  { label: 'THE DEN', x: DEN.x, z: DEN.z },
  { label: 'THE OLD-GROWTH', x: OLD_GROWTH.x, z: -90 },
  { label: 'STILL POND', x: POND.x, z: POND.z },
  { label: 'THE HOLLOW', x: CROSSROADS.x, z: CROSSROADS.z + 20 },
  { label: 'MILL HAMLET', x: HAMLET.x, z: HAMLET.z },
];

// ── geometry helpers (pure) ─────────────────────────────────────────────────────────────────────────────────────────

/** distance from (x, z) to a polyline and the arc length `s` along it at the nearest point */
export function nearestOnPolyline(poly: readonly XZ[], x: number, z: number): { d: number; s: number } {
  let best = Infinity, bestS = 0, acc = 0;
  for (let i = 0; i + 1 < poly.length; i++) {
    const a = poly[i], b = poly[i + 1];
    if (!a || !b) continue;
    const vx = b[0] - a[0], vz = b[1] - a[1], l2 = vx * vx + vz * vz, l = Math.sqrt(l2);
    const t = l2 > 0 ? Math.min(1, Math.max(0, ((x - a[0]) * vx + (z - a[1]) * vz) / l2)) : 0;
    const d = Math.hypot(x - a[0] - vx * t, z - a[1] - vz * t);
    if (d < best) { best = d; bestS = acc + t * l; }
    acc += l;
  }
  return { d: best, s: bestS };
}

/** arc length of a polyline up to vertex `i` */
export function arcTo(poly: readonly XZ[], i: number): number {
  let acc = 0;
  for (let k = 0; k < i && k + 1 < poly.length; k++) { const a = poly[k], b = poly[k + 1]; if (a && b) acc += Math.hypot(b[0] - a[0], b[1] - a[1]); }
  return acc;
}

/** the creek's bed height at arc length `s` from the outlet: level in the outlet, the dam's sill, then a steady fall */
export function creekBedAt(s: number): number {
  const sDam = arcTo(CREEK, BEAVER_DAM.at), sEnd = arcTo(CREEK, CREEK.length - 1);
  if (s <= sDam - 4) return CREEK_BED.outlet;
  if (s <= sDam) return CREEK_BED.outlet + (CREEK_BED.sill - CREEK_BED.outlet) * ((s - sDam + 4) / 4);
  if (s <= sDam + 3) return CREEK_BED.sill + (CREEK_BED.afterDam - CREEK_BED.sill) * ((s - sDam) / 3);
  return CREEK_BED.afterDam + (CREEK_BED.edge - CREEK_BED.afterDam) * ((s - sDam - 3) / (sEnd - sDam - 3));
}

/** the zipline's cable height above y = 0 at the fraction `t` (0 = the lookout deck, 1 = the landing) — a straight chord */
export function ziplineAt(t: number, lookoutGround: number, landingGround: number): { x: number; z: number; y: number } {
  const { from, to } = ZIPLINE;
  return { x: from.x + (to.x - from.x) * t, z: from.z + (to.z - from.z) * t, y: (lookoutGround + from.deck) * (1 - t) + (landingGround + to.deck) * t };
}

// ── the water on the creek (PH-L9) ──────────────────────────────────────────────────────────────────────────────────
/*
 * The creek's water surface, flow and foam along its arc length `s`, for the ribbon PineStreams.ts draws and for the
 * player / animals (`streamAt` in the terrain: wading, the dry-ground test). Upstream of the dam's crest the outlet is the
 * pond (its level); over the crest a thin sheet spills, down the dam's face it runs fast and white, and from the toe it is
 * a clear 0.45 m run falling with the bed. The surface never rises downstream (the max of two falling profiles).
 */
/** depth over the bed in the run, the sheet over the crest, flow speeds (m/s) in the run / down the dam's face, how far
 *  before the crest the ribbon starts, and the half-width of the wetted strip the physics asks about */
export const CREEK_WATER = { depth: 0.45, crest: 0.1, run: 0.55, dam: 2.4, lead: 1.5, halfWidth: 6 };
const S_DAM = arcTo(CREEK, BEAVER_DAM.at), S_END = arcTo(CREEK, CREEK.length - 1);
/** the dam's crest and the creek's end (arc lengths) */
export function creekSpan(): { dam: number; end: number } { return { dam: S_DAM, end: S_END }; }
const sstep = (a: number, b: number, v: number): number => { const t = Math.min(1, Math.max(0, (v - a) / (b - a))); return t * t * (3 - 2 * t); };
/** the creek's water surface at arc length `s` */
export function creekSurfaceAt(s: number): number {
  if (s < S_DAM - CREEK_WATER.lead) return POND.level;
  if (s <= S_DAM) return creekBedAt(s) + CREEK_WATER.crest;
  const run = CREEK_BED.afterDam + (CREEK_BED.edge - CREEK_BED.afterDam) * ((s - S_DAM - 3) / (S_END - S_DAM - 3)) + CREEK_WATER.depth;
  return Math.max(creekBedAt(s) + CREEK_WATER.crest, run);
}
/** flow speed (m/s): quick over the crest and down the dam's face, a gentle run after */
export function creekFlowAt(s: number): number {
  return CREEK_WATER.run + (CREEK_WATER.dam - CREEK_WATER.run) * sstep(S_DAM - 1.5, S_DAM, s) * (1 - sstep(S_DAM + 2.5, S_DAM + 6, s));
}
/** white water 0..1: the dam's face, a tail of foam drifting off it, a few bubbles in the run */
export function creekFoamAt(s: number): number {
  const face = sstep(S_DAM - 0.6, S_DAM + 0.4, s) * (1 - sstep(S_DAM + 2.5, S_DAM + 5, s));
  const tail = sstep(S_DAM, S_DAM + 1, s) * (1 - sstep(S_DAM + 3, S_DAM + 14, s));
  return Math.max(0.06, 0.72 * face, 0.3 * tail);
}
/** the running water's surface at (x, z), or null off the creek: the terrain's `streamAt` (wading, the dry test) */
export function creekWaterAt(x: number, z: number): number | null {
  const n = nearestOnPolyline(CREEK, x, z);
  return n.d <= CREEK_WATER.halfWidth ? creekSurfaceAt(n.s) : null;
}
