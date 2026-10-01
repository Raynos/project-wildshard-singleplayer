import { Flags, QuestState } from '#engine';
import { CoinBurst, purseSave, shardSave, type ShardContext } from '#game';
import * as v from 'valibot';
import { Scene, type Vector3 } from 'three';
import { STRINGS } from '../strings';

/** The shard key: the signal is lit (the fire stays lit on the next visit, the reward is paid once). */
const SIGNAL = { key: 'sunscar-dunes.signal', scope: 'shard' as const, version: 1, schema: v.boolean(), initial: () => false };

export interface SignalQuest { quest: QuestState; flags: Flags; wasLit: boolean; light: () => void }

/** One step, "Light the signal fire": the flag is set by the tower's interactable (world/build.ts). */
export function installQuest(ctx: ShardContext, player: Vector3, onCoin?: (share: number) => void): SignalQuest {
  const flags = new Flags(ctx.manifest.slug), signal = ctx.app.saves.define(SIGNAL), wasLit = signal.read(ctx.manifest.slug);
  const quest = new QuestState({ id: 'sunscar.quest', title: STRINGS.quest, completeFlag: 'sunscar.complete', steps: [
    { id: 'fire', objective: STRINGS.step, done: { all: ['sunscar.fire'] } },
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
  return { quest, flags, wasLit, light: () => { flags.set('sunscar.fire'); } };
}
