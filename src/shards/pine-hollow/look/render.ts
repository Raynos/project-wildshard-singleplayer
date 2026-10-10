import type { LookStrategy } from '@wildshard/engine/render/look';
import { keyedSkyBackdrop } from '@wildshard/sdk/looks/keyedSky';
import { PINE_KEYED_DAY } from './dayKeys';
import { pineMemoryTrim } from '../debug/options';

/** Pine Hollow's look: the engine's chain under its keyed day / night sky (data/sky.ts); the memory trim packs the keys. */
export function shardRender(): LookStrategy { return { compose: () => ({}), backdrop: keyedSkyBackdrop(PINE_KEYED_DAY, pineMemoryTrim) }; }
