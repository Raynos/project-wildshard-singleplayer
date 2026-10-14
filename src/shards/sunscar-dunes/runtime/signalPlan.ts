import { prepareRuntimePlan, readRuntimeWorldMetadata } from '@wildshard/game/plugin/simulation';
import type { QuestGraphPorts } from '@wildshard/game/plugin/quests';
import type { PrepareHeadlessRuntime } from '@wildshard/sdk/headlessRuntime';
import { SIGNAL_NATIVE_WORLD } from '../data/nativeWorld';
import baked from '../data/physics.generated.json' with { type: 'json' };

/** Native metadata and the explicit trusted entry retain their existing module boundary. */
export function bakedSpots(input: unknown): QuestGraphPorts['spots'] { return readRuntimeWorldMetadata(input, true).spots; }
export const prepareSignalRuntime: PrepareHeadlessRuntime = ({ shard, assets }) => prepareRuntimePlan(shard, assets, baked, SIGNAL_NATIVE_WORLD);
