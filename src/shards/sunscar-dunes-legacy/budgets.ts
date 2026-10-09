import { BUDGET_CEILINGS } from './budgetCeilings';
import type { LevelSpec } from '@wildshard/engine/level/spec';

/** Inputs only (SHARDS §9): the template's numbers; the engine derives draws, triangles, programs and GPU MB. */
const tier = (fps: number): NonNullable<LevelSpec['budgets']['phone']> => ({ fps, variability: 1.3, cpuMs: fps === 30 ? 9.6 : 4.8, gcMs: 0.3,
  systems: { physics: 0.3, ai: 0.3, animation: 0.3, player: 0.2, world: 0.2, hud: 0.1, audio: 0.1 },
  vertexShare: 0.5, lanes: { opaque: 0.4, shadow: 0.2, transparent: 0.1, viewmodel: 0.1, post: 0.1, reserve: 0.1 }, linkMs: 1000 });
export const BUDGETS: LevelSpec['budgets'] = { ceilings: BUDGET_CEILINGS, phone: tier(30), desktop: tier(60), load: { coldPlay4G: null, fixedSeconds: 0, cpuRatio: 2, bytesPerSecond: 1125000 } };

// SF22a: one measured opaque-runtime bound, shared by author data and the manifest's static closure.
/**
 * Three cold Safari play medians on 744cf67ef, with same-source labelled phone-tier GL.
 * Native play range 210.931–222.449 MB; play/Explorer peaks and raw records are in the receipt.
 * The 299 MB engine base is the dated calibration, not remeasured. The game helper calibrates once.
 * This standalone Simulator + GL proxy is not physical-iPhone or entered-grid evidence.
 */
export const SIGNAL_DUNES_RUNTIME_COST = {
  "webContentMB": 220.400664,
  "glMB": 133.399284,
  "engineBaseMB": 299,
  "rev": "744cf67ef347bd635ae8126cb80d5355a77fec85",
  "device": "iOS Simulator iPhone 17 Pro Safari + desktop labelled GL census",
  "evidence": "progress/memory/sf50-sun-runtime-744cf67ef/summary.json"
} as const;
