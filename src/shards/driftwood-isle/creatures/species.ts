import { deriveSpecies } from '@wildshard/engine/data';
import { BOAR, BOAR_TUNING, BEAR } from '@wildshard/kit/data';

/** The beach's long sight lines and variant pool, kept out of the shared hunting family. */
export const ISLAND_BOARS = ['boar', 'sow', 'black', 'big'];
export const ISLAND_BOAR = deriveSpecies(BOAR, {
  id: 'driftwood.creature.boar',
  tuning: { ...BOAR_TUNING, sightRange: 42, sightRangeGraze: 26, sightCone: 1.22,
    hearWalk: 18, hearSprint: 34, noticeRate: 0.65, impactAlert: 28 },
});
export const ISLAND_BEAR = deriveSpecies(BEAR, { id: 'driftwood.creature.bear' });
