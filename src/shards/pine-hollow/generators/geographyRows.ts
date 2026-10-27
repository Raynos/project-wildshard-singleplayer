import { pineForestRows, PINE_DENSITY_FILE } from './forestRows';
import { creekSpan, inBeaverPool } from './geography';
import * as LAYOUT from './layout';
import TERRAIN from '../data/terrainBindings.json' with { type: 'json' };
import manifest from '../manifest.json' with { type: 'json' };
import { Noise2D } from './floorNoise';

/** One straight run of the creek's centreline, with its arc length from the source. */
interface CreekLine { x: number; z: number; vx: number; vz: number; l2: number; length: number; arc: number }
/** One linear piece of a profile: `from` at `start + offset`, `to` a `span` later. */
interface ProfileLine { from: number; to: number; start: number; offset: number; span: number }
/** A piecewise profile: its first piece that reaches `along`, else `last`. */
interface Profile { pieces: { until: number; line: ProfileLine }[]; last: ProfileLine }
/** A surface term: a profile plus a lift, or a named live level. */
interface SurfaceValue { profile: Profile; add: number; level?: string }
/** A bed piece (its reach and its line). */
interface BedPiece extends ProfileLine { until: number }

/** The creek's ordered piecewise profile at `along` (its first piece that reaches there, else the last). */
function streamProfile(source: Profile, along: number): number {
  const row = source.pieces.find(piece => along <= piece.until)?.line ?? source.last;
  return row.from + (row.to - row.from) * ((along - row.start - row.offset) / row.span);
}
/** The creek's surface along its arc: the highest of its band's values, a value naming a live `level` reading that one. */
function streamSurface(source: { bands: { until: number; inclusive: boolean; values: SurfaceValue[] }[]; last: SurfaceValue[] }, along: number, levels: Readonly<Record<string, number>> = {}): number {
  const values = source.bands.find(row => row.inclusive ? along <= row.until : along < row.until)?.values ?? source.last;
  let result = -Infinity;
  for (const entry of values) {
    const live = entry.level === undefined ? undefined : levels[entry.level];
    if (live !== undefined && !Number.isFinite(live)) throw new Error('Invalid live water level');
    result = Math.max(result, (live ?? streamProfile(entry.profile, along)) + entry.add);
  }
  return result;
}

/** Sample the exact jittered candidate lattice, retaining every double (the retired bake-geography.mjs `pineGeography`). */
function pineGeography() {
  const forest = pineForestRows(manifest);
  const lines: CreekLine[] = []; let arc = 0;
  for (let i = 0; i + 1 < LAYOUT.CREEK.length; i++) {
    const a = LAYOUT.CREEK[i], b = LAYOUT.CREEK[i + 1]; if (a === undefined || b === undefined) throw new Error('Missing creek vertex');
    const [ax, az] = a, [bx, bz] = b;
    const vx = bx - ax, vz = bz - az, l2 = vx * vx + vz * vz, length = Math.sqrt(l2);
    lines.push({ x: ax, z: az, vx, vz, l2, length, arc }); arc += length;
  }
  const { dam, end } = creekSpan(), p = LAYOUT.BEAVER_POOL, b = LAYOUT.CREEK_BED;
  const segment = (until: number, start: number, offset: number, size: number, from: number, to: number): BedPiece => ({ until, start, offset, span: size, from, to });
  const run = segment(end, dam, 3, end - dam - 3, b.afterDam, b.edge);
  const { lead, crest, depth, halfWidth } = LAYOUT.CREEK_WATER;
  const bed = [
    segment(p.riffle - 4, 0, 0, 1, b.outlet, b.outlet),
    segment(p.riffle, p.riffle, -4, 4, b.outlet, p.crest),
    segment(p.riffle + p.slope, p.riffle, 0, p.slope, p.crest, p.bed),
    segment(dam, p.riffle + p.slope, 0, dam - (p.riffle + p.slope), p.bed, b.sill),
    segment(dam + 3, dam, 0, 3, b.sill, b.afterDam),
  ];
  const line = ({ from, to, start, offset, span }: BedPiece): ProfileLine => ({ from, to, start, offset, span });
  const bedProfile: Profile = { pieces: bed.map(row => ({ until: row.until, line: line(row) })), last: line(run) };
  const constant = (height: number): Profile => ({ pieces: [], last: { from: height, to: height, start: 0, offset: 0, span: 1 } });
  const value = (profile: Profile, add = 0): SurfaceValue => ({ profile, add });
  const stream = { lines, halfWidth, bands: [
    { until: p.riffle, inclusive: false, values: [value(constant(LAYOUT.POND.level))] },
    { until: dam - lead, inclusive: false, values: [{ ...value(constant(p.full)), level: 'pool' }, value(bedProfile, .05)] },
    { until: dam, inclusive: true, values: [value(bedProfile, crest)] },
  ], last: [value(bedProfile, crest), value({ pieces: [], last: line(run) }, depth)] };
  return { forest, stream, creek: { lines, dam, riffle: p.riffle, lead, crest, depth, halfWidth, run, bed } };
}

/** G4: the beaver pool's reach as a declared clip (game `declaredPondClip`): the pond grid's cells whose centre lies in the
 *  beaver pool (within 12 m of the creek, riffle to dam face); the pool draws them instead. */
function pondClip(): { x0: number; z0: number; cell: number; segs: number; cells: number[] } {
  const half = LAYOUT.POND.r + 15, segs = 128, cell = (half * 2) / segs, x0 = LAYOUT.POND.x - half, z0 = LAYOUT.POND.z - half, cells: number[] = [];
  for (let j = 0; j < segs; j++) for (let i = 0; i < segs; i++) {
    if (inBeaverPool(LAYOUT.POND.x - half + (i + 0.5) * cell, LAYOUT.POND.z - half + (j + 0.5) * cell)) cells.push(j * segs + i);
  }
  return { x0, z0, cell, segs, cells };
}

