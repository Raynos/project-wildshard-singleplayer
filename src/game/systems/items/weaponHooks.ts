/**
 * Weapon hooks (SHARD-PLATFORM SF36): the points where a weapon family asks a shard's admitted AssemblyScript for a number
 * instead of using its own row rule. A family holds `hooks: WeaponHooks | null` (null = the row rule, always the default)
 * and calls a hook where it computes the number; a hook that declines, fails or answers out of its declared bounds returns
 * null and the family's own rule applies, so a hook can never stop a weapon working.
 *
 * The hooks come from `@wildshard/game/shardfile/weaponHooks` (`WeaponHookLane.hooks(weaponId)`), which admits the module
 * through the same ScriptHost as the shard's director (fuel, memory, event and failure ceilings) and keeps every call a
 * pure function of its inputs.
 *
 *   // in the family, where the mounted pass computes its damage:
 *   this.damage = this.hooks?.damage({ phase: 'pass', base, facts: { speed, links } }) ?? rowRule;
 */

/** The family's moment: `pass` = a mounted pass slash's damage, set at the swing's input edge (the mounted sword). */
export type WeaponHookPhase = 'pass';
/** The phases in their wire order (the script reads phase `index + 1`). */
export const WEAPON_HOOK_PHASES: readonly WeaponHookPhase[] = ['pass'];

/** What the family tells a damage hook: its phase, the row's base damage and the numeric facts the declaration names. */
export interface WeaponDamageInput {
  readonly phase: WeaponHookPhase;
  readonly base: number;
  /** keyed by the declaration's fact keys; a missing or out-of-bounds fact declines the call */
  readonly facts: Readonly<Record<string, number>>;
}

/** One weapon's admitted hooks. */
export interface WeaponHooks {
  /** a bounded integer damage, or null for the family's own rule */
  readonly damage: (input: WeaponDamageInput) => number | null;
}
