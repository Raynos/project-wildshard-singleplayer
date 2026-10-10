import { app } from '@wildshard/engine/app/runtime';
import type { MeleeProfile } from '@wildshard/engine/combat/meleeProfile';
import type { Targets } from '@wildshard/engine/combat/types';
import type { Move, SwordRig, SwordWorld } from '@wildshard/engine/combat/view/melee';
import { Sword } from '../../weapons/Sword';
import type { WeaponHooks } from './weaponHooks';

/**
 * The mounted sword family (SHARD-PLATFORM SF36): the starter sword's on-foot combo, heavy, lunge, hit-stop and trail
 * over a shard's blade, plus the saddle. While `mount` is set (the riding code writes the horse's speed and heading every
 * frame in the saddle, `null` on foot) a tap is ONE wide pass slash (`passes.left` / `passes.right`) on whichever side the
 * nearest live aim target inside `mounted.sense` m is relative to the horse's heading (none: the side you look to), its
 * damage `profile.damage × (1 + v / mounted.speedDivisor) × the pass chain`, `mounted.cooldown` s between passes and no
 * lunge (the horse does the moving). The heavy still works in the saddle. Mounted hits within `mounted.chainWindow` s chain:
 * `+mounted.chainStep` per link up to `× mounted.chainMax`; `passChain` (hits in the running chain, 0 = none) and
 * `passChainLeft` (s until it lapses) feed the HUD's chain chip.
 *
 * HOOKS (`hooks`, null by default): a shard's admitted AssemblyScript may answer the pass damage (`damage`, phase `pass`,
 * facts `speed` = the horse's ground speed ≥ 0 and `links` = the live chain's hits, 0 when it has lapsed); a declined or
 * failed call keeps the row rule above. A reward replacement does not carry the hooks (they are declared per weapon id).
 *
 * A reward that upgrades the sword is a `power`: `apply(sword)` once the sword is built, `onSwingStart(move)` at every
 * swing's input edge (in place of the family's own no-op hook).
 *
 *   export const Sabre = mountedSwordType({ profile: SABRE_PROFILE, rig: sabreRig, passes: { left: PASS_LEFT, right: PASS_RIGHT } });
 *   export const Naizagai = mountedSwordVariant(Sabre, NAIZAGAI_PROFILE);
 *   const sabre = new Sabre(world, targets, { allowUnlocked });  sabre.mount = { speed, yaw };
 */

/** The riding hook: the horse's ground speed (m/s) and heading (rad, the player's yaw convention). */
export interface MountedSwordMount { speed: number; yaw: number }

/** The numbers the saddle reads, beside a melee profile's. */
export interface MountedSwordProfile extends MeleeProfile {
  readonly mounted: {
    /** pass slash reach (m) is the moves'; these are the pass clock, the side sense and the chain */
    readonly reach: number; readonly cooldown: number; readonly sense: number;
    readonly chainWindow: number; readonly chainStep: number; readonly chainMax: number;
    /** damage × (1 + speed / speedDivisor) */
    readonly speedDivisor: number;
    /** a target further than this (m, negative = behind) along the heading is already passed */
    readonly behind: number;
  };
}

/** The two pass slashes: the backhand on the left, the forehand on the right. */
export interface MountedSwordPasses { readonly left: Move; readonly right: Move }

/** A reward's behaviour over a built sword: applied once, told of every swing's start. */
export interface MountedSwordPower<W> {
  readonly apply: (sword: W) => void;
  readonly onSwingStart: (move: Move) => void;
}

/** The family's construction: the profile row, the built rig, the passes, an optional power and the unlock policy. */
export interface MountedSwordOptions<P extends MountedSwordProfile> {
  readonly profile: P;
  readonly rig: SwordRig;
  readonly passes: MountedSwordPasses;
  readonly allowUnlocked?: boolean;
  readonly power?: MountedSwordPower<MountedSword<P>>;
}

export class MountedSword<P extends MountedSwordProfile = MountedSwordProfile> extends Sword {
  /** set by the riding code every frame in the saddle (`null` on foot): taps become the pass slash */
  mount: MountedSwordMount | null = null;
  /** mounted hits in the running pass chain (0 = none) — the HUD's "2 HIT" chip */
  passChain = 0;
  /** the shard's admitted weapon hooks (`@wildshard/game/shardfile/weaponHooksClient`); null = the row rule */
  hooks: WeaponHooks | null = null;
  private chainT = 0;
  private mountCd = 0;
  private readonly swordProfile: P;
  private readonly passes: MountedSwordPasses;
  private readonly power: MountedSwordPower<MountedSword<P>> | null;

  constructor(world: SwordWorld, targets: Targets | undefined, opts: MountedSwordOptions<P>) {
    super(world, targets, { row: opts.profile, profile: opts.profile, allowUnlocked: opts.allowUnlocked ?? false, rig: opts.rig });
    this.swordProfile = opts.profile;
    this.passes = opts.passes;
    this.power = opts.power ?? null;
    this.power?.apply(this);
  }
  protected override onSwingStart(move: Move): void {
    if (this.power !== null) this.power.onSwingStart(move);
    else super.onSwingStart(move);
  }
  protected override onMoveHit(move: Move): void {
    if (move !== this.passes.left && move !== this.passes.right) return;
    this.passChain = this.chainT > 0 ? this.passChain + 1 : 1;
    this.chainT = this.swordProfile.mounted.chainWindow;
  }
  /** Reward replacement retains the riding clock and loot-adjusted heavy strength. */
  carryPassState(previous: MountedSword<P>): void {
    this.mount = previous.mount; this.passChain = previous.passChain;
    this.chainT = previous.chainT; this.mountCd = previous.mountCd; this.heavyMult = previous.heavyMult;
  }

