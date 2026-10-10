import { JavelinSpear as PlatformJavelinSpear, javelinSpearType as platformJavelinSpearType, type JavelinSpearDraws as PlatformJavelinSpearDraws, type JavelinSpearMount as PlatformJavelinSpearMount, type JavelinSpearOptions as PlatformJavelinSpearOptions, type JavelinSpearParts as PlatformJavelinSpearParts, type JavelinSpearPose as PlatformJavelinSpearPose, type JavelinSpearProfile as PlatformJavelinSpearProfile, type JavelinSpearRow as PlatformJavelinSpearRow, type JavelinSpearRowOptions as PlatformJavelinSpearRowOptions, type JavelinSpearType as PlatformJavelinSpearType, type JavelinSpearView as PlatformJavelinSpearView, type JavelinSpearWorld as PlatformJavelinSpearWorld } from '@wildshard/game/systems/items/javelinSpear';

/** The host the spear draws into. */
export type JavelinSpearWorld = PlatformJavelinSpearWorld;
/** The riding hook: the horse's ground speed (m/s) and heading (rad). */
export type JavelinSpearMount = PlatformJavelinSpearMount;
/** The numbers the spear reads beside a melee profile's: the thrust and the couched lance. */
export type JavelinSpearProfile = PlatformJavelinSpearProfile;
/** A spear's or a javelin's two draws: the painterly body and the PBR steel. */
export type JavelinSpearDraws = PlatformJavelinSpearDraws;
/** The shard's model: materials, spear, javelin and the geometry merge. */
export type JavelinSpearParts = PlatformJavelinSpearParts;
/** A pose in camera space: the right hand's grip point and the shaft's rotation. */
export type JavelinSpearPose = PlatformJavelinSpearPose;
/** The family's view as rows: the poses, the fists and sleeves, the RMB tap. */
export type JavelinSpearView = PlatformJavelinSpearView;
/** The family's construction: profile, javelin, model, view and unlock policy. */
export type JavelinSpearOptions<P extends JavelinSpearProfile> = PlatformJavelinSpearOptions<P>;
/** A two-handed spear that thrusts, throws javelins from its slot and couches as a lance in the saddle (SHARD-PLATFORM SF36). */
export const JavelinSpear: typeof PlatformJavelinSpear = PlatformJavelinSpear;
/** A built javelin spear. */
export type JavelinSpearWeapon<P extends JavelinSpearProfile = JavelinSpearProfile> = PlatformJavelinSpear<P>;
/** A shard's spear as a row: its default profile, javelin, model and view. */
export type JavelinSpearRow<P extends JavelinSpearProfile> = PlatformJavelinSpearRow<P>;
/** A row-bound spear's construction: the unlock policy and an optional profile. */
export type JavelinSpearRowOptions<P extends JavelinSpearProfile> = PlatformJavelinSpearRowOptions<P>;
/** The constructor a row binds. */
export type JavelinSpearType<P extends JavelinSpearProfile> = PlatformJavelinSpearType<P>;
/** Bind a shard's row (profile, javelin, model, view) to the family: the shard writes data and a model, never a subclass. */
export const javelinSpearType: typeof platformJavelinSpearType = platformJavelinSpearType;
