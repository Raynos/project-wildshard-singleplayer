import type { QuestMarker, QuestState } from '@wildshard/engine/quest/core';
import type { CoinBurst } from '@wildshard/game/loot/CoinBurst';
import type { QuestPresentation } from '@wildshard/game/quest/presentation';
import { installRewardedQuest } from '@wildshard/game/plugin/ui';
import type { ShardContext } from '@wildshard/game/shard/context';
import * as v from 'valibot';
import type { Vector3 } from 'three';
import type { SignalWorld } from '../world/build';
import groundQueries from '../data/manifestGround.generated.json' with { type: 'json' };
import { DISCOVERY_PLACES } from '../data/questPresentation';
import { STRINGS } from '../data/strings';
import { lastLightAll } from '../look/light';
import { ownPrimitives } from '../world/resources';
import { installPivotNpc } from '@wildshard/game/plugin/geometry';
import { SCOUT_MODEL, SCOUT_NPC } from '../quests/scout';
import { duneMesh } from '../world/meshes';
import { FLAG, SCOUT_AT, SCOUT_FLAG } from '../data/flags';
import { COMPLETE_FLAG, LATER_FLAGS, PAID_FLAG } from '../data/signalQuest';
import { bindRuntimeCoins, type RuntimeCoins, type RuntimeFacts } from '@wildshard/game/shardfile/hybridRows';
import source from '../shard.config';
import { bindSignalFacts } from '../runtime/persistence';


/** The old reward record (SHARDS §10): read once to carry a current save over to PAID_FLAG (C26), never written again. */
export const LEGACY_SIGNAL = { key: 'sunscar.signal', scope: 'shard' as const, version: 1, schema: v.boolean(), initial: (): boolean => false };
export const LIT_FLAG = FLAG.lit;


const at = (p: Vector3, dy = 0): QuestMarker['at'] => ({ poi: 'world', x: p.x, y: p.y + dy, z: p.z });

/**
 * "The signal" (C4, staged like Driftwood's in P4): Sefa the caravan scout waves from the spawn crest and her talk is
 * the first step (loop 2); the quest's chip names her from the first frame, every step has a
 * marker (the HUD chip with distance and bearing, a diamond on the minimap and the map, a pin in the world), the map
 * tab carries the quest card, the places toast as they are found, and the Matriarch is the last step: the 5-coin
 * signal reward pays after her fall.
 */
export function installQuest(ctx: ShardContext, player: Vector3, world: SignalWorld, coins: RuntimeCoins = bindRuntimeCoins(ctx, null)): { quest: QuestState; burst: CoinBurst; view: QuestPresentation | null; facts: RuntimeFacts } {
  const { flags } = world, saves = ctx.app.saves, legacy = saves.define(LEGACY_SIGNAL);
  // SF14 / M3: Signal Dunes' feats are its shardfile's ledger rows (runtime.binds); the platform grants each achievement once.
  // The instance is the first-party placement id (the slug: Select a shard, explore and the grid share it).
  const slug = ctx.manifest.slug, runtime = ctx.game.runtime, facts = bindSignalFacts(ctx, runtime?.play?.progress, slug);
  const groundAt = (x: number, z: number): number => {
    if (x !== SCOUT_AT.x || z !== SCOUT_AT.z) throw new Error('Undeclared authored scout ground query');
    return groundQueries.heights.scout;
  };
  // C26: a current save that recorded the paid reward in the old shard save carries it over as the quest flag.
  if (!flags.has(PAID_FLAG) && legacy.read(slug)) flags.set(PAID_FLAG);
  // A save from before Sefa (loop 2) or a player who walked past her to the caravan: any later step done means the
  // scout's step is too, so a mid-quest save is never sent back to the crest; on load her flag is set for it (no wave).
  if (!flags.has(SCOUT_FLAG) && [...LATER_FLAGS, COMPLETE_FLAG].some((f) => flags.has(f))) flags.set(SCOUT_FLAG);
  // The declared quest (data/signalQuest.ts), each world-piece marker placed on its built piece.
  const placed: Record<string, QuestMarker['at']> = {
    scout: { poi: 'world', x: SCOUT_AT.x, y: groundAt(SCOUT_AT.x, SCOUT_AT.z), z: SCOUT_AT.z }, // her feet: the pin adds its own 2.2 m (round 1, R1C-7)
    logbook: at(world.logbook.position, 0.4), well: at(world.well.spot.position, 0.6), tower: at(world.fire.brazier.position, 1),
    ...Object.fromEntries(world.braziers.map((b, i) => [`waymark.${String(i)}`, at(b.spot.position, 0.8)])),
  };
  // The declared quest (shard.config.ts) with its 5-coin signal reward, once per save (PAID_FLAG), held for the beat after
  // the Matriarch falls; Sefa, the caravan scout, starts it on the spawn crest (P4; Driftwood's Wendell): she waves until you talk.
  const { quest, reward, view } = installRewardedQuest(ctx, source, { id: 'sunscar.signal', rewardId: 'sunscar.reward', strings: STRINGS, flags, facts,
    place: (marker) => placed[marker.id], player, coins, paid: () => flags.has(PAID_FLAG), markPaid: () => { flags.set(PAID_FLAG); },
    presentation: { places: [...DISCOVERY_PLACES] }, npc: () => {
      const figure = duneMesh(SCOUT_MODEL);
      const sefa = figure === null ? null : installPivotNpc(ctx, SCOUT_NPC, { source: figure, groundAt, player, met: () => flags.has(SCOUT_FLAG), file: 'src/shards/sunscar-dunes/quests/scout.ts',
        dress: (group) => { ownPrimitives(group, ctx.scope); lastLightAll(group, ctx.scope); } });
      return sefa === null ? null : { row: SCOUT_NPC, figure: sefa, label: STRINGS.talkScout };
    } });
  return { quest, burst: reward.burst, facts, get view() { return view(); } };
}
