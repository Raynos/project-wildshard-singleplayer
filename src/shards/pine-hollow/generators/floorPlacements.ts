import type { NativeTerrainSource } from '@wildshard/sdk/bake/terrain';
import { PineSeedStream as Rng } from './seedStream';
import { Noise2D, smoothstep, lerp } from './floorNoise';
import { pineCragQueries } from './cragGround';
import { ridgeFootZ, nearestOnPolyline } from '../behaviour/layout';
import { OLD_GROWTH, RIDGE, ZIPLINE, POND, HAMLET, KINGS_CLEARING, LOOKOUT, DEN, BEAR_CAVE, CREEK, WATERFALL, CREEK_BRIDGE } from '../data/layout';

interface Tree { readonly x: number; readonly z: number; readonly r: number }
export interface UnderPlacement { x: number; y: number; z: number; nx: number; ny: number; nz: number; rot: number; scale: number; r: number; g: number; b: number }
const kinds = ['ferns', 'shrubs', 'litter', 'stones', 'moss', 'reeds'] as const;
export type UnderPlacements = Record<(typeof kinds)[number], UnderPlacement[]>;
type Placement = UnderPlacement;
const FERN_MAX = 6000, SHRUB_MAX = 1500, LITTER_MAX = 5000, STONE_MAX = 3000, MOSS_MAX = 3000, REED_MAX = 1500;
type Kind = 'fern' | 'shrub' | 'litter' | 'stone' | 'moss' | 'reed';
/** 0 → 1 inside the old-growth's soft ellipse */
function oldGrowthMask(x: number, z: number): number {
  const e = Math.hypot((x - OLD_GROWTH.x) / OLD_GROWTH.ax, (z - OLD_GROWTH.z) / OLD_GROWTH.az);
  return smoothstep(1.0, 0.72, e);
}

/** the ridge's rise at (x, z): 0 at its foot → 1 at the crest and on to the north edge, cut by the pass, faded toward the Den */
function ridgeWeight(x: number, z: number): number {
  const u = (z - ridgeFootZ(x)) / RIDGE.climb;
  if (u <= 0) return 0;
  const west = smoothstep(RIDGE.westFade[1], RIDGE.westFade[0], x);
  const pass = smoothstep(RIDGE.passHalf, RIDGE.passOpen, Math.abs(x));
  return smoothstep(0, 1, u) * west * pass;
}

/** metres from (x, z) to the zipline's ground track */
function ziplineDistance(x: number, z: number): number {
  return nearestOnPolyline([[ZIPLINE.from.x, ZIPLINE.from.z], [ZIPLINE.to.x, ZIPLINE.to.z]], x, z).d;
}

/** E143: the keep multiplier on the whole forest (the look loop's was 1, with the Hollow grove's × 2.4 on top) */
const FOREST_KEEP = 0.7;

/**
 * Forest keep multiplier (ChunkForest.density): the old-growth nearly solid, the ridge's crags sparse; bare (0: no tree,
 * no undergrowth) on the hamlet's pad, the King's arena, the lookout's pad and the Den's floor; the creek, the zipline's
 * cut, the waterfall's foot and the footbridge keep their ferns but lose their trees.
 */
function forestDensity(x: number, z: number): number {
  if (Math.hypot(x - HAMLET.x, z - HAMLET.z) < HAMLET.r + 6) return 0;
  if (Math.hypot(x - KINGS_CLEARING.x, z - KINGS_CLEARING.z) < KINGS_CLEARING.clear) return 0;
  if (Math.hypot(x - LOOKOUT.x, z - LOOKOUT.z) < LOOKOUT.r + 5) return 0;
  if (Math.hypot(x - DEN.x, z - DEN.z) < 14 || Math.hypot(x - BEAR_CAVE.x, z - BEAR_CAVE.z) < 9) return 0;
  if (nearestOnPolyline(CREEK, x, z).d < 7 || ziplineDistance(x, z) < ZIPLINE.corridor) return 0.02;
  if (Math.hypot(x - WATERFALL.foot.x, z - WATERFALL.foot.z) < 10 || Math.hypot(x - CREEK_BRIDGE.x, z - CREEK_BRIDGE.z) < 10) return 0.02;
  // E143 (Jake: "way too many trees … green, green, green foliage" — a hunting shard needs sight lines): the whole shard at
  // FOREST_KEEP of the look loop's forest and the old-growth × 1.6, not × 4 (which saturated its 8.5 m grid into a wall),
  // and no Hollow grove (PH-L1 round 2's × 2.4 and its second grid): paths, clearings and animals at 40–80 m read again
  return FOREST_KEEP * (1 + oldGrowthMask(x, z) * 0.6) * (1 - smoothstep(0.3, 0.9, ridgeWeight(x, z)) * 0.6);
}


