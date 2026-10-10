import { rowsHeadlessRuntime, bakedSpots } from '@wildshard/sdk/rowsHeadless';
import type { PrepareHeadlessRuntime } from '@wildshard/sdk/headlessRuntime';
import { SIGNAL_MODULES, SIGNAL_SPECIES, SIGNAL_STRIKES } from '../data/brains';
import { SIGNAL_HEADLESS } from '../data/headless';
import baked from './physics.baked.json' with { type: 'json' };

/** The built world's prompt spots and crack targets (baked from the browser, world/build.ts order), strictly. */
export const signalSpots = (): ReturnType<typeof bakedSpots> => bakedSpots(baked);
/**
 * Signal Dunes' renderer-free trusted runtime (SF72 / SF27): its rows (data/headless.ts) on the SDK's rows headless
 * runtime, with the browser-baked metadata (scripts/bake-signal-physics.mjs) and the declared species catalogue.
 */
export const prepareHeadlessRuntime: PrepareHeadlessRuntime = rowsHeadlessRuntime({ ...SIGNAL_HEADLESS, baked,
  homes: { ...SIGNAL_HEADLESS.homes, species: SIGNAL_SPECIES, strikes: SIGNAL_STRIKES, modules: SIGNAL_MODULES } });
