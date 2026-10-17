import * as v from 'valibot';
import { BowWeaponProfileSchema } from '@wildshard/format/weaponProfiles';
import rows from '../data/bowProfile.json' with { type: 'json' };

/** Admit the authored native bow rows at build time; runtime consumes combat/items. */
export const BOW_PROFILE = v.parse(BowWeaponProfileSchema, rows);
