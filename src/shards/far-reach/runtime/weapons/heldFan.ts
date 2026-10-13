import { HeldMeleeWeapon, HeldPlayback } from '@wildshard/game/plugin/weaponFamily';
import type {Group,MeshStandardMaterial} from 'three';
import playback from '../../data/heldPlayback.generated.json' with {type:'json'};
import { FAN_PHASE } from '../../data/meleePhase';
import { FAN_ROW } from '../../weapons/rows';
import { fanSource } from '../../weapons/fanModel';
/** The shared contact scan target, including the owner's optional impulse port. */
export type ConeFanTarget = ReturnType<ConstructorParameters<typeof HeldMeleeWeapon>[3]['targets']>[number];
export type ConeFanContacts = ConstructorParameters<typeof HeldMeleeWeapon<ConeFanTarget,FanParts>>[3]['contacts'];
export interface FanParts {readonly group:Group;readonly fan:Group;readonly pendant:Group;readonly silk:MeshStandardMaterial;readonly playback:HeldPlayback}
/** Original fan ports and admitted phase rows on the one page owner. */
export class WarFan extends HeldMeleeWeapon<ConeFanTarget,FanParts> {
 constructor(app:ConstructorParameters<typeof HeldMeleeWeapon>[0],targets:()=>readonly ConeFanTarget[],contacts:ConeFanContacts) {
  const parts=fanParts();super(app,FAN_ROW,FAN_PHASE,{model:parts.group,parts,presentation:parts.playback,nodes:parts.playback.model?.parts??new Map(),contacts,targets});
 }
}
export type WarFanWeapon = WarFan;

export function fanParts():FanParts {
  const source=fanSource(), owner = new HeldPlayback(playback, new Map(), undefined, source), model = owner.model;
  if (source.hand !== null) owner.createPart(source.hand,'root');
  const group = model?.group('root'), fan = model?.group('fan'), pendant = model?.group('pendant'), silk = model?.standardMaterial('silk');
  if (group === null || group === undefined || fan === null || fan === undefined || pendant === null || pendant === undefined || silk === null || silk === undefined) throw new Error('Fan scene bindings unavailable');
  return { group, fan, pendant, silk, playback: owner };
}
