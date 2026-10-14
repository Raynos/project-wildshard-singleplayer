import type { PrepareHeadlessRuntime } from '@wildshard/sdk/headlessRuntime';
import { prepareRuntimePlan } from '@wildshard/game/plugin/simulation';
import { SKY_NATIVE_WORLD } from '../data/nativeWorld';
import baked from '../data/physics.generated.json' with { type: 'json' };

/** Declared native owners share the existing host and install order. */
export const prepareHeadlessRuntime: PrepareHeadlessRuntime = ({ shard, assets }) => prepareRuntimePlan(shard, assets, baked, SKY_NATIVE_WORLD);
