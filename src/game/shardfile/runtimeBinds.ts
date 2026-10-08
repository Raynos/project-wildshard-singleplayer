import * as v from 'valibot';

/**
 * The behaviour sections a trusted hybrid runtime may bind (SHARD-PLATFORM M3, the runtime-owner binding, E435). A hybrid
 * shard's runtime owns its world and its play scope; a section named here stays declared data in the shardfile, validated
 * like every row, and the platform installs it into that runtime's play scope through the same installers the template
 * uses (`@wildshard/game/shardfile/hybridRows`). The data client never installs a bound section a second time, and a bound
 * section's rows do not make a hybrid shardfile "non-empty": only an unbound behaviour row sends a hybrid shard down the
 * full shardfile loader.
 *
 * - `quests`: quest graphs, flags and dialogue; the runtime supplies its flags and places world-piece markers.
 * - `ledger`: fact → profile reward rules; the runtime emits declared facts, the platform grants once.
 * - `items`: weapon / tool rows, input contexts and the loadout; the runtime may resolve a family of its own
 *   (`<slug>.<name>`) beside the kit's, and the declared input contexts register through its entered-input path.
 * - `spawns`: the runtime's creatures as declared rows (`runtime.spawns`, ./runtimeSpawns.ts): its homes and boss bodies,
 *   each under a stable identity; the platform keeps the homes (respawn, retained identity), the runtime's species and
 *   encounter scripts stay its own.
 * - `state`: host-owned shared scalar fields (including bounded JSON strings), migrated once from legacy slots and
 *   persisted by the platform under the stable instance id; player/public fields remain simulation-owned.
 * - `terrain` (G227, "the shardfile is the bake"): the compiled 62.5 m terrain tiles and their critical collider. The data
 *   client draws and collides none of them; the runtime binds them (`bindRuntimeTerrain`, ./runtimeWorld.ts), streaming the
 *   admitted tiles through the shardfile's residency in place of its code-built ground. The edge rows stay platform data.
 * - `props` (G227): the compiled props section (tiles, library models, panels, far proxy), bound the same way; the
 *   runtime keeps the behaviour of the pieces it dresses.
 */
export const RUNTIME_BOUND_SECTIONS = ['quests', 'ledger', 'items', 'spawns', 'state', 'terrain', 'props'] as const;
/** One section a trusted runtime binds rather than the data client. */
export type RuntimeBoundSection = (typeof RUNTIME_BOUND_SECTIONS)[number];
/** `runtime.binds`: the declared capability that replaces the implicit "empty apart from audio, edges and colliders" rule. */
export const RuntimeBindsSchema = v.pipe(v.array(v.picklist(RUNTIME_BOUND_SECTIONS)), v.maxLength(RUNTIME_BOUND_SECTIONS.length),
  v.check((sections) => new Set(sections).size === sections.length, 'unique runtime-bound sections'));
