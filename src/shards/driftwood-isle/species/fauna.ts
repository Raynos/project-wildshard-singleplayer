import type { SpeciesLook } from '@wildshard/engine/entities/species/look';
import { BEAR_LOOK } from '@wildshard/game/systems/species/view/bear';
import { BOAR_LOOK } from '@wildshard/game/systems/species/view/boar';
import { ISLAND_BEAR, ISLAND_BOAR } from '../creatures/species';
import { creatureBody, preloadCreatureBodies } from './bodies';

/**
 * The island's boar and bear: the shared looks, drawn from the baked bodies (generators/creatureBodies.ts runs the shared
 * builders offline in the island's low-poly toon palette). `preload` is the bake: the factory waits for it before the
 * first herd (the manifest's `waitForModels`), and a body asked for before it refuses.
 */
export const ISLAND_BOAR_LOOK: SpeciesLook = { ...BOAR_LOOK, id: 'driftwood.look.boar', species: ISLAND_BOAR.id,
  preload: preloadCreatureBodies, build: (v) => creatureBody('boar', v.id) };
export const ISLAND_BEAR_LOOK: SpeciesLook = { ...BEAR_LOOK, id: 'driftwood.look.bear', species: ISLAND_BEAR.id,
  preload: preloadCreatureBodies, build: (v) => creatureBody('bear', v.id) };
