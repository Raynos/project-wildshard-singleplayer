import { Weapon as PlatformWeapon } from '@wildshard/engine/combat/Weapon';

/** Trusted platform weapon instance for transitional runtime subclasses until declared items replace them. */
export type WeaponInstance = PlatformWeapon;
/** The single platform weapon constructor; the trusted SDK surface adds no runtime state or implementation. */
export const Weapon: typeof PlatformWeapon = PlatformWeapon;
