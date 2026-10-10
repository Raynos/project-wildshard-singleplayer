import { RewardBow as PlatformRewardBow, rewardBowType as platformRewardBowType, type RewardBowOptions as PlatformRewardBowOptions, type RewardBowPower as PlatformRewardBowPower, type RewardBowType as PlatformRewardBowType } from '@wildshard/game/systems/items/rewardBow';

/** A reward's behaviour over the built bow: applied once, after the replaced bow's state is carried over. */
export type RewardBowPower = PlatformRewardBowPower;
/** A reward bow's construction: the starter bow's options, its power and the bow it replaces. */
export type RewardBowOptions = PlatformRewardBowOptions;
/** The starter bow over a legendary's row, carrying the replaced bow's multiplier, loose hook and saddle (SHARD-PLATFORM SF36). */
export const RewardBow: typeof PlatformRewardBow = PlatformRewardBow;
/** A built reward bow. */
export type RewardBowWeapon = PlatformRewardBow;
/** The constructor a reward row binds. */
export type RewardBowType = PlatformRewardBowType;
/** Bind a reward's equipment row to the family: the shard writes the row and its power, never a subclass. */
export const rewardBowType: typeof platformRewardBowType = platformRewardBowType;
