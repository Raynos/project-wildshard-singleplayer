import { registerSpecies } from '#engine/entities/species/registry';
import { speciesWithLook } from '#engine/entities/species/look';
import { BOAR } from './boar';
import { BEAR } from './bear';
import { BOAR_LOOK } from './view/boar';
import { BEAR_LOOK } from './view/bear';

/** Composition root defaults for legacy shards and standalone model tools. Plugins add scoped child rows. */
export function installKitSpecies(): void {
  registerSpecies(speciesWithLook(BOAR, BOAR_LOOK));
  registerSpecies(speciesWithLook(BEAR, BEAR_LOOK));
}
