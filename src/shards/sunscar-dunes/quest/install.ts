import type { QuestState } from '@wildshard/engine/quest/core';
import type { QuestPresentation } from '@wildshard/game/quest/presentation';
import { installDeclaredQuestNpc, installRewardedQuest } from '@wildshard/game/plugin/ui';
import type { ShardContext } from '@wildshard/game/shard/context';
import * as v from 'valibot';
import type { Vector3 } from 'three';
import type { SignalWorld } from '../world/build';
import { DISCOVERY_PLACES } from '../data/questPresentation';
import { STRINGS } from '../data/strings';
import { lastLightAll } from '../look/light';
import { duneMesh } from '../world/meshes';
import { FLAG } from '../data/flags';
import { PAID_FLAG } from '../data/signalQuest';
import { bindRuntimeCoins, type RuntimeCoins, type RuntimeFacts } from '@wildshard/game/shardfile/hybridRows';
import source from '../runtime/source';
import { bindSignalFacts } from '../runtime/persistence';
import { QUEST_MARKERS } from '../data/questMarkers';
import { QUEST_REPAIR, QUEST_REPAIR_INITIAL } from '../data/questRepair';
import { bindDirectorActions } from '@wildshard/game/plugin/director';


/** The old reward record (SHARDS §10): read once to carry a current save over to PAID_FLAG (C26), never written again. */
export const LEGACY_SIGNAL = { key: 'sunscar.signal', scope: 'shard' as const, version: 1, schema: v.boolean(), initial: (): boolean => false };
export const LIT_FLAG = FLAG.lit;




/**
 * "The signal" (C4, staged like Driftwood's in P4): Sefa the caravan scout waves from the spawn crest and her talk is
 * the first step (loop 2); the quest's chip names her from the first frame, every step has a
 * marker (the HUD chip with distance and bearing, a diamond on the minimap and the map, a pin in the world), the map
 * tab carries the quest card, the places toast as they are found, and the Matriarch is the last step: the 5-coin
 * signal reward pays after her fall.
 */
export function installQuest(ctx: ShardContext, player: Vector3, world: SignalWorld, coins: RuntimeCoins = bindRuntimeCoins(ctx, null)): { quest: QuestState; burst: ReturnType<typeof installRewardedQuest>['reward']['burst']; view: QuestPresentation | null; facts: RuntimeFacts } {
  const { flags } = world, saves = ctx.app.saves, legacy = saves.define(LEGACY_SIGNAL);
  // SF14 / M3: Signal Dunes' feats are its shardfile's ledger rows (runtime.binds); the platform grants each achievement once.
  // The instance is the first-party placement id (the slug: Select a shard, explore and the grid share it).
  const slug = ctx.manifest.slug, runtime = ctx.game.runtime, facts = bindSignalFacts(ctx, runtime?.play?.progress, slug);
  // Startup-only migration: flags hold the result, so no director cursor enters snapshots.
  const legacyPaid = !flags.has(PAID_FLAG) && legacy.read(slug);
  const repair = bindDirectorActions(QUEST_REPAIR, { flags, bindings: [], initial: [QUEST_REPAIR_INITIAL],
    observe: binding => {
      if (binding !== 'event:legacy.sunscar.signal') throw new Error('Unknown quest repair observation');
      return legacyPaid;
    } });
  repair.advance(); repair.advance(); repair.advance();
  // The declared quest (shard.config.ts) with its 5-coin signal reward, once per save (PAID_FLAG), held for the beat after
  // the Matriarch falls; Sefa, the caravan scout, starts it on the spawn crest (P4; Driftwood's Wendell): she waves until you talk.
  const { quest, reward, view } = installRewardedQuest(ctx, source, { id: 'sunscar.signal', rewardId: 'sunscar.reward', strings: STRINGS, flags, facts,
    place: (marker) => QUEST_MARKERS[marker.id], player, coins, paid: () => flags.has(PAID_FLAG), markPaid: () => { flags.set(PAID_FLAG); },
    presentation: { places: [...DISCOVERY_PLACES] }, npc: () => installDeclaredQuestNpc(ctx, source, 'sunscar.scout', { player, flags,
      model: id => { if (id !== 'caravan-scout') throw new Error('Unknown quest scout model'); const geometry = duneMesh(id); return geometry === null ? null : { geometry }; },
      dress: group => { ctx.scope.ownPrimitives(group); lastLightAll(group, ctx.scope); },
    }) });
  return { quest, burst: reward.burst, facts, get view() { return view(); } };
}
