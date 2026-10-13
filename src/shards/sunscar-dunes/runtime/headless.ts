import type { PrepareHeadlessRuntime } from '@wildshard/sdk/headlessRuntime';
import { bakedSpots, prepareSignalRuntime } from './signalPlan';
import baked from './physics.baked.json' with { type: 'json' };

/** The built world's prompt spots and crack targets, in actual world/build.ts registration order. */
export const signalSpots = (): ReturnType<typeof bakedSpots> => bakedSpots(baked);
/**
 * Signal's renderer-free native owners compose locally: declared species homes, Matriarch, quest and lash rows,
 * with the shipping held-heavy input. Its Node-canonical native metadata comes from generators/bake-signal-physics.mjs.
 */
export const prepareHeadlessRuntime: PrepareHeadlessRuntime = prepareSignalRuntime;
