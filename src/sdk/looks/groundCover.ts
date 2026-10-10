import { groundCoverCells as platformGroundCoverCells, GroundCover as PlatformGroundCover, groundCoverMatrix as platformGroundCoverMatrix, type GroundCoverDraw as PlatformGroundCoverDraw, type GroundCoverKind as PlatformGroundCoverKind, type GroundCoverKindRow as PlatformGroundCoverKindRow, type GroundCoverLook as PlatformGroundCoverLook, type GroundCoverOptions as PlatformGroundCoverOptions, type GroundCoverShape as PlatformGroundCoverShape } from '@wildshard/game/systems/looks/groundCover';

/** A ground-cover kind (the engine placement's kinds). */
export type GroundCoverKind = PlatformGroundCoverKind;
/** One kind's look as data (SHARD-PLATFORM M3). */
export type GroundCoverKindRow = PlatformGroundCoverKindRow;
/** The field's look as data: patch ids, program keys, material names, the kinds in build order. */
export type GroundCoverLook = PlatformGroundCoverLook;
/** One kind's geometry as data. */
export type GroundCoverShape = PlatformGroundCoverShape;
/** One kind as the field draws it. */
export type GroundCoverDraw = PlatformGroundCoverDraw;
/** What a field is built from. */
export type GroundCoverOptions = PlatformGroundCoverOptions;
/** How a field's copies are culled (cells, reach, the tier's far). */
export const groundCoverCells: typeof platformGroundCoverCells = platformGroundCoverCells;
/** A copy's transform: tilted to the ground's normal, turned about it, scaled. */
export const groundCoverMatrix: typeof platformGroundCoverMatrix = platformGroundCoverMatrix;
/** A forest floor's ground cover: the engine's undergrowth placement drawn with one shared program per look. */
export const GroundCover: typeof PlatformGroundCover = PlatformGroundCover;
