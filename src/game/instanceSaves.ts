import type { SaveStore, InstanceSaveKeyDef, InstanceSaveSlot } from '@wildshard/engine/saves/store';
import catalogue from './grid/singleplayer.json';

/** Stable placement identity passed by the session, independent of cell or launch mode. */
export interface LocalSaveInstance { id: string; shard: string }
/** Bind shard-local state, migrating a slug only for its canonical first-party instance. Template copies start independent. */
export function instanceSave<T>(store: SaveStore, definition: InstanceSaveKeyDef<T>, identity: LocalSaveInstance): InstanceSaveSlot<T> {
  const canonical = catalogue.placements.find((placement) => placement.instance === identity.id && placement.slug.replace(/^_/u, '') === identity.shard.replace(/^_/u, ''));
  return store.instance(definition, { id: identity.id, ...(canonical === undefined ? {} : { legacy: canonical.slug }) });
}
