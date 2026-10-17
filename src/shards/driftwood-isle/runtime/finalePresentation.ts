import { driftwoodRows } from './boot/rows';
/**
 * The finale (A6 + D3/D5): the Drowned Captain and the golden-hour reward view.
 *
 *   - Setting the three shards in the altar (`used:altar`) wakes Captain Brine (src/shards/driftwood-isle/species/captain.ts) in the
 *     shrine's spring pool (the model's `shrine.anchors.pool`); a reload mid-fight puts him back under the pool, and he
 *     rises again when you come near. The shared boss bar shows his health and phase while you are in the
 *     arena. His death (`dead:captain`, Spine.ts's kill hook) opens the last step.
 *   - The reward: walk up to the ring. The view eases to the spot where the stone ring frames the ringed planet (found
 *     in the authored quest-spots row), the day/night clock (sky.dayNight, D3) eases to golden hour and
 *     holds there, the caption fades in; seven seconds later `seen:reward` completes the quest and the clock runs on.
 */
import * as THREE from 'three';
import { app as clientApp } from '@wildshard/engine/app/runtime';
import { BossBar } from '@wildshard/engine/ui/BossBar';
import { QuestRewardBeat } from '@wildshard/game/quest/reward';
import type { Adventure, AdventureWorld, AdvAnimal } from '../quest/adventure';
import { DrownedCaptain } from '../combat/captain';
import type { LevelContext } from '@wildshard/engine/level/context';
import { DirectorScriptStageLane, readDirectorProduct } from '@wildshard/game/plugin/director';
import type { ShardProduct } from '@wildshard/game/shardfile/shardProduct';

/** The existing view services; native finale timing and fight authority remain separate. */
export type FinaleHost = Pick<typeof clientApp, 'events' | 'encounters' | 'levelScope' | 'engineScope' | 'clock'>;

export interface Finale { captain: () => AdvAnimal | null; rewardAt: THREE.Vector3; rewardPose: { yaw: number; pitch: number; phase: number } }

