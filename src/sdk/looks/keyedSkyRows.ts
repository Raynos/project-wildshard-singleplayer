import { keyedSkyUrls as platformKeyedSkyUrls, skyKeyFiles as platformSkyKeyFiles, type KeyedSkyStyle as PlatformKeyedSkyStyle, type SkyColour as PlatformSkyColour, type SkyKeyRow as PlatformSkyKeyRow, type SkyPresetRow as PlatformSkyPresetRow, type SkyRgb as PlatformSkyRgb } from '@wildshard/game/systems/looks/keyedSkyRows';

/** Linear RGB. */
export type SkyRgb = PlatformSkyRgb;
/** A colour as data: an sRGB hex number or linear RGB. */
export type SkyColour = PlatformSkyColour;
/** One photographic sky key. */
export type SkyKeyRow = PlatformSkyKeyRow;
/** One keyed light preset, as data. */
export type SkyPresetRow = PlatformSkyPresetRow;
/** A keyed sky's row (SHARD-PLATFORM M3, look-family rows): keys, presets, keyframes, phases and paths. */
export type KeyedSkyStyle = PlatformKeyedSkyStyle;
/** A key's file URLs. */
export const skyKeyFiles: typeof platformSkyKeyFiles = platformSkyKeyFiles;
/** Every key's baked pair, for the boot pack. */
export const keyedSkyUrls: typeof platformKeyedSkyUrls = platformKeyedSkyUrls;
