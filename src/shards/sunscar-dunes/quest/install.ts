import type { QuestMarker, QuestState } from '@wildshard/engine/quest/core';
import { boxDesc } from '@wildshard/engine/world/registry';
import { CoinBurst } from '@wildshard/game/loot/CoinBurst';
import { installEnteredQuestPresentation, installQuestPresentation, type QuestPresentation, type QuestPresentationOptions } from '@wildshard/game/quest/presentation';
import { purseSave, shardSave } from '@wildshard/game/saves';
import type { ShardContext } from '@wildshard/game/shard/context';
import { retainsRuntimeServices } from '@wildshard/game/shard/retainedHooks';
import * as v from 'valibot';
import { Scene, type Vector3 } from 'three';
import type { SignalWorld } from '../world/build';
import { BASIN, CARAVAN, SPAWN, WELL, TOWER } from '../layout';
import { STRINGS } from '../strings';
import { lastLightAll } from '../look/light';
import { ownPrimitives } from '../world/resources';
import { scout, scoutNpc } from './scout';
import { FLAG, SCOUT_AT, SCOUT_FLAG } from '../data/flags';
import { COMPLETE_FLAG, LATER_FLAGS, PAID_FLAG } from '../quests/signal';
import { bindRuntimeLedger, bindRuntimeQuest, type RuntimeFacts } from '@wildshard/game/shardfile/hybridRows';
import source from '../shard.config';


/** The old reward record (SHARDS §10): read once to carry a current save over to PAID_FLAG (C26), never written again. */
export const LEGACY_SIGNAL = { key: 'sunscar.signal', scope: 'shard' as const, version: 1, schema: v.boolean(), initial: (): boolean => false };
export const LIT_FLAG = FLAG.lit;

/** The named places: walking into one toasts "Discovered · …" once and names it on the full map (review R4, R11). */
const PLACES = [
  { id: 'sunscar.crest', label: STRINGS.placeCrest, x: SPAWN.x, z: SPAWN.z, r: 14 },
  { id: 'sunscar.caravan', label: STRINGS.caravan, x: CARAVAN.x, z: CARAVAN.z, r: 18 },
  { id: 'sunscar.well', label: STRINGS.well, x: WELL.x, z: WELL.z, r: 16 },
  { id: 'sunscar.tower', label: STRINGS.tower, x: TOWER.x, z: TOWER.z, r: 18 },
  { id: 'sunscar.basin', label: STRINGS.placeBasin, x: BASIN.x, z: BASIN.z, r: BASIN.r - 4 },
] as const;

const at = (p: Vector3, dy = 0): QuestMarker['at'] => ({ poi: 'world', x: p.x, y: p.y + dy, z: p.z });

/**
 * "The signal" (C4, staged like Driftwood's in P4): Sefa the caravan scout waves from the spawn crest and her talk is
 * the first step (loop 2); the quest's chip names her from the first frame, every step has a
 * marker (the HUD chip with distance and bearing, a diamond on the minimap and the map, a pin in the world), the map
 * tab carries the quest card, the places toast as they are found, and the Matriarch is the last step: the 5-coin
 * signal reward pays after her fall.
 */
