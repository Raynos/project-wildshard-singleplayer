import { BUDGET_CEILINGS } from './budgetCeilings';
import type { LevelSpec } from '@wildshard/engine/level/spec';

/** E357 S1.6 allocation inputs; all count targets rederive after a stable M5 calibration. */
export const PINE_BUDGET_INPUTS: LevelSpec['budgets'] = {
  ceilings: BUDGET_CEILINGS,
  phone: {
    fps: 30, variability: 1.3, cpuMs: 9.6, gcMs: 0.6,
    systems: { physics: 0.8, ai: 0.8, animation: 1, player: 0.4, world: 0.5, hud: 0.3, audio: 0.2 },
    // Half of the GPU allocation is reserved for vertex work; lane allocations remain advisory.
    vertexShare: 0.5,
    lanes: { opaque: 5 / 16, foliage: 3 / 16, shadow: 2.5 / 16, transparent: 1.5 / 16, viewmodel: 1 / 16, post: 2 / 16, reserve: 1 / 16 },
    linkMs: 1000, // quarter of the existing 4-second warm-launch envelope; a stated allocation, not a measured cost
  },
  desktop: {
    fps: 60, variability: 1.3, cpuMs: 4.8, gcMs: 0.3,
    systems: { physics: 0.4, ai: 0.4, animation: 0.5, player: 0.2, world: 0.25, hud: 0.15, audio: 0.1 },
    vertexShare: 0.5, lanes: { opaque: 0.5, post: 0.5 }, linkMs: 1000,
  },
  // Load caps and fixed-time observations: budget-design §6.6; CPU ratio 2 remains an assumption.
  load: { coldPlay4G: 40, fixedSeconds: 3, cpuRatio: 2, bytesPerSecond: 1125000 },
};
