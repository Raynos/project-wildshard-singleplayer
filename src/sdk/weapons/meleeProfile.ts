import type { MeleeProfile as PlatformMeleeProfile, ViewmodelFeel as PlatformViewmodelFeel } from '@wildshard/engine/combat/meleeProfile';

/** Authored contact, combo, sweep and view parameters for trusted melee families. */
export type MeleeProfile = PlatformMeleeProfile;
/** Numeric camera lag, bob and sway parameters, independent of a particular weapon model. */
export type ViewmodelFeel = PlatformViewmodelFeel;
