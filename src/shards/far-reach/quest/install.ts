import { Flags, QuestState } from '#engine';
import { CoinBurst, purseSave, shardSave, type ShardContext } from '#game';
import * as v from 'valibot';
import { Scene, type Vector3 } from 'three';
import { DECK, WINDMILL } from '../layout';
import { STRINGS } from '../strings';

export const FLAGS = { raised: 'far.bridge', mill: 'far.mill', complete: 'far.complete' } as const;
export const REWARD = 10;
const REWARDED = { key: 'far-reach.rewarded', scope: 'shard' as const, version: 1, schema: v.boolean(), initial: () => false };

/** The fallen bridge: raise it with the winch, then cross to the windmill. Ten coins, once per save. */
export function installQuest(ctx: ShardContext, player: Vector3, onCoin?: (share: number) => void): { quest: QuestState; flags: Flags } {
  const flags = new Flags(ctx.manifest.slug), rewarded = ctx.app.saves.define(REWARDED);
  const quest = new QuestState({ id: 'far.quest', title: STRINGS.quest, completeFlag: FLAGS.complete, steps: [
    { id: 'raise', objective: STRINGS.raise, done: { all: [FLAGS.raised] } },
    { id: 'cross', objective: STRINGS.cross, done: { all: [FLAGS.mill] } },
  ] }, flags, ctx.app.events, ctx.scope);
  const purse = shardSave(purseSave, ctx.manifest.slug);
  const scene = ctx.game.runtime?.world?.game.scene ?? new Scene(), burst = new CoinBurst(scene);
  ctx.system({ id: 'far.reward', phase: 'update', run: (dt) => { burst.update(dt, player); } });
  ctx.scope.onDispose(() => { burst.update(3, player); burst.dispose(); });
  quest.onComplete = () => {
    if (rewarded.read(ctx.manifest.slug)) return;
    rewarded.write(true, ctx.manifest.slug);
    burst.spawn(player, REWARD, onCoin ?? ((share) => { purse.write(purse.read() + share); }), () => { ctx.game.runtime?.play?.hud.toast(STRINGS.reward); });
  };
  ctx.system({ id: 'far.quest', phase: 'update', run: () => {
    if (flags.has(FLAGS.raised) && player.y > DECK - 1.5 && Math.hypot(player.x - WINDMILL.x, player.z - WINDMILL.z) < WINDMILL.r * 0.75) flags.set(FLAGS.mill);
  } });
  return { quest, flags };
}
