import type { EffectDef } from '@wildshard/engine/combat/effects/types';

export const pineFinishEffect = (id: string, weapon: string): EffectDef => ({
  id: `effect.finish.${id}`, kind: 'permanent', stacking: 'none', tags: ['effect.cosmetic'], modifiers: [],
  grants: [`cosmetic.finish.${id}`], group: `finish.${weapon}`,
});
