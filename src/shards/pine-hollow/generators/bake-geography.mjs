import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import { byteWriter, jsonBytes } from '../../../../scripts/bake-output.mjs';
import { PineSeedStream } from './seedStream.ts';
import { forestDensity, oldGrowthMask, speciesMix } from './forestGeography.ts';
import { creekSpan } from './geography.ts';
import LAYOUT from '../data/layout.generated.json' with { type: 'json' };
import TERRAIN from '../data/terrainBindings.json' with { type: 'json' };
import { streamSurface } from '@wildshard/format/populationEnvironment';
import { Noise2D } from './floorNoise.ts';

const manifest = JSON.parse(readFileSync(new URL('../manifest.json', import.meta.url), 'utf8'));
const speciesIds = manifest.forest.speciesTraits.map(row => row.id);

/** Sample the exact jittered candidate lattice, retaining every double. */
export function pineGeography() {
  const rng = new PineSeedStream(manifest.seed + 99), cell = manifest.forest.spacing, forest = [];
  for (let x = -244; x < 244; x += cell) for (let z = -244; z < 244; z += cell) {
    const px = x + rng.range(-cell * 0.45, cell * 0.45), pz = z + rng.range(-cell * 0.45, cell * 0.45);
    forest.push({ x: px, z: pz, density: forestDensity(px, pz), scale: 1 + oldGrowthMask(px, pz) * 0.25, species: speciesMix(px, pz, speciesIds) });
  }
  const lines = []; let arc = 0;
  for (let i = 0; i + 1 < LAYOUT.CREEK.length; i++) {
    const a = LAYOUT.CREEK[i], b = LAYOUT.CREEK[i + 1]; if (a === undefined || b === undefined) throw new Error('Missing creek vertex');
    const vx = b[0] - a[0], vz = b[1] - a[1], l2 = vx * vx + vz * vz, length = Math.sqrt(l2);
    lines.push({ x: a[0], z: a[1], vx, vz, l2, length, arc }); arc += length;
  }
  const { dam, end } = creekSpan(), p = LAYOUT.BEAVER_POOL, b = LAYOUT.CREEK_BED;
  const segment = (until, start, offset, size, from, to) => ({ until, start, offset, span: size, from, to });
  const run = segment(end, dam, 3, end - dam - 3, b.afterDam, b.edge);
  const { lead, crest, depth, halfWidth } = LAYOUT.CREEK_WATER;
  const bed = [
    segment(p.riffle - 4, 0, 0, 1, b.outlet, b.outlet),
    segment(p.riffle, p.riffle, -4, 4, b.outlet, p.crest),
    segment(p.riffle + p.slope, p.riffle, 0, p.slope, p.crest, p.bed),
    segment(dam, p.riffle + p.slope, 0, dam - (p.riffle + p.slope), p.bed, b.sill),
    segment(dam + 3, dam, 0, 3, b.sill, b.afterDam),
  ];
  const line = ({ from, to, start, offset, span }) => ({ from, to, start, offset, span });
  const bedProfile = { pieces: bed.map(row => ({ until: row.until, line: line(row) })), last: line(run) };
  const constant = height => ({ pieces: [], last: { from: height, to: height, start: 0, offset: 0, span: 1 } });
  const value = (profile, add = 0) => ({ profile, add });
  const stream = { lines, halfWidth, bands: [
    { until: p.riffle, inclusive: false, values: [value(constant(LAYOUT.POND.level))] },
    { until: dam-lead, inclusive: false, values: [{ ...value(constant(p.full)), level: 'pool' }, value(bedProfile, .05)] },
    { until: dam, inclusive: true, values: [value(bedProfile, crest)] },
  ], last: [value(bedProfile, crest), value({ pieces: [], last: line(run) }, depth)] };
  return { forest, stream, creek: { lines, dam, riffle: p.riffle, lead, crest, depth, halfWidth, run, bed } };
}

/** G4: the beaver pool's reach as a declared clip (game `declaredStreamClip`): within 12 m of the creek, riffle to dam face */
export function pondClip(geography = pineGeography()) {
  const { lines, riffle, dam, lead } = geography.creek;
  return { lines, within: 12, from: riffle, to: dam - lead };
}

/** the beaver pool's live water level (world/beaverPool.ts publishes it) */
export const POOL_LEVEL = 'pine-hollow.beaver-pool';

/**
 * G4: Pine's declared ground rows (game `declaredGround`): its baked terrain by key and seed, the four mandated roads and
 * every spur (den and lookout under their own trails, in the authored order), the cabin pads, the pond and its level, and
 * its water as rows: the pond basin traced where the terrain's pond mask is wet, and the creek as a stream sampled along its
 * baked lines at its own surface law (the beaver pool at its level), every band and profile break included.
 */
