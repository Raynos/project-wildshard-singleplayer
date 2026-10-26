import * as v from 'valibot';
import { BowWeaponProfileSchema } from '@wildshard/format/weaponProfiles';
import rows from '../data/bowProfile.json' with { type: 'json' };

/** Admit the authored native bow rows at build time; runtime consumes combat/items. */
export const BOW_PROFILE: { family: "bow"; quiver: number; speedBase: number; speedDraw: number; damageScale: number; draw: { drawTime: number; letdownTime: number; renockTime: number; renockEarly: number; holdSteady: number; holdTire: number; tiredTime: number; }; spread: { aimMultiplier: number; motion: number; } & { degrees: number; radius: "linear" | "sqrt"; axisScale: 1 | 2; }; flight: { gravity: number; drag: number; windCoupling: number; }; muzzle: number; pool: number; substeps: number; lifetime: number; } = v.parse(BowWeaponProfileSchema, rows);
