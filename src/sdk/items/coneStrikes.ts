import { ConeStrikes as PlatformConeStrikes, inCone as platformInCone, type ConeFanTarget as PlatformConeFanTarget, type ConeGustSpec as PlatformConeGustSpec, type ConeSlashSpec as PlatformConeSlashSpec, type ConeStrikePorts as PlatformConeStrikePorts, type ConeStrikeSpec as PlatformConeStrikeSpec } from '@wildshard/game/systems/items/coneStrikes';

/** Anything a cone fan can strike: a world position, its combat actor and how it takes the gust's push. */
export type ConeFanTarget = PlatformConeFanTarget;
/** What the moves' contacts are lent: the damage pipeline's contact and the live targets. */
export type ConeStrikePorts = PlatformConeStrikePorts;
/** The arc slash's numbers: cone, light / heavy damage, cooldowns, tags and move ids. */
export type ConeSlashSpec = PlatformConeSlashSpec;
/** The gust's numbers: cone, push, lift, wind hit, cooldown, tags and move id. */
export type ConeGustSpec = PlatformConeGustSpec;
/** A cone fan's strikes: the weapon id, the slash and the gust. */
export type ConeStrikeSpec = PlatformConeStrikeSpec;
/** True when a point lies inside a cone of `reach` metres and `halfAngle` radians around a direction. */
export const inCone: typeof platformInCone = platformInCone;
/** A cone fan's moves, view-free (no renderer import): the cooldowns, the arc slash and the gust (SHARD-PLATFORM M3). */
export const ConeStrikes: typeof PlatformConeStrikes = PlatformConeStrikes;
/** The view-free strikes as built. */
export type ConeStrikesRuntime = PlatformConeStrikes;
