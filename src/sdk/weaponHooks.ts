import { installWeaponHooks as platformInstallWeaponHooks, type HookedWeapon as PlatformHookedWeapon, type WeaponHooksInstallation as PlatformWeaponHooksInstallation } from '@wildshard/game/shardfile/weaponHooksClient';
import { parseWeaponHooks, type WeaponHookLane as PlatformWeaponHookLane, type WeaponHooksData as PlatformWeaponHooksData } from '@wildshard/game/shardfile/weaponHooks';
import type { WeaponDamageInput as PlatformWeaponDamageInput, WeaponHooks as PlatformWeaponHooks } from '@wildshard/game/systems/items/weaponHooks';

/** A shard's validated weapon-hook declaration: one admitted module, the weapons it answers for, its parameters. */
export type WeaponHooksData = PlatformWeaponHooksData;
/** One weapon's admitted hooks (a family's `hooks` slot; null = its row rule). */
export type WeaponHooks = PlatformWeaponHooks;
/** What a family tells a damage hook: phase, base damage and the declared facts. */
export type WeaponDamageInput = PlatformWeaponDamageInput;
/** A weapon that takes hooks. */
export type HookedWeapon = PlatformHookedWeapon;
/** The declaration, the module bytes and the built weapons to hook. */
export type WeaponHooksInstallation = PlatformWeaponHooksInstallation;
/** An admitted weapon-hook module. */
export type WeaponHookLane = PlatformWeaponHookLane;
/** Validate a weapon-hook declaration before admitting its module (SHARD-PLATFORM SF36). */
export function weaponHooks(data: unknown): WeaponHooksData { return parseWeaponHooks(data); }
/** Admit the module and hook the built weapons, behind the default-off "Shard directors (data)" Developer row (SF36). */
export const installWeaponHooks: typeof platformInstallWeaponHooks = platformInstallWeaponHooks;
