
import * as v from 'valibot';
import { ClaimedPickupSchema , type ClaimedPickupRows as ClaimedPickupRowsType } from '@wildshard/format/lootEconomy';
import rows from '../data/skinPickups.json' with { type: 'json' };
import { WEAPON_FINISHES } from './weaponFinishes';

const catalogue: v.StrictObjectSchema<{ readonly 'ghost-stag': v.GenericSchema<ClaimedPickupRowsType, ClaimedPickupRowsType>; readonly 'hollow-ash': v.GenericSchema<ClaimedPickupRowsType, ClaimedPickupRowsType>; readonly ironhide: v.GenericSchema<ClaimedPickupRowsType, ClaimedPickupRowsType>; readonly blackpaw: v.GenericSchema<ClaimedPickupRowsType, ClaimedPickupRowsType>; readonly imperial: v.GenericSchema<ClaimedPickupRowsType, ClaimedPickupRowsType>; readonly warden: v.GenericSchema<ClaimedPickupRowsType, ClaimedPickupRowsType>; readonly 'scarback-furnace': v.GenericSchema<ClaimedPickupRowsType, ClaimedPickupRowsType>; }, undefined> = v.strictObject({ 'ghost-stag': ClaimedPickupSchema, 'hollow-ash': ClaimedPickupSchema, ironhide: ClaimedPickupSchema,
  blackpaw: ClaimedPickupSchema, imperial: ClaimedPickupSchema, warden: ClaimedPickupSchema, 'scarback-furnace': ClaimedPickupSchema });
/** The same seven authored skins, with their existing death selector compiled into the portable item catalogue. */
export function pinePickups(input: unknown = rows): v.InferOutput<typeof catalogue> {
  const pickups = v.parse(catalogue, input);
  return v.parse(catalogue, Object.fromEntries(Object.entries(pickups).map(([id, row]) => {
    const skin = WEAPON_FINISHES[id as keyof typeof WEAPON_FINISHES];
    return [id, { ...row, ...('dropsFrom' in skin ? { death: { ...skin.dropsFrom, floor: 'max' } } : {}) }];
  })));
}
