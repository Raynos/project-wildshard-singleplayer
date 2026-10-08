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
/** Worst disc with three synthetic neighbours at the platform caps; a fine grid expands the radius to cover its gaps. */
export function worstContentCost(shard: Shardfile, commons = 0): { playing: number; loading: number; accounted: number; location: [number, number] } {
  const step = 5, radius2 = (C.nearRadius + Math.SQRT2 * step / 2) ** 2;
  const own = shard.tiles.filter((t) => t.lod === 0);
  // Synthetic coarse slots remain at the platform target; authored excess is never hidden by that assumption.
  const coarseExcess = shard.tiles.filter((t) => t.lod === 1).reduce((sum, tile) => sum + Math.max(0, tile.decoded + tile.gpu - C.l1.resident), 0);
  let worst = { playing: 0, loading: 0, accounted: 0, location: [0, 0] as [number, number] };
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const neighbours = [[sx * C.pitch, 0], [0, sz * C.pitch], [sx * C.pitch, sz * C.pitch]] as const;
    const tiles = neighbours.flatMap(([cx, cz]) => Array.from({ length: 64 }, (_, i) => ({ x0: cx - 250 + (i % 8) * 62.5, z0: cz - 250 + Math.floor(i / 8) * 62.5 })));
    for (let x = -280; x <= 280; x += step) for (let z = -280; z <= 280; z += step) {
      const active = neighbours.filter(([cx, cz]) => distance2(x, z, cx - 250, cz - 250, cx + 250, cz + 250) <= radius2).length;
      const ownActive = distance2(x, z, -250, -250, 250, 250) <= radius2;
      let l0 = 0;
      for (const t of own) if (distance2(x, z, t.bounds.min[0], t.bounds.min[2], t.bounds.max[0], t.bounds.max[2]) <= radius2) l0 += t.decoded + t.gpu;
      for (const t of tiles) if (distance2(x, z, t.x0, t.z0, t.x0 + 62.5, t.z0 + 62.5) <= radius2) l0 += C.l0.resident;
      // Eight heading lookahead slots charged at cap, even when the project is empty.
      l0 += 8 * C.l0.resident;
      const cost = contentCost({ l0, l1: C.l1Count * C.l1.resident + coarseExcess, far: (C.farCount - 1) * C.far.resident + (shard.far === null ? 0 : shard.far.decoded + shard.far.gpu), libraries: (ownActive ? shard.budgets.library.resident : 0) + active * C.library.resident, sims: Math.max(shard.budgets.sim.resident, shard.serverBudget.memory) + 3 * C.sim.resident, commons, overlap: Math.max(C.overlap, shard.budgets.overlap) });
      if (cost.playing > worst.playing) worst = { ...cost, location: [x, z] };
    }
  }
  return worst;
}
