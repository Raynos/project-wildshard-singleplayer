import type { PrepareHeadlessRuntime } from '@wildshard/sdk/headlessRuntime';
import { bakedSpots, prepareSignalRuntime } from './signalPlan';
import baked from '../data/physics.generated.json' with { type: 'json' };

/** The built world's prompt spots and crack targets, in actual world/build.ts registration order. */
export const signalSpots = (): ReturnType<typeof bakedSpots> => bakedSpots(baked);
/**
 * Signal's renderer-free native owners compose locally: declared species homes, Matriarch, quest and lash rows,
 * with the shipping held-heavy input. Its physics product comes from authored rows (generators/physics.ts).
 */
export const prepareHeadlessRuntime: PrepareHeadlessRuntime = prepareSignalRuntime;
