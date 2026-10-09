import { BUDGET_CEILINGS } from './budgetCeilings';
import type { LevelSpec } from '@wildshard/engine/level/spec';

/** 07 §6.5 G: default allocations from budget-design §6.1–6.3, load inputs from §6.6.
 * Counts rederive at all three harness poses when the lead publishes a stable M5 calibration.
 * Desktop retains F2 ceilings until X7 establishes the desktop GPU mapping. */
export const NALATI_BUDGET_INPUTS: LevelSpec['budgets'] = {
  ceilings: BUDGET_CEILINGS,
  phone: {
    fps: 30, variability: 1.3, cpuMs: 9.6, gcMs: 0.6,
    systems: { physics: 0.8, ai: 0.8, animation: 1, player: 0.4, world: 0.5, hud: 0.3, audio: 0.2 },
    vertexShare: 0.5,
    lanes: { opaque: 5 / 16, foliage: 3 / 16, shadow: 2.5 / 16, transparent: 1.5 / 16, viewmodel: 1 / 16, post: 2 / 16, reserve: 1 / 16 },
    linkMs: 1000, // S1.6/B25: a quarter of the 4-second warm-launch envelope
  },
  desktop: {
    fps: 60, variability: 1.3, cpuMs: 4.8, gcMs: 0.3,
    systems: { physics: 0.4, ai: 0.4, animation: 0.5, player: 0.2, world: 0.25, hud: 0.15, audio: 0.1 },
    vertexShare: 0.5, lanes: { opaque: 0.5, post: 0.5 }, linkMs: 1000,
  },
  // 35.5-second cap, 5.2-second fixed cost, 1.125 MB/s 4G; phone CPU ratio 2 is the stated assumption.
  load: { coldPlay4G: 35.5, fixedSeconds: 5.2, cpuRatio: 2, bytesPerSecond: 1125000 },
};
