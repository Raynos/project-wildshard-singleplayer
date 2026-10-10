import type { Targets } from '@wildshard/engine/combat/types';
import type { EquipmentRow } from '@wildshard/engine/combat/Equipment';
import { Bow, type BowOptions, type BowWorld } from '../../weapons/Bow';

/**
 * The reward bow family (SHARD-PLATFORM SF36): a legendary bow that takes the starter bow's slot. It is the starter bow
 * over the reward's equipment row; when it replaces a bow it keeps that bow's damage multiplier, loose hook and saddle
 * state, and then its `power` is applied once (a draw boost, a new style, its own loose behaviour — the power owns those
 * and its own clock).
 *
 *   export const GoldenBow = rewardBowType(GOLDEN_BOW);
 *   const next = new GoldenBow(world, targets, { row: BOW, profile, allowUnlocked, power, previous });
 */

/** A reward's behaviour over the built bow: applied once, after the replaced bow's state is carried over. */
export interface RewardBowPower {
  readonly apply: (bow: Bow) => void;
}
/** Construction: the starter bow's options (its row is replaced by the reward's), the power and the bow it replaces. */
export type RewardBowOptions = BowOptions & { power: RewardBowPower; previous?: Bow };

export class RewardBow extends Bow {
  constructor(world: BowWorld, targets: Targets, row: EquipmentRow, opts: RewardBowOptions) {
    super(world, targets, { ...opts, row });
    if (opts.previous) {
      this.damageMultiplier = opts.previous.damageMultiplier;
      this.onLoose = opts.previous.onLoose;
      this.carryMountState(opts.previous);
    }
    opts.power.apply(this);
  }
}

/** The constructor a reward row binds: `new GoldenBow(world, targets, { row, profile, power, previous })`. */
export interface RewardBowType {
  new (world: BowWorld, targets: Targets, opts: RewardBowOptions): RewardBow;
  readonly prototype: RewardBow;
}
/** Bind a reward's equipment row to the family (SHARD-PLATFORM SF36): the shard writes the row and its power, never a subclass. */
export function rewardBowType(row: EquipmentRow): RewardBowType {
  return class extends RewardBow {
    constructor(world: BowWorld, targets: Targets, opts: RewardBowOptions) {
      super(world, targets, row, opts);
    }
  };
}
