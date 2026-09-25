/**
 * The finale (A6 + D3/D5): the Drowned Captain and the golden-hour reward view.
 *
 *   - Setting the three shards in the altar (`used:altar`) wakes Captain Brine (src/entities/species/captain.ts) in the
 *     shrine's spring pool (the model's `shrine.anchors.pool`); a reload mid-fight puts him back under the pool, and he
 *     rises again when you come near. A boss bar (QuestUI.BossBar) shows his health and phase while you are in the
 *     arena. His death (`dead:captain`, Spine.ts's kill hook) opens the last step.
 *   - The reward: walk up to the ring. The view eases to the spot where the stone ring frames the ringed planet (found
 *     from `shrine.anchors.ring` and `sky.planetDir`), the day/night clock (sky.dayNight, D3) eases to golden hour and
 *     holds there, the caption fades in; seven seconds later `seen:reward` completes the quest and the clock runs on.
 */
import * as THREE from 'three';
import { BossBar, RewardCaption } from './QuestUI';
import type { Adventure, AdventureWorld, AdvAnimal } from './Adventure';
import { preloadCaptainMesh } from '../../entities/species/captainMesh';

const GOLDEN = 0.745;          // DayNight phase of the golden-hour key (its KEYS table: GOLDEN at 0.74)
const HOLD_S = 7;              // seconds the reward view holds before the quest completes
const ARENA = 22;

export interface Finale { captain: () => AdvAnimal | null; rewardAt: THREE.Vector3 }

export function installFinale<A extends AdvAnimal>(adv: Adventure, w: AdventureWorld<A>): Finale {
  const { flags, place } = adv;
  void preloadCaptainMesh(); // the generated captain (v0.2): loads in the background, long before the altar raises him
  const pool = place({ poi: 'shrine', anchor: 'shrine.pool', x: 0, z: 8 });
  const ringP = place({ poi: 'shrine', anchor: 'shrine.ring', x: 0, z: 0, dy: 3.8 });
  const bar = new BossBar();
  const caption = new RewardCaption('The Sealed Ring · opened', 'Driftwood Isle', 'The planet in the ring, at golden hour');
  let captain: A | null = null;

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
    if (captain || !w.animals.spawn) return;
    try { captain = w.animals.spawn('captain', pool.x, pool.z, pool.yaw + Math.PI, 'captain'); }
    catch (e) { console.error('[finale] the captain failed to spawn', e); flags.set('dead:captain'); return; }   // never strand the quest
    captain.herd = -1;
    captain.mem['poolX'] = pool.x; captain.mem['poolZ'] = pool.z; captain.mem['arena'] = ARENA;
  };
  const awake = (): void => { if (captain) captain.mem['awake'] = 1; };

  flags.onChange((f, on) => {
    if (!on) return;
    if (f === 'used:altar') {
      spawn(); awake();
      w.hud.toast('The pool boils — the Drowned Captain rises!');
      w.music.combat?.(1);
    }
    if (f === 'dead:captain') { w.hud.toast('Captain Brine sinks for good. The ring hums — go and stand in it'); w.music.sting('chunk'); }
  });
  if (flags.has('used:altar') && !flags.has('dead:captain')) spawn();   // a reload mid-fight: he waits under the pool

  // ── per frame: wake on approach, the boss bar, the reward view ──
  const from = new THREE.Vector3();
  let reward = -1, fromYaw = 0, fromPitch = 0, fromPhase = 0;
  const wantYaw = Math.atan2(-planet.x, -planet.z);   // forward = (−sin yaw, −cos yaw): face the planet
  const wantPitch = Math.asin(THREE.MathUtils.clamp(planet.y, -1, 1));
  w.game.onUpdate((dt) => {
    const pp = w.player.position;
    const nearPool = Math.hypot(pp.x - pool.x, pp.z - pool.z) < ARENA;
    if (captain && !flags.has('dead:captain')) {
      if (nearPool && flags.has('used:altar')) awake();
      const up = captain.alive && (captain.mem['rise'] ?? 0) > 0.5;
      bar.set(nearPool && up, captain.hp / Math.max(1, captain.maxHp), captain.mem['phase'] ?? 1);
    } else bar.set(false, 0, 1);

    // the reward
    if (reward < 0 && flags.has('dead:captain') && !flags.has('seen:reward') && Math.hypot(pp.x - rewardAt.x, pp.z - rewardAt.z) < 7) {
      reward = 0; w.player.carried = true; from.copy(pp); fromYaw = w.player.yaw; fromPitch = w.player.pitch; fromPhase = w.sky.dayNight?.phase ?? 0;
      caption.show(true);
      w.setViewmodel?.(false);                                   // nothing between you and the view
      adv.spine?.objective.root.classList.add('ws-quest-hide');   // the caption has the screen
      w.music.sting('chunk');
    }
    if (reward >= 0) {
      reward += dt;
      const k = THREE.MathUtils.smoothstep(reward, 0, 2.5);
      w.player.position.lerpVectors(from, rewardAt, k); w.player.velocity.set(0, 0, 0);
      w.player.yaw = fromYaw + wrap(wantYaw - fromYaw) * k;
      w.player.pitch = fromPitch + (wantPitch - fromPitch) * k;
      const dn = w.sky.dayNight;
      if (dn) { const ahead = ((GOLDEN - fromPhase) % 1 + 1) % 1; dn.phase = (fromPhase + ahead * THREE.MathUtils.smoothstep(reward, 0, 3.5)) % 1; }
      if (reward > HOLD_S) {
        reward = -2; caption.show(false); flags.set('seen:reward');   // the quest completes: its toasts play under the card
        // E132: the first time, the "Driftwood complete" card takes over while we still own the camera (Complete.ts)
        if (adv.complete?.showAfterReward() !== true) {
          w.player.carried = false;
          w.setViewmodel?.(true); adv.spine?.objective.root.classList.remove('ws-quest-hide');
        }
      }
    }
  });
  return { captain: () => captain, rewardAt };
}

function wrap(a: number): number { return Math.atan2(Math.sin(a), Math.cos(a)); }
