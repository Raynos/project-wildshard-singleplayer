import { ToonLight as PlatformToonLight, type ToonLightGlsl as PlatformToonLightGlsl, type ToonLightTune as PlatformToonLightTune, type ToonLightUniforms as PlatformToonLightUniforms } from '@wildshard/game/systems/looks/toonLight';

/** A toon light model's GLSL rows (SHARD-PLATFORM M3, look-family rows). */
export type ToonLightGlsl = PlatformToonLightGlsl;
/** The tunables' starting values as data. */
export type ToonLightTune = PlatformToonLightTune;
/** The live tunables a day / night clock turns. */
export type ToonLightUniforms = PlatformToonLightUniforms;
/** A toon light model (one patch of three's light chunk) and a colour-ramp fog from the shard's GLSL rows and tunables. */
export const ToonLight: typeof PlatformToonLight = PlatformToonLight;
