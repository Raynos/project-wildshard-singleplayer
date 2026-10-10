import type { BrainedSpecies } from '@wildshard/sdk/speciesBrains';

/** Aqbars' existing body data, shared by the actual rendered species and the renderer-free declared brain catalogue. */
export const LEOPARD_DATA: BrainedSpecies = {
  id: 'species.nalati.leopard', kind: 'leopard', label: 'Snow leopard', lockable: true,
  aggressive: true, walkSpeed: 1.4, chargeSpeed: 11, chargeDamage: 14,
  sounds: { call: 'leopard_growl', hurt: 'leopard_growl', callEvery: [40, 90] },
  variants: [{ id: 'aqbars', label: 'Aqbars the Pale', weight: 1, rarity: 'legendary', scale: [1.5, 1.5], hp: 700 }],
  tick: 'ai',
};
