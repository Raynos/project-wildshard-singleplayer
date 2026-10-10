import { EDGE as platformEdge, RuledKit as PlatformRuledKit, type RuledLook as PlatformRuledLook } from '@wildshard/game/systems/kit/ruledKit';

/** How a ruled face looks: its wash, pattern kind and parameters, emit, line weight and edge bits (SHARD-PLATFORM M3, the kit system). */
export type RuledLook = PlatformRuledLook;
/** Edge mask bits: which borders of a face get a ruled line. */
export const EDGE: typeof platformEdge = platformEdge;
/** A merged builder of ruled quads, boxes, beams, wires, cylinders, limbs, lathes and blobs. */
export const RuledKit: typeof PlatformRuledKit = PlatformRuledKit;
/** A ruled kit (the instance type; extend RuledKit to name your own). */
export type RuledKitView = PlatformRuledKit;
