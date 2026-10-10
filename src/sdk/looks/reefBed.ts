import { ReefBed as PlatformReefBed, scatterReefBed as platformScatterReefBed, type ReefBedLayout as PlatformReefBedLayout, type ReefBedModels as PlatformReefBedModels, type ReefBedParams as PlatformReefBedParams, type ReefBedRow as PlatformReefBedRow, type ReefBedSpec as PlatformReefBedSpec, type ReefGround as PlatformReefGround, type ReefNoiseRow as PlatformReefNoiseRow, type ReefSchool as PlatformReefSchool } from '@wildshard/game/systems/looks/reefBed';

/** One reef copy's numbers: size, turn, tint (SHARD-PLATFORM M3). */
export type ReefBedParams = PlatformReefBedParams;
/** One scattered reef copy. */
export type ReefBedSpec = PlatformReefBedSpec;
/** The fish school's centre, radius and count. */
export type ReefSchool = PlatformReefSchool;
/** A reef scatter and its school. */
export type ReefBedLayout = PlatformReefBedLayout;
/** One noise field of the scatter as data. */
export type ReefNoiseRow = PlatformReefNoiseRow;
/** A reef scatter's numbers as data. */
export type ReefBedRow = PlatformReefBedRow;
/** The ground a reef scatter reads. */
export type ReefGround = PlatformReefGround;
/** A reef's models, material and fish. */
export type ReefBedModels<P extends PlatformReefBedParams> = PlatformReefBedModels<P>;
/** Scatters a reef from its row: reefs, beds and a scatter where the water is shallow, the school over the densest reef. */
export const scatterReefBed: typeof platformScatterReefBed = platformScatterReefBed;
/** A welded reef (one draw) and its swimming school. */
export const ReefBed: typeof PlatformReefBed = PlatformReefBed;
/** A welded reef (the class's instances). */
export type ReefBedSet<P extends PlatformReefBedParams> = PlatformReefBed<P>;
