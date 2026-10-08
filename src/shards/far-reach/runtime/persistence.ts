import * as v from 'valibot';
import type { BossSaved } from '@wildshard/engine/ai/BossBrain';
import type { Progress } from '@wildshard/game/Progress';
import { bossesSave } from '@wildshard/game/saves';
import type { ShardContext } from '@wildshard/game/shard/context';
import { bindRuntimeLedger, bindRuntimeState, type RuntimeFacts } from '@wildshard/game/shardfile/hybridRows';
import source from '../shard.config';

/** Read-only C26 source; runtime state becomes the sole writer after field initialization. */
export const LEGACY_REWARDED = { key: 'far-reach.rewarded', scope: 'shard' as const, version: 1, schema: v.boolean(), initial: (): boolean => false };
const bossSchema = v.strictObject({ defeated: v.boolean(), rewardTaken: v.boolean(), kills: v.pipe(v.number(), v.integer(), v.minValue(0)) });
export interface SkyPersistence {
  readonly facts: RuntimeFacts;
  readonly rewarded: { read: () => boolean; write: (value: boolean) => void };
  readonly boss: { read: () => BossSaved; write: (value: BossSaved) => void };
  readonly bindProgress: (progress: Pick<Progress, 'bindLedger' | 'refreshLedger'> | undefined) => void;
}

/** One continuation and one ledger under the canonical placement id, shared by standalone and the grid. */
export function bindSkyPersistence(ctx: Pick<ShardContext, 'app' | 'scope'>, saves: ShardContext['app']['saves'], instance = source.identity.slug): SkyPersistence {
  const oldReward = saves.define(LEGACY_REWARDED);
  const reward = bindRuntimeState(ctx, source, 'far-reach.rewarded', () => oldReward.read(source.identity.slug), instance);
  const encounter = bindRuntimeState(ctx, source, 'far-reach.roc', () => JSON.stringify(bossesSave.read(source.identity.slug)['far.roc']
    ?? { defeated: false, rewardTaken: false, kills: 0 }), instance);
  const emit = bindRuntimeLedger(ctx, source, instance);
  let progress: Pick<Progress, 'bindLedger' | 'refreshLedger'> | undefined;
  const facts = Object.assign((name: string, entity: string) => { const receipt = emit(name, entity); progress?.refreshLedger(); return receipt; },
    { flush: emit.flush, achievement: emit.achievement });
  const rewarded = { read: (): boolean => { const value = reward.read(); if (typeof value !== 'boolean') throw new Error('Sky reward state must be boolean'); return value; },
    write: (value: boolean): void => { if (!reward.write(value)) throw new Error('Sky reward checkpoint is not durable'); } };
  const boss = { read: (): BossSaved => {
    const value = encounter.read(); if (typeof value !== 'string') throw new Error('Sky encounter state must be JSON');
    const parsed: unknown = JSON.parse(value); return v.parse(bossSchema, parsed);
  }, write: (value: BossSaved): void => { if (!encounter.write(JSON.stringify(v.parse(bossSchema, value)))) throw new Error('Sky encounter checkpoint is not durable'); } };
  if (boss.read().defeated) facts('far-reach.roc', 'far.roc');
  return { facts, rewarded, boss, bindProgress: (view) => {
    progress = view;
    view?.bindLedger({ count: (id) => facts.achievement(id)?.count ?? 0, earned: (id) => facts.achievement(id)?.earned ?? false,
      checkpoint: () => { const state = reward.write(reward.read()), continuation = encounter.write(encounter.read()), ledger = facts.flush(); return state && continuation && ledger; } });
  } };
}
