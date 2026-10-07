import { app } from '@wildshard/engine/app/runtime';
import { Melee as PlatformMelee, meleeActor as platformMeleeActor } from '@wildshard/engine/combat/Melee';
import { isMeleeProfile as platformIsMeleeProfile, type MeleeProfile as PlatformMeleeProfile, type ViewmodelFeel as PlatformViewmodelFeel } from '@wildshard/engine/combat/meleeProfile';

/** Transitional kit name for the platform's authored contact profile. */
export type MeleeProfile = PlatformMeleeProfile;
/** Transitional kit name for the platform's numeric view tuning. */
export type ViewmodelFeel = PlatformViewmodelFeel;
/** The platform discriminant retains legacy row handling. */
export const isMeleeProfile: typeof platformIsMeleeProfile = platformIsMeleeProfile;
/** All kit and SDK contact callers share the platform's one native/practice adapter cache. */
export const meleeActor: typeof platformMeleeActor = platformMeleeActor;

/** Compatibility constructor supplies the current combat pipeline; all family behavior lives in the engine. */
export abstract class Melee<P extends MeleeProfile = MeleeProfile> extends PlatformMelee<P> {
  constructor(profile: P) { super(profile, app.combat); }
}
