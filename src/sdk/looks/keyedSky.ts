import { KeyedSky as PlatformKeyedSky, keyedSkyBackdrop as platformKeyedSkyBackdrop, keyedSkyOf as platformKeyedSkyOf, packSkyKeyRgb9e5 as platformPackSkyKeyRgb9e5, type KeyedSkyOptions as PlatformKeyedSkyOptions, type SkyWeather as PlatformSkyWeather } from '@wildshard/game/systems/looks/keyedSky';

/** The weather's multipliers over a keyed sky's blended preset. */
export type SkyWeather = PlatformSkyWeather;
/** How a keyed sky is built on one page. */
export type KeyedSkyOptions = PlatformKeyedSkyOptions;
/** A live keyed sky (the class's instance). */
export type KeyedSkyHandle = PlatformKeyedSky;
/** A day / night sky drawn from photographic keys (SHARD-PLATFORM M3, look-family rows). */
export const KeyedSky: typeof PlatformKeyedSky = PlatformKeyedSky;
/** A shard's sky backdrop from its keyed-sky row. */
export const keyedSkyBackdrop: typeof platformKeyedSkyBackdrop = platformKeyedSkyBackdrop;
/** The keyed sky a backdrop built on this sky rig. */
export const keyedSkyOf: typeof platformKeyedSkyOf = platformKeyedSkyOf;
/** A decoded sky key as RGB9_E5 (half the GPU bytes). */
export const packSkyKeyRgb9e5: typeof platformPackSkyKeyRgb9e5 = platformPackSkyKeyRgb9e5;
