import { duskSand as platformDuskSand, duskSandAt as platformDuskSandAt, duskSandEntry as platformDuskSandEntry, duskSky as platformDuskSky, duskSkyEntry as platformDuskSkyEntry, type DuskSand as PlatformDuskSand, type DuskSandRow as PlatformDuskSandRow, type DuskSandSite as PlatformDuskSandSite, type DuskSky as PlatformDuskSky, type DuskSkyRow as PlatformDuskSkyRow, type GrainMeans as PlatformGrainMeans } from '@wildshard/game/systems/looks/duskFamilies';

/** A dusk sand as rows: its maps, surface, dusk curves and trail / key-shadow / fire-pool layers (SHARD-PLATFORM M3). */
export type DuskSandRow = PlatformDuskSandRow;
/** Where a dusk sand lies: its wind and its afterglow's direction. */
export type DuskSandSite = PlatformDuskSandSite;
/** The grain tile's own means. */
export type GrainMeans = PlatformGrainMeans;
/** The live dusk sand: its material and its dusk / fires adapter. */
export type DuskSand = PlatformDuskSand;
/** A painted dusk sky as rows: its two stages, elevations, window, first gain and hold. */
export type DuskSkyRow = PlatformDuskSkyRow;
/** The live dusk sky: its material and its dusk adapter. */
export type DuskSky = PlatformDuskSky;
/** A dusk sand's family terms at one dusk value. */
export const duskSandAt: typeof platformDuskSandAt = platformDuskSandAt;
/** A dusk sand's PBR family entry. */
export const duskSandEntry: typeof platformDuskSandEntry = platformDuskSandEntry;
/** A dusk sand as a PBR family material over its baked maps, freed with its scope. */
export const duskSand: typeof platformDuskSand = platformDuskSand;
/** A painted dusk sky's emissive family entry. */
export const duskSkyEntry: typeof platformDuskSkyEntry = platformDuskSkyEntry;
/** A painted dusk sky as an emissive family sky over its two stages, freed with its scope. */
export const duskSky: typeof platformDuskSky = platformDuskSky;
