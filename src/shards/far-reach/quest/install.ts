import { Flags, QuestState } from '#engine';
import { CoinBurst, purseSave, shardSave, type ShardContext } from '#game';
import * as v from 'valibot';
import { Scene, type Vector3 } from 'three';
import { STRINGS } from '../strings';

/** Whether the fallen bridge is up (and its reward paid): one shard-scoped boolean. */
export const BRIDGE_SAVE = { key: 'far-reach.bridge', scope: 'shard' as const, version: 1, schema: v.boolean(), initial: (): boolean => false };
export const QUEST_FLAG = 'farReach.bridge';

/** One step: raise the fallen bridge to the windmill isle. The flag is set when the bridge is up; completing saves it. */
export function installQuest(ctx: ShardContext, player: Vector3): { quest: QuestState; flags: Flags; saved: boolean } {
  const flags = new Flags(ctx.manifest.slug), store = ctx.app.saves.define(BRIDGE_SAVE), saved = store.read(ctx.manifest.slug);
  const quest = new QuestState({ id: 'farReach.quest', title: STRINGS.quest, completeFlag: 'farReach.complete', steps: [
    { id: 'bridge', objective: STRINGS.questStep, done: { all: [QUEST_FLAG] } },
  ] }, flags, ctx.app.events, ctx.scope);
  const purse = shardSave(purseSave, ctx.manifest.slug);
  const scene = ctx.game.runtime?.world?.game.scene ?? new Scene(), burst = new CoinBurst(scene);
  ctx.system({ id: 'farReach.reward', phase: 'update', run: (dt) => { burst.update(dt, player); } });
  ctx.scope.onDispose(() => { burst.update(3, player); burst.dispose(); });
  quest.onComplete = () => {
    if (store.read(ctx.manifest.slug)) return;
    store.write(true, ctx.manifest.slug);
    burst.spawn(player, 10, (share) => { purse.write(purse.read() + share); }, () => { ctx.game.runtime?.play?.hud.toast(STRINGS.reward); });
  };
  if (saved) flags.set(QUEST_FLAG);
  return { quest, flags, saved };
}
