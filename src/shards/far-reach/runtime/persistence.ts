import * as v from 'valibot';
import type { Progress } from '@wildshard/game/Progress';
import type { ShardContext } from '@wildshard/game/shard/context';
import { bindRuntimeBossRecord, bindRuntimeLedger, bindRuntimeState, projectRuntimeFacts, type RuntimeFacts } from '@wildshard/game/shardfile/hybridRows';
import source from '../shard.config';
import { SKY_BOSS_STATE } from '../data/rocFight';

/** Read-only C26 source; runtime state becomes the sole writer after field initialization. */
export const LEGACY_REWARDED = { key: 'far-reach.rewarded', scope: 'shard' as const, version: 1, schema: v.boolean(), initial: (): boolean => false };
export interface SkyPersistence {
  readonly facts: RuntimeFacts;
  readonly rewarded: { read: () => boolean; write: (value: boolean) => void };
  readonly boss: ReturnType<typeof bindRuntimeBossRecord>;
  readonly bindProgress: (progress: Pick<Progress, 'bindLedger' | 'refreshLedger'> | undefined) => void;
}

/** One continuation and one ledger under the canonical placement id, shared by standalone and the grid. */
export function bindSkyPersistence(ctx: Pick<ShardContext, 'app' | 'scope'>, saves: ShardContext['app']['saves'], instance = source.identity.slug): SkyPersistence {
  const oldReward = saves.define(LEGACY_REWARDED);
  const reward = bindRuntimeState(ctx, source, 'far-reach.rewarded', () => oldReward.read(source.identity.slug), instance);
  const continuation = bindRuntimeBossRecord(ctx, source, SKY_BOSS_STATE, undefined, instance);
  const emit = bindRuntimeLedger(ctx, source, instance);
  const facts = projectRuntimeFacts(emit, undefined);
  const rewarded = { read: (): boolean => { const value = reward.read(); if (typeof value !== 'boolean') throw new Error('Sky reward state must be boolean'); return value; },
    write: (value: boolean): void => { if (!reward.write(value)) throw new Error('Sky reward checkpoint is not durable'); } };
  const boss = continuation;
  if (boss.read().defeated) facts('far-reach.roc', 'far.roc');
  return { facts, rewarded, boss, bindProgress: (view) => {
    facts.bindProgress(view, () => { const state = reward.write(reward.read()), durable = continuation.flush(), ledger = facts.flush(); return state && durable && ledger; });
  } };
}
