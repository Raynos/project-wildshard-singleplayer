import { MagazineFirearm as PlatformMagazineFirearm, magazineFirearmType as platformMagazineFirearmType, type MagazineFirearmRow as PlatformMagazineFirearmRow, type MagazineFirearmRowOptions as PlatformMagazineFirearmRowOptions, type MagazineFirearmType as PlatformMagazineFirearmType, type MagazineFirearmOptions as PlatformMagazineFirearmOptions, type MagazineFirearmParts as PlatformMagazineFirearmParts, type MagazineFirearmProfile as PlatformMagazineFirearmProfile, type MagazineFirearmView as PlatformMagazineFirearmView } from '@wildshard/game/systems/items/magazineFirearm';

/** The numbers a magazine firearm reads (a `FirearmProfile` row satisfies it). */
export type MagazineFirearmProfile = PlatformMagazineFirearmProfile;
/** The gun's model parts the family animates: body meshes, charging handle, bolt, magazine, rear-sight glow, brass material. */
export type MagazineFirearmParts = PlatformMagazineFirearmParts;
/** The family's view as rows: the hip pose, the ejection port, the case, the muzzle flash and the tracer's life. */
export type MagazineFirearmView = PlatformMagazineFirearmView;
/** A magazine firearm's construction: its equipment row, profile row, parts builder and view row. */
export type MagazineFirearmOptions<P extends MagazineFirearmProfile> = PlatformMagazineFirearmOptions<P>;
/** A semi-automatic, magazine-fed hitscan gun held as a weapon over a shard's parts and rows (SHARD-PLATFORM SF36). */
export const MagazineFirearm: typeof PlatformMagazineFirearm = PlatformMagazineFirearm;
/** A built magazine firearm. */
export type MagazineFirearmWeapon<P extends MagazineFirearmProfile = MagazineFirearmProfile> = PlatformMagazineFirearm<P>;
/** A shard's gun as a row: its default profile, parts builder and view. */
export type MagazineFirearmRow<P extends MagazineFirearmProfile> = PlatformMagazineFirearmRow<P>;
/** A row-bound gun's construction: its equipment row, an optional profile and the muzzle light. */
export type MagazineFirearmRowOptions<P extends MagazineFirearmProfile> = PlatformMagazineFirearmRowOptions<P>;
/** The constructor a row binds. */
export type MagazineFirearmType<P extends MagazineFirearmProfile> = PlatformMagazineFirearmType<P>;
/** Bind a shard's row (profile, parts, view) to the family: the shard writes data and a model, never a subclass. */
export const magazineFirearmType: typeof platformMagazineFirearmType = platformMagazineFirearmType;