/** The finale reads only these quest, combat and presentation ports; a replay drives the shipping installer. */
export type FinaleAdventure = Pick<Adventure, 'flags' | 'place' | 'floorAt' | 'setAnchor' | 'spine' | 'complete'>;
/** Trusted view/combat recipes can be exercised without constructing a renderer or the rest of the island. */
export interface FinaleWorld<A extends AdvAnimal> {
  game: Pick<AdventureWorld<A>['game'], 'onUpdate'>;
  sky: { planetDir: THREE.Vector3; dayNight: { phase: number } | null };
  player: Pick<AdventureWorld<A>['player'], 'position' | 'velocity' | 'yaw' | 'pitch' | 'carried'>;
  animals: Pick<AdventureWorld<A>['animals'], 'spawn'>;
  hud: Pick<AdventureWorld<A>['hud'], 'toast'>;
  music: AdventureWorld<A>['music'];
  scope?: AdventureWorld<A>['scope'];
  /** The declared boss body bound by the trusted runtime; replay oracles retain the legacy spawn port. */
  spawnCaptain?: () => AdvAnimal | null;
  setViewmodel?: AdventureWorld<A>['setViewmodel'];
}
function finaleRecipe<A extends AdvAnimal>(adv: FinaleAdventure, w: FinaleWorld<A>, app: FinaleHost) {
  const { flags, place } = adv;
  const pool = place({ poi: 'shrine', anchor: 'shrine.pool', x: 0, z: 8 });
  const bar = new BossBar();
  let captain: AdvAnimal | null = null;

  // The page and native reward controller share the author-only placement row.
  const target = driftwoodRows('custom/fixedLayouts').nativeView.FINALE_REWARD, rewardAt = new THREE.Vector3(target.x, target.y, target.z);

  adv.setAnchor('shrine.reward', { x: rewardAt.x, y: rewardAt.y, z: rewardAt.z });   // the quest's last marker

  const spawn = (): void => {
    if (captain || (w.spawnCaptain === undefined && !w.animals.spawn)) return;
    try {
      captain = w.spawnCaptain === undefined ? w.animals.spawn?.('captain', pool.x, pool.z, pool.yaw + Math.PI, 'captain') ?? null : w.spawnCaptain();
      if (captain === null) throw new Error('Captain spawn host unavailable');
    }
    catch (e) { console.error('[finale] the captain failed to spawn', e); flags.set('dead:captain'); return; }   // never strand the quest
    captain.herd = -1;
    captain.mem['poolX'] = pool.x; captain.mem['poolZ'] = pool.z; captain.mem['arena'] = driftwoodRows('custom/fixedLayouts').nativeView.CAPTAIN_ARENA_R;
  };
  const encounter = new DrownedCaptain({ player: w.player, pool, events: app.events, flags, animal: () => captain, ui: bar });
  const scope = app.levelScope;
  if (scope !== null) {
    app.encounters.register({ id: driftwoodRows('custom/fixedLayouts').nativeView.CAPTAIN_ID, displayName: driftwoodRows('custom/fixedLayouts').nativeView.CAPTAIN_NAME }, scope);
    app.encounters.boss(driftwoodRows('custom/fixedLayouts').nativeView.CAPTAIN_ID, encounter, scope);
    app.events.on('player.died', () => { encounter.onPlayerDeath(); }, scope);
    scope.onDispose(() => { bar.root.remove(); });
  }
  // ── per frame: wake on approach, the boss bar, the reward view ──
  const state = { started: false, completed: false };
  const rewardPose = { yaw: target.yaw, pitch: target.pitch, phase: target.phase };
  const reward = new QuestRewardBeat({ scope: w.scope ?? app.levelScope ?? app.engineScope, player: w.player,
    dayNight: w.sky.dayNight, ...(adv.spine === null ? {} : { objective: adv.spine.objective.root }),
    ...(w.setViewmodel === undefined ? {} : { setViewmodel: w.setViewmodel }), sting: () => { w.music.sting('chunk'); } }, {
    kicker: 'The Sealed Ring · opened', title: 'Driftwood Isle', subtitle: 'The planet in the ring, at golden hour',
    at: rewardAt, ...rewardPose,
    when: () => state.started,
    finish: () => adv.complete?.showAfterReward() === true,
  });
  w.game.onUpdate((dt) => {
    encounter.update(dt, app.clock.now);
  }, 'shard.driftwood-isle.installFinale');
  return { captain: () => captain, rewardAt, rewardPose,
    director: { flags, player: w.player.position, rewardAt, reward: state, captain: { restore: spawn,
      wake: () => {
        spawn(); encounter.wake();
        w.hud.toast('The pool boils — the Drowned Captain rises!'); w.music.combat?.(1);
      },
      dead: () => { w.hud.toast('Captain Brine sinks for good. The ring hums — go and stand in it'); w.music.sting('chunk'); },
    } },
    step: (dt: number) => { reward.update(dt, state.completed); },
  };
}

/** SF24 decisions/timers are data + bounded script; captain combat and reward camera/renderer remain runtime recipes (G51). */
export async function installDirectorFinale<A extends AdvAnimal>(adv: FinaleAdventure, w: FinaleWorld<A>, context: Pick<LevelContext, 'scope' | 'system'> & { readonly product: ShardProduct }, host?: FinaleHost): Promise<Finale> {
  const scope = context.scope, app = host ?? { events: clientApp.events, encounters: clientApp.encounters, levelScope: scope,
    engineScope: clientApp.engineScope, clock: clientApp.clock };
  const recipe = scope.run(() => finaleRecipe(adv, w, app));
  const director = await readDirectorProduct(context.product, scope);
  const clock = scope.run(() => DirectorScriptStageLane.bind(director.stages, director.create(), director.bindings,
    new Map<string, unknown>(Object.entries(recipe.director)), scope));
  // G51: the page's existing rendered clock owns the reward view. Decisions use the same elapsed dt,
  // while the trusted headless keeper uses its normal fixed clock; neither installs a second scheduler.
  w.game.onUpdate(dt => { clock.update(dt); recipe.step(dt); }, 'shard.driftwood.director');
  return recipe;
}
