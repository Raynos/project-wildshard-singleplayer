import { createDeclaredHeldMelee, createHeldPresentation } from '@wildshard/game/plugin/weaponFamily';
import { FAN_HELD_RECIPE } from '../../data/heldWeapon';
import { fanSource } from '../../weapons/fanModel';

export type WarFanWeapon = ReturnType<typeof createDeclaredHeldMelee>;
export type ConeFanTarget = ReturnType<NonNullable<Parameters<typeof createDeclaredHeldMelee>[2]['targets']>>[number];
function fanModelPorts():Parameters<typeof createHeldPresentation>[1] {
  const source=fanSource();return {scene:source.ports,attachments:new Map([['hand',source.hand?.ports??null]])};
}
export const createFan = (app:Parameters<typeof createDeclaredHeldMelee>[0],targets:()=>readonly ConeFanTarget[],contacts:unknown):WarFanWeapon =>
  createDeclaredHeldMelee(app,FAN_HELD_RECIPE,{model:fanModelPorts(),targets,contacts});
export const fanParts = ():ReturnType<typeof createHeldPresentation> => createHeldPresentation(FAN_HELD_RECIPE,fanModelPorts());
