import { deriveSpecies, type SpeciesRow } from '@wildshard/engine/ai/species';
import { speciesDef } from '@wildshard/engine/entities/species/registry';
import { BEAR } from '@wildshard/game/systems/species/bear';
import { BOAR } from '@wildshard/game/systems/species/boar';

/** The night-only thrall is authored by Pine; ordinary weighted variants retain their original order. */
export const PINE_BOAR = deriveSpecies(BOAR, {
  id: 'pine.creature.boar',
  spawnOnly: [{ id: 'thrall', label: 'Thrall', weight: 1, rarity: 'rare', scale: [1.1, 1.2], hp: 140, mods: { chargeDist: 1.4 } }],
});
export const PINE_BEAR = deriveSpecies(BEAR, { id: 'pine.creature.bear' });
/** Pine's elk: the kit's (its simulation fields, read at registration) plus the Antler King's thrall, spawned by id at
 *  night and in his fight, never rolled (PH-U9 / PH-M2; E405: the thrall is Pine's, not the engine's or the kit's); its coat
 *  and stiff gait are the elk look's (./looks.ts) */
export function pineElk(): SpeciesRow {
  const { build: _build, fur: _fur, rigContract: _rig, pose: _pose, gait: _gait, postPose: _postPose, rig: _rigKind, animate: _animate, ...sim } = speciesDef('elk');
  return { ...sim, id: 'pine.creature.elk', spawnOnly: [
    { id: 'thrall', label: 'Thrall', weight: 1, rarity: 'rare', scale: [1.1, 1.2], hp: 220, mods: { damageTaken: 0.8, speed: 0.9 } },
  ] };
}
export const PINE_SPECIES = [PINE_BOAR, PINE_BEAR];
