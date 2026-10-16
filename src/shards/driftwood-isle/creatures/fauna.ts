import type { HuntSpecies } from '@wildshard/engine/ai/hunt';
import { ISLAND_BOAR, ISLAND_BEAR } from './species';

/** The island fauna's species rows, by kind, as the hunting brain reads them (creatures/install.ts registers these two). */
export const FAUNA_SPECIES: ReadonlyMap<string, HuntSpecies> = new Map([['boar', ISLAND_BOAR], ['bear', ISLAND_BEAR]]);