  get mounted(): boolean { return this.mount !== null; }
  /** s until the pass chain lapses */
  get passChainLeft(): number { return this.chainT; }

  override tryFire(): void {
    const m = this.mount;
    if (m === null) { super.tryFire(); return; }
    if (this.mountCd > 0 || this.chargingHeavy) return;
    const side = this.passSide(m);
    const mounted = this.swordProfile.mounted;
    const links = this.chainT > 0 ? this.passChain : 0, speed = Math.max(0, m.speed);
    const scripted = this.hooks?.damage({ phase: 'pass', base: this.swordProfile.damage, facts: { speed, links } }) ?? null;
    this.damage = scripted ?? Math.round(this.swordProfile.damage * (1 + speed / mounted.speedDivisor) * Math.min(mounted.chainMax, 1 + mounted.chainStep * links));
    if (this.strikeMove(side < 0 ? this.passes.left : this.passes.right, false)) this.mountCd = mounted.cooldown;
  }

  /** −1 = left, +1 = right of the horse's heading: the nearest live aim target within `mounted.sense`, else the way you look */
  private passSide(m: MountedSwordMount): number {
    const p = this.player.position, mounted = this.swordProfile.mounted;
    const fx = -Math.sin(m.yaw), fz = -Math.cos(m.yaw), rx = Math.cos(m.yaw), rz = -Math.sin(m.yaw);
    let best = Infinity, side = 0;
    for (const t of app.aimTargets) {
      if (!t.alive || t.hidden === true) continue;
      const dx = t.position.x - p.x, dz = t.position.z - p.z, d = Math.hypot(dx, dz);
      if (d > mounted.sense || d >= best) continue;
      if (dx * fx + dz * fz < mounted.behind) continue; // well behind: already passed
      best = d; side = dx * rx + dz * rz >= 0 ? 1 : -1;
    }
    if (side !== 0) return side;
    const look = Math.atan2(Math.sin(this.player.yaw - m.yaw), Math.cos(this.player.yaw - m.yaw));
    return look > 0 ? -1 : 1; // yaw grows to the left
  }

  override update(dt: number, t: number): void {
    this.mountCd = Math.max(0, this.mountCd - dt);
    if (this.chainT > 0) { this.chainT = Math.max(0, this.chainT - dt); if (this.chainT === 0) this.passChain = 0; }
    if (!this.swinging) this.damage = this.swordProfile.damage; // a pass slash sets its own number for its one swing
    super.update(dt, t);
  }
}

/** A shard's mounted sword as a row: its default profile, its rig builder (the world's sky for materials) and its passes. */
export interface MountedSwordRow<P extends MountedSwordProfile> {
  readonly profile: P;
  readonly rig: (world: SwordWorld, profile: P) => SwordRig;
  readonly passes: MountedSwordPasses;
}
/** Construction of a row-bound sword: an optional profile over the row's, an optional power and the unlock policy. */
export interface MountedSwordRowOptions<P extends MountedSwordProfile> {
  allowUnlocked?: boolean;
  profile?: P;
  power?: MountedSwordPower<MountedSword<P>>;
}
/** The constructor a row binds: `new Sabre(world, targets, { allowUnlocked })`. */
export interface MountedSwordType<P extends MountedSwordProfile> {
  new (world: SwordWorld, targets?: Targets, opts?: MountedSwordRowOptions<P>): MountedSword<P>;
  readonly prototype: MountedSword<P>;
}
/** A variant's constructor: the base row's sword with the variant's profile, its power required. */
export interface MountedSwordVariantType<P extends MountedSwordProfile> {
  new (world: SwordWorld, targets: Targets, opts: { allowUnlocked?: boolean; power: MountedSwordPower<MountedSword<P>> }): MountedSword<P>;
  readonly prototype: MountedSword<P>;
}

/**
 * Bind a shard's row to the family (SHARD-PLATFORM SF36): the shard writes data and a blade, never a subclass.
 *
 *   export const Sabre = mountedSwordType({ profile: SABRE_PROFILE, rig: sabreRig, passes: { left: PASS_LEFT, right: PASS_RIGHT } });
 */
export function mountedSwordType<P extends MountedSwordProfile>(row: MountedSwordRow<P>): MountedSwordType<P> {
  return class extends MountedSword<P> {
    constructor(world: SwordWorld, targets?: Targets, opts: MountedSwordRowOptions<P> = {}) {
      const profile = opts.profile ?? row.profile;
      super(world, targets, { profile, rig: row.rig(world, profile), passes: row.passes, allowUnlocked: opts.allowUnlocked ?? false,
        ...(opts.power ? { power: opts.power } : {}) });
    }
  };
}

/**
 * A reward row over a bound sword (SHARD-PLATFORM SF36): the same sword type (an `instanceof` the base holds) with the
 * variant's profile and a required power.
 *
 *   export const Naizagai = mountedSwordVariant(Sabre, NAIZAGAI_PROFILE);
 *   const nz = new Naizagai(world, targets, { allowUnlocked, power });
 */
export function mountedSwordVariant<P extends MountedSwordProfile>(base: MountedSwordType<P>, profile: P): MountedSwordVariantType<P> {
  return class extends base {
    constructor(world: SwordWorld, targets: Targets, opts: { allowUnlocked?: boolean; power: MountedSwordPower<MountedSword<P>> }) {
      super(world, targets, { ...opts, profile });
    }
  };
}
