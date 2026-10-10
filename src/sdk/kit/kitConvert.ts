import {
  convertKits as platformConvertKits,
  type KitBuilder as PlatformKitBuilder, type KitGeometries as PlatformKitGeometries, type KitProfile as PlatformKitProfile, type KitSets as PlatformKitSets,
} from '@wildshard/game/systems/kit/kitConvert';

/** A kit builder: its vertex count, its geometry, and dropping its JS arrays once built. */
export type KitBuilder = PlatformKitBuilder;
/** The named kits: solid, swept and alpha-cut. */
export type KitSets = PlatformKitSets;
/** One kit's build time and vertex count. */
export type KitProfile = PlatformKitProfile;
/** The built kits and the profile. */
export type KitGeometries = PlatformKitGeometries;
/** Build a world's named kits into one geometry each, releasing every builder as it goes (SHARD-PLATFORM M3). */
export const convertKits: typeof platformConvertKits = platformConvertKits;
