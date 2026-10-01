import { Flags, QuestState } from '#engine';
import { CoinBurst, purseSave, shardSave, type ShardContext } from '#game';
import * as v from 'valibot';
import { Scene, type Vector3 } from 'three';
import type { SignalFire } from '../world/build';
import { STRINGS } from '../strings';

/** Whether the signal reward was paid (shard save, SHARDS §10). */
const SIGNAL = { key: 'sunscar.signal', scope: 'shard' as const, version: 1, schema: v.boolean(), initial: () => false };
export const LIT_FLAG = 'sunscar.lit';

/** One step, "Light the signal fire": interact with the brazier on the tower deck. Pays 5 coins once. */
export function installQuest(ctx: ShardContext, player: Vector3, fire: SignalFire, onCoin?: (share: number) => void): { quest: QuestState; flags: Flags } {
  const flags = new Flags(ctx.manifest.slug), paid = ctx.app.saves.define(SIGNAL);
  const quest = new QuestState({ id: 'sunscar.signal', title: STRINGS.quest, completeFlag: 'sunscar.complete', steps: [
    { id: 'fire', objective: STRINGS.step, done: { all: [LIT_FLAG] } },
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
  fire.onLight = () => { flags.set(LIT_FLAG); };
  // A signal lit on an earlier visit stays lit.
  if (paid.read(ctx.manifest.slug)) fire.light();
  return { quest, flags };
}
