import { createHeldPresentation, type createDeclaredHeldMelee } from '@wildshard/game/plugin/weaponFamily';
import { WORLD } from '../../world/baked';
import { DUNE_LIBRARY, heldSurface } from '../../world/meshes';
import { WHIP_HELD_RECIPE } from '../../data/heldWeapon';

export const WHIP_HELD_OWNERS={world:WORLD,library:DUNE_LIBRARY,surface:{decorate:heldSurface}};
const owners=new Map<string,unknown>(Object.entries(WHIP_HELD_OWNERS));
export const buildWhipModel = ():ReturnType<typeof createHeldPresentation> => createHeldPresentation(WHIP_HELD_RECIPE,{owners});
export type Bullwhip = ReturnType<typeof createDeclaredHeldMelee>;
