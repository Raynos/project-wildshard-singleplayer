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
    model: id => {
      if (id !== 'keeper-hd') throw new Error('Unknown quest keeper model');
      const made = skyHd(id);
      if (made === null) return null;
      made.geometry.dispose();
      if (made.pivots === undefined) throw new Error('Missing authored keeper pivots');
      return { geometry: made.pivots, material: skyMappedLook('keeper-scarf', made.map) };
    },
    dress: group => { ctx.scope.ownPrimitives(group, { instances: true }); },
  });
  return { ...state, get view(): PersistedQuest['view'] { return state.view; }, burst: state.reward.spawn };
}
