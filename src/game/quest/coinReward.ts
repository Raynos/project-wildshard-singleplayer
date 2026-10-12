import { Scene, type Vector3 } from 'three';
import type { QuestState } from '@wildshard/engine/quest/core';
import { CoinBurst } from '../loot/CoinBurst';
import type { ShardContext } from '../plugin/context';
import { retainsRuntimeServices } from '../plugin/lifecycle';
import type { RuntimeCoins } from '../plugin/headless';
import { installEnteredQuestPresentation, installQuestPresentation, type QuestPresentation, type QuestPresentationOptions } from '../plugin/ui';
import type { QuestRewardSpec } from './reward';

/** A quest's coin reward: the burst that flies the coins to the player, `pay`, which pays once per save, and `spawn`, any other coins through the same burst. */
export interface QuestReward { readonly burst: CoinBurst; readonly pay: () => undefined; readonly spawn: (amount: number, toast: string) => void }

/**
 * A declared quest's coin reward (SHARD-PLATFORM M3; Signal Dunes and Sky Reach): `amount` coins burst out of the player through the platform purse
 * (`coins`), the `toast` after the last lands; `paid` / `markPaid` are the save's once-only record (a quest flag, a shard
 * save). The burst lives on the play scene, or on a scene of its own headless.
 */
export function questReward(ctx: ShardContext, o: { readonly player: Vector3; readonly coins: RuntimeCoins; readonly amount: number; readonly paid: () => boolean; readonly markPaid: () => void; readonly toast: string }): QuestReward {
  const scene = ctx.game.runtime?.world?.game.scene ?? new Scene(), burst = new CoinBurst(scene);
  const spawn = (amount: number, toast: string): void => { burst.spawn(o.player, amount, o.coins, () => { ctx.game.runtime?.play?.hud.toast(toast); }); };
  const pay = (): undefined => {
    if (o.paid()) return undefined;
    o.markPaid(); spawn(o.amount, o.toast);
    return undefined;
  };
  return { burst, pay, spawn };
}

/**
 * A quest's one-call presentation with its coin reward (ENGINE §20): the chip, markers, MAP card, places and step toasts,
 * the held reward beat (`reward`, shown while the quest is complete and `unpaid` holds) that pays; entered
 * for a retained home, installed in plain play, absent headless (the reward then pays at once on completion). A quest
 * still open toasts `newQuest` on the first frame. The burst animates under the system `id` and is freed with the level.
 */
export function presentRewardedQuest(ctx: ShardContext, quest: QuestState, reward: QuestReward, o: { readonly id: string; readonly player: Vector3; readonly unpaid: () => boolean; readonly newQuest: string; readonly presentation: Omit<QuestPresentationOptions, 'reward'>; readonly beat: Omit<QuestRewardSpec, 'when' | 'finish'> }): () => QuestPresentation | null {
  const runtime = ctx.game.runtime, live = runtime?.world && runtime.play ? runtime : null, { burst, pay } = reward;
  const presentation: QuestPresentationOptions = { ...o.presentation, reward: { ...o.beat, when: () => o.unpaid() && quest.isComplete, finish: pay } };
  const entered = live !== null && retainsRuntimeServices(ctx) ? installEnteredQuestPresentation(ctx, quest, presentation) : null;
  const view = live === null || entered !== null ? null : installQuestPresentation(ctx, quest, presentation);
  ctx.scope.onDispose(quest.observe({ complete: () => { if (live === null) pay(); } }));
  if (!quest.isComplete) ctx.game.runtime?.play?.hud.toast(o.newQuest);
  ctx.system({ id: o.id, phase: 'update', run: (dt) => { burst.update(dt, o.player); } });
  ctx.scope.onDispose(() => { burst.update(3, o.player); burst.dispose(); });
  return () => entered === null ? view : entered();
}
