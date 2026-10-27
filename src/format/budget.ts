import { CONTENT_CAPS as C } from '@wildshard/format/contentBounds';
import { contentCost } from '@wildshard/format/contentCost';
import type { Shardfile } from '@wildshard/format/shardSchema';
import { NEAR_PLACEHOLDER_LIMITS, nearPlaceholderCost } from '@wildshard/format/nearPlaceholder';

/** Category resident targets are tradeable warnings; only the complete playing/loading totals refuse memory. */
export function memoryTargetWarnings(shard: Shardfile): { category: string; bytes: number; target: number }[] {
  const warnings: { category: string; bytes: number; target: number }[] = [];
  const check = (category: string, bytes: number, target: number): void => {
    if (bytes > target) warnings.push({ category, bytes, target });
  };
  check('library', shard.budgets.library.resident, C.library.resident);
  check('simulation', shard.budgets.sim.resident, C.sim.resident);
  check('overlap', shard.budgets.overlap, C.overlap);
  check('server simulation', shard.serverBudget.memory, C.sim.resident);
  for (const tile of shard.tiles) check(`tile ${tile.lod}/${tile.x}/${tile.z}`, tile.decoded + tile.gpu, (tile.lod === 0 ? C.l0 : C.l1).resident);
  if (shard.far !== null) check('far', shard.far.decoded + shard.far.gpu, C.far.resident);
  return warnings;
}

/**
 * Each L0 tile's resident bytes beyond what the shard's library already charges: a tile whose files the library holds
 * (Nine Dragon draws its whole L0 city from its library) is charged once there, never again as a resident tile. A
 * tile's declared bytes less its library files' bytes, never below zero; other tiles are unchanged.
 */
function ownTileBytes(shard: Shardfile): (tile: Shardfile['tiles'][number]) => number {
  const files = new Map(shard.files.map(file => [file.hash, file]));
  const closure = (roots: readonly string[]): Set<string> => {
    const seen = new Set<string>(), pending = [...roots];
    for (let ref = pending.pop(); ref !== undefined; ref = pending.pop()) if (!seen.has(ref)) { seen.add(ref); pending.push(...files.get(ref)?.dependencies ?? []); }
    return seen;
  };
  const library = closure(shard.library);
  return tile => {
    let shared = 0;
    if (library.size > 0) for (const ref of closure(tile.files)) {
      const file = library.has(ref) ? files.get(ref) : undefined;
      if (file !== undefined) shared += file.decoded + file.gpu;
    }
    return Math.max(0, tile.decoded + tile.gpu - shared);
  };
}

const distance2 = (x: number, z: number, x0: number, z0: number, x1: number, z1: number): number => {
  const dx = Math.max(x0 - x, x - x1, 0), dz = Math.max(z0 - z, z - z1, 0); return dx * dx + dz * dz;
};
type LocationCost = ReturnType<typeof contentCost> & { location: [number, number] };
const GRID_STEP = 5;
const RADIUS2 = (C.nearRadius + Math.SQRT2 * GRID_STEP / 2) ** 2;

/** One synthetic-neighbour model of the location cost: `accounted` alone (no allocation, the worst-disc scan's hot loop)
 *  and the whole `cost`. `playing` never falls as `accounted` rises, so a location whose accounted bytes do not exceed
 *  the worst found so far cannot beat it. */
interface LocationModel {
  /** the three synthetic neighbour cells' centres this model charges */
  neighbours: readonly (readonly [number, number])[];
  /** accounted bytes that do not depend on the location (everything but L0 and libraries) */
  fixed: number;
  cost: (x: number, z: number) => LocationCost;
}