/** Original candidate and colour stream over authored ground and trunks. */
export function* pineFloorPlacements(trees: readonly Tree[], source: NativeTerrainSource): Generator<void, UnderPlacements, undefined> {
  const rng = new Rng(1337 + 77);
  const cluster = new Noise2D(1337 + 78);
  const ferns: Placement[] = [], shrubs: Placement[] = [], litter: Placement[] = [], stones: Placement[] = [], moss: Placement[] = [], reeds: Placement[] = [];
  const half = 250 - 8;
  const wl = POND.level;
  const { heightAt, normalAt, splatAt } = source;
  const { trailDistance, cabinMask } = pineCragQueries(source);
  const pondNoise = new Noise2D(1337);
  const pondMask = (x: number, z: number): number => smoothstep(POND.r + 10, POND.r * 0.3, Math.hypot(x - POND.x, z - POND.z) + pondNoise.get(x * 0.05, z * 0.05) * 3);
  const cells = new Map<string, Tree[]>();
  for (const tree of trees) { const key = `${Math.floor(tree.x / 16)},${Math.floor(tree.z / 16)}`; const row = cells.get(key) ?? []; row.push(tree); cells.set(key, row); }
  const grid = { nearby: (x: number, z: number, radius: number): Tree[] => {
    const out: Tree[] = [], cx = Math.floor(x / 16), cz = Math.floor(z / 16);
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) for (const tree of cells.get(`${cx+i},${cz+j}`) ?? []) if (Math.hypot(tree.x-x,tree.z-z) < radius+tree.r+3) out.push(tree);
    return out;
  } };
  const bare = forestDensity;
  const fernK = 1, shrubK = 2.5;
  /** the tests: pure, no rng — so a candidate's outcome is the one bit the log keeps */
  const accepts = (kind: Kind, x: number, z: number): boolean => {
    if (Math.abs(x) > 242 || Math.abs(z) > 242) return false;
    if (kind !== 'reed' && bare(x, z) <= 0) return false; // a bare pad (ChunkForest.density = 0)
    const td = trailDistance(x, z);
    const pm = pondMask(x, z);
    const y = heightAt(x, z);
    const depth = wl - y;                       // > 0 under water
    if (kind === 'reed') {
      if (depth < -0.55 || depth > 0.35 || pm < 0.05) return false;
    } else {
      if (depth > -0.1) return false;              // nothing else grows in the water
      if (td < (kind === 'litter' || kind === 'stone' ? 3 : 5.5)) return false;
      if (cabinMask(x, z) > 0.02) return false;
    }
    const c = cluster.fbm(x * 0.02 + (kind === 'shrub' ? 40 : 0), z * 0.02, 3);
    const verge = td < 10 || (pm > 0.03 && depth < -0.1);   // trail edge or pond rim: ferns like it here
    if (kind === 'fern' && c < 0.12 && !verge) return false;
    if (kind === 'shrub' && c < -0.1) return false;
    // the grid lookups first, the tree query (the expensive one) last
    const nrm = normalAt(x, z, 0.8);
    if (nrm[1] < (kind === 'moss' ? 0.7 : 0.8)) return false;
    const [f, g, r, t] = splatAt(x, z);
    if (r > (kind === 'stone' || kind === 'moss' ? 0.6 : 0.25)) return false;
    if (kind === 'fern' && f < 0.55 && !(verge && t < 0.5 && f + g > 0.4)) return false;
    if (kind === 'shrub' && f + g < 0.6) return false;
    if (kind === 'litter' && f < 0.5) return false;
    if (kind === 'stone' && f + r < 0.5) return false;
    const near = grid.nearby(x, z, 12);
    let canopy = 0, trunkD = 1e9;
    for (const tr of near) { const d = Math.hypot(tr.x - x, tr.z - z); if (d < tr.r + (kind === 'moss' ? 0.1 : 0.45)) return false; if (d < 12) canopy++; trunkD = Math.min(trunkD, d - tr.r); }
    if (kind === 'fern' && canopy < 2 && !verge) return false;
    if ((kind === 'litter' || kind === 'stone') && canopy < 1) return false;
    if (kind === 'moss' && trunkD > 2.2) return false;
    return true;
  };
  const tryPlace = (kind: Kind, x: number, z: number) => {
    if (!accepts(kind, x, z)) return;
    // a kept candidate: what the tests computed about it, again (pure functions of x, z — the same numbers)
    const y = heightAt(x, z);
    const depth = wl - y;
    const nrm = normalAt(x, z, 0.8);
    const hue = rng.next();
    const base = { x, y, z, nx: nrm[0], ny: nrm[1], nz: nrm[2], rot: rng.range(0, Math.PI * 2) };
    if (kind === 'fern') {
      const c = cluster.fbm(x * 0.02, z * 0.02, 3);
      const scale = rng.range(0.9, 1.6) * (0.8 + 0.2 * smoothstep(0, 0.5, c));
      ferns.push({ ...base, y: y - 0.02, scale, r: lerp(0.5, 0.78, hue), g: lerp(0.72, 0.82, hue), b: lerp(0.48, 0.6, hue) });
    } else if (kind === 'shrub') {
      shrubs.push({ ...base, y: y - 0.03, scale: rng.range(0.8, 1.5), r: lerp(0.8, 1.0, hue), g: lerp(0.9, 0.8, hue), b: lerp(0.6, 0.55, hue) });
    } else if (kind === 'litter') {
      litter.push({ ...base, y: y + 0.06, scale: rng.range(0.8, 1.5), r: lerp(0.7, 0.9, hue), g: lerp(0.68, 0.82, hue), b: lerp(0.62, 0.75, hue) });
    } else if (kind === 'stone') {
      stones.push({ ...base, y: y + 0.06, scale: rng.range(0.6, 1.3), r: lerp(0.75, 1.0, hue), g: lerp(0.75, 0.98, hue), b: lerp(0.75, 0.95, hue) });
    } else if (kind === 'moss') {
      moss.push({ ...base, y: y + 0.05, scale: rng.range(0.7, 1.6), r: lerp(0.6, 0.85, hue), g: lerp(0.62, 0.78, hue), b: lerp(0.5, 0.62, hue) });
    } else {
      reeds.push({ ...base, y: y - 0.05, scale: rng.range(0.8, 1.2) * (depth > 0 ? 1.1 : 1), r: lerp(0.75, 1.0, hue), g: lerp(0.85, 0.95, hue), b: lerp(0.45, 0.6, hue) });
    }
  };
  const anywhere = (kind: Kind) => tryPlace(kind, rng.range(-half, half), rng.range(-half, half));
  for (let i = 0; i < 30000 * fernK && ferns.length < FERN_MAX * fernK * 0.7; i++) anywhere('fern');
  yield;
  // trail verges + pond rim: sample near the trails / pond directly so the verge fills up
  for (let i = 0; i < 12000 * fernK && ferns.length < FERN_MAX * fernK; i++) {
    if (rng.next() < 0.75) {
      const x = rng.range(-half, half), z = rng.range(-half, half);
      tryPlace('fern', x, z);
    } else {
      const a = rng.range(0, Math.PI * 2), d = POND.r + rng.range(-4, 14);
      tryPlace('fern', POND.x + Math.cos(a) * d, POND.z + Math.sin(a) * d);
    }
  }
  yield;
  for (let i = 0; i < 9000 * shrubK && shrubs.length < SHRUB_MAX * shrubK; i++) anywhere('shrub');
  yield;
  for (let i = 0; i < 18000 && litter.length < LITTER_MAX; i++) anywhere('litter');
  yield;
  for (let i = 0; i < 12000 && stones.length < STONE_MAX; i++) anywhere('stone');
  yield;
  // moss: sample right at the trunks
  for (let i = 0; i < 14000 && moss.length < MOSS_MAX; i++) {
    const t = rng.pick(trees);
    const a = rng.range(0, Math.PI * 2), d = t.r + rng.range(0.15, 1.6);
    tryPlace('moss', t.x + Math.cos(a) * d, t.z + Math.sin(a) * d);
  }
  yield;
  for (let i = 0; i < 40000 && reeds.length < REED_MAX; i++) {
    const a = rng.range(0, Math.PI * 2), d = rng.range(POND.r * 0.3, POND.r + 10);
    tryPlace('reed', POND.x + Math.cos(a) * d, POND.z + Math.sin(a) * d);
  }
  return { ferns, shrubs, litter, stones, moss, reeds };
}

