import { Flags, QuestState } from '#engine';
import { CoinBurst, purseSave, shardSave, type ShardContext } from '#game';
import * as v from 'valibot';
import { Scene, type Vector3 } from 'three';
import { MILL } from '../layout';
import { STRINGS } from '../strings';
import type { SkyWorld } from '../world/build';

const REWARDED = { key: 'far-reach.rewarded', scope: 'shard' as const, version: 1, schema: v.boolean(), initial: () => false };
/** How long the winch takes to bring the bridge up (s). */
export const RAISE_SECONDS = 3;

/** The one quest: raise the fallen bridge at the winch, then cross it to the windmill island. 10 coins, once. */
export function installQuest(ctx: ShardContext, world: SkyWorld, player: Vector3): { quest: QuestState; flags: Flags } {
  const flags = new Flags(ctx.manifest.slug), rewarded = ctx.app.saves.define(REWARDED);
  const quest = new QuestState({ id: 'far.quest', title: STRINGS.quest, completeFlag: 'far.complete', steps: [
    { id: 'winch', objective: STRINGS.questWinch, done: { all: ['far.bridge'] } },
    { id: 'cross', objective: STRINGS.questCross, done: { all: ['far.mill'] } },
  ] }, flags, ctx.app.events, ctx.scope);
  // a bridge raised in an earlier session stays up
  if (flags.has('far.bridge')) { world.bridge.target = 1; world.bridge.raised = 1; world.winch.label = STRINGS.raised; }
  const purse = shardSave(purseSave, ctx.manifest.slug), scene = ctx.game.runtime?.world?.game.scene ?? new Scene(), burst = new CoinBurst(scene);
  ctx.scope.onDispose(() => { burst.update(3, player); burst.dispose(); });
  quest.onComplete = () => {
    if (rewarded.read(ctx.manifest.slug)) return;
    rewarded.write(true, ctx.manifest.slug);
    burst.spawn(player, 10, (share) => { purse.write(purse.read() + share); }, () => { ctx.game.runtime?.play?.hud.toast(STRINGS.reward); });
  };
  ctx.system({ id: 'far.quest', phase: 'update', run: (dt) => {
    burst.update(dt, player);
    const b = world.bridge;
    if (b.target > b.raised) {
      b.raised = Math.min(1, b.raised + dt / RAISE_SECONDS);
      if (b.raised >= 1) { flags.set('far.bridge'); world.winch.label = STRINGS.raised; }
    }
    b.hinge.rotation.x = 1.35 * (1 - b.raised) * (1 - b.raised);
    world.drum.rotation.x = b.raised * 12;
    if (b.raised >= 1 && Math.hypot(player.x - MILL.x, player.z - MILL.z) < MILL.r - 1 && player.y > MILL.top - 1) flags.set('far.mill');
  } });
  return { quest, flags };
}
