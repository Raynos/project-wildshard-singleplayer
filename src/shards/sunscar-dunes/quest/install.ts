import { Flags, QuestState } from '#engine';
import { CoinBurst, purseSave, shardSave, type ShardContext } from '#game';
import * as v from 'valibot';
import { Scene, type Vector3 } from 'three';
import { STRINGS } from '../strings';

const SIGNAL = { key: 'sunscar.signal', scope: 'shard' as const, version: 1, schema: v.boolean(), initial: () => false };
export const REACH_RADIUS = 9;

/** "The signal fire": reach the tower on the far crest, then light the brazier on its deck. Five coins, once. */
export function installQuest(ctx: ShardContext, player: Vector3, tower: Vector3, onCoin?: (share: number) => void): { quest: QuestState; flags: Flags; lit: () => boolean } {
  const flags = new Flags(ctx.manifest.slug), signal = ctx.app.saves.define(SIGNAL);
  const quest = new QuestState({ id: 'sunscar.quest', title: STRINGS.quest, completeFlag: 'sunscar.complete', steps: [
    { id: 'reach', objective: STRINGS.reach, done: { all: ['sunscar.tower'] } },
    { id: 'kindle', objective: STRINGS.kindle, done: { all: ['sunscar.fire'] } },
  ] }, flags, ctx.app.events, ctx.scope);
  const purse = shardSave(purseSave, ctx.manifest.slug);
  const scene = ctx.game.runtime?.world?.game.scene ?? new Scene(), burst = new CoinBurst(scene);
  ctx.system({ id: 'sunscar.reward', phase: 'update', run: (dt) => { burst.update(dt, player); } });
  ctx.scope.onDispose(() => { burst.update(3, player); burst.dispose(); });
  quest.onComplete = () => {
    if (signal.read(ctx.manifest.slug)) return;
    signal.write(true, ctx.manifest.slug);
    burst.spawn(player, 5, onCoin ?? ((share) => { purse.write(purse.read() + share); }), () => { ctx.game.runtime?.play?.hud.toast(STRINGS.reward); });
  };
  ctx.system({ id: 'sunscar.quest', phase: 'update', run: () => { if (Math.hypot(player.x - tower.x, player.z - tower.z) < REACH_RADIUS) flags.set('sunscar.tower'); } });
  return { quest, flags, lit: () => signal.read(ctx.manifest.slug) };
}
