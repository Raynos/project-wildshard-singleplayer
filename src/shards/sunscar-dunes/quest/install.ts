import { QuestState, type QuestMarker } from '#engine';
import { CoinBurst, installQuestPresentation, purseSave, shardSave, type QuestPresentation, type ShardContext } from '#game';
import * as v from 'valibot';
import { Scene, Vector3 } from 'three';
import { FLAG, type SignalWorld } from '../world/build';
import { BASIN, CARAVAN, SPAWN, WELL, TOWER } from '../layout';
import { STRINGS } from '../strings';

/** Whether the signal reward was paid (shard save, SHARDS §10). */
const SIGNAL = { key: 'sunscar.signal', scope: 'shard' as const, version: 1, schema: v.boolean(), initial: () => false };
export const LIT_FLAG = FLAG.lit;
/** Raised when the Dune Matriarch falls (combat/matriarch.ts): the quest's last step. */
export const MATRIARCH_FLAG = 'sunscar.matriarch.down';

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
 * "The signal" (C4, staged like Driftwood's in P4): it starts on the first frame and names its goal, every step has a
 * marker (the HUD chip with distance and bearing, a diamond on the minimap and the map, a pin in the world), the map
 * tab carries the quest card, the places toast as they are found, and the Matriarch is the last step: the 5-coin
 * signal reward pays after her fall.
 */
export function installQuest(ctx: ShardContext, player: Vector3, world: SignalWorld, onCoin?: (share: number) => void): { quest: QuestState; burst: CoinBurst; view: QuestPresentation | null } {
  const { flags } = world, paid = ctx.app.saves.define(SIGNAL);
  const basin = new Vector3(BASIN.x, 2, BASIN.z);
  const quest = new QuestState({ id: 'sunscar.signal', title: STRINGS.quest, completeFlag: 'sunscar.complete', steps: [
    { id: 'logbook', objective: STRINGS.stepLog, chip: STRINGS.chipLog, hint: STRINGS.hintLog, done: { all: [FLAG.logbook] },
      markers: [{ id: 'logbook', label: STRINGS.readLog, short: STRINGS.shortLog, at: at(world.logbook.position, 0.4) }] },
    { id: 'oil', objective: STRINGS.stepOil, chip: STRINGS.chipOil, hint: STRINGS.hintOil, done: { all: [FLAG.oil] },
      markers: [{ id: 'well', label: STRINGS.well, short: STRINGS.shortWell, at: at(world.well.spot.position, 0.6) }] },
    { id: 'waymarks', objective: STRINGS.stepWaymarks, chip: STRINGS.chipWaymarks, hint: STRINGS.hintWaymarks,
      done: { all: world.braziers.map((_, i) => FLAG.brazier(i)) }, count: world.braziers.map((_, i) => FLAG.brazier(i)),
      markers: world.braziers.map((b, i) => ({ id: `waymark.${String(i)}`, label: STRINGS.waymark, short: STRINGS.shortWaymark, at: at(b.spot.position, 0.8), hideWhen: { all: [FLAG.brazier(i)] } })) },
    { id: 'fire', objective: STRINGS.step, chip: STRINGS.chipFire, hint: STRINGS.hintFire, done: { all: [FLAG.lit] },
      markers: [{ id: 'tower', label: STRINGS.tower, short: STRINGS.shortTower, at: at(world.fire.brazier.position, 1) }] },
    { id: 'matriarch', objective: STRINGS.stepBoss, chip: STRINGS.chipBoss, hint: STRINGS.hintBoss, done: { all: [MATRIARCH_FLAG] },
      markers: [{ id: 'basin', label: STRINGS.placeBasin, short: STRINGS.shortBasin, at: at(basin) }] },
  ] }, flags, ctx.app.events, ctx.scope);
  const purse = shardSave(purseSave, ctx.manifest.slug);
  const scene = ctx.game.runtime?.world?.game.scene ?? new Scene(), burst = new CoinBurst(scene);
  const alreadyPaid = paid.read(ctx.manifest.slug);
  // The one-call presentation (ENGINE §20): the chip with distance and bearing, minimap and map diamonds, world pins,
  // the MAP card, saved discovery of the places, step toasts, and the held reward beat after the Matriarch falls.
  const pay = (): undefined => {
    if (paid.read(ctx.manifest.slug)) return undefined;
    paid.write(true, ctx.manifest.slug);
    burst.spawn(player, 5, onCoin ?? ((share) => { purse.write(purse.read() + share); }), () => { ctx.game.runtime?.play?.hud.toast(STRINGS.reward); });
    return undefined;
  };
  const live = ctx.game.runtime?.world && ctx.game.runtime.play ? ctx.game.runtime : null;
  const view = live === null ? null : installQuestPresentation(ctx, quest, { places: [...PLACES], introTitle: STRINGS.quest,
    reward: { kicker: STRINGS.rewardKicker, title: STRINGS.quest, subtitle: STRINGS.rewardSubtitle, when: () => !alreadyPaid && quest.isComplete, finish: pay } });
  // Headless (no play host: tests, a node bake) the reward pays at once.
  if (view === null) ctx.scope.onDispose(quest.observe({ complete: () => { pay(); } }));
  // On the first frame the goal is on screen: the chip, and a toast that names the quest.
  if (!quest.isComplete) ctx.game.runtime?.play?.hud.toast(`${STRINGS.newQuest} · ${STRINGS.quest}`);
  ctx.system({ id: 'sunscar.reward', phase: 'update', run: (dt) => { burst.update(dt, player); } });
  ctx.scope.onDispose(() => { burst.update(3, player); burst.dispose(); });
  return { quest, burst, view };
}
