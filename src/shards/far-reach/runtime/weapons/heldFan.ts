import { createHeldMelee, HeldPlayback } from '@wildshard/game/plugin/weaponFamily';
import playback from '../../data/heldPlayback.generated.json' with {type:'json'};
import { FAN_PHASE } from '../../data/meleePhase';
import { FAN_ROW } from '../../data/equipment';
import { fanSource } from '../../weapons/fanModel';

export type WarFanWeapon = ReturnType<typeof createHeldMelee>;
export type ConeFanTarget = ReturnType<NonNullable<Parameters<typeof createHeldMelee>[3]['targets']>>[number];
/** Bind the fan directly to the common held owner. */
export function createFan(app:Parameters<typeof createHeldMelee>[0],targets:()=>readonly ConeFanTarget[],contacts:unknown):WarFanWeapon {
 return createHeldMelee(app,FAN_ROW,FAN_PHASE,{presentation:fanParts(),targets,contacts});
}
export function fanParts():HeldPlayback {
  const source=fanSource(), owner = new HeldPlayback(playback, new Map(), undefined, source);
  if (source.hand !== null) owner.createPart(source.hand,'root');
  return owner;
}
