import type { ShardContext } from '@wildshard/game/shard/context';
import type { Progress } from '@wildshard/game/Progress';
import { bindRuntimeLedger, type RuntimeFacts } from '@wildshard/game/shardfile/hybridRows';
import { createAchievementCounters } from '@wildshard/game/achievements';
import { DRIFTWOOD_FEATS, DRIFTWOOD_FEAT_COUNTERS } from '../data/questInventory';
import source from '../shard.config';

export interface DriftwoodFacts {
  readonly facts: RuntimeFacts;
  readonly count: (id: string, total: number) => void;
  readonly kill: (kind: string) => void;
}
/** C26: read current Progress counts without rewriting its save; replay stable count facts into SF14 once. */
export function bindDriftwoodFacts(ctx: Pick<ShardContext, 'app'>, previous: readonly { def: { id: string }; count: number }[], progress?: Partial<Pick<Progress, 'bindLedger' | 'refreshLedger'>>, instance = source.identity.slug): DriftwoodFacts {
  const emit = bindRuntimeLedger(ctx, source, instance);
  const facts: RuntimeFacts = Object.assign((name: string, entity: string) => {
    const receipt = emit(name, entity); progress?.refreshLedger?.(); return receipt;
  }, { flush: emit.flush, achievement: emit.achievement });
  let counts:Record<string,number>=Object.fromEntries(DRIFTWOOD_FEATS.map(feat=>[feat.id,emit.achievement(feat.id)?.count??0] as const));
  const counter=createAchievementCounters(DRIFTWOOD_FEAT_COUNTERS,{read:()=>({...counts}),write:current=>{counts=current;},emit:(name,entity)=>{facts(name,entity);}});
  const count=counter.count;
  for (const row of previous) if (DRIFTWOOD_FEATS.some(feat => feat.id === row.def.id)) count(row.def.id, row.count);
  progress?.bindLedger?.({ count: id => emit.achievement(id)?.count ?? 0, earned: id => emit.achievement(id)?.earned ?? false, checkpoint: emit.flush });
  return {facts,count,kill:counter.kill};
}
