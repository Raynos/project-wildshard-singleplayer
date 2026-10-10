import { BatchedLodSet as PlatformBatchedLodSet, geometrySize as platformGeometrySize, type LodInstance as PlatformLodInstance, type LodPlanRow as PlatformLodPlanRow } from '@wildshard/game/systems/cull/batchedLod';

/** One instance to add to a batch's own two-level set (SHARD-PLATFORM M3, the cull system). */
export type LodPlanRow = PlatformLodPlanRow;
/** One added instance with its level state. */
export type LodInstance = PlatformLodInstance;
/** A geometry's vertex and index counts as a batch reserves them. */
export const geometrySize: typeof platformGeometrySize = platformGeometrySize;
/** A BatchedMesh's own instances with two distance levels, re-chosen as the camera moves. */
export const BatchedLodSet: typeof PlatformBatchedLodSet = PlatformBatchedLodSet;
/** A batch's own two-level instances (the instance type). */
export type BatchedLodSetView = PlatformBatchedLodSet;
