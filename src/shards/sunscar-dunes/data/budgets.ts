import { BUDGET_CEILINGS } from './budgetCeilings';

/**
 * Inputs only (SHARDS §9): the template's numbers per tier, the recorded ceilings and the load model; the engine derives
 * draws, triangles, programs and GPU MB. Data (SHARD-PLATFORM M3): lint/shard-layout.json's dataHomes lets a shard keep
 * its budgets here instead of the root budgets.ts.
 */
export const BUDGETS = {
  ceilings: BUDGET_CEILINGS,
  phone: { fps: 30, variability: 1.3, cpuMs: 9.6, gcMs: 0.3, systems: { physics: 0.3, ai: 0.3, animation: 0.3, player: 0.2, world: 0.2, hud: 0.1, audio: 0.1 },
    vertexShare: 0.5, lanes: { opaque: 0.4, shadow: 0.2, transparent: 0.1, viewmodel: 0.1, post: 0.1, reserve: 0.1 }, linkMs: 1000 },
  desktop: { fps: 60, variability: 1.3, cpuMs: 4.8, gcMs: 0.3, systems: { physics: 0.3, ai: 0.3, animation: 0.3, player: 0.2, world: 0.2, hud: 0.1, audio: 0.1 },
    vertexShare: 0.5, lanes: { opaque: 0.4, shadow: 0.2, transparent: 0.1, viewmodel: 0.1, post: 0.1, reserve: 0.1 }, linkMs: 1000 },
  load: { coldPlay4G: null, fixedSeconds: 0, cpuRatio: 2, bytesPerSecond: 1125000 },
};