/** the beaver pool's live water level (world/beaverPool.ts publishes it) */
export const POOL_LEVEL = 'pine-hollow.beaver-pool';

/** G4: Pine's declared ground rows (game `declaredGround`): its baked terrain by key and seed, the four mandated roads and
 *  every spur, the cabin pads, the pond and its level, and its water as rows (the pond basin where the pond mask is wet, the
 *  creek sampled along its lines at its own surface law, the beaver pool at its level). */
function pineGround(geography: ReturnType<typeof pineGeography>) {
  const spurs: Record<string, typeof LAYOUT.DEN_TRAIL> = { ...LAYOUT.SPURS }; spurs['den'] = LAYOUT.DEN_TRAIL; spurs['lookout'] = LAYOUT.LOOKOUT_TRAIL;
  const trails = [LAYOUT.S_ROAD, LAYOUT.N_ROAD, LAYOUT.W_ROAD, LAYOUT.E_ROAD, ...Object.values(spurs)];
  const pond = { x: LAYOUT.POND.x, z: LAYOUT.POND.z, r: LAYOUT.POND.r }, noise = new Noise2D(TERRAIN.seed);
  // the basin's edge: the radius where the mask (smoothstep(r + 10, 0.3 r, d + 3 n)) first reaches 0, at 64 bearings
  const wet = (x: number, z: number): boolean => Math.hypot(x - pond.x, z - pond.z) + noise.get(x * 0.05, z * 0.05) * 3 < pond.r + 10;
  const basin = Array.from({ length: 64 }, (_, i): [number, number] => {
    const a = i / 64 * Math.PI * 2, ux = Math.cos(a), uz = Math.sin(a);
    let lo = 0, hi = pond.r + 14;
    for (let k = 0; k < 40; k++) { const mid = (lo + hi) / 2; if (wet(pond.x + ux * mid, pond.z + uz * mid)) lo = mid; else hi = mid; }
    return [pond.x + ux * lo, pond.z + uz * lo];
  });
  const { stream, creek } = geography, pool = LAYOUT.beaverPoolLevel.y, end = creek.lines.at(-1);
  if (end === undefined) throw new Error('Missing creek line');
  // a declared stream's banks stay inside the cell: the creek is cut where its centre comes within half its width of the edge
  const edge = 250 - creek.halfWidth, at = (arc: number) => {
    const row = creek.lines.find(candidate => arc <= candidate.arc + candidate.length) ?? end, t = row.length === 0 ? 0 : (arc - row.arc) / row.length;
    return { x: row.x + row.vx * t, z: row.z + row.vz * t };
  };
  let total = end.arc + end.length;
  if (creek.lines.some(row => Math.max(Math.abs(row.x + row.vx), Math.abs(row.z + row.vz)) > edge)) {
    let lo = 0, hi = total;
    for (let k = 0; k < 60; k++) { const mid = (lo + hi) / 2, p = at(mid); if (Math.max(Math.abs(p.x), Math.abs(p.z)) <= edge) lo = mid; else hi = mid; }
    total = lo;
  }
  const breaks = new Set([0, total]);
  for (const row of creek.lines) breaks.add(row.arc);
  // a band edge is a step: a point 2 cm on its own side of it keeps the step sharp
  for (const band of stream.bands) { breaks.add(band.until); breaks.add(band.until + (band.inclusive ? 0.02 : -0.02)); }
  for (const piece of creek.bed) { breaks.add(piece.until); breaks.add(piece.start); }
  const step = total / 96;
  for (let arc = 0; arc < total; arc += step) breaks.add(arc);
  const arcs = [...breaks].filter(arc => arc >= 0 && arc <= total).sort((a, b) => a - b);
  if (arcs.length > 128) throw new Error(`Creek stream needs ${String(arcs.length)} points (at most 128)`);
  // the beaver pool's stretch rests on its bed floor under the live pool level (BeaverPool publishes it as it drains)
  const points = arcs.map(arc => {
    const p = at(arc), full = streamSurface(stream, arc, { pool }), dry = streamSurface(stream, arc, { pool: -250 });
    return full === dry ? { x: p.x, z: p.z, level: full } : { x: p.x, z: p.z, level: dry, under: POOL_LEVEL };
  });
  return { terrain: { key: TERRAIN.key, seed: TERRAIN.seed }, trails, cabinSites: LAYOUT.CABIN_SITES, pond, water: LAYOUT.POND.level,
    bodies: [{ id: 'pond', kind: 'pool', level: LAYOUT.POND.level, shape: { kind: 'polygon', points: basin } },
      { id: 'creek', kind: 'stream', width: creek.halfWidth * 2, points, levels: { [POOL_LEVEL]: pool } }] };
}

/** Pine's declared geography rows, computed in the program (the retired pine-geography job wrote them as
 *  data/geography.generated.json, ground.generated.json and pondClip.generated.json): the forest queries (candidates and
 *  the density channel the product names), the ground and the pond clip. */
function geographyRows() {
  const geography = pineGeography();
  return {
    forestQueries: { ...geography, forest: geography.forest.map(({ density: _density, ...row }) => row),
      density: { type: 'f64', count: geography.forest.length, data: { file: PINE_DENSITY_FILE } } },
    ground: pineGround(geography),
    pondClip: pondClip(),
  };
}
/** GR8 (G33b): Pine's declared geography rows (see `geographyRows`). */
export const pineGeographyRows: () => ReturnType<typeof geographyRows> = geographyRows;
