import BUDGET_CEILINGS from '../../data/budgetCeilings.json' with { type: 'json' };
import RUNTIME_COST from '../../runtimeCost.json' with { type: 'json' };

/** Exact authored phone/desktop budgets; runtime never computes a second tier formula. */
export const BUDGETS = { ceilings: BUDGET_CEILINGS,
  phone: {"fps": 30, "variability": 1.3, "cpuMs": 9.6, "gcMs": 0.3, "systems": {"physics": 0.3, "ai": 0.3, "animation": 0.3, "player": 0.2, "world": 0.2, "hud": 0.1, "audio": 0.1}, "vertexShare": 0.5, "lanes": {"opaque": 0.4, "shadow": 0.2, "transparent": 0.1, "viewmodel": 0.1, "post": 0.1, "reserve": 0.1}, "linkMs": 1000},
  desktop: {"fps": 60, "variability": 1.3, "cpuMs": 4.8, "gcMs": 0.3, "systems": {"physics": 0.3, "ai": 0.3, "animation": 0.3, "player": 0.2, "world": 0.2, "hud": 0.1, "audio": 0.1}, "vertexShare": 0.5, "lanes": {"opaque": 0.4, "shadow": 0.2, "transparent": 0.1, "viewmodel": 0.1, "post": 0.1, "reserve": 0.1}, "linkMs": 1000},
  load: { coldPlay4G: null, fixedSeconds: 0, cpuRatio: 2, bytesPerSecond: 1125000 } };

// SF22a: the measured runtime cost lives beside the budgets (one file in the manifest's static closure, AG10).
/**
 * SF22a median of three cold Safari play medians on 535780474, plus same-pin labelled phone-tier GL.
 * Native play range 254.824–277.810 MB; play and Explorer coverage, peaks and both rulers are in the receipt.
 * The 299 MB engine base is the dated 91f97bdfc calibration, not remeasured. Whole opaque home render + sim;
 * the game helper applies calibration once. This Simulator + GL proxy is not physical-iPhone evidence.
 */

/** G258: largest paired worst entered pose minus settled pre-entry road in G257's three cold runs.
 * The existing platform, composer and highway remain separately charged. The dated engine base is provenance only.
 * This is settled Simulator accounting, not a continuous peak or physical-phone proof. Keep the legacy image arm. */
export const SKY_REACH_RUNTIME_COST = structuredClone(RUNTIME_COST);
