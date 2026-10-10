// Explicit CLI composition root for shared producers: install the real generated manifest list before baking.
import { SHARDS } from '../src/shards.generated.ts';
import { installShards } from '../src/game/shard/list.ts';

installShards(SHARDS);
