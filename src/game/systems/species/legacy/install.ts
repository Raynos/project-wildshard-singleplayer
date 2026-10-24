/** Held for LD (wave 3): original procedural catalogue for explicit legacy boots. */
import { registerSpecies } from '@wildshard/engine/entities/species/registry';
import { speciesWithLook } from '@wildshard/engine/entities/species/look';
import { BOAR } from '../boar';
import { BEAR } from '../bear';
import { BOAR_LOOK } from '../view/boar';
import { BEAR_LOOK } from '../view/bear';
import { DEER } from './deer';
import { ELK } from './elk';

/** Restore the original catalogue order without publishing anything on import. */
export function installLegacyKitSpecies(register: typeof registerSpecies = registerSpecies): void {
  register(speciesWithLook(BOAR, BOAR_LOOK));
  register(DEER);
  register(ELK);
  register(speciesWithLook(BEAR, BEAR_LOOK));
}
