import LAYOUT from '../data/layout.generated.json' with { type: 'json' };

type XZ = [number, number];

// Keep the authored shared roads and pool cell in one JSON intake.
LAYOUT.SPURS['den'] = LAYOUT.DEN_TRAIL;
LAYOUT.SPURS['lookout'] = LAYOUT.LOOKOUT_TRAIL;
LAYOUT.GRADED.paths[0] = LAYOUT.LOOKOUT_TRAIL;

/** Exact native ridge-foot profile shared by runtime and author placements. */
export function ridgeFootZ(x: number): number {
  // the foot bows south around the pond's waterfall (x ≈ −85) and north over the pass (x ≈ 0)
  return 164 + 6 * Math.sin(x * 0.021 + 0.7) + 4 * Math.sin(x * 0.053) - 12 * Math.exp(-(((x + 86) / 34) ** 2)) + 8 * Math.exp(-((x / 40) ** 2));
}

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
  const sDam = arcTo(LAYOUT.CREEK, LAYOUT.BEAVER_DAM.at), sEnd = arcTo(LAYOUT.CREEK, LAYOUT.CREEK.length - 1), P = LAYOUT.BEAVER_POOL, rEnd = P.riffle + P.slope;
  if (s <= P.riffle - 4) return LAYOUT.CREEK_BED.outlet;
  if (s <= P.riffle) return LAYOUT.CREEK_BED.outlet + (P.crest - LAYOUT.CREEK_BED.outlet) * ((s - P.riffle + 4) / 4);   // up the riffle
  if (s <= rEnd) return P.crest + (P.bed - P.crest) * ((s - P.riffle) / P.slope);                         // down into the pool
  if (s <= sDam) return P.bed + (LAYOUT.CREEK_BED.sill - P.bed) * ((s - rEnd) / (sDam - rEnd));                   // on to the sluice
  if (s <= sDam + 3) return LAYOUT.CREEK_BED.sill + (LAYOUT.CREEK_BED.afterDam - LAYOUT.CREEK_BED.sill) * ((s - sDam) / 3);
  return LAYOUT.CREEK_BED.afterDam + (LAYOUT.CREEK_BED.edge - LAYOUT.CREEK_BED.afterDam) * ((s - sDam - 3) / (sEnd - sDam - 3));
}

// ── the water on the creek (PH-L9) ──────────────────────────────────────────────────────────────────────────────────
/*
 * The creek's water surface along its arc length `s`, for the ribbon PineStreams.ts draws and for the
 * player / animals (`streamAt` in the terrain: wading, the dry-ground test); its flow and foam are the bake's
 * (../generators/streams.ts). Upstream of the riffle the outlet is the
 * pond (its level), then the beaver pool to the dam (BEAVER_POOL: its own mesh, src/shards/pine-hollow/world/beaverPool.ts); through the
 * sluice a thin sheet runs, down the dam's face it runs fast and white, and from the toe it is a clear 0.45 m run falling
 * with the bed. The surface never rises downstream (the max of two falling profiles).
 */
/** depth over the bed in the run, the sheet over the crest, flow speeds (m/s) in the run / down the dam's face, how far
 *  before the crest the ribbon starts, and the half-width of the wetted strip the physics asks about */
const S_DAM = arcTo(LAYOUT.CREEK, LAYOUT.BEAVER_DAM.at), S_END = arcTo(LAYOUT.CREEK, LAYOUT.CREEK.length - 1);
/** the dam's crest and the creek's end (arc lengths) */
export function creekSpan(): { dam: number; end: number } { return { dam: S_DAM, end: S_END }; }
/** the creek's water surface at arc length `s`: the pond's level to the riffle, then the beaver pool's (or, drained, the
 *  trickle a few cm over its bed) to the dam */
export function creekSurfaceAt(s: number): number {
  if (s < LAYOUT.BEAVER_POOL.riffle) return LAYOUT.POND.level;
  if (s < S_DAM - LAYOUT.CREEK_WATER.lead) return Math.max(LAYOUT.beaverPoolLevel.y, creekBedAt(s) + 0.05);
  if (s <= S_DAM) return creekBedAt(s) + LAYOUT.CREEK_WATER.crest;
  const run = LAYOUT.CREEK_BED.afterDam + (LAYOUT.CREEK_BED.edge - LAYOUT.CREEK_BED.afterDam) * ((s - S_DAM - 3) / (S_END - S_DAM - 3)) + LAYOUT.CREEK_WATER.depth;
  return Math.max(creekBedAt(s) + LAYOUT.CREEK_WATER.crest, run);
}
// ── the beaver pool (E322 F-L6) ──────────────────────────────────────────────────────────────────────────────────────
/** the pool's reach, riffle crest to the dam's upstream face (the pond's surface mesh leaves it to the pool's own) */
export function inBeaverPool(x: number, z: number): boolean {
  const n = nearestOnPolyline(LAYOUT.CREEK, x, z);
  return n.d < 12 && n.s >= LAYOUT.BEAVER_POOL.riffle && n.s <= S_DAM - LAYOUT.CREEK_WATER.lead;
}
/** the running water's surface at (x, z), or null off the creek: the terrain's `streamAt` (wading, the dry test) */
export function creekWaterAt(x: number, z: number): number | null {
  const n = nearestOnPolyline(LAYOUT.CREEK, x, z);
  return n.d <= LAYOUT.CREEK_WATER.halfWidth ? creekSurfaceAt(n.s) : null;
}
