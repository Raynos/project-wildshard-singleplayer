import {
  LUT_TEXEL_SPLICES as PLATFORM_LUT_TEXEL_SPLICES, identityLutTexture as platformIdentityLutTexture, loadLutTexture as platformLoadLutTexture,
  lutTexture as platformLutTexture,
} from '@wildshard/game/systems/looks/lutTexture';

/** A colour grade's LUT table as a linear, edge-clamped 3D texture (SHARD-PLATFORM M3). */
export const lutTexture: typeof platformLutTexture = platformLutTexture;
/** The identity LUT texture: the grade off (SHARD-PLATFORM M3). */
export const identityLutTexture: typeof platformIdentityLutTexture = platformIdentityLutTexture;
/** Fetch a fitted LUT as a texture, or null when it is missing or the wrong size (SHARD-PLATFORM M3). */
export const loadLutTexture: typeof platformLoadLutTexture = platformLoadLutTexture;
/** The LUT's texel-centre mapping for a shader splice (`lutScale`, `lutBias`). */
export const LUT_TEXEL_SPLICES: typeof PLATFORM_LUT_TEXEL_SPLICES = PLATFORM_LUT_TEXEL_SPLICES;
