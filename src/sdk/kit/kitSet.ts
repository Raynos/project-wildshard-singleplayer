import type { KitBuilder } from '@wildshard/game/systems/kit/kitConvert';
import { KitSet as PlatformKitSet } from '@wildshard/game/systems/kit/kitSet';

/** A world build's named kits: opaque, alpha-cut and swept builders by name, the reflective names, the draw distances
 *  and the ground-plan cells (SHARD-PLATFORM M3; extend KitSet to add a build's own records). */
export const KitSet: typeof PlatformKitSet = PlatformKitSet;
/** A world build's named kits (the instance type). */
export type KitSetView<K extends KitBuilder, X extends KitBuilder> = PlatformKitSet<K, X>;
