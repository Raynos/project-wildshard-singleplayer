import { LeverFirearm as PlatformLeverFirearm, leverFirearmType as platformLeverFirearmType, leverOpen as platformLeverOpen, type LeverActionState as PlatformLeverActionState, type LeverFirearmAction as PlatformLeverFirearmAction, type LeverFirearmBuild as PlatformLeverFirearmBuild, type LeverFirearmHands as PlatformLeverFirearmHands, type LeverFirearmHandsBuilt as PlatformLeverFirearmHandsBuilt, type LeverFirearmHandsKit as PlatformLeverFirearmHandsKit, type LeverFirearmHooks as PlatformLeverFirearmHooks, type LeverFirearmOptions as PlatformLeverFirearmOptions, type LeverFirearmParts as PlatformLeverFirearmParts, type LeverFirearmProfile as PlatformLeverFirearmProfile, type LeverFirearmRow as PlatformLeverFirearmRow, type LeverFirearmRowOptions as PlatformLeverFirearmRowOptions, type LeverFirearmType as PlatformLeverFirearmType, type LeverFirearmView as PlatformLeverFirearmView, type LeverGrip as PlatformLeverGrip, type LeverPhase as PlatformLeverPhase } from '@wildshard/game/systems/items/leverFirearm';

/** The numbers a lever firearm reads: the hitscan's and the sights' blend (a `FirearmProfile` row satisfies it). */
export type LeverFirearmProfile = PlatformLeverFirearmProfile;
/** The lever's cycle: idle, the recoil beat, the throw, a reload through the gate. */
export type LeverPhase = PlatformLeverPhase;
/** The action as its pure helpers see it: the tube, the chamber and the reserve. */
export type LeverActionState = PlatformLeverActionState;
/** What a lever action tells its owner as it runs. */
export type LeverFirearmHooks = PlatformLeverFirearmHooks;
/** A shard's renderer-free lever action. */
export type LeverFirearmAction = PlatformLeverFirearmAction;
/** A build's parts in model space (the lever / hammer about their pivots). */
export type LeverFirearmParts = PlatformLeverFirearmParts;
/** A build: its three materials, its parts and the front sight's bead. */
export type LeverFirearmBuild = PlatformLeverFirearmBuild;
/** A hand grip: the fist's point, axis and palm normal. */
export type LeverGrip = PlatformLeverGrip;
/** A shard's hands on the rifle. */
export type LeverFirearmHands = PlatformLeverFirearmHands;
/** A pair of hands as built, with the right's rest and gate grips. */
export type LeverFirearmHandsBuilt = PlatformLeverFirearmHandsBuilt;
/** A shard's hands: the maker, a blank grip and the grip blend. */
export type LeverFirearmHandsKit = PlatformLeverFirearmHandsKit;
/** The family's view as rows: the magazine, kick, flash, brass, tracer, the lever's throw, the sights, the clock and the poses. */
export type LeverFirearmView = PlatformLeverFirearmView;
/** A lever firearm's construction: its equipment row, profile, builders, action, hands and view. */
export type LeverFirearmOptions<P extends LeverFirearmProfile> = PlatformLeverFirearmOptions<P>;
/** A lever-action hitscan rifle held as a weapon over a shard's model, hands, action and rows (SHARD-PLATFORM SF36). */
export const LeverFirearm: typeof PlatformLeverFirearm = PlatformLeverFirearm;
/** A built lever firearm. */
export type LeverFirearmWeapon<P extends LeverFirearmProfile = LeverFirearmProfile> = PlatformLeverFirearm<P>;
/** A shard's lever-action as a row. */
export type LeverFirearmRow<P extends LeverFirearmProfile, B extends object> = PlatformLeverFirearmRow<P, B>;
/** A row-bound lever-action's construction: its equipment row, an optional profile, the muzzle light and the shard's own. */
export type LeverFirearmRowOptions<P extends LeverFirearmProfile, B extends object> = PlatformLeverFirearmRowOptions<P, B>;
/** The constructor a row binds. */
export type LeverFirearmType<P extends LeverFirearmProfile, B extends object> = PlatformLeverFirearmType<P, B>;
/** Bind a shard's row to the family: the shard writes data and a model, never a subclass. */
export const leverFirearmType: typeof platformLeverFirearmType = platformLeverFirearmType;
/** The lever's throw over one cycle u 0..1: down fast, a beat open, up and home. */
export const leverOpen: typeof platformLeverOpen = platformLeverOpen;
