import { BUDGET_CEILINGS } from './budgetCeilings';
import type { LevelSpec } from '@wildshard/engine/level/spec';

const tier = (fps: number): NonNullable<LevelSpec['budgets']['phone']> => ({ fps, variability: 1.3, cpuMs: fps === 30 ? 9.6 : 4.8, gcMs: 0.3,
  systems: { physics: 0.3, ai: 0.3, animation: 0.3, player: 0.2, world: 0.2, hud: 0.1, audio: 0.1 },
  vertexShare: 0.5, lanes: { opaque: 0.4, shadow: 0.2, transparent: 0.1, viewmodel: 0.1, post: 0.1, reserve: 0.1 }, linkMs: 1000 });
export const BUDGETS: LevelSpec['budgets'] = { ceilings: BUDGET_CEILINGS, phone: tier(30), desktop: tier(60), load: { coldPlay4G: null, fixedSeconds: 0, cpuRatio: 2, bytesPerSecond: 1125000 } };
