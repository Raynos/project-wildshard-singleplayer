import { flattenGlbParts as platformFlattenGlbParts, loadLodGlb as platformLoadLodGlb, type GlbPart as PlatformGlbPart } from '@wildshard/game/systems/kit/lodGlb';

/** One flattened glTF part: geometry, material, world matrix (SHARD-PLATFORM M3, the kit system). */
export type GlbPart = PlatformGlbPart;
/** Fetches a glTF scene. */
export const loadLodGlb: typeof platformLoadLodGlb = platformLoadLodGlb;
/** A glTF scene's meshes as parts, maps at 8× anisotropy, each material passed to the caller's setup. */
export const flattenGlbParts: typeof platformFlattenGlbParts = platformFlattenGlbParts;
