
import { authorCatalogueRows } from '@wildshard/sdk/formatJsonSchema';
import rows from '../data/skinPickups.json' with { type: 'json' };
import { WEAPON_FINISHES } from './weaponFinishes';

const PICKUP_KEYS = ['ghost-stag', 'hollow-ash', 'ironhide', 'blackpaw', 'imperial', 'warden', 'scarback-furnace'] as const;
/** The same seven authored skins, with their existing death selector compiled into the portable item catalogue. */
export function pinePickups(input: unknown = rows): ReturnType<typeof authorCatalogueRows<'lootEconomy.ClaimedPickupSchema', typeof PICKUP_KEYS>> {
  const pickups = authorCatalogueRows('lootEconomy.ClaimedPickupSchema', PICKUP_KEYS, input);
  return authorCatalogueRows('lootEconomy.ClaimedPickupSchema', PICKUP_KEYS, Object.fromEntries(Object.entries(pickups).map(([id, row]) => {
    const skin = WEAPON_FINISHES[id as keyof typeof WEAPON_FINISHES];
    return [id, { ...row, ...('dropsFrom' in skin ? { death: { ...skin.dropsFrom, floor: 'max' } } : {}) }];
  })));
}
