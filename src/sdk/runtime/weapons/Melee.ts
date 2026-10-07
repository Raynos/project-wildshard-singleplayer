import { Melee as PlatformMelee, meleeActor as platformMeleeActor } from '@wildshard/engine/combat/Melee';
import type { MeleeProfile } from '../../weapons/meleeProfile';

/** Trusted contact-family instance with authored sweep and view parameters. */
export type MeleeInstance<P extends MeleeProfile = MeleeProfile> = PlatformMelee<P>;
/** The one platform contact constructor, used by transitional runtime subclasses until declared items replace them. */
export const Melee: typeof PlatformMelee = PlatformMelee;
/** Native/practice targets share the platform's one cached combat actor adapter. */
export const meleeActor: typeof platformMeleeActor = platformMeleeActor;
