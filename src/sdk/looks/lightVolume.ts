import {
  bakeLightVolume as platformBakeLightVolume, blankLightVolume as platformBlankLightVolume,
  type BakeStats as PlatformBakeStats, type PoolLight as PlatformPoolLight, type VolumeBox as PlatformVolumeBox,
} from '@wildshard/game/systems/looks/lightVolume';

/** A pool light: where, its linear colour, strength, falloff radius and reach. */
export type PoolLight = PlatformPoolLight;
/** A volume's world box and its cell size. */
export type VolumeBox = PlatformVolumeBox;
/** One bake's numbers. */
export type BakeStats = PlatformBakeStats;
/** A 1³ placeholder volume until the bake lands (SHARD-PLATFORM M3). */
export const blankLightVolume: typeof platformBlankLightVolume = platformBlankLightVolume;
/** Bake pool lights into a 3D irradiance texture, filling its min / inv (SHARD-PLATFORM M3). */
export const bakeLightVolume: typeof platformBakeLightVolume = platformBakeLightVolume;
