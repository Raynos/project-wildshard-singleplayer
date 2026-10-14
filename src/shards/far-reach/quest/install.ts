import { installPersistedQuest, type PersistedQuest, type QuestReward } from '@wildshard/game/plugin/ui';
import type { ShardContext } from '@wildshard/game/shard/context';
import type { Vector3 } from 'three';
import { skyHd } from '../world/meshes';
import { skyMappedLook } from '../world/looks';
import source from '../shard.config';
import { SKY_QUEST_PAGE } from '../data/questPage';

/** Borrow the prepared keeper geometry; rows compose its quest and save. */
export function installQuest(ctx: ShardContext, player: Vector3, onCoin?: (share: number) => void):
  Omit<PersistedQuest, 'burst' | 'persistence'> & { readonly burst: QuestReward['spawn']; readonly persistence: PersistedQuest['persistence'] & { readonly boss: NonNullable<PersistedQuest['persistence']['boss']> } } {
  const state = installPersistedQuest(ctx, source, SKY_QUEST_PAGE, { player, ...(onCoin === undefined ? {} : { coins: onCoin }),
    model: { kind: 'pivots', read: () => skyHd('keeper-hd'), material: map => skyMappedLook('keeper-scarf', map) },
    dress: group => { ctx.scope.ownPrimitives(group, { instances: true }); },
  });
  return { ...state, get view(): PersistedQuest['view'] { return state.view; }, burst: state.reward.spawn };
}
