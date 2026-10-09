import * as v from 'valibot';
import type { ShardContext } from '@wildshard/game/shard/context';
import { bindRuntimeState } from '@wildshard/game/shardfile/hybridRows';
import type { BossPersistence } from '@wildshard/game/Boss';
import type { ElitePersistence } from '@wildshard/game/Elite';
import { bossesSave, elitesSave } from '@wildshard/game/saves';
import source from '../shard.config';

const finite = v.pipe(v.number(), v.finite());
const bosses = v.record(v.string(), v.object({ defeated: v.boolean(), rewardTaken: v.boolean(), kills: finite }));
const elites = v.record(v.string(), v.object({ timer: finite, discovered: v.boolean(), skinTaken: v.boolean(), kills: finite, retired: v.boolean() }));

/** C26: retain current encounter records, then route every subsequent write through declared host state. */
export function bindPineCombatState(ctx: Pick<ShardContext, 'app' | 'scope'>, instance: string): { bosses: BossPersistence; elites: ElitePersistence } {
  const bossState = bindRuntimeState(ctx, source, 'pine.bosses', () => JSON.stringify(bossesSave.read(instance)), instance);
  const eliteState = bindRuntimeState(ctx, source, 'pine.elites', () => JSON.stringify(elitesSave.read(instance)), instance);
  const owner = (slug: string): void => { if (slug !== instance) throw new Error('Pine encounter state belongs to another instance'); };
  const json = (value: number | string | boolean): unknown => {
    if (typeof value !== 'string') throw new Error('Pine encounter state needs a JSON string');
    return JSON.parse(value) as unknown;
  };
  return {
    bosses: { read: (slug) => { owner(slug); return v.parse(bosses, json(bossState.read())); },
      write: (value, slug) => { owner(slug); bossState.write(JSON.stringify(v.parse(bosses, value))); } },
    elites: { read: (slug) => { owner(slug); return v.parse(elites, json(eliteState.read())); },
      write: (value, slug) => { owner(slug); eliteState.write(JSON.stringify(v.parse(elites, value))); } },
  };
}
