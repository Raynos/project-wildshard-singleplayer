import { BUDGET_CEILINGS } from './budgetCeilings';
import type { LevelSpec } from '@wildshard/engine/level/spec';

const tier = (fps: number): NonNullable<LevelSpec['budgets']['phone']> => ({ fps, variability: 1.3, cpuMs: fps === 30 ? 9.6 : 4.8, gcMs: 0.3,
  systems: { physics: 0.3, ai: 0.3, animation: 0.3, player: 0.2, world: 0.2, hud: 0.1, audio: 0.1 },
  vertexShare: 0.5, lanes: { opaque: 0.4, shadow: 0.2, transparent: 0.1, viewmodel: 0.1, post: 0.1, reserve: 0.1 }, linkMs: 1000 });
export const BUDGETS: LevelSpec['budgets'] = { ceilings: BUDGET_CEILINGS, phone: tier(30), desktop: tier(60), load: { coldPlay4G: null, fixedSeconds: 0, cpuRatio: 2, bytesPerSecond: 1125000 } };

// SF22a: the measured runtime cost lives beside the budgets (one file in the manifest's static closure, AG10).
/**
 * SF22a median of three cold Safari play medians on 535780474, plus same-pin labelled phone-tier GL.
 * Native play range 254.824–277.810 MB; play and Explorer coverage, peaks and both rulers are in the receipt.
 * The 299 MB engine base is the dated 91f97bdfc calibration, not remeasured. Whole opaque home render + sim;
 * the game helper applies calibration once. This Simulator + GL proxy is not physical-iPhone evidence.
 */
export const SKY_REACH_RUNTIME_COST = {
  "webContentMB": 270.994576,
  "glMB": 267.71368,
  "engineBaseMB": 299,
  "rev": "5357804745121cdda8f9492b62d3266244f4ac1b",
  "device": "iOS Simulator iPhone 17 Pro Safari + desktop labelled GL census",
  "evidence": "progress/memory/sf22a-runtime-homes-535780474/summary.json"
} as const;
