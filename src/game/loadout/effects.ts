import type { EffectDef } from '@wildshard/engine/combat/effects/types';

/** The shared permanent cosmetic grant; authored finish identity and weapon determine its exclusive group. */
export const heldFinishEffect = (id: string, weapon: string): EffectDef => ({
  id: `effect.finish.${id}`, kind: 'permanent', stacking: 'none', tags: ['effect.cosmetic'], modifiers: [],
  grants: [`cosmetic.finish.${id}`], group: `finish.${weapon}`,
});
