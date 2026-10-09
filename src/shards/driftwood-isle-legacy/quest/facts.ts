import type { ShardContext } from '@wildshard/game/shard/context';
import type { Progress } from '@wildshard/game/Progress';
import { bindRuntimeLedger, type RuntimeFacts } from '@wildshard/game/shardfile/hybridRows';
import { DRIFTWOOD_FEATS } from './rows';
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
  const counts = new Map(DRIFTWOOD_FEATS.map(feat => [feat.id, emit.achievement(feat.id)?.count ?? 0]));
  const count = (id: string, total: number): void => {
    const feat = DRIFTWOOD_FEATS.find(row => row.id === id); if (feat === undefined) throw new Error(`Unknown Driftwood feat ${id}`);
    const value = Math.min(feat.count, Math.max(counts.get(id) ?? 0, Math.floor(total)));
    if (!Number.isFinite(value) || value < 0) throw new RangeError('Invalid Driftwood feat count');
    for (let n = (counts.get(id) ?? 0) + 1; n <= value; n++) facts(`driftwood.${id}`, `${id}:${String(n)}`);
    counts.set(id, value);
  };
  for (const row of previous) if (DRIFTWOOD_FEATS.some(feat => feat.id === row.def.id)) count(row.def.id, row.count);
  progress?.bindLedger?.({ count: id => emit.achievement(id)?.count ?? 0, earned: id => emit.achievement(id)?.earned ?? false, checkpoint: emit.flush });
  return { facts, count, kill: (kind: string): void => {
    for (const feat of DRIFTWOOD_FEATS) if (feat.kind === kind) count(feat.id, (counts.get(feat.id) ?? 0) + 1);
  } };
}
