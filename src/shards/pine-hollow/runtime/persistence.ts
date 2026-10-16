import * as v from 'valibot';
import type { ShardContext } from '@wildshard/game/shard/context';
import { bindRuntimeJsonRecord } from '@wildshard/game/shardfile/hybridRows';
import { bossesSave, elitesSave } from '@wildshard/game/saves';
import source from '../shard.config';

const finite = v.pipe(v.number(), v.finite());
const bosses = v.record(v.string(), v.object({ defeated: v.boolean(), rewardTaken: v.boolean(), kills: finite }));
const elites = v.record(v.string(), v.object({ timer: finite, discovered: v.boolean(), skinTaken: v.boolean(), kills: finite, retired: v.boolean() }));

/** C26: retain current encounter records, then route every subsequent write through declared host state. */
export function bindPineCombatState(ctx: Pick<ShardContext, 'app' | 'scope'>, instance: string): { bosses: ReturnType<typeof bindRuntimeJsonRecord<typeof bosses>>; elites: ReturnType<typeof bindRuntimeJsonRecord<typeof elites>> } {
  return {
    bosses: bindRuntimeJsonRecord(ctx, source, 'pine.bosses', bosses, () => bossesSave.read(instance), instance),
    elites: bindRuntimeJsonRecord(ctx, source, 'pine.elites', elites, () => elitesSave.read(instance), instance),
  };
}
