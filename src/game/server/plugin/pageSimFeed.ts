import { installDeclaredMovers } from './moverInstall';
import { bindMeleeContacts, bindQuestWorldReactions, commandSocketLift, createShardfileSim, declaredItemScriptBindings, prepareShardfileSimRestore, startMeleeSecondary } from './simulation';
import { AnimalManager } from '@wildshard/engine/entities/AnimalManager';
import { createSimHost } from '@wildshard/engine/sim';
import { GridRegionDurability } from '../grid/durability';
import { readSpawnScript, SpawnScript } from '../population/spawnScript';
import { PageActorGroups, bindPageGroups, lendPageGrass, wildEnv } from '../population/pageGroups';
import { PageWildlife, lendClientWildlife } from '../population/wildlife';
import { clientWildlifeState } from '../../shared/population/wildlifeOwner';
import { bindCrowdGuard, crowdGuardProjection } from '../ambient/crowdPage';
import { admitSpeciesProgram } from './brain';
import type { CrowdDraw } from '../../client/ambient/crowdDraw';
import { PerchBodyBinding } from '../population/perchBody';
import { pageSpeciesBehaviour } from '../population/speciesBehaviour';
import { pageClimate } from '../weather/pageClimate';
import { readEliteFeature } from '../quest/eliteFeature';

/**
 * What the page's quest views and motion still take from the page's own sim (E6: port first, flip last). A view asks
 * this feed, through the one client seat in `shardfile/clientMoverOwners.ts`, and never names these owners itself. Every
 * page runs on the server, so what these rows build runs on nothing; each row goes as its view stops building on it.
 */
export interface PageSimFeed {
  readonly installDeclaredMovers: typeof installDeclaredMovers;
  readonly declaredItemScriptBindings: typeof declaredItemScriptBindings;
  readonly commandSocketLift: typeof commandSocketLift;
  readonly bindQuestWorldReactions: typeof bindQuestWorldReactions;
  /** The sky a forest page's weather views read (E6 WORLD). */
  readonly climate: typeof pageClimate;
  /** The page's creature law its population views still install (E6 WORLD). */
  readonly speciesBehaviour: typeof pageSpeciesBehaviour;
  readonly perchBody: (...args: ConstructorParameters<typeof PerchBodyBinding>) => PerchBodyBinding;
  readonly actorGroups: (...args: ConstructorParameters<typeof PageActorGroups>) => PageActorGroups;
  /** The wind a creature's riding envelopes sway in. */
  readonly wind: () => typeof wildEnv.wind;
  /** The page's weather and light, which its fights read (E6 COMBAT). */
  readonly wild: typeof wildEnv;
  /** The page's fights: an elite feature's rows. */
  readonly readEliteFeature: typeof readEliteFeature;
  readonly clientWildlifeState: typeof clientWildlifeState;
  /** The page's population, which its wildlife feature builds and lends (E6 WORLD). */
  readonly lendClientWildlife: typeof lendClientWildlife;
  readonly bindPageGroups: typeof bindPageGroups;
  readonly pageWildlife: (...args: ConstructorParameters<typeof PageWildlife<CrowdDraw>>) => PageWildlife<CrowdDraw>;
  readonly lendPageGrass: typeof lendPageGrass;
  /** A crowd's guardian, whose law is the page sim's and whose crowd is a view. */
  readonly crowdGuardProjection: typeof crowdGuardProjection;
  readonly bindCrowdGuard: typeof bindCrowdGuard;
  /** The page's species programme. */
  readonly admitSpeciesProgram: typeof admitSpeciesProgram;
  /** A held blade's contacts and its secondary, which the page's weapons still settle themselves. */
  readonly bindMeleeContacts: typeof bindMeleeContacts;
  readonly startMeleeSecondary: typeof startMeleeSecondary;
  readonly spawnScript: { readonly read: typeof readSpawnScript; readonly page: typeof SpawnScript.page };
  /** The page's own sim, and the restore a grid home takes it through (E6 SESSION). */
  readonly createShardfileSim: typeof createShardfileSim;
  readonly prepareShardfileSimRestore: typeof prepareShardfileSimRestore;
  /** A regional world's bodyless shell and the manager its creatures stand in. */
  readonly createSimHost: typeof createSimHost;
  readonly animalManager: (...args: ConstructorParameters<typeof AnimalManager>) => AnimalManager;
  /** What a grid page keeps of a cell it has played. */
  readonly regionDurability: (...args: ConstructorParameters<typeof GridRegionDurability>) => GridRegionDurability;
}
/** The page sim's own owners. */
export const pageSimFeed: PageSimFeed = {
  installDeclaredMovers, declaredItemScriptBindings, commandSocketLift, bindQuestWorldReactions,
  climate: pageClimate, speciesBehaviour: pageSpeciesBehaviour,
  perchBody: (...args) => new PerchBodyBinding(...args), actorGroups: (...args) => new PageActorGroups(...args), wind: () => wildEnv.wind,
  wild: wildEnv, readEliteFeature,
  clientWildlifeState, lendClientWildlife,
  bindPageGroups: (...args) => { bindPageGroups(...args); }, pageWildlife: (...args) => new PageWildlife<CrowdDraw>(...args), lendPageGrass, crowdGuardProjection, bindCrowdGuard,
  admitSpeciesProgram, bindMeleeContacts, startMeleeSecondary,
  spawnScript: { read: (...args) => readSpawnScript(...args), page: (...args) => SpawnScript.page(...args) },
  createShardfileSim, prepareShardfileSimRestore, createSimHost,
  animalManager: (...args) => new AnimalManager(...args), regionDurability: (...args) => new GridRegionDurability(...args),
};
