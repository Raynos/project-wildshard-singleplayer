import { installPersistedQuest, type PersistedQuest } from '@wildshard/game/plugin/ui';
import type { ShardContext } from '@wildshard/game/shard/context';
import type { Vector3 } from 'three';
import type { SignalWorld } from '../world/build';
import { lastLightAll } from '../look/light';
import { duneMesh } from '../world/meshes';
import { FLAG } from '../data/flags';
import type { RuntimeCoins } from '@wildshard/game/shardfile/hybridRows';
import source from '../runtime/source';
import { SIGNAL_QUEST_PAGE } from '../data/questPage';

export const LIT_FLAG = FLAG.lit;

/** Keep the scout model/material owners while rows compose the saved quest. */
export function installQuest(ctx: ShardContext, player: Vector3, world: SignalWorld, coins?: RuntimeCoins): PersistedQuest {
  return installPersistedQuest(ctx, source, SIGNAL_QUEST_PAGE, { player, flags: world.flags, ...(coins === undefined ? {} : { coins }),
    model: id => { if (id !== 'caravan-scout') throw new Error('Unknown quest scout model'); const geometry = duneMesh(id); return geometry === null ? null : { geometry }; },
    dress: group => { ctx.scope.ownPrimitives(group); lastLightAll(group, ctx.scope); },
  });
}
