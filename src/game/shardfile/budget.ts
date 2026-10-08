import { CONTENT_CAPS as C } from '@wildshard/engine/core/config';
import { contentCost } from '@wildshard/engine/core/contentCost';
import type { Shardfile } from './schema';

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

const distance2 = (x: number, z: number, x0: number, z0: number, x1: number, z1: number): number => {
  const dx = Math.max(x0 - x, x - x1, 0), dz = Math.max(z0 - z, z - z1, 0); return dx * dx + dz * dz;
};
type LocationCost = ReturnType<typeof contentCost> & { location: [number, number] };
const GRID_STEP = 5;
const RADIUS2 = (C.nearRadius + Math.SQRT2 * GRID_STEP / 2) ** 2;

function locationModels(shard: Shardfile, commons: number): ((x: number, z: number) => LocationCost)[] {
  const own = shard.tiles.filter(tile => tile.lod === 0);
  const coarseExcess = shard.tiles.filter(tile => tile.lod === 1).reduce((sum, tile) => sum + Math.max(0, tile.decoded + tile.gpu - C.l1.resident), 0);
  const models: ((x: number, z: number) => LocationCost)[] = [];
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const neighbours = [[sx * C.pitch, 0], [0, sz * C.pitch], [sx * C.pitch, sz * C.pitch]] as const;
    const tiles = neighbours.flatMap(([cx, cz]) => Array.from({ length: 64 }, (_, i) => ({ x0: cx - 250 + (i % 8) * 62.5, z0: cz - 250 + Math.floor(i / 8) * 62.5 })));
    models.push((x, z) => {
      const active = neighbours.filter(([cx, cz]) => distance2(x, z, cx - 250, cz - 250, cx + 250, cz + 250) <= RADIUS2).length;
      const ownActive = distance2(x, z, -250, -250, 250, 250) <= RADIUS2;
      // Eight heading lookahead slots charged at target, even when the project is empty.
      let l0 = 8 * C.l0.resident;
      for (const tile of own) if (distance2(x, z, tile.bounds.min[0], tile.bounds.min[2], tile.bounds.max[0], tile.bounds.max[2]) <= RADIUS2) l0 += tile.decoded + tile.gpu;
      for (const tile of tiles) if (distance2(x, z, tile.x0, tile.z0, tile.x0 + 62.5, tile.z0 + 62.5) <= RADIUS2) l0 += C.l0.resident;
      const cost = contentCost({ l0, l1: C.l1Count * C.l1.resident + coarseExcess, far: (C.farCount - 1) * C.far.resident + (shard.far === null ? 0 : shard.far.decoded + shard.far.gpu), libraries: (ownActive ? shard.budgets.library.resident : 0) + active * C.library.resident, sims: Math.max(shard.budgets.sim.resident, shard.serverBudget.memory) + 3 * C.sim.resident, commons, overlap: Math.max(C.overlap, shard.budgets.overlap) });
      return { ...cost, location: [x, z] };
    });
  }
  return models;
}

/** Conservative total around an actual player location, using the same neighbour assumptions as admission. */
export function nearbyContentCost(shard: Shardfile, x: number, z: number, commons = 0): LocationCost {
  if (![x, z, commons].every(Number.isFinite) || commons < 0) throw new Error('Invalid memory estimate location');
  let worst: LocationCost = { playing: 0, loading: 0, accounted: 0, location: [x, z] };
  for (const model of locationModels(shard, commons)) { const cost = model(x, z); if (cost.playing > worst.playing) worst = cost; }
  return worst;
}

/** Worst disc with three synthetic neighbours at the platform targets; grid padding covers unsampled gaps. */
export function worstContentCost(shard: Shardfile, commons = 0): LocationCost {
  let worst: LocationCost = { playing: 0, loading: 0, accounted: 0, location: [0, 0] };
  for (const model of locationModels(shard, commons)) {
    for (let x = -280; x <= 280; x += GRID_STEP) for (let z = -280; z <= 280; z += GRID_STEP) {
      const cost = model(x, z); if (cost.playing > worst.playing) worst = cost;
    }
  }
  return worst;
}
