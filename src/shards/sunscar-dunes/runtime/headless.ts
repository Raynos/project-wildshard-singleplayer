import type { PrepareHeadlessRuntime } from '@wildshard/sdk/headlessRuntime';
import { prepareRuntimePlan } from '@wildshard/game/plugin/simulation';
import { SIGNAL_NATIVE_WORLD } from '../data/nativeWorld';
import baked from '../data/physics.generated.json' with { type: 'json' };

/** Declared native owners retain their existing installation and save order. */
export const prepareHeadlessRuntime: PrepareHeadlessRuntime = ({ shard, assets }) => prepareRuntimePlan(shard, assets, baked, SIGNAL_NATIVE_WORLD);
