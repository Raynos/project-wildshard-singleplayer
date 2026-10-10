import { CLASS_EDGE as platformClassEdge, ClassKit as PlatformClassKit, classCurve as platformClassCurve, mergeClassKits as platformMergeClassKits, v3 as platformV3, type ClassKitClasses as PlatformClassKitClasses, type ClassLook as PlatformClassLook, type ClassSweepOpt as PlatformClassSweepOpt } from '@wildshard/game/systems/kit/classKit';

/** How a class-kit piece looks: its material class (the caller's table), emission, line weight, edges and painted maps. */
export type ClassLook = PlatformClassLook;
/** How a class-kit sweep shapes its section. */
export type ClassSweepOpt = PlatformClassSweepOpt;
/** The material classes a raw mesh needs (its fallback and its glowing class). */
export type ClassKitClasses = PlatformClassKitClasses;
/** Edge mask bits of the face rule. */
export const CLASS_EDGE: typeof platformClassEdge = platformClassEdge;
/** A builder of close-up pieces (quads, sweeps, lathes, ellipsoids, raw meshes) in one attribute set keyed by material class (SHARD-PLATFORM M3, the kit system). */
export const ClassKit: typeof PlatformClassKit = PlatformClassKit;
/** A class kit (the instance type; extend ClassKit to name your own). */
export type ClassKitView = PlatformClassKit;
/** Catmull-Rom through the points, `per` samples per span. */
export const classCurve: typeof platformClassCurve = platformClassCurve;
/** Merges class-kit geometries (the same attribute set) into one. */
export const mergeClassKits: typeof platformMergeClassKits = platformMergeClassKits;
/** A new Vector3. */
export const v3: typeof platformV3 = platformV3;
