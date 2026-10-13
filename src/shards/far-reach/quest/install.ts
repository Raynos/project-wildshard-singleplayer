import type { QuestState } from '@wildshard/engine/quest/core';
import { Flags } from '@wildshard/engine/world/interact/flags';
import { installDeclaredQuestNpc, installRewardedQuest } from '@wildshard/game/plugin/ui';
import { bindSkyQuestStage } from '../runtime/quest';
import type { QuestPresentation } from '@wildshard/game/quest/presentation';
import { bindRuntimeCoins } from '@wildshard/game/shardfile/hybridRows';
import type { ShardContext } from '@wildshard/game/shard/context';
import { Vector3 } from 'three';
import { CROWN, HIGH, STEP, VANES } from '../data/layout';
import { STRINGS } from '../data/strings';
import { ownPrimitives } from '../world/resources';
import { FLAGS, vaneFlag } from './flags';
import { skyHd } from '../world/meshes';
import { skyMappedLook } from '../world/looks';
import { SKY_PLACES } from '../data/places';
import source from '../shard.config';
import { bindSkyPersistence, type SkyPersistence } from '../runtime/persistence';

export const REWARD = 10;
/** The reward view: from the high step, the raised bridge running out to the storm crown (Driftwood's held beat). */
export const REWARD_VIEW = { at: new Vector3(STEP.x + 2, HIGH + 1.7, STEP.z - 4), yaw: Math.atan2(-(CROWN.x - STEP.x - 2), -(CROWN.z - STEP.z + 4)), pitch: 0.12 } as const;



/**
 * The crown bridge, staged like Driftwood's (review items 3, 4, 14; ENGINE §20 `installQuestPresentation`): the
 * bridge-keeper waves at Sunrest from the first frame and names the goal; every step has a marker (the chip with metres
 * and bearing, minimap and map diamonds, a styled world pin), a chip and a hint; the MAP card carries the quest; each step
 * toasts; raising the bridge holds the camera on the bridge and the crown beyond, then pays ten coins once per save.
 *   1. talk to the keeper (his notes are his dialogue; the lectern on his isle still reads them)
 *   2. clear the roost of drift rays · 3. turn the three wind vanes with GUST · 4. raise the bridge at the winch
 */
export function installQuest(ctx: ShardContext, player: Vector3, onCoin?: (share: number) => void):
  { quest: QuestState; flags: Flags; burst: (count: number, toast: string) => void; view: QuestPresentation | null; finished: () => void; persistence: SkyPersistence } {
  const flags = new Flags(ctx.manifest.slug), persistence = bindSkyPersistence(ctx, ctx.app.saves), { rewarded, facts } = persistence;
  // The keeper at the spawn waves within 16 m and gestures while he talks; headless (tests, a node bake) the reward pays at once.
  const { quest, reward, view } = installRewardedQuest(ctx, source, { id: 'far.quest', rewardId: 'far.reward', strings: STRINGS, flags, facts, player,
    coins: onCoin ?? bindRuntimeCoins(ctx, null), paid: () => rewarded.read(), markPaid: () => { rewarded.write(true); }, unpaid: () => !rewarded.read(),
    presentation: { flags, places: [...SKY_PLACES] }, beat: { ...REWARD_VIEW, holdSeconds: 5 }, npc: () => installDeclaredQuestNpc(ctx, source, 'far.keeper', { player, flags,
      model: id => {
        if (id !== 'keeper-hd') throw new Error('Unknown quest keeper model');
        const made = skyHd(id);
        if (made === null) return null;
        made.geometry.dispose();
        if (made.pivots === undefined) throw new Error('Missing authored keeper pivots');
        return { geometry: made.pivots, material: skyMappedLook('keeper-scarf', made.map) };
      },
      dress: group => { ownPrimitives(group, ctx.scope); },
    }) });
  const vanes = bindSkyQuestStage('vanes', flags);
  ctx.system({ id: 'far.vanes', phase: 'update', run: vanes.advance });
  /**
   * The quest as a player has it by the time they stand in the arena (E399 capture staging, the council's should-fix: the
   * tracker read TALK TO THE KEEPER at the crown): the notes read, the roost cleared, the vanes turned, the bridge raised,
   * and its reward already paid (so no reward beat plays now).
   */
  const finished = (): void => {
    rewarded.write(true);
    for (const vane of VANES) flags.set(vaneFlag(vane.id));
    for (const flag of [FLAGS.notes, FLAGS.roost, FLAGS.vanes, FLAGS.raised]) flags.set(flag);
  };
  return { quest, flags, burst: reward.spawn, get view() { return view(); }, finished, persistence };
}