export function installQuest(ctx: ShardContext, player: Vector3, world: SignalWorld, onCoin?: (share: number) => void): { quest: QuestState; burst: CoinBurst; view: QuestPresentation | null; facts: RuntimeFacts } {
  const { flags } = world, saves = ctx.app.saves, legacy = saves.define(LEGACY_SIGNAL);
  // SF14 / M3: Signal Dunes' feats are its shardfile's ledger rows (runtime.binds); the platform grants each achievement once.
  // The instance is the first-party placement id (the slug: Select a shard, explore and the grid share it).
  const slug = ctx.manifest.slug, facts = bindRuntimeLedger(ctx, source, slug);
  const groundAt = (x: number, z: number): number => ctx.manifest.ground.terrain?.heightAt(x, z) ?? 0;
  // C26: a current save that recorded the paid reward in the old shard save carries it over as the quest flag.
  if (!flags.has(PAID_FLAG) && legacy.read(slug)) flags.set(PAID_FLAG);
  // A save from before Sefa (loop 2) or a player who walked past her to the caravan: any later step done means the
  // scout's step is too, so a mid-quest save is never sent back to the crest; on load her flag is set for it (no wave).
  if (!flags.has(SCOUT_FLAG) && [...LATER_FLAGS, COMPLETE_FLAG].some((f) => flags.has(f))) flags.set(SCOUT_FLAG);
  // The declared quest (quests/signal.ts), each world-piece marker placed on its built piece.
  const placed: Record<string, QuestMarker['at']> = {
    scout: { poi: 'world', x: SCOUT_AT.x, y: groundAt(SCOUT_AT.x, SCOUT_AT.z), z: SCOUT_AT.z }, // her feet: the pin adds its own 2.2 m (round 1, R1C-7)
    logbook: at(world.logbook.position, 0.4), well: at(world.well.spot.position, 0.6), tower: at(world.fire.brazier.position, 1),
    ...Object.fromEntries(world.braziers.map((b, i) => [`waymark.${String(i)}`, at(b.spot.position, 0.8)])),
  };
  // The declared quest (shard.config.ts, bound by this runtime): the platform builds its state over the world's flags and
  // emits its fact on completion, and on load for a save that finished it before facts existed.
  const bound = bindRuntimeQuest(ctx, source, 'sunscar.signal', { flags, facts, place: (marker) => placed[marker.id] });
  const quest = bound.state, reward = bound.reward.coins;
  const purse = shardSave(purseSave, slug);
  const scene = ctx.game.runtime?.world?.game.scene ?? new Scene(), burst = new CoinBurst(scene);
  const alreadyPaid = flags.has(PAID_FLAG);
  // The one-call presentation (ENGINE §20): the chip with distance and bearing, minimap and map diamonds, world pins,
  // the MAP card, saved discovery of the places, step toasts, and the held reward beat after the Matriarch falls.
  const pay = (): undefined => {
    if (flags.has(PAID_FLAG)) return undefined;
    flags.set(PAID_FLAG);
    burst.spawn(player, reward, onCoin ?? ((share) => { purse.write(purse.read() + share); }), () => { ctx.game.runtime?.play?.hud.toast(STRINGS.reward); });
    return undefined;
  };
  // Sefa, the caravan scout, starts the quest on the spawn crest (P4; Driftwood's Wendell): she waves until you talk.
  const sefa = scout(groundAt);
  if (sefa !== null) {
    ctx.root.add(sefa.group); ownPrimitives(sefa.group, ctx.scope); lastLightAll(sefa.group, ctx.scope);
    // She is solid: a 0.6 m column you walk round, not through (loop 3); she turns in place, so the box stays square.
    const y = sefa.group.position.y;
    ctx.piece({ id: 'sunscar.scout', name: STRINGS.scoutName, category: 'props', file: 'src/shards/sunscar-dunes/quest/scout.ts', object: sefa.group,
      colliders: [boxDesc({ x: SCOUT_AT.x, z: SCOUT_AT.z, hw: 0.3, hd: 0.3, rot: 0, yBottom: y - 0.3, yTop: y + 1.7 }, 'flesh')], surface: 'flesh' });
    ctx.system({ id: 'sunscar.scout', phase: 'update', run: (dt, t) => { sefa.update(dt, t, player, flags.has(SCOUT_FLAG)); } });
  }
  const live = ctx.game.runtime?.world && ctx.game.runtime.play ? ctx.game.runtime : null;
  const presentation: QuestPresentationOptions = { places: [...PLACES], introTitle: STRINGS.quest,
    ...(sefa === null ? {} : { npc: { npc: scoutNpc(COMPLETE_FLAG), at: sefa.head, label: STRINGS.talkScout, speaker: sefa.speaker, radius: 3.5 } }),
    reward: { kicker: STRINGS.rewardKicker, title: STRINGS.quest, subtitle: STRINGS.rewardSubtitle, when: () => !alreadyPaid && quest.isComplete, finish: pay } };
  const entered = live !== null && retainsRuntimeServices(ctx) ? installEnteredQuestPresentation(ctx, quest, presentation) : null;
  const view = live === null || entered !== null ? null : installQuestPresentation(ctx, quest, presentation);
  // Headless (no play host: tests, a node bake) the reward pays at once on completion.
  ctx.scope.onDispose(quest.observe({ complete: () => { if (live === null) pay(); } }));
  // On the first frame the goal is on screen: the chip, and a toast that names the quest.
  if (!quest.isComplete) ctx.game.runtime?.play?.hud.toast(`${STRINGS.newQuest} · ${STRINGS.quest}`);
  ctx.system({ id: 'sunscar.reward', phase: 'update', run: (dt) => { burst.update(dt, player); } });
  ctx.scope.onDispose(() => { burst.update(3, player); burst.dispose(); });
  return { quest, burst, facts, get view() { return entered === null ? view : entered(); } };
}
