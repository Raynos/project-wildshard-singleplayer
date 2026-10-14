import { createDeclaredHeldMelee, createHeldPresentation } from '@wildshard/game/plugin/weaponFamily';
import { FAN_HELD_RECIPE } from '../../data/heldWeapon';
import { SKY_LIBRARY, skyHd } from '../../world/meshes';

const owners=new Map<string,unknown>([['library',SKY_LIBRARY],['hero',{read:skyHd}]]);
export type WarFanWeapon = ReturnType<typeof createDeclaredHeldMelee>;
export type ConeFanTarget = ReturnType<NonNullable<Parameters<typeof createDeclaredHeldMelee>[2]['targets']>>[number];
export const createFan = (app:Parameters<typeof createDeclaredHeldMelee>[0],targets:()=>readonly ConeFanTarget[],contacts:unknown):WarFanWeapon =>
  createDeclaredHeldMelee(app,FAN_HELD_RECIPE,{model:{owners},targets,contacts});
export const fanParts = ():ReturnType<typeof createHeldPresentation> => createHeldPresentation(FAN_HELD_RECIPE,{owners});