function locationModels(shard: Shardfile, commons: number): LocationModel[] {
  const bytesOf = ownTileBytes(shard), own = shard.tiles.filter(tile => tile.lod === 0).map(tile => {
    const bounds = tile.drawBounds ?? tile.bounds;
    return { x0: bounds.min[0], z0: bounds.min[2], x1: bounds.max[0], z1: bounds.max[2], bytes: bytesOf(tile) };
  });
  const coarseExcess = shard.tiles.filter(tile => tile.lod === 1).reduce((sum, tile) => sum + Math.max(0, tile.decoded + tile.gpu - C.l1.resident), 0);
  const models: LocationModel[] = [];
  const nearBytes = shard.near === undefined ? 0 : nearPlaceholderCost(shard.near, shard).total.resident +
    (NEAR_PLACEHOLDER_LIMITS.cells - 1) * (NEAR_PLACEHOLDER_LIMITS.terrainBytes + NEAR_PLACEHOLDER_LIMITS.contentBytes);
  const l1 = C.l1Count * C.l1.resident + coarseExcess, far = (C.farCount - 1) * C.far.resident + (shard.far === null ? 0 : shard.far.decoded + shard.far.gpu);
  const sims = Math.max(shard.budgets.sim.resident, shard.serverBudget.memory) + 3 * C.sim.resident, overlap = Math.max(C.overlap, shard.budgets.overlap);
  // each neighbour's 8 x 8 synthetic tiles by column and row (the tile at column i, row j spans x0 ... x0 + 62.5)
  const edges = (centre: number): Float64Array => Float64Array.from({ length: 8 }, (_, i) => centre - 250 + i * 62.5);
  const dx2 = new Float64Array(8), dz2 = new Float64Array(8);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const neighbours = ([[sx * C.pitch, 0], [0, sz * C.pitch], [sx * C.pitch, sz * C.pitch]] as const).map(([cx, cz]) => ({ cx, cz, xs: edges(cx), zs: edges(cz) }));
    // the last location's library bytes, beside its returned l0 (no object a location)
    let libraries = 0;
    const l0At = (x: number, z: number): number => {
      let active = 0;
      for (const { cx, cz } of neighbours) if (distance2(x, z, cx - 250, cz - 250, cx + 250, cz + 250) <= RADIUS2) active++;
      const ownActive = distance2(x, z, -250, -250, 250, 250) <= RADIUS2;
      // Eight heading lookahead slots charged at target, even when the project is empty.
      let l0 = 8 * C.l0.resident;
      for (const tile of own) if (distance2(x, z, tile.x0, tile.z0, tile.x1, tile.z1) <= RADIUS2) l0 += tile.bytes;
      for (const { xs, zs } of neighbours) {
        for (let i = 0; i < 8; i++) { const a = xs[i] ?? 0, d = Math.max(a - x, x - (a + 62.5), 0); dx2[i] = d * d; }
        for (let j = 0; j < 8; j++) { const a = zs[j] ?? 0, d = Math.max(a - z, z - (a + 62.5), 0); dz2[j] = d * d; }
        for (let j = 0; j < 8; j++) for (let i = 0; i < 8; i++) if ((dx2[i] ?? 0) + (dz2[j] ?? 0) <= RADIUS2) l0 += C.l0.resident;
      }
      libraries = (ownActive ? shard.budgets.library.resident : 0) + active * C.library.resident;
      return l0;
    };
    models.push({
      neighbours: neighbours.map(({ cx, cz }) => [cx, cz] as const), fixed: l1 + far + sims + commons + nearBytes,
      cost: (x, z) => {
        const l0 = l0At(x, z);
        return { ...contentCost({ l0, l1, far, libraries, sims, commons, near: nearBytes, overlap }), location: [x, z] };
      },
    });
  }
  return models;
}

/** Conservative total around an actual player location, using the same neighbour assumptions as admission. */
export function nearbyContentCost(shard: Shardfile, x: number, z: number, commons = 0): LocationCost {
  if (![x, z, commons].every(Number.isFinite) || commons < 0) throw new Error('Invalid memory estimate location');
  let worst: LocationCost = { playing: 0, loading: 0, accounted: 0, location: [x, z] };
  for (const model of locationModels(shard, commons)) { const cost = model.cost(x, z); if (cost.playing > worst.playing) worst = cost; }
  return worst;
}

const worstCache = new Map<string, LocationCost>();
/** A synthetic neighbour cell's per-location grids (how many of its 8 x 8 target tiles, and whether the cell, lie within
 *  near radius) depend on its offset alone, never the shard: built once a page, not per admission (a phone-4x Nine
 *  drive rebuilt all eight, 512 tile sweeps, for each product it admitted). */
const syntheticCells = new Map<string, { l0: Uint8Array; active: Uint8Array }>();

/** Worst disc with three synthetic neighbours at the platform targets; grid padding covers unsampled gaps. */
export function worstContentCost(shard: Shardfile, commons = 0): LocationCost {
  const steps = worstContentCostSteps(shard, commons);
  for (;;) { const step = steps.next(); if (step.done === true) return step.value; }
}

/** `worstContentCost` in steps, one per own tile and synthetic neighbour tile the grids sum, then one per scanned row:
 *  a live admission paints between them (Pine's activation spent ~90 ms of a frame in this scan at 4x CPU). */
