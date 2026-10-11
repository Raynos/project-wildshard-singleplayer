import type * as v from 'valibot';
import type { FirearmWeaponProfileSchema } from '@wildshard/format/weaponProfiles';

/** The native single-bolt rail, quiver, reload clock and physical flight. Range is the host's fixed world boundary, not hitscan reach. */
export const CROSSBOW_WEAPON_PROFILE = {
  family: 'firearm', action: 'bolt', magazine: 1, reserve: 29,
  interval: 0.3, reload: 1.35, reloadMode: 'single', autoReload: 1.4,
  damageScale: 1, range: 310, spreadAds: 0.15, spreadHip: 0.75, spreadRadius: 'linear', spreadAxisScale: 2,
  bloomShot: 0, bloomMax: 0, movingSpread: 0, movingAimReduction: 0,
  projectile: { kind: 'bolt', delivery: 'flight', speed: 62, radius: 0.03, muzzle: 0.35,
    flight: { gravity: 9.8, drag: 0.012, windCoupling: 0 }, pool: 8, substeps: 4, lifetime: 12 },
} satisfies v.InferOutput<typeof FirearmWeaponProfileSchema>;
