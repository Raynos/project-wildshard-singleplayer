import { ToonArms as PlatformToonArms, type ToonArmsGlsl as PlatformToonArmsGlsl, type ToonArmsLook as PlatformToonArmsLook } from '@wildshard/game/systems/viewmodel/toonArms';

/** Toon arms' GLSL rows (SHARD-PLATFORM M3, look-family rows). */
export type ToonArmsGlsl = PlatformToonArmsGlsl;
/** A shard's toon arms as data: the rig, framing, blades, swim line, materials and names. */
export type ToonArmsLook = PlatformToonArmsLook;
/** Toon first-person arms: a skinned rig with two swords and swimming hands, dressed from the shard's rows. */
export const ToonArms: typeof PlatformToonArms = PlatformToonArms;
