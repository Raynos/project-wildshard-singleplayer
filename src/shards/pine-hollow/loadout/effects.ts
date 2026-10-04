import type { AmmoRow } from '@wildshard/engine/combat/ammo';
import type { EffectDef, SourceMulDef } from '@wildshard/engine/combat/effects/types';

export const AMMO_ROWS: readonly AmmoRow[] = [
  { id: 'ammo.iron', label: 'Bolts', name: 'Iron bolts', flight: { gravity: 1, drag: 1 }, wet: { gravity: 1.2, drag: 1.9 }, tags: ['ammo.iron'], pouchMax: 30 },
  { id: 'ammo.pitch', label: 'Pitch bolts', name: 'Pitch-tipped bolts', flight: { gravity: 0.8, drag: 0.7 }, tags: ['ammo.pitch'], pouchMax: 30 },
  { id: 'ammo.broadhead', label: 'Broadheads', name: 'Broadhead bolts', flight: { gravity: 1.08, drag: 1.1 }, wet: { gravity: 1.2, drag: 1.9 }, tags: ['ammo.broadhead'], pouchMax: 30 },
];
export const PINE_SOURCE_MULTIPLIERS: readonly SourceMulDef[] = [
  { id: 'source.broadhead', when: { sourceTags: ['ammo.broadhead'], targetTags: ['size.deer'] }, mul: 1.4 },
];
export const PINE_AMMO_EFFECTS: readonly EffectDef[] = AMMO_ROWS.map((row) => ({
  id: `effect.${row.id}`, kind: 'instant', stacking: 'none', tags: row.tags, modifiers: [],
}));
export const pineFinishEffect = (id: string, weapon: string): EffectDef => ({
  id: `effect.finish.${id}`, kind: 'permanent', stacking: 'none', tags: ['effect.cosmetic'], modifiers: [],
  grants: [`cosmetic.finish.${id}`], group: `finish.${weapon}`,
});
