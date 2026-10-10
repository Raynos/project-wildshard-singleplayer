import { GullFlock as PlatformGullFlock, type GullGlsl as PlatformGullGlsl, type GullLook as PlatformGullLook, type GullPalette as PlatformGullPalette, type GullsSpec as PlatformGullsSpec } from '@wildshard/game/systems/looks/gullFlock';

/** A gull's colours as CSS colour strings. */
export type GullPalette = PlatformGullPalette;
/** The flap rig's GLSL rows (SHARD-PLATFORM M3, look-family rows). */
export type GullGlsl = PlatformGullGlsl;
/** A shard's gull look: palette, rig GLSL and patch id. */
export type GullLook = PlatformGullLook;
/** Where gulls perch, where the flocks wheel, how many. */
export type GullsSpec = PlatformGullsSpec;
/** A low-poly gull flock in one instanced draw: perching, wheeling, flushing and guiding gulls from the shard's look. */
export const GullFlock: typeof PlatformGullFlock = PlatformGullFlock;
