import type * as v from 'valibot';
import type { FirearmWeaponProfileSchema } from '@wildshard/format/weaponProfiles';

/** The native semi-auto carbine's magazine/reload, hitscan damage/range/spread and bloom; its rendered rig stays local. */
export const RIFLE_WEAPON_PROFILE = {
  family: 'firearm', action: 'semi', magazine: 30, reserve: 90, interval: 0.09,
  reload: 1.6, reloadMode: 'magazine', autoReload: 0.35, damageScale: 0.55, range: 300,
  spreadAds: 0.12, spreadHip: 1.1, spreadRadius: 'linear', bloomShot: 0.35, bloomMax: 1.6,
  movingSpread: 0, movingAimReduction: 0,
  projectile: { kind: 'bullet', delivery: 'hitscan', speed: 0, radius: 0,
    flight: { gravity: 0, drag: 0, windCoupling: 0 }, pool: 1, substeps: 1, lifetime: 1 },
} satisfies v.InferOutput<typeof FirearmWeaponProfileSchema>;
