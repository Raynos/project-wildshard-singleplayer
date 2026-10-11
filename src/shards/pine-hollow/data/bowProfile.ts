import type * as v from 'valibot';
import type { BowWeaponProfileSchema } from '@wildshard/format/weaponProfiles';

/** Authored native bow clocks and ballistics. View poses, mounting and rewards remain their own owners. */
export const BOW_PROFILE = {
  family: 'bow', quiver: 20, speedBase: 32, speedDraw: 30, damageScale: 1.35,
  draw: { drawTime: 0.75, letdownTime: 0.4, renockTime: 0.62, renockEarly: 0.4, holdSteady: 3, holdTire: 8, tiredTime: 1.1 },
  spread: { degrees: 0.3, radius: 'sqrt', axisScale: 1, aimMultiplier: 0.5, motion: 0.6 },
  flight: { gravity: 6, drag: 0.014, windCoupling: 0.25 }, muzzle: 0.55, pool: 8, substeps: 4, lifetime: 12,
} satisfies v.InferOutput<typeof BowWeaponProfileSchema>;
