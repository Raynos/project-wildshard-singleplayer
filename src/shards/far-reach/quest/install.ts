import { QuestState, type QuestMarker } from '@wildshard/engine/quest/core';
import { Flags } from '@wildshard/engine/world/interact/flags';
import { CoinBurst } from '@wildshard/game/loot/CoinBurst';
import { installEnteredQuestPresentation, installQuestPresentation, type QuestPresentation, type QuestPresentationOptions } from '@wildshard/game/quest/presentation';
import { purseSave, shardSave } from '@wildshard/game/saves';
import type { ShardContext } from '@wildshard/game/shard/context';
import { retainsRuntimeServices } from '@wildshard/game/shard/retainedHooks';
import * as v from 'valibot';
import { Scene, Vector3 } from 'three';
import { CROWN, DECK, GROVE, HIGH, KEEPER, ROOST, RUIN, STEP, SUNREST, VANES, WINCH, WINDMILL } from '../layout';
import { STRINGS } from '../strings';
import { ownPrimitives } from '../world/resources';
import { FLAGS, vaneFlag } from './flags';
import { KEEPER_AT, KEEPER_NPC, keeper } from './keeper';

export const REWARD = 10;
export const BOSS_REWARD = 25;
const REWARDED = { key: 'far-reach.rewarded', scope: 'shard' as const, version: 1, schema: v.boolean(), initial: () => false };
/** The reward view: from the high step, the raised bridge running out to the storm crown (Driftwood's held beat). */
export const REWARD_VIEW = { at: new Vector3(STEP.x + 2, HIGH + 1.7, STEP.z - 4), yaw: Math.atan2(-(CROWN.x - STEP.x - 2), -(CROWN.z - STEP.z + 4)), pitch: 0.12 } as const;

/** A marker at a place's feet: the world pin adds its own 2.2 m (game/quest/presentation.ts; council round 2: the keeper's pin floated 2.4 m over his head). */
const at = (x: number, y: number, z: number): QuestMarker['at'] => ({ poi: 'world', x, y, z });

/**
 * The named places (loop 6, as the other shards: "DISCOVERED · <place>" as you arrive, pins on the full map, and the last
 * one reached is where a fall puts you back, E295). Each sits on its island's deck, clear of the structures on it.
 */
const PLACES = [
  { id: 'far.sunrest', label: STRINGS.sunrest, x: SUNREST.x, y: SUNREST.y, z: SUNREST.z, r: 12, quiet: true },
  { id: 'far.windmill', label: STRINGS.windmill, x: WINDMILL.x, y: WINDMILL.y, z: WINDMILL.z, r: 11 },
  { id: 'far.grove', label: STRINGS.grove, x: GROVE.x, y: GROVE.y, z: GROVE.z, r: 9 },
  { id: 'far.roost', label: STRINGS.roost, x: ROOST.x - 4, y: ROOST.y, z: ROOST.z - 2, r: 10 },
  { id: 'far.keeper', label: STRINGS.keeper, x: KEEPER.x, y: KEEPER.y, z: KEEPER.z, r: 9 },
  { id: 'far.ruin', label: STRINGS.ruin, x: RUIN.x, y: RUIN.y, z: RUIN.z, r: 10 },
  { id: 'far.step', label: STRINGS.step, x: STEP.x, y: STEP.y, z: STEP.z, r: 10 },
  { id: 'far.crown', label: STRINGS.crown, x: CROWN.x, y: CROWN.y, z: CROWN.z, r: 15 },
] as const;

/**
 * The crown bridge, staged like Driftwood's (review items 3, 4, 14; ENGINE §20 `installQuestPresentation`): the
 * bridge-keeper waves at Sunrest from the first frame and names the goal; every step has a marker (the chip with metres
 * and bearing, minimap and map diamonds, a styled world pin), a chip and a hint; the MAP card carries the quest; each step
 * toasts; raising the bridge holds the camera on the bridge and the crown beyond, then pays ten coins once per save.
 *   1. talk to the keeper (his notes are his dialogue; the lectern on his isle still reads them)
 *   2. clear the roost of drift rays · 3. turn the three wind vanes with GUST · 4. raise the bridge at the winch
 */
