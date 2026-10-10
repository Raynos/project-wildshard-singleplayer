import {
  decodeInstanceSets as platformDecodeInstanceSets, encodeInstanceSets as platformEncodeInstanceSets, fetchInstanceSets as platformFetchInstanceSets,
  instancedFromSet as platformInstancedFromSet, shuffleLanes as platformShuffleLanes, unshuffleLanes as platformUnshuffleLanes,
  type ColumnRow as PlatformColumnRow, type InstanceSet as PlatformInstanceSet, type InstanceSetRow as PlatformInstanceSetRow,
} from '@wildshard/game/systems/looks/bakedInstances';

/** How one column of a baked set is stored: in the binary, one word throughout, or an earlier column (negated). */
export type ColumnRow = PlatformColumnRow;
/** One baked instance set's row: its name, instance count and whether it carries colours (SHARD-PLATFORM M3). */
export type InstanceSetRow = PlatformInstanceSetRow;
/** One baked instance set: its float32 instance matrices and colours (or null). */
export type InstanceSet = PlatformInstanceSet;
/** 4-byte words as byte lanes (they deflate better). */
export const shuffleLanes: typeof platformShuffleLanes = platformShuffleLanes;
/** Byte lanes back to their words. */
export const unshuffleLanes: typeof platformUnshuffleLanes = platformUnshuffleLanes;
/** Build time: named instanced meshes as rows and one lane-shuffled binary of their matrices and colours. */
export const encodeInstanceSets: typeof platformEncodeInstanceSets = platformEncodeInstanceSets;
/** The sets from their unshuffled words, by name. */
export const decodeInstanceSets: typeof platformDecodeInstanceSets = platformDecodeInstanceSets;
/** Fetch a deflated, lane-shuffled instance bake and decode it against its rows. */
export const fetchInstanceSets: typeof platformFetchInstanceSets = platformFetchInstanceSets;
/** One instanced draw with a baked set's matrices and colours. */
export const instancedFromSet: typeof platformInstancedFromSet = platformInstancedFromSet;
