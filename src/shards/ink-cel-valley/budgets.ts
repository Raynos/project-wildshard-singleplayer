import { BUDGET_CEILINGS } from './budgetCeilings';

// Unannotated on purpose: the manifest's inferred type stays structural, so its declaration emit never names the engine's
// unexported budget interfaces (tsc -b tsconfig.layers.json, TS2883). The game checks it against its manifest type.
const tier = (fps: number) => ({ fps, variability: 1.3, cpuMs: fps === 30 ? 9.6 : 4.8, gcMs: 0.3,
  systems: { physics: 0.3, ai: 0.3, animation: 0.3, player: 0.2, world: 0.2, hud: 0.1, audio: 0.1 },
  vertexShare: 0.5, lanes: { opaque: 0.4, shadow: 0.2, transparent: 0.1, viewmodel: 0.1, post: 0.1, reserve: 0.1 }, linkMs: 1000 });
/** the ink valley's frame, CPU and load budget inputs (the template's numbers) */
export const BUDGETS = { ceilings: BUDGET_CEILINGS, phone: tier(30), desktop: tier(60), load: { coldPlay4G: null, fixedSeconds: 0, cpuRatio: 2, bytesPerSecond: 1125000 } };
