import type { createDeclaredHeldMelee } from '@wildshard/game/plugin/weaponFamily';
import { WORLD } from '../../world/baked';
import { DUNE_LIBRARY, heldSurface } from '../../world/meshes';

export const WHIP_HELD_OWNERS={world:WORLD,library:DUNE_LIBRARY,surface:{decorate:heldSurface}};
export type Bullwhip = ReturnType<typeof createDeclaredHeldMelee>;
