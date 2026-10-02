import { Flags, QuestState } from '#engine';
import { CoinBurst, purseSave, shardSave, type ShardContext } from '#game';
import * as v from 'valibot';
import { Scene, type Vector3 } from 'three';
import { VANES } from '../layout';
import { STRINGS } from '../strings';

export const FLAGS = { notes: 'far.notes', roost: 'far.roost', vanes: 'far.vanes', raised: 'far.bridge', complete: 'far.complete', roc: 'far.roc.down' } as const;
export const vaneFlag = (id: string): string => `far.vane.${id}`;
export const REWARD = 10;
export const BOSS_REWARD = 25;
const REWARDED = { key: 'far-reach.rewarded', scope: 'shard' as const, version: 1, schema: v.boolean(), initial: () => false };

/**
 * The crown bridge, four steps: read the bridge-keeper's notes, clear the roost of drift rays, turn the three wind
 * vanes with GUST, raise the bridge to the storm crown. Ten coins once per save; the Storm Roc waits across the bridge.
 */
export function installQuest(ctx: ShardContext, player: Vector3, onCoin?: (share: number) => void):
  { quest: QuestState; flags: Flags; burst: (count: number, toast: string) => void } {
  const flags = new Flags(ctx.manifest.slug), rewarded = ctx.app.saves.define(REWARDED);
  const quest = new QuestState({ id: 'far.quest', title: STRINGS.quest, completeFlag: FLAGS.complete, steps: [
    { id: 'notes', objective: STRINGS.notes, done: { all: [FLAGS.notes] } },
    { id: 'roost', objective: STRINGS.roostQuest, done: { all: [FLAGS.roost] } },
    { id: 'vanes', objective: STRINGS.vanes, done: { all: [FLAGS.vanes] } },
    { id: 'raise', objective: STRINGS.raise, done: { all: [FLAGS.raised] } },
  ] }, flags, ctx.app.events, ctx.scope);
  const purse = shardSave(purseSave, ctx.manifest.slug);
  const scene = ctx.game.runtime?.world?.game.scene ?? new Scene(), coins = new CoinBurst(scene);
  ctx.system({ id: 'far.reward', phase: 'update', run: (dt) => { coins.update(dt, player); } });
  ctx.scope.onDispose(() => { coins.update(3, player); coins.dispose(); });
  const burst = (count: number, toast: string): void => {
    coins.spawn(player, count, onCoin ?? ((share) => { purse.write(purse.read() + share); }), () => { ctx.game.runtime?.play?.hud.toast(toast); });
  };
  quest.onComplete = () => {
    if (rewarded.read(ctx.manifest.slug)) return;
    rewarded.write(true, ctx.manifest.slug); burst(REWARD, STRINGS.reward);
  };
  ctx.system({ id: 'far.vanes', phase: 'update', run: () => {
    if (!flags.has(FLAGS.vanes) && VANES.every((vane) => flags.has(vaneFlag(vane.id)))) flags.set(FLAGS.vanes);
  } });
  return { quest, flags, burst };
}
