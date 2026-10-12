/**
 * Pine Hollow world layout v2 — Map D, layout A "the ridge north" (project/archive/2026-09-25-pine-hollow-remaster.md §2 B1 / §4, Jake's
 * pick: art/pine-hollow/round-1-map/A-ridge-north.jpg). Every coordinate of the shard as plain data with no runtime imports, so the
 * chunk def (src/shards/pine-hollow/manifest.ts), the placers, the fauna and the walk check (scripts/pine-hollow-walkcheck.mjs) read
 * one source. No Pine Hollow position is hard-coded anywhere else.
 *
 * ── Axis convention (verified in code, 2026-09-24) ──────────────────────────────────────────────────────────────────
 * Origin at the slab centre, ±250 m. **+z = NORTH, +x = WEST, −x = EAST.**
 *   · src/engine/ui/HUD.ts `bearingTo` / the compass band: heading = 180 − yaw°, 0 = north = +Z, 90 = east = −X.
 *   · src/engine/ui/Minimap.ts paints u = HALF − x (east → right), v = HALF − z (north → up).
 *   · ShardManifest.spawn: yaw π faces +Z, the compass' north. `yaw` faces (−sin yaw, −cos yaw) in x / z.
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
/** the three log cabins (src/engine/world/Cabin.ts builds one per site) — none moved in v2, two renamed (see CABIN_NAMES) */
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
/** the beaver dam: across the creek where it leaves the pond's water square, its sluice at the bed (index into CREEK) */
export const BEAVER_DAM = { x: -138, z: 64, at: 2 };
/**
 * The beaver pool (E322 F-L6, Jake's pick "Local pool"): the dam's own small pool on the creek between a gravel riffle at
 * the pond's outlet and the dam. Full, the dam backs it up to the pond's level (one sheet of water over the riffle); with
 * the sluice open (`open:dam-sluice`) it drains to a muddy bed, the pond's outflow a trickle over the riffle, down the bed
 * and out through the sluice. The pond (its level, the canoe, the islet) is untouched: the riffle's crest holds it.
 * Arc lengths on CREEK: the riffle's crest `riffle`, the pool's middle `centre` ± `half`. Across: a mud flat `width` m
 * each side at the middle (narrowing to the ends, rising `flat` per m), then a bank rising `bank` per m. Heights: the bed
 * at the riffle's crest `crest`, `bed` where the riffle's back slope ends (`riffle` + `slope`), the sluice's floor =
 * CREEK_BED.sill; the water `full` → `drained` (the thin film left in the channel before the sluice).
 */
export const BEAVER_POOL = {
  riffle: 16, slope: 7, centre: 24.5, half: 8.5, width: 5.5, flat: 0.08, bank: 0.4,
  crest: POND.level - 0.05, bed: POND.level - 0.62, full: POND.level, drained: POND.level - 0.68,
};
/** the pool's water level now: `full` until the sluice opens, then falling to `drained` (src/shards/pine-hollow/world/beaverPool.ts sets it
 *  from the quest flag, so a reload with the sluice open starts drained). The one piece of run-time state in this file:
 *  the creek's `streamAt` (wading, swimming, the animals' dry test) reads it. */
export const beaverPoolLevel = { y: BEAVER_POOL.full };
/** creek bed: half-width of the flat bed, bank slope (rise / run, ~31°), bed height at the outlet, the sluice's floor under
 *  the dam (the pool drains to it), the toe below the dam and the south edge */
export const CREEK_BED = { half: 2.6, bank: 0.6, outlet: POND.level - 0.45, sill: POND.level - 0.8, afterDam: POND.level - 1.3, edge: -9 };
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


/** Native creek depth, flow, ribbon and query widths. */
export const CREEK_WATER = { depth: 0.45, crest: 0.1, run: 0.55, dam: 2.4, lead: 1.0, halfWidth: 6 };
