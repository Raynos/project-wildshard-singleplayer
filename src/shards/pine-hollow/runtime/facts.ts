import * as v from 'valibot';
import { bindRuntimeLedger, bindRuntimeJsonRecord, type RuntimeFacts } from '@wildshard/game/shardfile/hybridRows';
import type { ShardContext } from '@wildshard/game/shard/context';
import type { Progress } from '@wildshard/game/Progress';
import { progressSave } from '@wildshard/game/saves';
import { createPineFacts, type PineFacts } from '../quest/featLaw';
import source from '../shard.config';

const countsSchema = v.record(v.string(), v.pipe(v.number(), v.finite(), v.integer(), v.minValue(0)));
/** C26 imports current counters once, retaining Progress solely as the unchanged journal/title presentation. */
export function bindPineFacts(ctx: Pick<ShardContext, 'app' | 'scope'>, progress: Pick<Progress, 'bindLedger' | 'refreshLedger'>, instance: string, facts: RuntimeFacts = bindRuntimeLedger(ctx, source, instance)): PineFacts {
  const { read, write } = bindRuntimeJsonRecord(ctx, source, 'pine.feat-counts', countsSchema, () => progressSave.read(instance).counts, instance);
  const policy = createPineFacts({ read, write: current => { write(current); }, emit: (fact, entity) => { facts(fact, entity); } });
  policy.replay();
  const achievement = (id: string) => facts.achievement(`pine-hollow.${id}`);
  progress.bindLedger({ count: (id) => achievement(id)?.count ?? 0, earned: (id) => achievement(id)?.earned ?? false,
    checkpoint: () => { const counters = write(read()), grants = facts.flush(); return counters && grants; } });
  return { kill: (kind, variant) => { policy.kill(kind, variant); progress.refreshLedger(); },
    syncFlags:flags=>{policy.syncFlags(flags,(id,total)=>{policy.event(id,total);progress.refreshLedger();});},
    event: (event, total) => { policy.event(event, total); progress.refreshLedger(); } };
}
