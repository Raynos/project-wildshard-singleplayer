import { installDeclaredMovers } from './moverInstall';
import { bindQuestWorldReactions, commandSocketLift, declaredItemScriptBindings } from './simulation';
import { readSpawnScript, SpawnScript } from '../population/spawnScript';
import { registerLootTable } from '../loot/tables';
import { PageActorGroups, wildEnv } from '../population/pageGroups';
import { PerchBodyBinding } from '../population/perchBody';
import { speciesBehaviour } from '../population/speciesBehaviour';
import { pageClimate } from '../weather/pageClimate';

/**
 * What the page's quest views and motion still take from the page's own sim (E6: port first, flip last). A view asks
 * this feed, through the one client seat in `shardfile/clientMoverOwners.ts`, and never names these owners itself, so
 * the flip swaps one object instead of every view. Each row is the owner's own function: nothing here adds law.
 */
export interface PageSimFeed {
  readonly installDeclaredMovers: typeof installDeclaredMovers;
  readonly declaredItemScriptBindings: typeof declaredItemScriptBindings;
  readonly commandSocketLift: typeof commandSocketLift;
  readonly bindQuestWorldReactions: typeof bindQuestWorldReactions;
  /** The sky a forest page's weather views read (E6 WORLD). */
  readonly climate: typeof pageClimate;
  /** The page's creature law its population views still install (E6 WORLD). */
  readonly speciesBehaviour: typeof speciesBehaviour;
  readonly registerLootTable: typeof registerLootTable;
  readonly perchBody: (...args: ConstructorParameters<typeof PerchBodyBinding>) => PerchBodyBinding;
  readonly actorGroups: (...args: ConstructorParameters<typeof PageActorGroups>) => PageActorGroups;
  /** The wind a creature's riding envelopes sway in. */
  readonly wind: () => typeof wildEnv.wind;
  readonly spawnScript: { readonly read: typeof readSpawnScript; readonly page: typeof SpawnScript.page };
}
/** The page sim's own owners. */
export const pageSimFeed: PageSimFeed = {
  installDeclaredMovers, declaredItemScriptBindings, commandSocketLift, bindQuestWorldReactions, climate: pageClimate, speciesBehaviour, registerLootTable,
  perchBody: (...args) => new PerchBodyBinding(...args), actorGroups: (...args) => new PageActorGroups(...args), wind: () => wildEnv.wind,
  spawnScript: { read: (...args) => readSpawnScript(...args), page: (...args) => SpawnScript.page(...args) },
};
