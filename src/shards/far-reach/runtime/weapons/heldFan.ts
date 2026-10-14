import type { createDeclaredHeldMelee } from '@wildshard/game/plugin/weaponFamily';
import { SKY_LIBRARY, skyHd } from '../../world/meshes';

export const FAN_HELD_OWNERS={library:SKY_LIBRARY,hero:{read:skyHd}};
export type WarFanWeapon = ReturnType<typeof createDeclaredHeldMelee>;
export type ConeFanTarget = ReturnType<NonNullable<Parameters<typeof createDeclaredHeldMelee>[2]['targets']>>[number];
