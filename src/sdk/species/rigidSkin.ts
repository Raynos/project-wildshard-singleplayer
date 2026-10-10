import { placed as platformPlaced, skinParts as platformSkinParts, type SkinPart as PlatformSkinPart } from '@wildshard/game/systems/species/rigidSkin';

/** One rigid part of a creature: a three.js geometry, its flat colour and the one bone it rides. */
export type SkinPart = PlatformSkinPart;
/** Merge rigid parts into one skinned, vertex-coloured, flat-shaded geometry (each vertex weighted 1 to its part's bone); the parts are disposed. */
export const skinParts: typeof platformSkinParts = platformSkinParts;
/** A geometry moved to (x, y, z), optionally scaled and turned (radians about X, then Y, then Z). */
export const placed: typeof platformPlaced = platformPlaced;
