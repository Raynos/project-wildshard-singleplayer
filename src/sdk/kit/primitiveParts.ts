import { PartKit as PlatformPartKit, buildPrimitiveParts as platformBuildPrimitiveParts, type PrimitivePartKind as PlatformPrimitivePartKind, type PrimitivePartRow as PlatformPrimitivePartRow } from '@wildshard/game/systems/kit/primitiveParts';

/** A smooth-shaded figure's part as data (SHARD-PLATFORM M3): a primitive, its colour and its placement. */
export type PrimitivePartRow = PlatformPrimitivePartRow;
/** A primitive part's kind. */
export type PrimitivePartKind = PlatformPrimitivePartKind;
/** A part kit instance: built geometries painted, placed and merged in add order. */
export type PartKitView = PlatformPartKit;
/** A part list builder: every part non-indexed with position + normal + colour, merged in add order. */
export const PartKit: typeof PlatformPartKit = PlatformPartKit;
/** Builds primitive parts (rows, in add order) into one merged position + normal + colour geometry. */
export const buildPrimitiveParts: typeof platformBuildPrimitiveParts = platformBuildPrimitiveParts;
