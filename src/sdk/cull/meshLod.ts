import { PX_PER_M as platformPxPerM, clusterLod as platformClusterLod, lodReady as platformLodReady, simplifiedCopy as platformSimplifiedCopy, triCount as platformTriCount } from '@wildshard/game/systems/cull/meshLod';

/** Metres a pixel spans per metre of distance on the reference phone frame (SHARD-PLATFORM M3, mesh LODs). */
export const PX_PER_M: number = platformPxPerM;
/** Loads meshoptimizer's simplifier; false where it cannot run. */
export const lodReady: typeof platformLodReady = platformLodReady;
/** A simplified copy of a geometry (shared attributes, a new index) within an absolute error. */
export const simplifiedCopy: typeof platformSimplifiedCopy = platformSimplifiedCopy;
/** A far LOD by vertex clustering, capped at a triangle count. */
export const clusterLod: typeof platformClusterLod = platformClusterLod;
/** The triangles in a geometry. */
export const triCount: typeof platformTriCount = platformTriCount;
