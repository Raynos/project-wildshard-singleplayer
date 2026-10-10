import { addKitMeshes as platformAddKitMeshes, type KitMeshes as PlatformKitMeshes } from '@wildshard/game/systems/kit/kitMeshes';

/** A world's kit meshes: the opaque ones by kit name, and every mesh with a draw distance. */
export type KitMeshes = PlatformKitMeshes;
/** Add a GPU-only mesh per converted kit, named `kit:<name>`, opaque then alpha-cut (SHARD-PLATFORM M3). */
export const addKitMeshes: typeof platformAddKitMeshes = platformAddKitMeshes;
