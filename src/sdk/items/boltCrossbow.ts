import { BoltCrossbow as PlatformBoltCrossbow, crossbowType as platformCrossbowType, PLAIN_BOLT as PLATFORM_PLAIN_BOLT, type BoltCrossbowHands as PlatformBoltCrossbowHands, type BoltCrossbowInto as PlatformBoltCrossbowInto, type BoltCrossbowOptions as PlatformBoltCrossbowOptions, type BoltCrossbowParts as PlatformBoltCrossbowParts, type BoltCrossbowProfile as PlatformBoltCrossbowProfile, type BoltCrossbowRow as PlatformBoltCrossbowRow, type BoltCrossbowRowOptions as PlatformBoltCrossbowRowOptions, type BoltCrossbowType as PlatformBoltCrossbowType, type BoltCrossbowView as PlatformBoltCrossbowView, type BoltFlight as PlatformBoltFlight, type BoltFlightStep as PlatformBoltFlightStep, type BoltMod as PlatformBoltMod } from '@wildshard/game/systems/items/boltCrossbow';

/** The numbers a bolt crossbow reads: quiver, bolt speed / flight / reach / bury, timing, kick, ADS and the pools. */
export type BoltCrossbowProfile = PlatformBoltCrossbowProfile;
/** The flight multipliers a bolt carries (the ammo's, the weather's): 1 / 1 is the plain bolt. */
export type BoltFlight = PlatformBoltFlight;
/** A shard's bolt flight law: one deterministic substep writing only `pos` / `vel`. */
export type BoltFlightStep<P extends BoltCrossbowProfile> = PlatformBoltFlightStep<P>;
/** A special bolt: the next loose's flight multipliers, damage scale and dress. */
export type BoltMod = PlatformBoltMod;
/** The plain bolt (no multipliers, the bolt's own material). */
export const PLAIN_BOLT: BoltMod = PLATFORM_PLAIN_BOLT;
/** The crossbow's model parts the family animates: the string, the loaded bolt, the peep, the bolt mesh and rest points. */
export type BoltCrossbowParts = PlatformBoltCrossbowParts;
/** Where a parts builder puts the model: the viewmodel group and the peep sight's groups. */
export type BoltCrossbowInto = PlatformBoltCrossbowInto;
/** A shard's hands on the crossbow: posed per frame, measured, disposed on a rebuild. */
export type BoltCrossbowHands = PlatformBoltCrossbowHands;
/** The family's view as rows: the hip pose and scale, the iron sights and the rear peep. */
export type BoltCrossbowView = PlatformBoltCrossbowView;
/** A bolt crossbow's construction: its equipment row, profile, parts and hands builders, flight law and view. */
export type BoltCrossbowOptions<P extends BoltCrossbowProfile> = PlatformBoltCrossbowOptions<P>;
/** A first-person crossbow loosing physical bolts over a shard's parts and rows (SHARD-PLATFORM SF36). */
export const BoltCrossbow: typeof PlatformBoltCrossbow = PlatformBoltCrossbow;
/** A built bolt crossbow. */
export type BoltCrossbowWeapon<P extends BoltCrossbowProfile = BoltCrossbowProfile> = PlatformBoltCrossbow<P>;
/** A shard's crossbow as a row: its default profile, parts and hands builders, flight law and view. */
export type BoltCrossbowRow<P extends BoltCrossbowProfile> = PlatformBoltCrossbowRow<P>;
/** A row-bound crossbow's construction: its equipment row and an optional profile. */
export type BoltCrossbowRowOptions<P extends BoltCrossbowProfile> = PlatformBoltCrossbowRowOptions<P>;
/** The constructor a row binds. */
export type BoltCrossbowType<P extends BoltCrossbowProfile> = PlatformBoltCrossbowType<P>;
/** Bind a shard's row (profile, parts, hands, flight, view) to the family: the shard writes data and a model, never a subclass. */
export const crossbowType: typeof platformCrossbowType = platformCrossbowType;
