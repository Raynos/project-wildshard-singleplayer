import type { Progress } from '@wildshard/game/Progress';
import { bindRuntimeLedger } from '@wildshard/game/shardfile/hybridRows';
import source from '../shard.config';
import type { NineFacts } from '../world/feats';

/** G285: the page's sink for Nine Dragon's gameplay facts (world/feats.ts): the shardfile's ledger rows, bound to the
 *  profile (the platform grants each achievement once) and projected into Progress; nothing is granted here. */
export function bindNineFacts(ctx: Parameters<typeof bindRuntimeLedger>[0], progress: Pick<Progress, 'bindLedger' | 'refreshLedger'> | undefined,
  instance = source.identity.slug): NineFacts {
  const emit = bindRuntimeLedger(ctx, source, instance);
  progress?.bindLedger({ count: (id) => emit.achievement(id)?.count ?? 0, earned: (id) => emit.achievement(id)?.earned ?? false, checkpoint: emit.flush });
  return (name, entity) => { emit(name, entity); progress?.refreshLedger(); };
}
