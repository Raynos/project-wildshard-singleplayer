import type { HuntSpecies } from '@wildshard/engine/ai/hunt';
import { ISLAND_BOAR, ISLAND_BEAR } from '../creatures/species';

/** The island fauna's species rows as the hunting brain reads them (creatures/install.ts registers these two). */
export function faunaSpecies(kind: string): HuntSpecies {
  if (kind === 'boar') return ISLAND_BOAR;
  if (kind === 'bear') return ISLAND_BEAR;
  throw new Error(`Driftwood's hunting brain has no fauna species ${kind}`);
}
