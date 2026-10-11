import type * as v from 'valibot';
import type { FirearmWeaponProfileSchema } from '@wildshard/format/weaponProfiles';

/** Pine's chamber, tube, timed per-round gate and native hitscan; sight poses and effects remain their own view owner. */
export const LEVER_WEAPON_PROFILE = {
  family: 'firearm', action: 'lever', magazine: 7, reserve: 21, interval: 0.68, reload: 0.4, reloadMode: 'perRound', autoReload: 0.35,
  damageScale: 1.5, range: 320, spreadAds: 0.06, spreadHip: 0.9, spreadRadius: 'sqrt', bloomShot: 0, bloomMax: 0,
  movingSpread: 0.5, movingAimReduction: 0.6,
  lever: { cycleDelay: 0.12, cycleTime: 0.56, reloadIn: 0.22, reloadOut: 0.2, ejectAt: 0.34, cockAt: 0.2, autoReloadClose: 5 },
  projectile: { kind: 'bullet', delivery: 'hitscan', speed: 0, radius: 0,
    flight: { gravity: 0, drag: 0, windCoupling: 0 }, pool: 1, substeps: 1, lifetime: 1 },
} satisfies v.InferOutput<typeof FirearmWeaponProfileSchema>;
