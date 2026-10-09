import type { Progress } from '@wildshard/game/Progress';
import { bindRuntimeLedger, type RuntimeFacts } from '@wildshard/game/shardfile/hybridRows';
import source from '../shard.config';

/** Project the same emitting ledger into Progress; no visible feat table or second grant is invented. */
export function bindSignalFacts(ctx: Parameters<typeof bindRuntimeLedger>[0], progress: Pick<Progress, 'bindLedger' | 'refreshLedger'> | undefined,
  instance = source.identity.slug): RuntimeFacts {
  const emit = bindRuntimeLedger(ctx, source, instance);
  const facts = Object.assign((name: string, entity: string) => {
    const receipt = emit(name, entity); progress?.refreshLedger(); return receipt;
  }, { flush: emit.flush, achievement: emit.achievement });
  progress?.bindLedger({ count: (id) => facts.achievement(id)?.count ?? 0,
    earned: (id) => facts.achievement(id)?.earned ?? false, checkpoint: facts.flush });
  return facts;
}
