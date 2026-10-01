import { Flags, QuestState } from '#engine';
import { CoinBurst, purseSave, shardSave, type ShardContext } from '#game';
import * as v from 'valibot';
import { Scene, type Vector3 } from 'three';
import { STRINGS } from '../strings';

/** The fire stays lit across visits (a shard-scoped save); the reward pays once. */
const SIGNAL = { key: 'sunscar-dunes.signal', scope: 'shard' as const, version: 1, schema: v.boolean(), initial: () => false };

export interface DuneQuest { quest: QuestState; flags: Flags; lightFire: () => void; wasLit: boolean }

/** One step, "Light the signal fire": the brazier interact sets the flag; completion pays five coins at the fire. */
export function installQuest(ctx: ShardContext, firePoint: Vector3, player: Vector3, onCoin?: (share: number) => void): DuneQuest {
  const flags = new Flags(ctx.manifest.slug), signal = ctx.app.saves.define(SIGNAL), wasLit = signal.read(ctx.manifest.slug);
  const quest = new QuestState({ id: 'sunscar.signal', title: STRINGS.quest, completeFlag: 'sunscar.signal.done', steps: [
    { id: 'fire', objective: STRINGS.light, done: { all: ['sunscar.fire'] } },
  ] }, flags, ctx.app.events, ctx.scope);
  const purse = shardSave(purseSave, ctx.manifest.slug);
  const scene = ctx.game.runtime?.world?.game.scene ?? new Scene(), burst = new CoinBurst(scene);
  ctx.system({ id: 'sunscar.reward', phase: 'update', run: (dt) => { burst.update(dt, player); } });
  ctx.scope.onDispose(() => { burst.update(3, player); burst.dispose(); });
  quest.onComplete = () => {
    if (signal.read(ctx.manifest.slug)) return;
    signal.write(true, ctx.manifest.slug);
    burst.spawn(firePoint, 5, onCoin ?? ((share) => { purse.write(purse.read() + share); }), () => { ctx.game.runtime?.play?.hud.toast(STRINGS.reward); });
  };
  return { quest, flags, wasLit, lightFire: () => { flags.set('sunscar.fire'); } };
}
