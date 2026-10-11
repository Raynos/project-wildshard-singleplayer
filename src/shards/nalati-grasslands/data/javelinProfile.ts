import type * as v from 'valibot';
import type { ThrownWeaponProfileSchema } from '@wildshard/format/weaponProfiles';

/** Native spear-slot javelins: launch, head/body damage, charge/recovery, ammunition and walk-in pickup. */
export const JAVELIN_WEAPON_PROFILE = {
  family: 'thrown', speed: 28, gravity: 9.8, damage: 55, headMultiplier: 2,
  radius: 0.03, headOffset: 0.8, windup: 0.4, release: 0.14, recovery: 0.45,
  carried: 3, pool: 5, pickupRadius: 1.6, pickupHeight: 2.2, survive: 0.9,
  arcPoints: 32, arcAfter: 0.12, stagger: 1,
} satisfies v.InferOutput<typeof ThrownWeaponProfileSchema>;
