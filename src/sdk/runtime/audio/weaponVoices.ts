import { sharedWeaponVoices as platformWeaponVoices, declaredWeaponVoices as platformDeclaredVoices, type WeaponSynth as PlatformWeaponSynth } from '@wildshard/game/systems/audio/weaponVoices';

/** Trusted sample and oscillator ports supplied by the owning mixer. */
export type WeaponSynth = PlatformWeaponSynth;
/** Preserve the existing sample-first recipes, random draw order and cue taps. */
export const sharedWeaponVoices: typeof platformWeaponVoices = platformWeaponVoices;
/** Resolve declared equipment voices without installing services or allocating mixer nodes on import. */
export const declaredWeaponVoices: typeof platformDeclaredVoices = platformDeclaredVoices;
