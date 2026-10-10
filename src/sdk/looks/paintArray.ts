import { loadPaintArray as platformLoadPaintArray, paintArrayPlaceholder as platformPaintArrayPlaceholder, type PaintLayer as PlatformPaintLayer } from '@wildshard/game/systems/looks/paintArray';

/** A paint layer: its file name, ratio scale and whether it has an alpha. */
export type PaintLayer = PlatformPaintLayer;
/** A 1-texel stand-in per layer until the paint array has loaded (SHARD-PLATFORM M3). */
export const paintArrayPlaceholder: typeof platformPaintArrayPlaceholder = platformPaintArrayPlaceholder;
/** Load painted swatch layers into one mipmapped RGBA8 texture array (SHARD-PLATFORM M3). */
export const loadPaintArray: typeof platformLoadPaintArray = platformLoadPaintArray;
