import type { BrainedSpecies } from '@wildshard/sdk/speciesBrains';

/** Qyran's existing body gameplay, shared by the rendered species and declared policy catalogue. */
export const EAGLE_DATA: BrainedSpecies = {
  id: 'species.nalati.eagle', kind: 'eagle', label: 'Golden eagle', lockable: true, aggressive: true,
  walkSpeed: 0.5, chargeDamage: 30, sounds: { call: 'eagle_cry', hurt: 'eagle_cry', callEvery: [8, 18] },
  variants: [{ id: 'qyran', label: 'Qyran the Storm-Wing', weight: 1, rarity: 'legendary', scale: [3, 3], hp: 600 }], tick: 'ai',
};
