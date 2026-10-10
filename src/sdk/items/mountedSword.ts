import { MountedSword as PlatformMountedSword, mountedSwordType as platformMountedSwordType, mountedSwordVariant as platformMountedSwordVariant, type MountedSwordMount as PlatformMountedSwordMount, type MountedSwordOptions as PlatformMountedSwordOptions, type MountedSwordPasses as PlatformMountedSwordPasses, type MountedSwordPower as PlatformMountedSwordPower, type MountedSwordProfile as PlatformMountedSwordProfile, type MountedSwordRow as PlatformMountedSwordRow, type MountedSwordRowOptions as PlatformMountedSwordRowOptions, type MountedSwordType as PlatformMountedSwordType, type MountedSwordVariantType as PlatformMountedSwordVariantType } from '@wildshard/game/systems/items/mountedSword';

/** The riding hook: the horse's ground speed (m/s) and heading (rad). */
export type MountedSwordMount = PlatformMountedSwordMount;
/** The numbers the saddle reads beside a melee profile's: the pass clock, the side sense and the chain. */
export type MountedSwordProfile = PlatformMountedSwordProfile;
/** The two pass slashes. */
export type MountedSwordPasses = PlatformMountedSwordPasses;
/** A reward's behaviour over a built sword: applied once, told of every swing's start. */
export type MountedSwordPower<W> = PlatformMountedSwordPower<W>;
/** The family's construction: profile, built rig, passes, power and unlock policy. */
export type MountedSwordOptions<P extends MountedSwordProfile> = PlatformMountedSwordOptions<P>;
/** The starter sword's combo and heavy over a shard's blade, plus the saddle's pass slashes and chain (SHARD-PLATFORM SF36). */
export const MountedSword: typeof PlatformMountedSword = PlatformMountedSword;
/** A built mounted sword. */
export type MountedSwordWeapon<P extends MountedSwordProfile = MountedSwordProfile> = PlatformMountedSword<P>;
/** A shard's mounted sword as a row: its default profile, rig builder and passes. */
export type MountedSwordRow<P extends MountedSwordProfile> = PlatformMountedSwordRow<P>;
/** A row-bound sword's construction: an optional profile, an optional power and the unlock policy. */
export type MountedSwordRowOptions<P extends MountedSwordProfile> = PlatformMountedSwordRowOptions<P>;
/** The constructor a row binds. */
export type MountedSwordType<P extends MountedSwordProfile> = PlatformMountedSwordType<P>;
/** A reward variant's constructor (its power required). */
export type MountedSwordVariantType<P extends MountedSwordProfile> = PlatformMountedSwordVariantType<P>;
/** Bind a shard's row (profile, rig, passes) to the family: the shard writes data and a blade, never a subclass. */
export const mountedSwordType: typeof platformMountedSwordType = platformMountedSwordType;
/** A reward row over a bound sword: the base's type with the variant's profile and a required power. */
export const mountedSwordVariant: typeof platformMountedSwordVariant = platformMountedSwordVariant;
