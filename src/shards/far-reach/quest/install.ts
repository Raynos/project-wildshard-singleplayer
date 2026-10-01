import { Flags, QuestState } from '#engine';
import { CoinBurst, purseSave, shardSave, type ShardContext } from '#game';
import * as v from 'valibot';
import { Scene, type Vector3 } from 'three';
import { MILL, WINDMILL } from '../layout';
import { STRINGS } from '../strings';

/** set once the quest's coins are paid, so a replay never pays twice */
const REWARDED = { key: 'far-reach.rewarded', scope: 'shard' as const, version: 1, schema: v.boolean(), initial: () => false };
export const REWARD_COINS = 10;

/**
 * "The fallen bridge": raise it with the winch (`far.bridge`, set by the plugin when the lift completes), then cross to
 * the windmill isle (`far.windmill`). The reward is 10 coins and a feat event, paid once per save.
 */
export function installQuest(ctx: ShardContext, player: Vector3, onCoin?: (share: number) => void): { quest: QuestState; flags: Flags } {
  const flags = new Flags(ctx.manifest.slug), rewarded = ctx.app.saves.define(REWARDED);
  const quest = new QuestState({ id: 'far.quest', title: STRINGS.quest, completeFlag: 'far.complete', steps: [
    { id: 'raise', objective: STRINGS.raise, done: { all: ['far.bridge'] } },
    { id: 'cross', objective: STRINGS.cross, done: { all: ['far.windmill'] } },
  ] }, flags, ctx.app.events, ctx.scope);
  const purse = shardSave(purseSave, ctx.manifest.slug);
  const scene = ctx.game.runtime?.world?.game.scene ?? new Scene(), burst = new CoinBurst(scene);
  ctx.system({ id: 'far.reward', phase: 'update', run: (dt) => { burst.update(dt, player); } });
  ctx.scope.onDispose(() => { burst.update(3, player); burst.dispose(); });
  quest.onComplete = () => {
    if (rewarded.read(ctx.manifest.slug)) return;
    rewarded.write(true, ctx.manifest.slug);
    burst.spawn(player, REWARD_COINS, onCoin ?? ((share) => { purse.write(purse.read() + share); }), () => { ctx.game.runtime?.play?.hud.toast(STRINGS.reward); });
    ctx.game.runtime?.play?.progress.recordEvent('far.quest', 1);
  };
  ctx.system({ id: 'far.quest', phase: 'update', run: () => {
    if (flags.has('far.bridge') && Math.hypot(player.x - MILL.x, player.z - MILL.z) < WINDMILL.r - 2) flags.set('far.windmill');
  } });
  return { quest, flags };
}
