import { SweptKit as PlatformSweptKit, curve as platformCurve, mergeKits as platformMergeKits, type SweptLook as PlatformSweptLook } from '@wildshard/game/systems/kit/sweptKit';

/** How a swept piece looks (the ruled kit's look without the gold line). */
export type SweptLook = PlatformSweptLook;
/** A builder of smooth swept tubes, ellipsoids, cards and raw meshes in the ruled kit's attributes (SHARD-PLATFORM M3, the kit system). */
export const SweptKit: typeof PlatformSweptKit = PlatformSweptKit;
/** A swept kit (the instance type; extend SweptKit to name your own). */
export type SweptKitView = PlatformSweptKit;
/** Merges ruled and swept kit geometries (the same attribute set) into one. */
export const mergeKits: typeof platformMergeKits = platformMergeKits;
/** A smooth Catmull-Rom path through control points. */
export const curve: typeof platformCurve = platformCurve;
