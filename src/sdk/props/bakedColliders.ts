import { bakedColliderDesc as platformBakedColliderDesc, bakedColliderSchemas as platformBakedColliderSchemas, type BakedCollider as PlatformBakedCollider, type BakedColliderSchemas as PlatformBakedColliderSchemas } from '@wildshard/game/systems/props/bakedColliders';

/** One parsed baked collider. */
export type BakedCollider = PlatformBakedCollider;
/** A bake's schemas: the surface picklist and the collider variant. */
export type BakedColliderSchemas = PlatformBakedColliderSchemas;
/** The strict schemas of a browser bake's registry colliders on the given surfaces (SHARD-PLATFORM M3). */
export const bakedColliderSchemas: typeof platformBakedColliderSchemas = platformBakedColliderSchemas;
/** A parsed baked collider as the engine's descriptor (SHARD-PLATFORM M3). */
export const bakedColliderDesc: typeof platformBakedColliderDesc = platformBakedColliderDesc;
