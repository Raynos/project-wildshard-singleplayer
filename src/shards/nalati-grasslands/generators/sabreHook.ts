import type { WeaponHooksData } from '@wildshard/format/weaponHooks';
import items from '../data/items.json' with { type: 'json' };
import { MeleeWeaponProfileSchema } from '@wildshard/format/weaponProfiles';
import * as v from 'valibot';

const mounted = v.parse(MeleeWeaponProfileSchema, items.rows.find(row => row.id === 'weapon.sabre')?.profile).mounted;
if (mounted === undefined) throw new Error('Sabre hook requires mounted combat');
/** Author declaration for the native sabre pass hook. The retained AS source supplies its generated module hash. */
export const SABRE_HOOK: Omit<WeaponHooksData, 'module'> = {
  id: 'nalati.weapons', entity: 1,
  parameters: [mounted.speedDivisor, mounted.chainStep, mounted.chainMax],
  weapons: [{ weapon: 'weapon.sabre', damage: {
    event: 1, phases: ['pass'],
    facts: [{ key: 'speed', min: 0, max: 1000 }, { key: 'links', min: 0, max: 100000 }],
    min: 0, max: 100000,
  } }],
};
