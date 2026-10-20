import { Weapon as PlatformWeapon } from '@wildshard/engine/combat/Weapon';

/** The single platform weapon constructor; the trusted SDK surface adds no runtime state or implementation. */
export const Weapon: typeof PlatformWeapon = PlatformWeapon;