export function installQuest(ctx: ShardContext, player: Vector3, onCoin?: (share: number) => void):
  { quest: QuestState; flags: Flags; burst: (count: number, toast: string) => void; view: QuestPresentation | null; finished: () => void } {
  const flags = new Flags(ctx.manifest.slug), rewarded = ctx.app.saves.define(REWARDED);
  const quest = new QuestState({ id: 'far.quest', title: STRINGS.quest, completeFlag: FLAGS.complete, steps: [
    { id: 'notes', objective: STRINGS.talkKeeperStep, chip: STRINGS.chipKeeper, hint: STRINGS.hintKeeper, done: { all: [FLAGS.notes] },
      markers: [{ id: 'keeper', label: STRINGS.keeperPin, short: STRINGS.keeperShort, at: at(KEEPER_AT.x, DECK, KEEPER_AT.z) }] },
    { id: 'roost', objective: STRINGS.roostQuest, chip: STRINGS.chipRoost, hint: STRINGS.hintRoost, done: { all: [FLAGS.roost] },
      markers: [{ id: 'roost', label: STRINGS.roost, short: STRINGS.roostShort, at: at(ROOST.x, ROOST.y, ROOST.z) }] },
    { id: 'vanes', objective: STRINGS.vanes, chip: STRINGS.chipVanes, hint: STRINGS.hintVanes, done: { all: [FLAGS.vanes] },
      count: VANES.map((vane) => vaneFlag(vane.id)),
      markers: VANES.map((vane) => ({ id: `vane.${vane.id}`, label: STRINGS.vane, short: STRINGS.vaneShort, at: at(vane.x, vane.y + 1.4, vane.z), hideWhen: { all: [vaneFlag(vane.id)] } })) },
    { id: 'raise', objective: STRINGS.raise, chip: STRINGS.chipRaise, hint: STRINGS.hintRaise, done: { all: [FLAGS.raised] },
      markers: [{ id: 'winch', label: STRINGS.winch, short: STRINGS.winchShort, at: at(WINCH.x, WINCH.y, WINCH.z) }] },
  ] }, flags, ctx.app.events, ctx.scope);
  const purse = shardSave(purseSave, ctx.manifest.slug);
  const scene = ctx.game.runtime?.world?.game.scene ?? new Scene(), coins = new CoinBurst(scene);
  ctx.system({ id: 'far.reward', phase: 'update', run: (dt) => { coins.update(dt, player); } });
  ctx.scope.onDispose(() => { coins.update(3, player); coins.dispose(); });
  const burst = (count: number, toast: string): void => {
    coins.spawn(player, count, onCoin ?? ((share) => { purse.write(purse.read() + share); }), () => { ctx.game.runtime?.play?.hud.toast(toast); });
  };
  const pay = (): undefined => {
    if (rewarded.read(ctx.manifest.slug)) return undefined;
    rewarded.write(true, ctx.manifest.slug); burst(REWARD, STRINGS.reward); return undefined;
  };
  // The keeper at the spawn: he waves within 16 m and gestures while he talks.
  const npc = keeper(DECK); ctx.root.add(npc.group); ownPrimitives(npc.group, ctx.scope);
  ctx.system({ id: 'far.keeper', phase: 'update', run: (_dt, t) => { npc.update(t, player); } });
  const live = ctx.game.runtime?.world && ctx.game.runtime.play ? ctx.game.runtime : null;
  const presentation: QuestPresentationOptions = { flags, places: [...PLACES], introTitle: STRINGS.quest,
    npc: { npc: KEEPER_NPC, at: npc.head, label: STRINGS.talkKeeper, speaker: npc.speaker, radius: 3.5 },
    reward: { kicker: STRINGS.rewardKicker, title: STRINGS.quest, subtitle: STRINGS.rewardSubtitle, when: () => !rewarded.read(ctx.manifest.slug) && quest.isComplete,
      at: REWARD_VIEW.at, yaw: REWARD_VIEW.yaw, pitch: REWARD_VIEW.pitch, holdSeconds: 5, finish: pay } };
  const entered = live !== null && retainsRuntimeServices(ctx) ? installEnteredQuestPresentation(ctx, quest, presentation) : null;
  const view = live === null || entered !== null ? null : installQuestPresentation(ctx, quest, presentation);
  // Headless (tests, a node bake): no presentation, the reward pays at once.
  if (live === null) ctx.scope.onDispose(quest.observe({ complete: () => { pay(); } }));
  if (!quest.isComplete) ctx.game.runtime?.play?.hud.toast(`${STRINGS.newQuest} · ${STRINGS.quest}`);
  ctx.system({ id: 'far.vanes', phase: 'update', run: () => {
    if (!flags.has(FLAGS.vanes) && VANES.every((vane) => flags.has(vaneFlag(vane.id)))) flags.set(FLAGS.vanes);
  } });
  /**
   * The quest as a player has it by the time they stand in the arena (E399 capture staging, the council's should-fix: the
   * tracker read TALK TO THE KEEPER at the crown): the notes read, the roost cleared, the vanes turned, the bridge raised,
   * and its reward already paid (so no reward beat plays now).
   */
  const finished = (): void => {
    rewarded.write(true, ctx.manifest.slug);
    for (const vane of VANES) flags.set(vaneFlag(vane.id));
    for (const flag of [FLAGS.notes, FLAGS.roost, FLAGS.vanes, FLAGS.raised]) flags.set(flag);
  };
  return { quest, flags, burst, get view() { return entered === null ? view : entered(); }, finished };
}
