import { cloneSkyPreset as platformCloneSkyPreset, keyedSkyDay as platformKeyedSkyDay, lerpSkyPreset as platformLerpSkyPreset, skyPreset as platformSkyPreset, type KeyedSkyDay as PlatformKeyedSkyDay, type SkyPreset as PlatformSkyPreset } from '@wildshard/game/systems/looks/keyedSkyDay';

/** One live preset (the row's colours as three.js colours). */
export type SkyPreset = PlatformSkyPreset;
/** A keyed sky's clock: the engine spec, the bodies' paths and the curves. */
export type KeyedSkyDay = PlatformKeyedSkyDay;
/** The clock a keyed sky's row declares (renderer-free; SHARD-PLATFORM M3, look-family rows). */
export const keyedSkyDay: typeof platformKeyedSkyDay = platformKeyedSkyDay;
/** A row's live preset. */
export const skyPreset: typeof platformSkyPreset = platformSkyPreset;
/** A preset's copy. */
export const cloneSkyPreset: typeof platformCloneSkyPreset = platformCloneSkyPreset;
/** `out` = a -> b at t. */
export const lerpSkyPreset: typeof platformLerpSkyPreset = platformLerpSkyPreset;
