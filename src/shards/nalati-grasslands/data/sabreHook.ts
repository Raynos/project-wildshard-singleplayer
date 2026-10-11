import type { WeaponHooksData } from '@wildshard/format/weaponHooks';
import { SABRE_WEAPON_PROFILE } from './sabreProfile';

const mounted = SABRE_WEAPON_PROFILE.mounted;
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
