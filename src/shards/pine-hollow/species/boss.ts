/** Pine's custom rig registration remains counted shard view code. */
import { registerSpecies, variantDef, hasSpecies, type SpeciesDef } from '@wildshard/engine/entities/species/registry';
import { roamingBossDamage } from '@wildshard/game/boss/roamingProjection';
import { pineGrazer } from './looks';
import { KING_VARIANT, kingOwnSpecies } from '../runtime/models/antlerKing';

export const KING_KIND = 'antler-king';
/** the King's species: the elk's fields re-registered as 'antler-king' — its own AI (the fight drives it), no blood (bark) —
 *  on his own upright rig (E322 F-M1, kingOwnSpecies) */
export function registerKing(): void {
  if (hasSpecies(KING_KIND)) return;
  const elk: SpeciesDef = pineGrazer('elk');
  const def: SpeciesDef = {
    ...elk, kind: KING_KIND, label: 'The Antler King', variants: [KING_VARIANT], aggressive: true, blood: false,
    walkSpeed: 2.2, chargeSpeed: 13,
    sounds: { call: 'elk_bugle', hurt: 'bear_hurt', callEvery: [600, 900] },
    eyeGlow: [1.0, 0.55, 0.15], eyeGlowIntensity: 2.5,
    think: () => { /* the fight's update drives him (AntlerKingFight) */ },
    damageMul: (a, p) => roamingBossDamage(a, p),
  };
  registerSpecies(kingOwnSpecies(def));
}

/** The variant a thrall of `kind` is spawned as: the creature lane's registered 'thrall' (Pine registers one for elk and
 *  boar); a missing one is a content error, never a stand-in. */
export function thrallVariant(kind: 'elk' | 'boar'): string {
  if (variantDef(kind, 'thrall').id !== 'thrall') throw new Error(`[antler-king] no 'thrall' variant registered for ${kind}`);
  return 'thrall';
}
