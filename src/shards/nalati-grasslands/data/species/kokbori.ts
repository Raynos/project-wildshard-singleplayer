import type { BrainedSpecies } from '@wildshard/sdk/speciesBrains';

/** Kokbori's existing gameplay row, shared by the page body and renderer-free brain catalogue. */
export const KOKBORI_DATA: BrainedSpecies = {
  id: 'species.nalati.kokbori', kind: 'kokbori', label: 'Kokbori', lockable: true,
  aggressive: true, walkSpeed: 1.8, chargeSpeed: 11, chargeDamage: 22,
  sounds: { call: 'wolf_howl', hurt: 'wolf_yelp', callEvery: [50, 120] }, tick: 'ai',
  variants: [{ id: 'kokbori', label: 'Kokbori, Mother of the Pack', weight: 1, rarity: 'legendary', scale: [2.6, 2.6], hp: 650 }],
};
