import { BUDGETS, SKY_REACH_RUNTIME_COST } from './rows/budgets';
import { SKY_DEV_POSES } from './rows/devPoses';
import { MEADOW, meadowCard } from './rows/meadowLook';
import { UPDRAFT_AXIS, WIND_FIELDS, WIND_LOOKS } from './rows/windLook';
import { RAY_WAKE } from './rows/rayWakeLook';

/** Source meadow cards retain the exact original float32 columns and caller ownership. */
export function skyMeadowView(): typeof MEADOW & { readonly cards: { card: number[]; layer: number[]; index: number[] }[] } {
  const cards = [1, 1 + MEADOW.layers].map(copies => {
    const card = meadowCard(copies);
    return { card: Array.from(card.card), layer: Array.from(card.layer), index: Array.from(card.index) };
  });
  return structuredClone({ ...MEADOW, cards });
}

/** Original finite effect identities, palette and axis values, independent for each caller. */
export function skyWindView(): { UPDRAFT_AXIS: typeof UPDRAFT_AXIS; WIND_FIELDS: typeof WIND_FIELDS; WIND_LOOKS: typeof WIND_LOOKS } {
  return structuredClone({ UPDRAFT_AXIS, WIND_FIELDS, WIND_LOOKS });
}
export interface SkyViewValues {
  readonly budgets: typeof BUDGETS;
  readonly runtimeCost: typeof SKY_REACH_RUNTIME_COST;
  readonly devPoses: typeof SKY_DEV_POSES;
  readonly meadow: ReturnType<typeof skyMeadowView>;
  readonly wind: ReturnType<typeof skyWindView>;
  readonly rayWake: typeof RAY_WAKE;
}
/** Build all six original metadata values directly; no file is read or published. */
export function skyViewValues(): SkyViewValues {
  return structuredClone({ budgets: BUDGETS, runtimeCost: SKY_REACH_RUNTIME_COST, devPoses: SKY_DEV_POSES,
    meadow: skyMeadowView(), wind: skyWindView(), rayWake: RAY_WAKE });
}
/** Only the finite source discovery values supported by the existing platform binding. */
export function skyViewDiscovery(): { readonly budgets: typeof BUDGETS; readonly poses: typeof SKY_DEV_POSES } {
  return structuredClone({ budgets: BUDGETS, poses: SKY_DEV_POSES });
}
/** Retained byte oracle in the original field and file order. */
export function skyViewData(): ReadonlyMap<string, Uint8Array> {
  return new Map(Object.entries(skyViewValues()).map(([name, rows]) => [`data/${name}.generated.json`, new TextEncoder().encode(`${JSON.stringify(rows)}\n`)]));
}
