import type { EffectDef, SourceMulDef, CombatTag } from '#engine';

export const SNEAK_SHOT: EffectDef = {
  id: 'effect.sneak-shot', kind: 'timed', duration: 4, stacking: 'refresh', tags: [],
  modifiers: [], grants: ['state.sneak-shot'],
};
export const NALATI_SOURCE_MULTIPLIERS: readonly SourceMulDef[] = [
  { id: 'source.sneak', when: { sourceTags: ['state.sneak-shot'] }, mul: 2 },
  { id: 'source.golden', when: { weaponTags: ['weapon.golden-bow'], targetTags: ['creature.balbal', 'creature.kurgan-balbal'] }, mul: 2 },
  { id: 'source.sun', when: { weaponTags: ['weapon.golden-bow'], sourceTags: ['arrow.sun'], targetTags: ['creature.balbal', 'creature.kurgan-balbal'] }, mul: 1.5 },
];
export const nalatiSkinEffect = (id: string, slot: string): EffectDef => ({
  id: `effect.skin.${id}`, kind: 'permanent', tags: ['effect.cosmetic'], stacking: 'none', modifiers: [],
  grants: [`cosmetic.skin.${id}`], group: `skin.${slot}`,
});
export const goldenSourceTags = (sun: boolean): readonly CombatTag[] => sun ? ['arrow.sun'] : [];
