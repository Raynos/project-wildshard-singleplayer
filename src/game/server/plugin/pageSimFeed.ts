import { installDeclaredMovers } from './moverInstall';
import { bindMeleeContacts, declaredItemScriptBindings, prepareShardfileSimRestore, startMeleeSecondary } from './simulation';
import { AnimalManager } from '@wildshard/engine/entities/AnimalManager';
import { createSimHost } from '@wildshard/engine/sim';
import { GridRegionDurability } from '../grid/durability';
import { lendPageGrass, wildEnv } from '../population/pageGroups';
import { bindCrowdGuard, crowdGuardProjection } from '../ambient/crowdPage';
import { admitSpeciesProgram } from './brain';
import { PerchBodyBinding } from '../population/perchBody';
import { pageSpeciesBehaviour } from '../population/speciesBehaviour';
import { pageClimate } from '../weather/pageClimate';

/**
 * What the page's quest views and motion still take from the page's own sim (E6: port first, flip last). A view asks
 * this feed, through the one client seat in `shardfile/clientMoverOwners.ts`, and never names these owners itself. Every
 * page runs on the server, so what these rows build runs on nothing; each row goes as its view stops building on it.
 */
export interface PageSimFeed {
  readonly installDeclaredMovers: typeof installDeclaredMovers;
  readonly declaredItemScriptBindings: typeof declaredItemScriptBindings;
  /** The sky a forest page's weather views read (E6 WORLD). */
  readonly climate: typeof pageClimate;
  /** The page's creature law its population views still install (E6 WORLD). */
  readonly speciesBehaviour: typeof pageSpeciesBehaviour;
  readonly perchBody: (...args: ConstructorParameters<typeof PerchBodyBinding>) => PerchBodyBinding;
  /** The wind a creature's riding envelopes sway in. */
  readonly wind: () => typeof wildEnv.wind;
  /** The page's weather and light, which its fights read (E6 COMBAT). */
  readonly wild: typeof wildEnv;
  readonly lendPageGrass: typeof lendPageGrass;
  /** A crowd's guardian, whose law is the page sim's and whose crowd is a view. */
  readonly crowdGuardProjection: typeof crowdGuardProjection;
  readonly bindCrowdGuard: typeof bindCrowdGuard;
  /** The page's species programme. */
  readonly admitSpeciesProgram: typeof admitSpeciesProgram;
  /** A held blade's contacts and its secondary, which the page's weapons still settle themselves. */
  readonly bindMeleeContacts: typeof bindMeleeContacts;
  readonly startMeleeSecondary: typeof startMeleeSecondary;
  /** The restore a grid home takes its page sim through (E6 SESSION). */
  readonly prepareShardfileSimRestore: typeof prepareShardfileSimRestore;
  /** A regional world's bodyless shell and the manager its creatures stand in. */
  readonly createSimHost: typeof createSimHost;
  readonly animalManager: (...args: ConstructorParameters<typeof AnimalManager>) => AnimalManager;
  /** What a grid page keeps of a cell it has played. */
  readonly regionDurability: (...args: ConstructorParameters<typeof GridRegionDurability>) => GridRegionDurability;
}
/** The page sim's own owners. */
export const pageSimFeed: PageSimFeed = {
  installDeclaredMovers, declaredItemScriptBindings,
  climate: pageClimate, speciesBehaviour: pageSpeciesBehaviour,
  perchBody: (...args) => new PerchBodyBinding(...args), wind: () => wildEnv.wind,
  wild: wildEnv,
  lendPageGrass, crowdGuardProjection, bindCrowdGuard,
  admitSpeciesProgram, bindMeleeContacts, startMeleeSecondary,
  prepareShardfileSimRestore, createSimHost,
  animalManager: (...args) => new AnimalManager(...args), regionDurability: (...args) => new GridRegionDurability(...args),
};
