import { createHeldPresentation, createDeclaredHeldMelee } from '@wildshard/game/plugin/weaponFamily';
import { WORLD } from '../../world/baked';
import { DUNE_LIBRARY, heldSurface } from '../../world/meshes';
import { WHIP_HELD_RECIPE } from '../../data/heldWeapon';

const owners=new Map<string,unknown>([['world',WORLD],['library',DUNE_LIBRARY],['surface',{decorate:heldSurface}]]);
export const buildWhipModel = ():ReturnType<typeof createHeldPresentation> => createHeldPresentation(WHIP_HELD_RECIPE,{owners});
export type Bullwhip = ReturnType<typeof createDeclaredHeldMelee>;
interface Targets {readonly raycast:NonNullable<Parameters<typeof createDeclaredHeldMelee>[2]['raycast']>}
export const createWhip = (app:Parameters<typeof createDeclaredHeldMelee>[0],targets:Targets,contacts:unknown,charge:number):Bullwhip =>
  createDeclaredHeldMelee(app,WHIP_HELD_RECIPE,{model:{owners},contacts,charge,raycast:targets.raycast.bind(targets)});
