import type { SkyRig } from '@wildshard/engine/world/skyRig';
import { keyedSkyOf, type KeyedSkyHandle, type SkyWeather } from '@wildshard/sdk/looks/keyedSky';

/** Pine Hollow's sky (look/render.ts builds it from data/sky.ts on the SDK's keyed sky). */
export type PineSkyBackdrop = KeyedSkyHandle;
/** The weather's hook on the clock (world/weather.ts writes it every frame). */
export type PineSkyMod = SkyWeather;
/** The keyed sky on a sky rig, if Pine's backdrop built one (the weather, the King's night). */
export function pineBackdrop(sky: SkyRig): PineSkyBackdrop | null { return keyedSkyOf(sky); }
