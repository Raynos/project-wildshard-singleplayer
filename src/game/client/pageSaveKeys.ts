import * as v from 'valibot';
import type { SaveKeyDef, SaveStore } from '@wildshard/engine/saves/store';

/**
 * The keys of a page's old saves that only a server opens now. A page reads none of them, but Settings takes a file from before the flip key by
 * key against what its store has defined, and a key it doesn't know is left out of the import. So every page defines these, whichever
 * shard it's on, and leaves their shape to the server that reads them.
 */
const SERVER_READS: readonly SaveKeyDef<unknown>[] = ['platform.continuation', 'platform.encounters', 'platform.region', 'platform.runtime-logical']
  .map(key => ({ key, scope: 'shard', version: 1, schema: v.unknown(), initial: (): unknown => null }));

/** Before a player can reach Settings. */
export function definePageSaveKeys(store: Pick<SaveStore, 'define'>): void { for (const key of SERVER_READS) store.define(key); }
