import { Flags, QuestState } from '#engine';
import { CoinBurst, purseSave, shardSave, type ShardContext } from '#game';
import * as v from 'valibot';
import { Scene, type Vector3 } from 'three';
import { HUT } from '../layout';
import { STRINGS } from '../strings';

const NOTES = { key: 'template.notes', scope: 'shard' as const, version: 1, schema: v.boolean(), initial: () => false };

export function installQuest(ctx: ShardContext, player: Vector3, onCoin?: (share: number) => void): { quest: QuestState; flags: Flags } {
  const flags = new Flags(ctx.manifest.slug);
  const notes = ctx.app.saves.define(NOTES);
  const quest = new QuestState({ id: 'template.quest', title: STRINGS.quest, completeFlag: 'template.complete', steps: [
    { id: 'hut', objective: STRINGS.reach, done: { all: ['template.hut'] } },
    { id: 'blob', objective: STRINGS.beat, done: { all: ['template.blob'] } },
  ] }, flags, ctx.app.events, ctx.scope);
  const purse = shardSave(purseSave, ctx.manifest.slug);
  const scene = ctx.game.runtime?.world?.game.scene ?? new Scene(), burst = new CoinBurst(scene);
  ctx.system({ id: 'template.reward', phase: 'update', run: (dt) => { burst.update(dt, player); } });
  ctx.scope.onDispose(() => { burst.update(3, player); burst.dispose(); });
  quest.onComplete = () => {
    if (notes.read(ctx.manifest.slug)) return;
    notes.write(true, ctx.manifest.slug);
    burst.spawn(player, 5, onCoin ?? ((share) => { purse.write(purse.read() + share); }), () => { ctx.game.runtime?.play?.hud.toast(STRINGS.reward); });
    ctx.game.runtime?.play?.progress.recordEvent('template.quest', 1);
  };
  ctx.on('actor.died', ({ actor }) => { if (actor.tags.includes('creature.greyBlob')) flags.set('template.blob'); });
  ctx.system({ id: 'template.quest', phase: 'update', run: () => { if (Math.hypot(player.x - HUT.x, player.z - HUT.doorZ) < 3) flags.set('template.hut'); } });
  return { quest, flags };
}