export function pineGround(geography = pineGeography()) {
  const spurs = { ...LAYOUT.SPURS }; spurs.den = LAYOUT.DEN_TRAIL; spurs.lookout = LAYOUT.LOOKOUT_TRAIL;
  const trails = [LAYOUT.S_ROAD, LAYOUT.N_ROAD, LAYOUT.W_ROAD, LAYOUT.E_ROAD, ...Object.values(spurs)];
  const pond = { x: LAYOUT.POND.x, z: LAYOUT.POND.z, r: LAYOUT.POND.r }, noise = new Noise2D(TERRAIN.seed);
  // the basin's edge: the radius where the mask (smoothstep(r + 10, 0.3 r, d + 3 n)) first reaches 0, at 64 bearings
  const wet = (x, z) => Math.hypot(x - pond.x, z - pond.z) + noise.get(x * 0.05, z * 0.05) * 3 < pond.r + 10;
  const basin = Array.from({ length: 64 }, (_, i) => {
    const a = i / 64 * Math.PI * 2, ux = Math.cos(a), uz = Math.sin(a);
    let lo = 0, hi = pond.r + 14;
    for (let k = 0; k < 40; k++) { const mid = (lo + hi) / 2; if (wet(pond.x + ux * mid, pond.z + uz * mid)) lo = mid; else hi = mid; }
    return [pond.x + ux * lo, pond.z + uz * lo];
  });
  const { stream, creek } = geography, pool = LAYOUT.beaverPoolLevel.y, end = creek.lines.at(-1);
  if (end === undefined) throw new Error('Missing creek line');
  // a declared stream's banks stay inside the cell: the creek is cut where its centre comes within half its width of the edge
  const edge = 250 - creek.halfWidth, at = arc => { const line = creek.lines.find(row => arc <= row.arc + row.length) ?? end, t = line.length === 0 ? 0 : (arc - line.arc) / line.length; return { line, x: line.x + line.vx * t, z: line.z + line.vz * t }; };
  let total = end.arc + end.length;
  if (creek.lines.some(row => Math.max(Math.abs(row.x + row.vx), Math.abs(row.z + row.vz)) > edge)) {
    let lo = 0, hi = total;
    for (let k = 0; k < 60; k++) { const mid = (lo + hi) / 2, p = at(mid); if (Math.max(Math.abs(p.x), Math.abs(p.z)) <= edge) lo = mid; else hi = mid; }
    total = lo;
  }
  const breaks = new Set([0, total]);
  for (const line of creek.lines) breaks.add(line.arc);
  // a band edge is a step: a point 2 cm on its own side of it keeps the step sharp
  for (const band of stream.bands) { breaks.add(band.until); breaks.add(band.until + (band.inclusive ? 0.02 : -0.02)); }
  for (const piece of creek.bed) { breaks.add(piece.until); breaks.add(piece.start); }
  const step = total / 96;
  for (let arc = 0; arc < total; arc += step) breaks.add(arc);
  const arcs = [...breaks].filter(arc => arc >= 0 && arc <= total).sort((a, b) => a - b);
  if (arcs.length > 128) throw new Error(`Creek stream needs ${arcs.length} points (at most 128)`);
  // the beaver pool's stretch rests on its bed floor under the live pool level (BeaverPool publishes it as it drains)
  const points = arcs.map(arc => {
    const p = at(arc), full = streamSurface(stream, arc, { pool }), dry = streamSurface(stream, arc, { pool: -250 });
    return full === dry ? { x: p.x, z: p.z, level: full } : { x: p.x, z: p.z, level: dry, under: POOL_LEVEL };
  });
  return { terrain: { key: TERRAIN.key, seed: TERRAIN.seed }, trails, cabinSites: LAYOUT.CABIN_SITES, pond, water: LAYOUT.POND.level,
    bodies: [{ id: 'pond', kind: 'pool', level: LAYOUT.POND.level, shape: { kind: 'polygon', points: basin } },
      { id: 'creek', kind: 'stream', width: creek.halfWidth * 2, points, levels: { [POOL_LEVEL]: pool } }] };
}

if (import.meta.main) {
  const writer = byteWriter(process.argv.includes('--check'), 'pine-geography'), geography = pineGeography();
  writer.put(fileURLToPath(new URL('../data/geography.generated.json', import.meta.url)), jsonBytes(geography, 0));
  writer.put(fileURLToPath(new URL('../data/ground.generated.json', import.meta.url)), jsonBytes(pineGround(geography), 0));
  writer.put(fileURLToPath(new URL('../data/pondClip.generated.json', import.meta.url)), jsonBytes(pondClip(geography), 0));
  writer.finish();
}
