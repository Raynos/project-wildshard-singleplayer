import type { SpeciesDef, VariantDef } from '@wildshard/engine/entities/species/registry';
import type { EliteRule } from '@wildshard/game/Elite';
import { ARGYMAQ } from '../data/eliteEncounters';

/** His species row from the horse's (`base`: its stallion): one legendary variant 'stallion', x1.3, 750 hp. */
export function argymaqDefinition(horse: SpeciesDef, base: VariantDef): SpeciesDef {
  return { ...horse, kind: ARGYMAQ, label: 'Argymaq', variants: [{ ...base, id: 'stallion', label: 'Argymaq the Unbroken', weight: 1, rarity: 'legendary', scale: [1.3, 1.3], hp: 750, traits: { ...base.traits, mane: 2.2, scar: 1 } }] };
}

/** The page's spawn rule (combat/elites.ts NalatiElites `condition`) over the day phase and the storm. */
export function eliteRuleHolds(rule: EliteRule, phase: string, storm: boolean): boolean {
  return rule === 'always' ? true : rule === 'storm' ? storm : rule === 'night' ? phase === 'night' : phase === 'dusk' || phase === 'night';
}
