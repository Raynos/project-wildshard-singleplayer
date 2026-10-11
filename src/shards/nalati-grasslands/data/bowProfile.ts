import type * as v from 'valibot';
import type { BowWeaponProfileSchema } from '@wildshard/format/weaponProfiles';

/** Authored native bow clocks and ballistics. View poses, mounting and rewards remain their own owners. */
export const BOW_PROFILE = {
  family: 'bow', quiver: 24, speedBase: 30, speedDraw: 28, damageScale: 1.2,
  draw: { drawTime: 0.75, letdownTime: 0.4, renockTime: 0.62, renockEarly: 0.4, holdSteady: 3, holdTire: 8, tiredTime: 1.1 },
  spread: { degrees: 0.3, radius: 'sqrt', axisScale: 1, aimMultiplier: 0.5, motion: 0.6 },
  flight: { gravity: 5, drag: 0.015, windCoupling: 0.25 }, muzzle: 0.55, pool: 8, substeps: 4, lifetime: 12,
} satisfies v.InferOutput<typeof BowWeaponProfileSchema>;
