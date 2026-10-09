// The shard list, installed into the game's registry (E362 AG4): the composition root imports every manifest
// (src/shards.generated.ts), so the game layer never does. entry.ts loads this before the game or the title deck.
import { installShards } from './game/shard/list';
import { game } from './game/shard/registry';
import { SHARDS, LEGACY_SHARDS } from './shards.generated';

installShards([...SHARDS, ...LEGACY_SHARDS]);
// the running shard resolves now, as it did when the registry built it at import: the level is configured early
void game.shard;
