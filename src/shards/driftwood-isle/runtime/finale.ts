/**
 * The finale (A6 + D3/D5): the Drowned Captain and the golden-hour reward view.
 *
 *   - Setting the three shards in the altar (`used:altar`) wakes Captain Brine (src/shards/driftwood-isle/species/captain.ts) in the
 *     shrine's spring pool (the model's `shrine.anchors.pool`); a reload mid-fight puts him back under the pool, and he
 *     rises again when you come near. The shared boss bar shows his health and phase while you are in the
 *     arena. His death (`dead:captain`, Spine.ts's kill hook) opens the last step.
 *   - The reward: walk up to the ring. The view eases to the spot where the stone ring frames the ringed planet (found
 *     from `shrine.anchors.ring` and `sky.planetDir`), the day/night clock (sky.dayNight, D3) eases to golden hour and
 *     holds there, the caption fades in; seven seconds later `seen:reward` completes the quest and the clock runs on.
 */
import * as THREE from 'three';
import type { FinaleHost } from '../quest/Finale';
import { BossBar } from '@wildshard/engine/ui/BossBar';
import { QuestRewardBeat } from '@wildshard/game/quest/reward';
import type { Adventure, AdventureWorld, AdvAnimal } from '../quest/adventure';
import { DrownedCaptain, CAPTAIN_DEF } from '../combat/captain';
import { directorVariant, installDeclaredDirector } from '@wildshard/game/shardfile/directorClient';
import { director } from '@wildshard/sdk/director';
import declaration from '../data/director.json' with { type: 'json' };

const GOLDEN = 0.745;          // DayNight phase of the golden-hour key (its KEYS table: GOLDEN at 0.74)
const ARENA = 22;

