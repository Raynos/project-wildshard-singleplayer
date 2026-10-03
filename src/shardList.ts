// The shard list, installed into the game's registry (E362 AG4): the composition root imports every manifest
// (src/shards.generated.ts), so the game layer never does. entry.ts loads this before the game or the title deck.
import { installShards } from '#game/shard/list';
import { SHARDS } from './shards.generated';

installShards(SHARDS);
