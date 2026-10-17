import type { ShardContext } from '@wildshard/game/shard/context';
import type { Progress } from '@wildshard/game/Progress';
import { bindRuntimeLedger, type RuntimeFacts } from '@wildshard/game/shardfile/hybridRows';
import { createAchievementCounters } from '@wildshard/game/achievements';
import { parseAchievementCounterData } from '@wildshard/format/achievementCounters';

export interface DriftwoodFacts {
  readonly facts: RuntimeFacts;
  readonly count: (id: string, total: number) => void;
  readonly syncFlags:ReturnType<typeof createAchievementCounters>['syncFlags'];
  readonly kill: (kind: string) => void;
}
/** C26: read current Progress counts without rewriting its save; replay stable count facts into SF14 once. */
export async function bindDriftwoodFacts(ctx: Pick<ShardContext, 'app' | 'scope' | 'product'>, source: ShardContext['product']['shardfile'], previous: readonly { def: { id: string }; count: number }[], progress?: Partial<Pick<Progress, 'bindLedger' | 'refreshLedger'>>, instance = source.identity.slug): Promise<DriftwoodFacts> {
  const rows = parseAchievementCounterData(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(await ctx.product.file('quests/achievements.json'))));
  if (ctx.scope.disposed) throw new Error('Driftwood achievement owner left during admission');
  const emit = bindRuntimeLedger(ctx, source, instance);
  const facts: RuntimeFacts = Object.assign((name: string, entity: string) => {
    const receipt = emit(name, entity); progress?.refreshLedger?.(); return receipt;
  }, { flush: emit.flush, achievement: emit.achievement });
  let counts:Record<string,number>=Object.fromEntries(rows.feats.map(feat=>[feat.id,emit.achievement(feat.id)?.count??0] as const));
  const counter=createAchievementCounters(rows,{read:()=>({...counts}),write:current=>{counts=current;},emit:(name,entity)=>{facts(name,entity);}});
  const count=counter.count;
  for (const row of previous) if (rows.feats.some(feat => feat.id === row.def.id)) count(row.def.id, row.count);
  progress?.bindLedger?.({ count: id => emit.achievement(id)?.count ?? 0, earned: id => emit.achievement(id)?.earned ?? false, checkpoint: emit.flush });
  return {facts,count,kill:counter.kill,syncFlags:counter.syncFlags};
}
