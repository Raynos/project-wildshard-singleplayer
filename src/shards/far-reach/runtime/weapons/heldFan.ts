import { HeldMeleeWeapon, HeldPlayback } from '@wildshard/game/plugin/weaponFamily';
import playback from '../../data/heldPlayback.generated.json' with {type:'json'};
import { FAN_PHASE } from '../../data/meleePhase';
import { FAN_ROW } from '../../data/equipment';
import { fanSource } from '../../weapons/fanModel';

export type ConeFanTarget = ReturnType<ConstructorParameters<typeof HeldMeleeWeapon>[3]['targets']>[number];
export type ConeFanContacts = ConstructorParameters<typeof HeldMeleeWeapon<ConeFanTarget,HeldPlayback>>[3]['contacts'];
/** Scene and phase rows share the same held owner as the lash. */
export class WarFan extends HeldMeleeWeapon<ConeFanTarget,HeldPlayback> {
 constructor(app:ConstructorParameters<typeof HeldMeleeWeapon>[0],targets:()=>readonly ConeFanTarget[],contacts:ConeFanContacts) {
  const model=fanParts();super(app,FAN_ROW,FAN_PHASE,{model:model.root,parts:model,presentation:model,nodes:model.model?.parts??new Map(),contacts,targets});
 }
}
export type WarFanWeapon = WarFan;
export function fanParts():HeldPlayback {
  const source=fanSource(), owner = new HeldPlayback(playback, new Map(), undefined, source);
  if (source.hand !== null) owner.createPart(source.hand,'root');
  return owner;
}
