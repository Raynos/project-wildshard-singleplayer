import { CoverTier as PlatformCoverTier, StreamedCover as PlatformStreamedCover, type CoverGround as PlatformCoverGround, type CoverSite as PlatformCoverSite, type StreamedCoverFarRow as PlatformStreamedCoverFarRow, type StreamedCoverHooks as PlatformStreamedCoverHooks, type StreamedCoverKindRow as PlatformStreamedCoverKindRow, type StreamedCoverOptions as PlatformStreamedCoverOptions, type StreamedCoverRow as PlatformStreamedCoverRow, type StreamedCoverStats as PlatformStreamedCoverStats } from '@wildshard/game/systems/looks/streamedCover';

/** A kind's far tier as data (SHARD-PLATFORM M3). */
export type StreamedCoverFarRow = PlatformStreamedCoverFarRow;
/** One kind of a streamed cover as data. */
export type StreamedCoverKindRow = PlatformStreamedCoverKindRow;
/** A streamed cover's numbers, material, patch and GLSL edits as data. */
export type StreamedCoverRow = PlatformStreamedCoverRow;
/** A candidate point's site, as the shard's hook fills it. */
export type CoverSite = PlatformCoverSite;
/** What a plant stands on, as the shard's hook fills it. */
export type CoverGround = PlatformCoverGround;
/** The shard's placement rules. */
export type StreamedCoverHooks<S extends PlatformCoverSite> = PlatformStreamedCoverHooks<S>;
/** What a streamed cover needs. */
export type StreamedCoverOptions<S extends PlatformCoverSite> = PlatformStreamedCoverOptions<S>;
/** A streamed cover's measurements. */
export type StreamedCoverStats = PlatformStreamedCoverStats;
/** One tier of one kind: two instanced meshes, written and uploaded behind, swapped in one frame. */
export const CoverTier: typeof PlatformCoverTier = PlatformCoverTier;
/** A ground cover streamed round the viewer from cached cells, near and far tiers, uploads spread over frames. */
export const StreamedCover: typeof PlatformStreamedCover = PlatformStreamedCover;
/** A streamed cover (the class's instances). */
export type StreamedCoverSet<S extends PlatformCoverSite> = PlatformStreamedCover<S>;
