import type { LevelContext } from '@wildshard/engine/level/context';
import type { WeaponHooks } from '../systems/items/weaponHooks';
import { directorVariant } from './directorClient';
import { createWeaponHookLane, parseWeaponHooks, type WeaponHookLane } from './weaponHooks';

/** A weapon that takes hooks: the family's `hooks` slot (null = its row rule). */
export interface HookedWeapon { readonly row: { readonly id: string }; hooks: WeaponHooks | null }
/** The shard's declaration, its module bytes and the built weapons to hook. */
export interface WeaponHooksInstallation {
  data: unknown;
  bytes: () => Promise<Uint8Array>;
  /** each must be declared; its hooks are cleared when the level's scope ends */
  weapons: () => readonly HookedWeapon[];
}

/**
 * Admit a shard's weapon hooks and hand each built weapon its own (SHARD-PLATFORM SF36). Gated by the same default-off
 * Developer row as the shard directors ("Shard directors (data)": Legacy / Script): off, nothing is fetched and every
 * weapon keeps its row rule. Async admission never hooks a weapon after its level has gone.
 */
export async function installWeaponHooks(context: Pick<LevelContext, 'scope' | 'debugRow'>, options: WeaponHooksInstallation): Promise<WeaponHookLane | null> {
  if (!directorVariant(context)) return null;
  const data = parseWeaponHooks(options.data);
  const lane = await createWeaponHookLane(data, await options.bytes());
  if (context.scope.disposed) return null;
  const hooked = options.weapons().map((weapon) => ({ weapon, hooks: lane.hooks(weapon.row.id) }));
  for (const { weapon, hooks } of hooked) weapon.hooks = hooks;
  context.scope.onDispose(() => { for (const { weapon, hooks } of hooked) if (weapon.hooks === hooks) weapon.hooks = null; });
  return lane;
}
