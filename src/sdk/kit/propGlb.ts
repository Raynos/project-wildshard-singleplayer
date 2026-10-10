import { loadPropGlb as platformLoadPropGlb, propGlbBox as platformPropGlbBox, type PropGlbOptions as PlatformPropGlbOptions } from '@wildshard/game/systems/kit/propGlb';

/** How a generated prop becomes kit geometry: material class, palette / ramp / metal wash, AO, clip, transform. */
export type PropGlbOptions = PlatformPropGlbOptions;
/** Loads a post-processed generated prop (glb) as swept-kit geometry (SHARD-PLATFORM M3, the kit system). */
export const loadPropGlb: typeof platformLoadPropGlb = platformLoadPropGlb;
/** The bounding box of a glb's positions (glTF space). */
export const propGlbBox: typeof platformPropGlbBox = platformPropGlbBox;
