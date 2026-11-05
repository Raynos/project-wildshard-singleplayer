import { installDeclaredMovers } from './moverInstall';
import { bindQuestWorldReactions, commandSocketLift, declaredItemScriptBindings } from './simulation';
import { readSpawnScript, SpawnScript } from '../population/spawnScript';

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
  readonly spawnScript: { readonly read: typeof readSpawnScript; readonly page: typeof SpawnScript.page };
}
/** The page sim's own owners. */
export const pageSimFeed: PageSimFeed = {
  installDeclaredMovers, declaredItemScriptBindings, commandSocketLift, bindQuestWorldReactions,
  spawnScript: { read: (...args) => readSpawnScript(...args), page: (...args) => SpawnScript.page(...args) },
};