export interface Finale { captain: () => AdvAnimal | null; rewardAt: THREE.Vector3 }

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
interface FinaleRecipe extends Finale {
  observe: () => Readonly<Record<string, number>>;
  publish: (key: string) => void;
  step: () => void;
}
function finaleRecipe<A extends AdvAnimal>(adv: FinaleAdventure, w: FinaleWorld<A>, directed: boolean, app: FinaleHost): FinaleRecipe {
  const { flags, place } = adv;
  const pool = place({ poi: 'shrine', anchor: 'shrine.pool', x: 0, z: 8 });
  const ringP = place({ poi: 'shrine', anchor: 'shrine.ring', x: 0, z: 0, dy: 3.8 });
  const bar = new BossBar();
  let captain: AdvAnimal | null = null;

  // ── the reward spot: back along the planet's direction from the ring's centre until the eye is at standing height ──
  const planet = w.sky.planetDir.clone();
  const flatLen = Math.max(0.2, Math.hypot(planet.x, planet.z));
  const rewardAt = new THREE.Vector3(ringP.x, ringP.y, ringP.z);
  {
    let best = Infinity;
    for (let d = 3; d <= 30; d += 0.25) {
      const x = ringP.x - (planet.x / flatLen) * d, z = ringP.z - (planet.z / flatLen) * d;
      const eye = adv.floorAt(x, z) + 1.68;
      const want = ringP.y - (planet.y / flatLen) * d;   // the ray from the eye through the ring's centre climbs at the planet's slope
      const err = Math.abs(eye - want);
      if (err < best) { best = err; rewardAt.set(x, adv.floorAt(x, z), z); }
    }
  }

  adv.setAnchor('shrine.reward', { x: rewardAt.x, y: rewardAt.y, z: rewardAt.z });   // the quest's last marker

  const spawn = (): void => {
    if (captain || (w.spawnCaptain === undefined && !w.animals.spawn)) return;
    try {
      captain = w.spawnCaptain === undefined ? w.animals.spawn?.('captain', pool.x, pool.z, pool.yaw + Math.PI, 'captain') ?? null : w.spawnCaptain();
      if (captain === null) throw new Error('Captain spawn host unavailable');
    }
    catch (e) { console.error('[finale] the captain failed to spawn', e); flags.set('dead:captain'); return; }   // never strand the quest
    captain.herd = -1;
    captain.mem['poolX'] = pool.x; captain.mem['poolZ'] = pool.z; captain.mem['arena'] = ARENA;
  };
  const encounter = new DrownedCaptain({ player: w.player, pool, events: app.events, flags, animal: () => captain, ui: bar });
  const scope = app.levelScope;
  if (scope !== null) {
    app.encounters.register({ id: CAPTAIN_DEF.id, displayName: 'The Drowned Captain' }, scope);
    app.encounters.boss(CAPTAIN_DEF.id, encounter, scope);
    app.events.on('player.died', () => { encounter.onPlayerDeath(); }, scope);
    scope.onDispose(() => { bar.root.remove(); });
  }
  const awake = (): void => { encounter.wake(); };

  const changed = (f: string, on: boolean): void => {
    if (!on) return;
    if (f === 'used:altar') {
      spawn(); awake();
      w.hud.toast('The pool boils — the Drowned Captain rises!');
      w.music.combat?.(1);
    }
    if (f === 'dead:captain') { w.hud.toast('Captain Brine sinks for good. The ring hums — go and stand in it'); w.music.sting('chunk'); }
  };
  if (!directed) {
    flags.onChange(changed);
    if (flags.has('used:altar') && !flags.has('dead:captain')) spawn(); // a reload mid-fight: he waits under the pool
  }

  // ── per frame: wake on approach, the boss bar, the reward view ──
  let started = false, completed = false;
  const reward = new QuestRewardBeat({ scope: w.scope ?? app.levelScope ?? app.engineScope, player: w.player,
    dayNight: w.sky.dayNight, ...(adv.spine === null ? {} : { objective: adv.spine.objective.root }),
    ...(w.setViewmodel === undefined ? {} : { setViewmodel: w.setViewmodel }), sting: () => { w.music.sting('chunk'); } }, {
    kicker: 'The Sealed Ring · opened', title: 'Driftwood Isle', subtitle: 'The planet in the ring, at golden hour',
    at: rewardAt, yaw: Math.atan2(-planet.x, -planet.z), pitch: Math.asin(THREE.MathUtils.clamp(planet.y, -1, 1)), phase: GOLDEN,
    when: () => directed ? started : flags.has('dead:captain') && !flags.has('seen:reward') && Math.hypot(w.player.position.x - rewardAt.x, w.player.position.z - rewardAt.z) < 7,
    finish: () => { if (!directed) flags.set('seen:reward'); return adv.complete?.showAfterReward() === true; },
  });
  w.game.onUpdate((dt) => {
    encounter.update(dt, app.clock.now);
    if (!directed) reward.update(dt);
  }, 'shard.driftwood-isle.installFinale');
  return { captain: () => captain, rewardAt,
    observe: () => ({ altar: Number(flags.has('used:altar')), dead: Number(flags.has('dead:captain')), seen: Number(flags.has('seen:reward')),
      'player-x': w.player.position.x, 'player-z': w.player.position.z, 'reward-x': rewardAt.x, 'reward-z': rewardAt.z }),
    publish: (key) => {
      if (key === 'captain.restore') spawn();
      else if (key === 'captain.wake') changed('used:altar', true);
      else if (key === 'captain.dead') changed('dead:captain', true);
      else if (key === 'reward.start') started = true;
      else if (key === 'reward.finish') { completed = true; flags.set('seen:reward'); }
      else throw new Error('Unknown finale director event');
    },
    step: () => { reward.update(1 / 60, completed); },
  };
}

/** The unchanged shipping decisions remain the default-off path and real replay oracle until SF46 selects the director. */
export function installLegacyFinale<A extends AdvAnimal>(adv: FinaleAdventure, w: FinaleWorld<A>, app: FinaleHost): Finale {
  return finaleRecipe(adv, w, false, app);
}
/** SF24 decisions/timers are data + bounded script; captain combat and reward camera/renderer remain runtime recipes (G51). */
export async function installDirectorFinale<A extends AdvAnimal>(adv: FinaleAdventure, w: FinaleWorld<A>, context: Parameters<typeof installDeclaredDirector>[0] & Parameters<typeof directorVariant>[0], app: FinaleHost): Promise<Finale> {
  const on = directorVariant(context);
  const recipe = finaleRecipe(adv, w, on, app);
  if (on) await installDeclaredDirector(context, { data: director(declaration), seed: 357, systemId: 'shard.driftwood.director',
    bytes: async () => {
      const response = await fetch(new URL('../assets/707eda3596f617c57a578c1ab938bfebaeefcb70a859e22ebf36f92fba1cf868', import.meta.url));
      if (!response.ok) throw new Error('Missing finale director module');
      return new Uint8Array(await response.arrayBuffer());
    },
    observe: recipe.observe, publish: (event) => { recipe.publish(event.key); }, afterStep: recipe.step,
  });
  return recipe;
}
