import { type createDeclaredHeldMelee, createHeldPresentation } from '@wildshard/game/plugin/weaponFamily';
import { FAN_HELD_RECIPE } from '../../data/heldWeapon';
import { SKY_LIBRARY, skyHd } from '../../world/meshes';

export const FAN_HELD_OWNERS={library:SKY_LIBRARY,hero:{read:skyHd}};
const owners=new Map<string,unknown>(Object.entries(FAN_HELD_OWNERS));
export type WarFanWeapon = ReturnType<typeof createDeclaredHeldMelee>;
export type ConeFanTarget = ReturnType<NonNullable<Parameters<typeof createDeclaredHeldMelee>[2]['targets']>>[number];
export const fanParts = ():ReturnType<typeof createHeldPresentation> => createHeldPresentation(FAN_HELD_RECIPE,{owners});
