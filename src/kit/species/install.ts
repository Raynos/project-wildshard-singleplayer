import { speciesWithLook } from '@wildshard/engine/entities/species/look';
import { registerSpecies, setCreatureSoundDefaults } from '@wildshard/engine/entities/species/registry';
import { BOAR } from './boar';
import { DEER } from './deer';
import { ELK } from './elk';
import { BEAR } from './bear';
import { BOAR_LOOK } from '@wildshard/game/systems/species/view/boar';
import { BEAR_LOOK } from '@wildshard/game/systems/species/view/bear';

/** Composition root defaults for legacy shards and standalone model tools. Plugins add scoped child rows. */
export function installKitSpecies(): void {
  // the calls a species with no `sounds` falls back on: a charger grunts like a boar, a grazer calls like a deer
  setCreatureSoundDefaults({ charger: { call: 'boar_grunt', hurt: 'boar_squeal' }, grazer: { call: 'deer_call', hurt: 'deer_call' } });
  registerSpecies(DEER);
  registerSpecies(ELK);
  registerSpecies(speciesWithLook(BOAR, BOAR_LOOK));
  registerSpecies(speciesWithLook(BEAR, BEAR_LOOK));
}
