import { deriveSpecies } from '#engine/ai/species';
import { BOAR } from '#kit/species/boar';
import { BEAR } from '#kit/species/bear';

/** The night-only thrall is authored by Pine; ordinary weighted variants retain their original order. */
export const PINE_BOAR = deriveSpecies(BOAR, {
  id: 'pine.creature.boar',
  spawnOnly: [{ id: 'thrall', label: 'Thrall', weight: 1, rarity: 'rare', scale: [1.1, 1.2], hp: 140, mods: { chargeDist: 1.4 } }],
});
export const PINE_BEAR = deriveSpecies(BEAR, { id: 'pine.creature.bear' });
export const PINE_SPECIES = [PINE_BOAR, PINE_BEAR];
