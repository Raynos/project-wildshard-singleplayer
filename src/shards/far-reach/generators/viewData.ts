import { BUDGETS, SKY_REACH_RUNTIME_COST } from './rows/budgets';
import { SKY_DEV_POSES } from './rows/devPoses';
import { MEADOW, meadowCard } from './rows/meadowLook';
import { UPDRAFT_AXIS, WIND_FIELDS, WIND_LOOKS } from './rows/windLook';
import { RAY_WAKE } from './rows/rayWakeLook';

/** Resolve authored view and discovery rows offline, retaining exact float32 card values. */
export function skyViewData(): ReadonlyMap<string, Uint8Array> {
  const cards = [1, 1 + MEADOW.layers].map(copies => {
    const card = meadowCard(copies);
    return { card: Array.from(card.card), layer: Array.from(card.layer), index: Array.from(card.index) };
  });
  return new Map(Object.entries({ budgets: BUDGETS, runtimeCost: SKY_REACH_RUNTIME_COST, devPoses: SKY_DEV_POSES,
    meadow: { ...MEADOW, cards }, wind: { UPDRAFT_AXIS, WIND_FIELDS, WIND_LOOKS }, rayWake: RAY_WAKE,
  }).map(([name, rows]) => [`data/${name}.generated.json`, new TextEncoder().encode(`${JSON.stringify(rows)}\n`)]));
}
