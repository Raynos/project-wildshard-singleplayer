import { registerDrawnInto as platformRegisterDrawnInto, type DrawnCopy as PlatformDrawnCopy, type DrawnPlaced as PlatformDrawnPlaced } from '@wildshard/game/systems/kit/drawnInto';

/** One copy of a model drawn into a kit: the model's id, the kit, its placement and, when measured, its world box. */
export type DrawnCopy<K> = PlatformDrawnCopy<K>;
/** One `place` of a model on one kit's mesh. */
export type DrawnPlaced = PlatformDrawnPlaced;
/** Register a model's copies drawn into merged kit meshes on those meshes, one `place` per kit (SHARD-PLATFORM M3). */
export const registerDrawnInto: typeof platformRegisterDrawnInto = platformRegisterDrawnInto;