export function* worstContentCostSteps(shard: Shardfile, commons = 0): Generator<void, LocationCost> {
  const bytesOf = ownTileBytes(shard);
  const key = JSON.stringify([shard.tiles.map(tile => [tile.lod, bytesOf(tile), (tile.drawBounds ?? tile.bounds).min[0], (tile.drawBounds ?? tile.bounds).min[2], (tile.drawBounds ?? tile.bounds).max[0], (tile.drawBounds ?? tile.bounds).max[2]]), shard.far === null ? null : [shard.far.decoded, shard.far.gpu], shard.budgets.library.resident, shard.budgets.sim.resident, shard.budgets.overlap, shard.serverBudget.memory, commons,
    shard.near === undefined ? 0 : nearPlaceholderCost(shard.near, shard).total.resident]);
  const cached = worstCache.get(key);
  if (cached !== undefined) return { ...cached, location: [...cached.location] };
  let worst: LocationCost = { playing: 0, loading: 0, accounted: 0, location: [0, 0] };
  // O14: the scan's ~51k locations sum their accounted bytes from per-location grids built once (own tiles, each
  // synthetic neighbour cell's tiles); only a location whose bytes exceed the worst so far gets its whole cost (all
  // bytes are naturals, so the sums are exact in any order and `playing` never falls as they rise)
  const steps: number[] = []; for (let v = -280; v <= 280; v += GRID_STEP) steps.push(v);
  const n = steps.length, at = (xi: number, zi: number): number => xi * n + zi;
  const square = (lo: number, hi: number, v: number): number => { const d = Math.max(lo - v, v - hi, 0); return d * d; };
  // One scratch row shared by every near() call. Cells retain their original
  // column/row order; circular cross-sections avoid rejected inner-loop cells.
  const dx = new Float64Array(n);
  // Only the index window within the radius of a box (one step of margin; the exact test below decides) is visited: a
  // tile far off this grid costs a few comparisons, not n x n.
  const reach = Math.sqrt(RADIUS2), first = steps[0] ?? 0;
  const below = (v: number): number => Math.max(0, Math.floor((v - reach - first) / GRID_STEP) - 1);
  const above = (v: number): number => Math.min(n - 1, Math.ceil((v + reach - first) / GRID_STEP) + 1);
  const near = (x0: number, z0: number, x1: number, z1: number, cells: Float64Array | Uint8Array, add: number, set = false): void => {
    const xa = below(x0), xb = above(x1), za = below(z0), zb = above(z1);
    for (let i = xa; i <= xb; i++) dx[i] = square(x0, x1, steps[i] ?? 0);
    for (let xi = xa; xi <= xb; xi++) {
      const ex = dx[xi] ?? 0; if (ex > RADIUS2) continue;
      // A box's circular cross-section is one contiguous interval in z.
      // Round outwards with one grid step, then use the original predicate
      // at both ends so floating-point boundary membership stays exact.
      const radius = Math.sqrt(RADIUS2 - ex);
      let lo = Math.max(za, Math.ceil((z0 - radius - first) / GRID_STEP) - 1);
      let hi = Math.min(zb, Math.floor((z1 + radius - first) / GRID_STEP) + 1);
      while (lo <= hi && ex + square(z0, z1, steps[lo] ?? 0) > RADIUS2) lo++;
      while (hi >= lo && ex + square(z0, z1, steps[hi] ?? 0) > RADIUS2) hi--;
      if (lo > hi) continue;
      const start = at(xi, lo), end = at(xi, hi) + 1;
      if (set) cells.fill(add, start, end);
      else for (let cell = start; cell < end; cell++) cells[cell] = (cells[cell] ?? 0) + add;
    }
  };
  const ownL0 = new Float64Array(n * n).fill(8 * C.l0.resident), ownActive = new Uint8Array(n * n);
  for (const tile of shard.tiles) if (tile.lod === 0) {
    const bounds = tile.drawBounds ?? tile.bounds, bytes = bytesOf(tile);
    near(bounds.min[0], bounds.min[2], bounds.max[0], bounds.max[2], ownL0, bytes);
    yield;
  }
  near(-250, -250, 250, 250, ownActive, 1, true);
  const cellOf = function* cellOf([cx, cz]: readonly [number, number]): Generator<void, { l0: Uint8Array; active: Uint8Array }> {
    const id = `${cx},${cz}`, known = syntheticCells.get(id); if (known !== undefined) return known;
    const made = { l0: new Uint8Array(n * n), active: new Uint8Array(n * n) };
    for (let i = 0; i < 64; i++) {
      const x0 = cx - 250 + (i % 8) * 62.5, z0 = cz - 250 + Math.floor(i / 8) * 62.5;
      near(x0, z0, x0 + 62.5, z0 + 62.5, made.l0, 1);
      yield;
    }
    near(cx - 250, cz - 250, cx + 250, cz + 250, made.active, 1, true);
    syntheticCells.set(id, made); return made;
  };
  let worstAccounted = Number.NEGATIVE_INFINITY;
  for (const model of locationModels(shard, commons)) {
    const found: { l0: Uint8Array; active: Uint8Array }[] = [];
    for (const neighbour of model.neighbours) found.push(yield* cellOf(neighbour));
    const [a, b, c] = found;
    if (a === undefined || b === undefined || c === undefined) throw new Error('Location model requires three neighbours');
    for (let xi = 0; xi < n; xi++) for (let zi = 0; zi < n; zi++) {
      const cell = at(xi, zi), active = (a.active[cell] ?? 0) + (b.active[cell] ?? 0) + (c.active[cell] ?? 0);
      const libraries = (ownActive[cell] === 1 ? shard.budgets.library.resident : 0) + active * C.library.resident;
      const accounted = (ownL0[cell] ?? 0) + ((a.l0[cell] ?? 0) + (b.l0[cell] ?? 0) + (c.l0[cell] ?? 0)) * C.l0.resident + libraries + model.fixed;
      if (accounted <= worstAccounted) continue;
      const cost = model.cost(steps[xi] ?? 0, steps[zi] ?? 0);
      if (cost.playing > worst.playing) { worst = cost; worstAccounted = accounted; }
    }
    yield;
  }
  if (worstCache.size >= 8) { const oldest = worstCache.keys().next().value; if (oldest !== undefined) worstCache.delete(oldest); }
  worstCache.set(key, worst);
  return { ...worst, location: [...worst.location] };
}
