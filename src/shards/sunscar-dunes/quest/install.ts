import { QuestState } from '#engine';
import { CoinBurst, purseSave, shardSave, type ShardContext } from '#game';
import * as v from 'valibot';
import { Scene, type Vector3 } from 'three';
import { FLAG, type SignalWorld } from '../world/build';
import { STRINGS } from '../strings';

/** Whether the signal reward was paid (shard save, SHARDS §10). */
const SIGNAL = { key: 'sunscar.signal', scope: 'shard' as const, version: 1, schema: v.boolean(), initial: () => false };
export const LIT_FLAG = FLAG.lit;

/**
 * "The signal", four steps (C4): read the caravan's logbook → take the oil from the dry well → light the three waymark
 * braziers → light the signal fire (which summons the Dune Matriarch, C5). Pays 5 coins once.
 */
export function installQuest(ctx: ShardContext, player: Vector3, world: SignalWorld, onCoin?: (share: number) => void): { quest: QuestState; burst: CoinBurst } {
  const { flags } = world, paid = ctx.app.saves.define(SIGNAL);
  const quest = new QuestState({ id: 'sunscar.signal', title: STRINGS.quest, completeFlag: 'sunscar.complete', steps: [
    { id: 'logbook', objective: STRINGS.stepLog, done: { all: [FLAG.logbook] } },
    { id: 'oil', objective: STRINGS.stepOil, done: { all: [FLAG.oil] } },
    { id: 'waymarks', objective: STRINGS.stepWaymarks, done: { all: [FLAG.brazier(0), FLAG.brazier(1), FLAG.brazier(2)] } },
    { id: 'fire', objective: STRINGS.step, done: { all: [FLAG.lit] } },
  ] }, flags, ctx.app.events, ctx.scope);
  const purse = shardSave(purseSave, ctx.manifest.slug);
  const scene = ctx.game.runtime?.world?.game.scene ?? new Scene(), burst = new CoinBurst(scene);
  ctx.system({ id: 'sunscar.reward', phase: 'update', run: (dt) => { burst.update(dt, player); } });
  ctx.scope.onDispose(() => { burst.update(3, player); burst.dispose(); });
  quest.onComplete = () => {
    if (paid.read(ctx.manifest.slug)) return;
    paid.write(true, ctx.manifest.slug);
    burst.spawn(player, 5, onCoin ?? ((share) => { purse.write(purse.read() + share); }), () => { ctx.game.runtime?.play?.hud.toast(STRINGS.reward); });
  };
  return { quest, burst };
}
