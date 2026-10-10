import { RainFx as PlatformRainFx, type RainFxLook as PlatformRainFxLook, type RainFxOptions as PlatformRainFxOptions, type RainFxPrograms as PlatformRainFxPrograms, type RainHood as PlatformRainHood, type RainReading as PlatformRainReading, type TierCount as PlatformTierCount } from '@wildshard/game/systems/looks/rainFx';

/** A count per device tier. */
export type TierCount = PlatformTierCount;
/** The rain's sizes as data (SHARD-PLATFORM M3): the cover map, the streaks, the splash and lens-drop slots, the puddles. */
export type RainFxLook = PlatformRainFxLook;
/** The rain's three programs as rows (`@{fog}` splices the atmosphere's fog GLSL). */
export type RainFxPrograms = PlatformRainFxPrograms;
/** A hood where no rain falls (a cave's mouth). */
export type RainHood = PlatformRainHood;
/** What the rain reads each frame: rain and wet, 0..1. */
export type RainReading = PlatformRainReading;
/** What a rain system is built from. */
export type RainFxOptions = PlatformRainFxOptions;
/** The camera-local rain with the canopy's drips, the puddles, the splashes and the lens drops of a wooded level. */
export const RainFx: typeof PlatformRainFx = PlatformRainFx;
