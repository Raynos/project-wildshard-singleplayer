import type { MeleeProfile as PlatformMeleeProfile, ViewmodelFeel as PlatformViewmodelFeel } from '@wildshard/engine/combat/meleeProfile';

/** Authored swept combo and view parameters; ordered contact rows are defined by the format's weaponProfiles module. */
export type MeleeProfile = PlatformMeleeProfile;
/** Numeric camera lag, bob and sway parameters, independent of a particular weapon model. */
export type ViewmodelFeel = PlatformViewmodelFeel;
