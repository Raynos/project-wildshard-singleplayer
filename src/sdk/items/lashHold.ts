import { buildLashHold as platformBuildLashHold, lashWrapMaterial as platformLashWrapMaterial, type LashCodeCoil as PlatformLashCodeCoil, type LashHoldModels as PlatformLashHoldModels, type LashHoldParts as PlatformLashHoldParts, type LashHoldRow as PlatformLashHoldRow } from '@wildshard/game/systems/items/lashHold';

/** A held lash's code coil: its loops, their radius, the cord and its pose. */
export type LashCodeCoil = PlatformLashCodeCoil;
/** The held lash as rows: the code fist, the generated glove's fit, the poses, the code coil and the hero glove's coil (SHARD-PLATFORM M3). */
export type LashHoldRow = PlatformLashHoldRow;
/** The held lash's models as loaders (the generated glove, the hero glove) and the hero coil's surface. */
export type LashHoldModels = PlatformLashHoldModels;
/** A built held lash: root, grip, code coil, thrown cord, the keeper's tip and the loaded gloves. */
export type LashHoldParts = PlatformLashHoldParts;
/** Builds the held lash from its rows, each loaded glove replacing the layer before. */
export const buildLashHold: typeof platformBuildLashHold = platformBuildLashHold;
/** The lash's matte braid as a plain material, for a pull's wrap coil. */
export const lashWrapMaterial: typeof platformLashWrapMaterial = platformLashWrapMaterial;
