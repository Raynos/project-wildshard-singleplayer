import { InstanceCuller as PlatformInstanceCuller, type InstanceLevel as PlatformInstanceLevel } from '@wildshard/game/systems/cull/instanceCuller';

/** A distance LOD of an instanced batch: a coarser copy drawn for the instances `from` m or more from the eye. */
export type InstanceLevel = PlatformInstanceLevel;
/** Per-instance frustum / distance culling for world-wide instanced batches, with distance LODs (SHARD-PLATFORM M3). */
export const InstanceCuller: typeof PlatformInstanceCuller = PlatformInstanceCuller;
/** An instance culler (the instance type). */
export type InstanceCullerView = PlatformInstanceCuller;
