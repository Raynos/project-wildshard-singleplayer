import { EntityIds } from './ids';
import { app } from '../app/runtime';
import { ParticlePool } from '../fx/ParticlePool';
import { tap } from '../core/harnessTap';
import * as THREE from 'three';
import { canReach } from '../ai/reach';
import { AggressionDirector } from '../ai/director';
import { brainPinned, inspectTick } from '../ai/inspect';
import { TickScheduler, type InterruptReason, type TickRate } from '../app/scheduler';
import { dodgeFx } from '../player/dodge';
import { castRay, floorBelow } from '../physics/query';
import { CreatureBodies } from '../physics/creatures';
import type { CharacterMotor } from '../physics/CharacterMotor';
import { SEED, CHUNK_HALF } from '../core/config';
import { Rng } from '../core/rng';
import { heightAt, normalAt, trailDistance, cabinMask, inChunk, waterLevel, hasPond, POND, streamAt } from '../world/Heightfield';
import type { Forest } from '../world/forest/Forest';
import type { SkyRig as Sky } from '../world/skyRig';
import { creatureSoundDefaults, speciesDef, variantDef, rollVariant, type EnemyWorld, type ThinkCtx } from './species/registry';
import { AnimalFactory, type AnimalKind, type AnimalModel, type AnimalStyle } from './AnimalFactory';
import { Animal, damageFor } from './AnimalView';
import { creatureFloor } from './creatureFloor';
import { killBelowWorld } from './killHeight';
import { attachShadowCaster } from './animalShadow';
import { FarHerd, type FarMember } from './farHerd';
import { activeLevel } from '../level/selection';
import type { CreatureRenderSpec } from '../level/spec';
import type { LevelFrameBinding } from '../level/frame';
import { TIER, TIER_CONFIG } from '../core/tier';
import { worldTime } from '../core/time';
import { frameCost } from '../core/frameCost';
import { practiceRoom } from '../core/practiceRoom';
import { AnimalGroup } from './animalMatrices';
import { reengage, backoffPoint, aroundPoint, RING_DEFAULT, BACKOFF_MAX_T, BREAK_OFF_HP, BREAK_OFF_CHANCE, RULES_CD_HIT, RULES_CD_MISS } from './fightRules';
/** the live WORLD physics, read in one place (blood decals, the spawn floor) */
const worldPhysics = (): typeof app.physics => app.physics;

export interface WanderGoalQuery { herd: number; goal: { x: number; z: number; r: number } | null }
declare module '../events/maps' {
  interface AskMap { 'creature.wander-goal': readonly [WanderGoalQuery, WanderGoalQuery] }
}

/**
 * AnimalManager — spawns the chunk's huntable wildlife (the active ShardManifest's `fauna` herd plans),
 * runs their AI at 10 Hz (idle / graze / wander / alert / flee / charge / stalk / dead), animates
 * them every frame, and exposes the combat + audio hooks.
 *
 *   const animals = new AnimalManager(scene, sky, forest).build();
 *   game.onUpdate((dt, t) => animals.update(dt, t, player.position, player.sprinting));
 *
 *   animals.raycast(origin, dir, maxDist) → { animal, point, distance, headshot, damage } | null  (result object is reused;
 *                                          `damage` = DAMAGE model (Animal.ts) for that hit: body 32–40 with distance falloff past 40 m, head ×2.5)
 *   animal.applyDamage(amount, hitPoint, dir) → true if it died   (deer 60 hp, boar 100 hp; variants override — Old Ironhide 300)
 *   animals.hit(hit, dir)  — convenience: applyDamage(hit.damage)
 *   animals.disturb(point, strength) — a bolt landed / something loud happened here: animals within
 *                                      impactSpook m bolt, within impactAlert m go alert (Combat calls it on misses)
 *   animals.nearRay(origin, dir, maxDist, tol) → the animal whose head/body passes within `tol` m of the ray (aim assist / "was I aiming at it")
 *   Blood burst + ground decal, sounds, AI reaction and onKill all fire from applyDamage.
 *   animal.fadeOut()  — dissolve a harvested carcass over 1.5 s (animal.hidden afterwards)
 *
 * The hunting loop (DEER_TUNING / BOAR_TUNING below): every animal carries an `awareness` meter 0..1. It rises while the
 * player is inside the SIGHT cone (body heading ± sightCone, out to sightRange — far less while grazing head-down) or
 * inside the HEARING radius (any direction; grows with the player's speed: still < crouch < walk < sprint), and decays
 * otherwise. At `alertAt` the head comes up and the animal FREEZES staring at you for freezeMin..freezeMax s — that is
 * the shot window — then bolts if it still senses you (`boltAt`), or relaxes back to grazing after `relaxAfter` s. It
 * flees at `runSpeed` (faster than a sprinting player) but only until `fleeUntil..fleeUntilMax` m away, then stops, looks
 * back, and grazes again — "wary" (sharper senses) for `waryTime` s. A hit that does not kill bolts it at once. One
 * spooked animal alerts its herd within `herdAlertRadius` m. Boars charge when hit or when the player is within
 * `chargeDist` m. HUNTERS (a species whose HuntTuning has `stalk` — the bear) never bolt: the alert freeze
 * ends in a STALK (walking the player down, huffing) that becomes a charge inside panicDist, and a charge that
 * lands or times out drops back into the stalk after `stalk.rechargeCd` s until the player is `stalk.giveUp` m away.
 *
 * Fur shells: the SHELL_MAX nearest animals within SHELL_DIST m get 4–8 fur-shell layers (SkinnedMeshes
 * sharing the body's geometry + skeleton); nothing changes beyond that distance.
 *   animals.onKill   = (animal) => …
 *   animals.onCharge = (animal, damage) => …          a boar reached the player
 *   animals.onSound  = (name, position) => …          'deer_call' | 'boar_grunt' | 'hoofsteps' | 'boar_squeal'
 *   animals.onWindup = (animal) => …                  melee shards: an attack's wind-up began (the charge telegraph, a crab's
 *                                                     claw raise, the sailor's cutlass) — play its cue (the level's wind-up voice)
 *   animals.animals: Animal[]   animals.alive (count)
 *
 * Species + variants: every kind comes from the species registry (`src/engine/entities/species/<kind>.ts`, see
 * AnimalFactory.ts). Each spawn rolls a VariantDef by weight with the seeded rng — its `scale`, `hp` and `mods`
 * (speed / chargeDist / damageTaken / chargeDamage / relentless) are applied HERE on top of the species'
 * HuntTuning (DEER_TUNING / BOAR_TUNING below stay the untouched baseline; a species may ship its own
 * `tuning`). A 'legendary' variant is capped at ONE alive per kind (the roll falls back to the rare tier).
 * HerdPlan.variants restricts a herd's pool to those ids.
 *
   * Dev helpers: animals.spawn(kind, x, z, yaw, variant?, placement?) adds a single animal (no herd AI target) — `variant`
 * is a variant id ('ironhide') or an id list to roll from; omitted = the species' full weighted table.
 * animals.debug = true draws the hit capsules, animals.calm = true stops them reacting to the player.
 *
 * Species that THINK FOR THEMSELVES (`SpeciesDef.think` — Driftwood Isle's Reef Crab / Coconut Monkey / Drowned Sailor,
 * src/shards/driftwood-isle/creatures/Enemies.ts spawns them): the manager still owns spawning, per-frame animation, hit tests, blood, sounds,
 * onKill and the corpse, but their 10 Hz tick goes to the species' `think(animal, ThinkCtx)` instead of the senses /
 * flee / charge loop above, and a hit does not push them into flee / charge. Their damage to the player arrives through
 * the same `onCharge(animal, damage)`. `animals.enemyWorld` (EnemyWorld) is what the shard hands those AIs: palm
 * perches, the coconut thrower, the wreck's hold — Enemies.ts fills it; a missing piece degrades to ground behaviour.
 * `animals.addHerd(kind, cx, cz)` makes a herd for such a spawner (`spawn()` then `animal.herd = index`).
 *
 * MELEE SHARDS (`meleeShard(ShardManifest)`: 'sword' / 'nalati', Driftwood C5 — Pine Hollow's crossbow hunting is untouched): every attack
 * is telegraphed and lands on an arc, so strafing is the dodge.
 *   • A charge starts with a WIND-UP (CHARGE_WINDUP: boar 0.55 s, bear 0.65 s): the animal stops, turns to you, drops its
 *     head and paws the ground (Animal.poseWindup) with the roar / grunt as the cue, then runs. A sword blow during the
 *     wind-up interrupts it (Animal.stagger cancels the attack → `staggered` sends it back to alert / stalk).
 *   • A running charge connects per frame, not at 10 Hz, and only if you are inside CHARGE_ARC of its heading when it
 *     reaches you; inside the last CHARGE_COMMIT m it can barely turn — sidestep late and it thunders past.
 *   • The self-thinking species' strikes (crab snap, monkey bite, cutlass) only hurt inside HURT_ARC of the attacker's
 *     facing, and while an attack runs the animal turns at most ATTACK_TURN rad/s (Animal.attackTurnCap): a wind-up
 *     commits to a direction you can step out of.
 *   • No hit through solid geometry (E296 — the wreck's hold, where the sailor cut you from behind the mast and beams):
 *     a strike or a charge only lands when `canReach` — the physics `lineOfSight` from your chest to the attacker's finds
 *     nothing (a hull wall, a beam, a deck, a rock) short of the attacker's own body. Asked only on the frame a hit would
 *     land; `ThinkCtx.reach` lets a species skip a swing it could not land (the sailor does).
 *
 * FIGHT RULES (E297, `ShardManifest.fight.attackers` — Driftwood only; src/engine/entities/fightRules.ts): one set of rules for every enemy.
 *   • At most `maxAttackers` (2) attack at once: a charge (wind-up + run) or a species' strike needs an attack token
 *     (`tokens`; `ThinkCtx.claim` / `mayAttack`); the rest hold back on a ring and wait. A token goes back when the
 *     charge ends / the strike's attackPhase drops below 0 (swept every think tick), or at once on leaving 'charge'.
 *   • Boars fight like the bears: a boar gets a synthesized `stalk` (RULES_STALK) — it does not bolt when it notices you,
 *     it comes for you. After a charge (landed, missed, timed out or broken by a blow) a charger BACKS OFF past the ring
 *     (`backoffPoint`, ≤ BACKOFF_MAX_T s), then circles on it (RING: boar 6.5 m, bear 7.5 m) facing you until its
 *     cooldown (RULES_CD_HIT 3.4 s / RULES_CD_MISS 2.0 s) and a token let it turn, wind up and charge again (`reengage`).
 *     Only a nearly dead (< 25 %), non-relentless one may break off after a hit (50 %).
 *   • A big animal's body never swallows the camera (`clearBody`, per frame): a boar / bear / deer body closer to the
 *     player than its radius + the player's capsule + a margin is moved back out, through its physics motor.
 *   • `isThreat(a)` says an attack is coming (a charge's wind-up or run, a strike's wind-up) — src/engine/ui/WindupWarn.ts draws
 *     the off-screen warning from it.
 */

export interface AnimalHit { animal: Animal; point: THREE.Vector3; distance: number; headshot: boolean; damage: number }
/** a species' own sound id (SpeciesDef.sounds); the engine names none (E405) */
export type AnimalSound = string;

export interface Herd { kind: AnimalKind; cx: number; cz: number; members: Animal[] }

interface Brain {
  timer: number;        // time left in the current state
  tx: number; tz: number; // wander target
  fleeT: number;        // seconds spent fleeing
  fleeUntil: number;    // m from the player at which this animal stops running (seeded per animal)
  chargeCd: number;
  callT: number;
  awareness: number;    // 0..1 sense meter (see DEER_TUNING)
  freeze: number;       // alert: seconds of head-up stare left before it may bolt
  spooked: boolean;     // alert: bolt as soon as the freeze ends, whatever the senses say (herd panic, impact, hit)
  wary: number;         // seconds of sharpened senses left after a scare
  sensed: boolean;      // the player was sensed this think
  windup: number;       // melee shards: seconds of charge wind-up left (0 = running / none)
  // ── E297 fight rules ──
  backoff: number;      // s of the after-charge back-off left (0 = none); br.tx / tz is where it backs off to
  side: number;         // ±1: which way it arcs round you (flipped every back-off)
  committed: boolean;   // this charge got inside CHARGE_COMMIT of the player (a miss is then a pass-through)
  // ── the navmesh path being followed (PHYSICS P6b; empty without a navmesh) ──
  path: THREE.Vector3[]; pathI: number; goalX: number; goalZ: number; repathAt: number;
}

/** One animal kind's hunting-loop numbers. Player speeds for reference: crouch 2.2, walk 4.3, sprint 7.2 m/s. */
export interface HuntTuning {
  hp: number;
  // ── senses ──
  sightRange: number;      // m: a head-up animal notices a MOVING player inside its cone out to here
  sightRangeGraze: number; // m: head down in the grass it sees far less
  sightCone: number;       // rad: half-angle of the cone around the body heading
  hearStill: number; hearCrouch: number; hearWalk: number; hearSprint: number; // m: hearing radius by player speed (any direction)
  noticeRate: number;      // awareness/s at the edge of a sense; up to 2× nearer (× 0.3 for a player standing still in view)
  forgetRate: number;      // awareness/s decay while nothing is sensed
  alertAt: number;         // awareness → head up + freeze
  boltAt: number;          // awareness → run (once the freeze is over)
  // ── alert ──
  freezeMin: number; freezeMax: number; // s: the stare before it may bolt — the shot window
  relaxAfter: number;      // s: alert with nothing sensed → back to grazing
  panicDist: number;       // m: player closer than this → bolt at once, no freeze
  // ── flee ──
  runSpeed: number;        // m/s gallop
  trotSpeed: number;       // m/s once it is nearly far enough
  fleeMinTime: number;     // s: run at least this long
  fleeUntil: number; fleeUntilMax: number; // m from the player where it stops (seeded per animal in this band)
  fleeMaxTime: number;     // s: give up running (edge of the chunk, pond…)
  lookBack: number;        // s: stopped after the run, looking back at you, before grazing again
  waryTime: number; waryBoost: number; // s of sharper senses after a scare, and the multiplier
  // ── herd ──
  herdAlertRadius: number; // m: a spooked animal alerts herd-mates within this
  herdBoltDelayMin: number; herdBoltDelayMax: number; // s: herd-mates bolt this long after it
  // ── disturbances (a bolt landing nearby) ──
  impactSpook: number;     // m: bolt now
  impactAlert: number;     // m: head up (a HUNTER also engages from this far: it heard the shot)
  // ── hunters (bear): the alert turns into a pursuit ('stalk') instead of a bolt ──
  stalk?: {
    detect: number;      // m: the player inside this radius is noticed at once, any direction (it smells you)
    speed: number;       // m/s of the stalk — a deliberate walk toward the player
    giveUp: number;      // m: a stalking animal this far from the player loses interest
    rechargeCd: number;  // s between a charge (contact or timeout) and the next
    huffMin: number; huffMax: number; // s between huffs (the species' `call` sound) while stalking
    roar: string;        // AnimalSound played at the start of a charge
    fleeBelowHp: number; // hp fraction under which a hit may make a NON-relentless variant break off and flee
    fleeChance: number;  // probability of that break-off per hit
  } | undefined;
}

export const DEER_TUNING: HuntTuning = {
  hp: 60,
  // Huntable, not paranoid (user: "I need to be able to get close and shoot them"): head-on a deer notices you
  // walking at ~22 m; from behind / the side you get to ~12 m on foot. Only sprinting inside 24 m is heard.
  sightRange: 30, sightRangeGraze: 14, sightCone: THREE.MathUtils.degToRad(55),
  hearStill: 3, hearCrouch: 6, hearWalk: 12, hearSprint: 24,
  noticeRate: 0.3, forgetRate: 0.3, alertAt: 0.45, boltAt: 1.0,
  // 4–7 s head-up stare: plenty of time to raise the crossbow and take the shot
  freezeMin: 4.0, freezeMax: 7.0, relaxAfter: 3.5, panicDist: 6,
  // gallop 6.0 (you sprint 7.2 — you CAN close on one) and only to 35–50 m, then it trots, stops and looks back
  runSpeed: 6.0, trotSpeed: 3.2, fleeMinTime: 1.5, fleeUntil: 35, fleeUntilMax: 50, fleeMaxTime: 8, lookBack: 2.5,
  waryTime: 10, waryBoost: 1.2,
  herdAlertRadius: 8, herdBoltDelayMin: 0.4, herdBoltDelayMax: 1.2,
  impactSpook: 4, impactAlert: 10,
};

export const BOAR_TUNING: HuntTuning = {
  hp: 100,
  // poor eyes, good nose: a short cone but it hears a walker from 22 m
  sightRange: 22, sightRangeGraze: 14, sightCone: THREE.MathUtils.degToRad(60),
  hearStill: 4, hearCrouch: 7, hearWalk: 14, hearSprint: 28,
  noticeRate: 0.5, forgetRate: 0.2, alertAt: 0.35, boltAt: 1.0,
  freezeMin: 1.5, freezeMax: 2.8, relaxAfter: 4, panicDist: 10, // panicDist doubles as the charge trigger
  runSpeed: 6.8, trotSpeed: 3.6, fleeMinTime: 2, fleeUntil: 40, fleeUntilMax: 60, fleeMaxTime: 10, lookBack: 2,
  waryTime: 20, waryBoost: 1.5,
  herdAlertRadius: 12, herdBoltDelayMin: 0.2, herdBoltDelayMax: 0.7,
  impactSpook: 7, impactAlert: 18,
};

const GRAZER_WALK = 1.3, CHARGER_WALK = 1.1, BOAR_CHARGE = 7.5, CHARGE_HIT_DIST = 1.4;   // species defaults (SpeciesDef.walkSpeed / chargeSpeed override)
const CHARGE_WHEN_HIT_DIST = 25;   // a wounded boar this close turns on you instead of running
/** melee shards (see the header): the charge wind-up per species (s), the contact arc (half-angle, rad), the self-thinking species' strike arc, the turn cap while attacking */
const CHARGE_WINDUP_DEFAULT = 0.5;
/** a species with no `sounds`: the installed default call / hurt for its temperament (installKitSpecies); none installed: '' */
const fallbackSound = (charger: boolean, which: 'call' | 'hurt'): string => creatureSoundDefaults()?.[charger ? 'charger' : 'grazer'][which] ?? '';
const CHARGE_ARC = THREE.MathUtils.degToRad(50), HURT_ARC = THREE.MathUtils.degToRad(70), ATTACK_TURN = 1.5;
const CHARGE_COMMIT = 4.5, CHARGE_COMMIT_TURN = 1.1;   // m from the player inside which a charge stops tracking, and its turn rate there (rad/s)
const ANIM_LOD = 140;
/** E297 fight rules: the stalk a boar gets when it has none (it comes for you instead of bolting); its circling / back-off speeds (m/s) */
const RULES_STALK: NonNullable<HuntTuning['stalk']> = { detect: 0, speed: 3.0, giveUp: 45, rechargeCd: RULES_CD_HIT, huffMin: 2.5, huffMax: 5, roar: '', fleeBelowHp: BREAK_OFF_HP, fleeChance: BREAK_OFF_CHANCE };
const CIRCLE_SPEED = 1.7, BACKOFF_SPEED = 4.2;
/** E297: a charger turns to within this of you (rad) before its wind-up starts */
const FACE_BEFORE_CHARGE = 0.6;
/** E297 body clearance: the player's capsule radius (Player.ts RADIUS) + a margin for the camera's near plane (m) */
const CLEAR_PLAYER = 0.38 + 0.3;
const _ring = { x: 0, z: 0 };
const SHELL_DIST = 18, SHELL_MAX = 4;   // fur shells: nearest SHELL_MAX animals within SHELL_DIST m

const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _d = new THREE.Vector3(), _p = new THREE.Vector3();

/** What `clearBody` needs of an animal (Animal implements it). */
export interface BodyClearable {
  readonly position: THREE.Vector3;
  readonly yaw: number;
  readonly scale: number;
  readonly dims: { readonly bodyRadius: number; readonly headRadius: number };
  /** its physics body: src/engine/physics/creatures.ts hands every live, shown, un-ridden animal within 45 m one */
  readonly motor: CharacterMotor | null;
  readonly mesh: { readonly position: THREE.Vector3 };
  bodyCapsule: (a: THREE.Vector3, b: THREE.Vector3) => void;
  headWorld: (out: THREE.Vector3) => THREE.Vector3;
}

/**
 * E297: a big animal's body never swallows the camera. The body (rump → head, horizontally) closer to the player than its
 * own radius + CLEAR_PLAYER is moved straight back out through its physics motor, so a wall or a rock behind it stops it
 * (then the player's own knock-back does the rest). No motor, no move (E323: physics owns collision, nothing is pushed
 * blind into a wall). No motor means a ridden horse (Mount's body carries it) or a world without physics: every live,
 * shown animal near the player has one, since CreatureBodies.sync runs first in the update. True when it pushed.
 */
export function clearBody(a: BodyClearable, player: THREE.Vector3): boolean {
  const motor = a.motor;
  if (motor === null) return false;
  if (Math.abs(player.y - a.position.y) > 2.5) return false;
  a.bodyCapsule(_a, _b); a.headWorld(_c);
  // the segment rump (_a) → head (_c), flattened
  const sx = _c.x - _a.x, sz = _c.z - _a.z, len2 = sx * sx + sz * sz;
  const t = len2 > 1e-6 ? THREE.MathUtils.clamp(((player.x - _a.x) * sx + (player.z - _a.z) * sz) / len2, 0, 1) : 0;
  const qx = _a.x + sx * t, qz = _a.z + sz * t;
  let ox = qx - player.x, oz = qz - player.z;
  const dist = Math.hypot(ox, oz);
  const min = Math.max(a.dims.bodyRadius, a.dims.headRadius) * a.scale + CLEAR_PLAYER;
  if (dist >= min) return false;
  if (dist > 1e-3) { ox /= dist; oz /= dist; } else { ox = -Math.sin(a.yaw); oz = -Math.cos(a.yaw); } // dead centre: straight back
  const push = min - dist;
  const x0 = a.position.x, z0 = a.position.z, y = a.position.y;
  _d.set(ox * push, 0, oz * push);
  motor.move(a.position, _d, true);
  a.position.y = y; // the motor ignores the terrain: the animal's ground follow owns y
  a.mesh.position.x += a.position.x - x0; a.mesh.position.z += a.position.z - z0; // this frame's pose already went out
  return true;
}

// ─────────────────────────────────────────────────────────────────────────────────────────
// Blood: a pooled particle burst + pooled ground decals
// ─────────────────────────────────────────────────────────────────────────────────────────

function makeDropTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas'); c.width = c.height = 32;
  const g = c.getContext('2d');
  if (g === null) throw new Error('BloodFX: could not get a 2d canvas context');
  const grad = g.createRadialGradient(16, 16, 2, 16, 16, 15);
  grad.addColorStop(0, 'rgba(255,255,255,1)'); grad.addColorStop(0.7, 'rgba(255,255,255,0.9)'); grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad; g.fillRect(0, 0, 32, 32);
  return new THREE.CanvasTexture(c);
}

const MAX_P = 384, MAX_DECALS = 24;
/** blood lands on the first world surface within this far under the burst (m) */
const BLOOD_DROP = 4;
const DOWN = { x: 0, y: -1, z: 0 } as const;

class BloodFX {
  group = new THREE.Group();
  private readonly pool: ParticlePool;
  /** where each droplet lands (PHYSICS P7: one ray down per burst) */
  private floor = new Float32Array(MAX_P);
  private decals: THREE.Mesh[] = [];
  private decalNext = 0;
  private active = 0;

  constructor(sky: Sky) {
    const mat = new THREE.PointsMaterial({ color: new THREE.Color(0.09, 0.004, 0.003), size: 0.035, sizeAttenuation: true, transparent: true, opacity: 0.95, depthWrite: false, map: makeDropTexture(), alphaTest: 0.3 });
    this.pool = new ParticlePool({ capacity: MAX_P, material: mat, renderOrder: 5, attributes: {}, parkY: -1000 }); // PointsMaterial draws every slot: the free ones wait far below
    this.group.add(this.pool.points);
    const dmat = new THREE.MeshStandardMaterial({ color: new THREE.Color(0.035, 0.002, 0.002), roughness: 0.35, metalness: 0, transparent: true, opacity: 0.9, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    sky.setupMaterial(dmat);
    const dgeo = new THREE.CircleGeometry(1, 18);
    // irregular splat outline
    const pa = dgeo.attributes['position'] as THREE.BufferAttribute;
    for (let i = 1; i < pa.count; i++) { const k = 0.6 + 0.4 * Math.abs(Math.sin(i * 7.3) * Math.cos(i * 3.1)); pa.setXY(i, pa.getX(i) * k, pa.getY(i) * k); }
    for (let i = 0; i < MAX_DECALS; i++) {
      const m = new THREE.Mesh(dgeo, dmat);
      m.visible = false; m.receiveShadow = true; m.renderOrder = 2;
      this.decals.push(m); this.group.add(m);
    }
  }

  burst(at: THREE.Vector3, dir: THREE.Vector3, strength = 1): void {
    const n = Math.round(22 * strength);
    const physics = worldPhysics();
    const fl = (physics ? floorBelow(physics, at.x, at.z, at.y + 0.3, BLOOD_DROP) : undefined) ?? heightAt(at.x, at.z);
    const { vel, life } = this.pool;
    for (let i = 0; i < n; i++) {
      const k = this.pool.claim();
      this.floor[k] = fl;
      this.pool.place(k, at);
      // spray mostly along the shot direction (exit) with a wide cone
      const s = 1.5 + Math.random() * 3.5;
      vel[k * 3] = (dir.x * 0.6 + (Math.random() - 0.5) * 1.2) * s;
      vel[k * 3 + 1] = (dir.y * 0.6 + (Math.random() - 0.2) * 1.2) * s;
      vel[k * 3 + 2] = (dir.z * 0.6 + (Math.random() - 0.5) * 1.2) * s;
      life[k] = 0.45 + Math.random() * 0.45;
    }
    this.active = Math.min(MAX_P, this.active + n);
    // ground patch
    const d = this.decals[this.decalNext]; this.decalNext = (this.decalNext + 1) % MAX_DECALS;
    if (d === undefined) return;
    const gx = at.x + dir.x * 0.4, gz = at.z + dir.z * 0.4;
    // the patch lands on what is under it: a deck, a rock, the hold floor — not the terrain beneath them
    const hit = physics ? castRay(physics, _c.set(gx, at.y + 0.3, gz), DOWN, BLOOD_DROP) : null;
    if (hit) { d.position.set(gx, hit.point.y + 0.015, gz); _d.set(hit.normal.x, hit.normal.y, hit.normal.z); }
    else { const nrm = normalAt(gx, gz); d.position.set(gx, heightAt(gx, gz) + 0.015, gz); _d.set(nrm[0], nrm[1], nrm[2]); }
    d.quaternion.setFromUnitVectors(_c.set(0, 0, 1), _d);
    d.rotateZ(Math.random() * Math.PI * 2);
    const r = 0.14 + Math.random() * 0.14 * strength;
    d.scale.set(r, r * (0.7 + Math.random() * 0.5), 1);
    d.visible = true;
  }

  update(dt: number): void {
    if (this.active === 0) return;
    let alive = 0;
    const { life, pos, vel } = this.pool;
    for (let k = 0; k < MAX_P; k++) {
      const l0 = life[k] ?? 0;
      if (l0 <= 0) continue;
      life[k] = l0 - dt;
      if ((life[k] ?? 0) <= 0) { pos[k * 3 + 1] = -1000; continue; }
      alive++;
      const j = k * 3;
      vel[j + 1] = (vel[j + 1] ?? 0) - 9.8 * dt;
      pos[j] = (pos[j] ?? 0) + (vel[j] ?? 0) * dt; pos[j + 1] = (pos[j + 1] ?? 0) + (vel[j + 1] ?? 0) * dt; pos[j + 2] = (pos[j + 2] ?? 0) + (vel[j + 2] ?? 0) * dt;
      const fl = this.floor[k] ?? -1e9;
      if ((pos[j + 1] ?? 0) < fl) { pos[j + 1] = fl + 0.01; vel[j] = vel[j + 1] = vel[j + 2] = 0; } // landed: it soaks in where it fell
    }
    this.active = alive;
    this.pool.posAttr.needsUpdate = true;
  }
}

const _navFrom = new THREE.Vector3(), _navTo = new THREE.Vector3();
/** a rig as the far herd sees it (its model: the batch's material) */
interface FarRig extends FarMember {
  readonly model: AnimalModel;
  /** the rig's own layer mask while the far herd draws it (its layers are 0 then: the rig is not drawn, its children are) */
  mask: number | null;
}
/** the bearings `steerNav` tries round a blocked heading (rad, each side) */
const NAV_FAN = [0.4, 0.8, 1.2, 1.6, 2.1, 2.6];
/** E322 F-L4: the grass a body parts (m, the trample's radius) */

export class AnimalManager {
  /** the animals' own world-matrix pass: a still, far animal's bones are not recomputed (animalMatrices.ts) */
  group = new AnimalGroup();
  animals: Animal[] = [];
  private readonly entityIds = new EntityIds('creature');
  private readonly spawnedActors = new WeakSet<Animal>();
  private readonly retiredActors = new WeakSet<Animal>();
  herds: Herd[] = [];
  factory: AnimalFactory;
  onKill?: (animal: Animal) => void;
  onCharge?: (animal: Animal, damage: number) => void;
  onSound?: (name: AnimalSound, position: THREE.Vector3) => void;
  /** melee shards: an attack's wind-up began (see the header) */
  onWindup?: ((animal: Animal, dur: number) => void) | undefined;
  /** every non-lethal AND lethal hit: amount actually dealt, world hit point, whether it was the head (Combat draws the numbers) */
  onDamage?: (animal: Animal, amount: number, hitPoint: THREE.Vector3, headshot: boolean, died: boolean) => void;
  debug = false;
  /** dev: animals ignore the player (no alert / flee) */
  calm = false;
  /** the player is not among them: `calm`, or a practice room is up (the arena, a playground — 1–3 km over the shard at the
   *  same x / z: no pack hunts, no horse bolts, no boar charges from under it; E321) */
  private get unaware(): boolean { return this.calm || practiceRoom.open; }
  /** the shard's pieces for the self-thinking enemy species (see the header; Enemies.ts fills it) */
  enemyWorld: EnemyWorld = {};
  get habitat(): EnemyWorld { return this.enemyWorld; }
  set habitat(value: EnemyWorld) { this.enemyWorld = value; }
  /** a place a herd animal's wander walks to instead of a random point (within r m of it), or null for the usual wander —
   *  Pine Hollow's rain sends the grazers in under the big trees (src/shards/pine-hollow/world/weather.ts, PH-C7) */
  wanderGoal: ((a: Animal) => { x: number; z: number; r: number } | null) | null = null;
  private brains = new Map<Animal, Brain>();
  private rng = new Rng(SEED + 31);
  readonly scheduler = new TickScheduler(app.scheduler);
  private readonly visibility = new WeakMap<Animal, boolean>();
  private dodgeId = dodgeFx.id;
  private playerSprinting = false;
  private blood!: BloodFX;
  private debugMeshes: THREE.Mesh[] = [];
  private playerPos = new THREE.Vector3();
  private playerPrev = new THREE.Vector3(); private playerSpeed = 0; private playerInit = false;
  private shellDist = new Float64Array(SHELL_MAX);
  private shellIdx = new Int32Array(SHELL_MAX);
  /** a melee shard (the sword): telegraphed charges, attacks on an arc (see the header) */
  private readonly melee = activeLevel().fight.telegraphed === true; // Driftwood's swords, Nalati's sabre / spear
  /** E297: the shard's fight rules (Driftwood), null = the old fights (see the header) */
  private readonly rules = (() => {
    const fight = activeLevel().fight;
    return fight.attackers === undefined || !Number.isFinite(fight.attackers) ? null : fight;
  })();
  /** E322 F-L4: Pine Hollow's animals part the grass (Nalati's Wildlife feeds the same map its own way) */
  /** E297: the attack tokens — at most `rules.maxAttackers` attacking at once */
  readonly tokens = new AggressionDirector<Animal>(this.rules?.attackers ?? Infinity);
  /** a token holder still attacking: a charger while it charges, a self-thinking species while its strike runs */
  private readonly stillAttacking = (a: Animal): boolean =>
    a.alive && !a.hidden && (speciesDef(a.kind).think !== undefined ? a.attackPhase >= 0 : a.state === 'charge');
  /** E297: an attack is coming from `a` — a charge's wind-up or run, a strike before it lands (WindupWarn reads it) */
  readonly isThreat = (a: Animal): boolean =>
    a.alive && !a.hidden && !a.stunned && (speciesDef(a.kind).think !== undefined ? a.attackPhase >= 0 && a.attackPhase < 1 : a.state === 'charge');
  /** each multi-group rig's one-draw shadow caster (animalShadow.ts); the per-frame shadow distance switches it */
  private readonly casters = new Map<Animal, THREE.SkinnedMesh>();
  /** PH-P2: the far animals drawn per model (farHerd.ts), desktop past TIER_CONFIG.animalFarBatchDist; each rig's entry */
  private readonly farHerd = new FarHerd<FarRig>((m) => this.factory.farMaterial(m.model), { keyOf: (m) => m.model });
  private readonly farRigs = new Map<Animal, FarRig>();
  /** PH-P2: the casting animals' shadows per model (farHerd.ts { shadow }), within animalShadowDist */
  private readonly shadowHerd = new FarHerd<FarRig>((m) => m.model.fur, { shadow: true });
  /**
   * A level's override of TIER_CONFIG.animalShadowBatch (null: the tier's): false casts each animal from its own visible
   * rig (its one-draw caster) instead of the shadow herd's skinned copies — one shadow draw per animal per cascade, and
   * none of the batch's geometry (G180 B5, Pine Hollow's memory trim: ~−7.9 MB of GL, −12.8 MB of JS arrays)
   */
  shadowBatch: boolean | null = null;
  private readonly pbr: boolean;

  private readonly scene: THREE.Scene;
  private readonly sky: Sky;
  private readonly forest: Forest;
  /** `opts.style` forces the render style (dev harness); production reads `ShardManifest.style` ('pbr' | 'lowpoly') */
  constructor(scene: THREE.Scene, sky: Sky, forest: Forest, opts: { style?: AnimalStyle | undefined; render?: CreatureRenderSpec | undefined } = {}) {
    this.scene = scene;
    this.sky = sky;
    this.forest = forest;
    const style = opts.style ?? activeLevel().creatureStyle ?? 'pbr';
    this.factory = new AnimalFactory(sky, { style, render: opts.render ?? activeLevel().creatures });
    this.pbr = this.factory.render.furRim;
    this.group.name = 'animals';
    // Legacy authored species keep their brain/strike callback until S3.4 / S4.2 migrates it.
    this.configureTicks(app.render?.level.tiers?.[TIER]?.ticks);
    const scope = app.levelScope;
    if (scope) {
      app.combat.registerTargets(scope, () => app.levelScope !== scope ? [] : this.animals.map((animal) =>
        app.combat.targetPort(animal.combatActor(), animal, (velocity) => { animal.impulse(velocity); },
          () => !scope.disposed && app.levelScope === scope && !animal.hidden && animal !== app.equipmentHost?.player.mountedOn)));
      app.events.on('weapon.fired', () => { if (app.levelScope === scope) this.interruptTargets('target.attack'); }, scope);
      scope.onDispose(() => { this.scheduler.reset(); });
    }
  }

  private configureTicks(overrides: Readonly<Record<string, TickRate>> | undefined): void {
    this.scheduler.configure(overrides);
    this.scheduler.rate('legacy', { bands: [{ upTo: Infinity, brainHz: 10, body: 'frame' }] });
  }

  get alive(): number { let n = 0; for (const a of this.animals) if (a.alive) n++; return n; }

  build(): this {
    this.blood = new BloodFX(this.sky);
    this.group.add(this.blood.group);
    for (const _herd of this.spawnHerds()) { /* all herds in one go */ }
    return this.finish();
  }

  /**
   * `build()` with the event loop let in between herds (`pause`, e.g. a macrotask): the same herds, the
   * same rolls — each herd's first animal of a species builds its model (lofted body + fur), and all of
   * them in one call was a 250–650 ms main-thread task of the boot's `animals` step at 4x CPU.
   * Regional shells pass their retained frame: construction and every resumed herd slice use its
   * services/owner; the frame is restored while awaiting models or yielding between herds.
   */
  async buildAsync(pause: () => Promise<void>, frame?: LevelFrameBinding): Promise<this> {
    const start = (): void => {
      this.blood = new BloodFX(this.sky);
      this.group.add(this.blood.group);
    };
    if (frame === undefined) start();
    else frame.run(app, () => { start(); this.configureTicks(frame.terrain.level.tiers?.[TIER]?.ticks); });
    await this.factory.ready;   // Pine Hollow's generated hulls (pineCreatures.ts) before the first herd: a model is made once
    if (frame === undefined) {
      for (const _herd of this.spawnHerds()) await pause();
      return this.finish();
    }
    // Each resumed herd reads its retained level/terrain/services, never the intervening page frame.
    // Keep the ambient binding synchronous: another region may enter while pause() is pending.
    const herds = this.spawnHerds();
    while (!frame.run(app, () => herds.next()).done) await pause();
    return frame.run(app, () => this.finish());
  }

  private finish(): this {
    this.group.add(this.farHerd.group, this.shadowHerd.group);
    this.scene.add(this.group);
    return this;
  }

  // ── spawning ───────────────────────────────────────────────────────────────────────────

  /** a shard's own water the flat `waterLevel()` cannot see (Nalati: the river's gravel corridor, the plateau brook —
   *  src/shards/nalati-grasslands/wet.ts); null = the water line alone */
  wetAt: ((x: number, z: number) => boolean) | null = null;

  /**
   * Dry ground: not under water. The water is the sea on an open-water shard, else only the pond — below its surface
   * (+ 0.25 m) inside the square src/shards/pine-hollow/world/pond.ts draws (2r + 30 m across). Pine Hollow has ~3.1 ha of dry valleys lower
   * than the pond's surface with no water drawn in them; the navmesh bake (scripts/bake-navmesh.mjs `wetTest`) already
   * walks them, and this is the same test, so a herd no longer needs a navmesh query per call to stand there (and the
   * no-navmesh fallback no longer calls them wet). Running water (Pine Hollow's creek, PH-L9) is wet here too, so nothing
   * spawns or settles standing in it; the navmesh still fords it (0.45 m), so herds cross it on the way somewhere.
   */
  private isDry(x: number, z: number): boolean {
    if (this.wetAt?.(x, z) === true) return false; // the shard's own water (Nalati: src/shards/nalati-grasslands/wet.ts)
    const y = heightAt(x, z), s = streamAt(x, z);
    if (s !== null && y < s - 0.05) return false;
    if (y > waterLevel() + 0.25) return true;
    if (app.world.water.sea !== null) return false; // the open sea (the level's registered water body)
    if (!hasPond()) {
      // no pond to measure against (Nalati): the navmesh bake's own wet test — walkable on it = dry
      const nav = app.navmesh;
      if (nav === null) return false;
      const p = nav.closestWalkable(_navFrom.set(x, y, z), 0, _navTo);
      return p !== null && Math.hypot(p.x - x, p.z - z) < 1;
    }
    const half = POND.r + 15;
    return Math.abs(x - POND.x) > half || Math.abs(z - POND.z) > half;
  }

  /**
   * Ground an animal can stand on. `clearingR` > 3 asks for a clearing (few trunks in that radius);
   * `canopy` instead asks for trees around (boars root under the canopy).
   */
  private isOpen(x: number, z: number, clearingR: number, canopy = false): boolean {
    if (!inChunk(x, z, 22)) return false;
    if (trailDistance(x, z) < (clearingR > 3 ? 9 : 6)) return false;
    if (cabinMask(x, z) > 0) return false;
    if (normalAt(x, z)[1] < 0.8) return false;
    if (!this.isDry(x, z)) return false;
    const near = this.forest.nearby(x, z, clearingR).length;
    if (clearingR > 3) return canopy ? near >= 3 || this.treeless : near <= 2;
    return near === 0;
  }
  /** a shard with no forest trees (Driftwood Isle: palms are not Forest trees) — every spot is a clearing, a canopy ask is moot */
  private get treeless(): boolean { return this.forest.trees.length === 0; }

  /** Places the shard's herds, yielding after each one (`build` drains it, `buildAsync` pauses between). */
  private *spawnHerds(): Generator<number, void, undefined> {
    const rng = this.rng;
    // herd placement comes from the shard: each HerdPlan asks for a clearing (or canopy) in a band of
    // distances off the trails, optionally in a ring around an anchor (a trail, a cabin…).
    const { spawns: plan, spawn } = activeLevel();
    const centres: [number, number][] = [];
    for (const h of plan) {
      let cx = 0, cz = 0, ok = false;
      // herd centres keep 60 m apart when the shard leaves placement to us; an anchored plan already says where
      // it wants to be (a laid-out grid of small groups, `src/engine/world/faunaLayout.ts`), so only its own ring size
      // — never less than 20 m — separates it from its neighbours
      const sep = h.anchor ? Math.min(60, Math.max(20, h.anchor.rMax)) : 60;
      for (let tries = 0; tries < 1500 && !ok; tries++) {
        if (h.anchor) {
          const ang = rng.range(0, Math.PI * 2), r = rng.range(h.anchor.rMin, h.anchor.rMax);
          cx = h.anchor.x + Math.cos(ang) * r; cz = h.anchor.z + Math.sin(ang) * r;
        } else { cx = rng.range(-215, 215); cz = rng.range(-215, 215); }
        // relax the trail band and clearing size as the search goes on
        const relax = tries / 1500;
        const td = trailDistance(cx, cz);
        if (td < h.trailBand[0] || td > h.trailBand[1] + relax * 60) continue;
        if (!this.isOpen(cx, cz, h.canopy ? 9 : 7 - relax * 3, h.canopy)) continue;
        if (Math.hypot(cx - spawn.x, cz - spawn.z) < 30) continue;         // not on top of the spawn point
        if (centres.some(([x, z]) => Math.hypot(x - cx, z - cz) < sep)) continue;
        ok = true;
      }
      if (!ok) continue;
      centres.push([cx, cz]);
      const herd: Herd = { kind: h.kind, cx, cz, members: [] };
      this.herds.push(herd);
      for (let i = 0; i < h.count; i++) {
        let px = cx, pz = cz, placed = false;
        for (let tries = 0; tries < 60 && !placed; tries++) {
          const ang = rng.range(0, Math.PI * 2), r = rng.range(1.5, 9);
          px = cx + Math.cos(ang) * r; pz = cz + Math.sin(ang) * r;
          if (!this.isOpen(px, pz, 1.2)) continue;
          if (herd.members.some((m) => Math.hypot(m.position.x - px, m.position.z - pz) < 1.8)) continue;
          placed = true;
        }
        if (!placed) continue;
        const a = this.spawn(h.kind, px, pz, rng.range(0, Math.PI * 2), h.variants);
        a.herd = this.herds.length - 1;
        herd.members.push(a);
      }
      yield this.herds.length;
    }
  }

  /** the species' hunting-loop numbers: its own `tuning`, else the manager's baseline for its temperament */
  private tuningFor(a: Animal): HuntTuning {
    const cached = this.tuningCache.get(a.kind);
    if (cached !== undefined) return cached;
    const sp = speciesDef(a.kind);
    const base = sp.tuning ?? (sp.aggressive ? BOAR_TUNING : DEER_TUNING);
    const over = activeLevel().faunaTuning?.[a.kind];
    let t = over !== undefined ? { ...base, ...over, stalk: over.stalk ?? base.stalk } : base;   // ShardManifest.faunaTuning: the shard's overrides (Driftwood's far-sighted beach boars)
    // E297 fight rules: a charger without a stalk (the boar) gets one — it comes for you instead of bolting
    if (this.rules !== null && sp.aggressive === true && sp.think === undefined && t.stalk === undefined) t = { ...t, stalk: { ...RULES_STALK, roar: sp.sounds?.call ?? fallbackSound(true, 'call') } };
    this.tuningCache.set(a.kind, t);
    return t;
  }
  private tuningCache = new Map<AnimalKind, HuntTuning>();

  /** true if a living legendary of this kind is already in the chunk (the cap is one per kind) */
  private hasLegendary(kind: AnimalKind): boolean {
    for (const a of this.animals) if (a.kind === kind && a.rarity === 'legendary' && a.alive) return true;
    return false;
  }

  /**
   * Add one animal (also used by the dev showcase). `variant`: a variant id (exact, even a second legendary),
   * an id list to roll from by weight, or nothing for the species' whole table.
   */
  /** Retire a scripted creature through the same body and manager ownership boundary. */
  retire(a: Animal): void {
    if (this.spawnedActors.has(a) && this.animals.includes(a)) this.retiredActors.add(a);
    a.hidden = true; a.mesh.visible = false;
    if (!a.simulationBound) { a.alive = false; a.position.y = -9999; }
    const i = this.animals.indexOf(a); if (i !== -1) this.animals.splice(i, 1);
    this.brains.delete(a); this.farRigs.delete(a); this.casters.delete(a); this.tokens.release(a); this.scheduler.forget(a);
    this.bodies?.remove(a);
    a.retireBody();
    a.mesh.removeFromParent();
  }

  /** Spawn below a WORLD ray origin (fromY), or at an exact initial world feet height (y). */
  spawn(kind: AnimalKind, x: number, z: number, yaw: number, variant?: string | string[], placement?: { y?: number; fromY?: number; entityId?: string }): Animal {
    return this.spawnAnimal(kind, x, z, yaw, variant, placement);
  }

  /** Rebuild one retired authored home with fresh rig/state and ordinary spawn RNG, preserving its logical identity.
   * Only an actor retired by this manager can be replaced, once; a foreign/live actor or live duplicate refuses before construction. */
  replace(retired: Animal, x: number, z: number, yaw: number, variant?: string | string[], placement?: { y?: number; fromY?: number }): Animal {
    if (retired.simulationBound || !this.retiredActors.has(retired) || this.animals.some(actor => actor.entityId === retired.entityId)) throw new Error('Replacement requires this manager\'s unreplaced retired actor');
    const replacement = this.spawnAnimal(retired.kind, x, z, yaw, variant, placement, retired.entityId);
    this.retiredActors.delete(retired);
    return replacement;
  }

  private spawnAnimal(kind: AnimalKind, x: number, z: number, yaw: number, variant?: string | string[], placement?: { y?: number; fromY?: number; entityId?: string }, identity?: string): Animal {
    if ((placement?.y !== undefined && !Number.isFinite(placement.y)) || (placement?.fromY !== undefined && !Number.isFinite(placement.fromY))) throw new Error('Creature spawn placement must be finite');
    const sp = speciesDef(kind);
    const v = typeof variant === 'string' ? variantDef(kind, variant) : rollVariant(sp, this.rng, variant, this.hasLegendary(kind));
    const model = this.factory.model(kind, v.id);
    const scale = this.rng.range(v.scale[0], v.scale[1]);
    const rig = this.factory.instantiate(model, this.rng.next());
    const a = new Animal(rig, model, this.rng.next(), scale, identity ?? this.entityIds.allocate(placement?.entityId));
    a.maxHp = a.hp = v.hp ?? this.tuningFor(a).hp;
    const physics = worldPhysics();
    const fromY = placement?.fromY ?? Math.max(activeLevel().spawn.y ?? heightAt(x, z), heightAt(x, z)) + 1;
    const floor = creatureFloor(physics, x, z, fromY);
    const flight = model.species.flight;
    const y = placement?.y ?? (flight === undefined ? floor.y : flight.altitude + (flight.above === 'world' ? 0 : floor.y));
    a.place(x, z, yaw, y);
    a.levelGround = floor.structure;
    if (activeLevel().ground.structures !== undefined || floor.structure || placement !== undefined) {
      a.groundHeight = (px, pz, py) => creatureFloor(physics, px, pz, py).y;
    }
    a.herd = -1;
    a.onFootfall = this.footfall;
    a.onDamaged = this.damaged;
    a.onStaggered = this.staggered;
    inspectTick(a, () => {
      const rate = this.tickRate(a);
      return { brainHz: rate === 'always' ? this.scheduler.frameHz : this.scheduler.brainHz(rate, a), pinned: rate === 'always' || this.scheduler.pinned(a) };
    });
    this.scheduler.onInterrupt(a, () => {
      if (a.simulationBound || a.hidden || a.harnessHold || !a.alive || (speciesDef(a.kind).think !== undefined && speciesDef(a.kind).tick === undefined)) return;
      const dt = this.scheduler.takeBrainDt(this.tickRate(a), a);
      this.think(a, dt, this.playerPos, this.playerSprinting);
    });
    if (model.shells.length > 0) a.makeShells = () => this.factory.createShells(rig, model);   // none in 'lowpoly'
    a.prepareMaterial = (m) => this.sky.setupMaterial(m);
    a.sampleTerrain();
    // one shadow draw per animal instead of one per material group (animalShadow.ts; PINE-HOLLOW PH-P1 / P2)
    const caster = attachShadowCaster(a.mesh);
    if (caster !== null) this.casters.set(a, caster);
    const fur = rig.materials[0];
    if (fur !== undefined) this.farRigs.set(a, { mesh: a.mesh, tint: fur.color, model, mask: null });
    this.group.add(a.mesh); this.group.own(a);
    this.animals.push(a);
    this.spawnedActors.add(a);
    app.aggression.register(a, this.tokens, app.levelScope ?? undefined);
    const tune = this.tuningFor(a);
    this.brains.set(a, {
      timer: this.rng.range(1, 4), tx: x, tz: z, fleeT: 0, fleeUntil: this.rng.range(tune.fleeUntil, tune.fleeUntilMax), chargeCd: 0,
      callT: this.rng.range(10, 60), awareness: 0, freeze: 0, spooked: false, wary: 0, sensed: false, windup: 0,
      backoff: 0, side: a.seed % 0.02 < 0.01 ? -1 : 1, committed: false, // from its own seed: no extra draw on the shared rng (the herds' rolls stay put)
      path: [], pathI: 0, goalX: 0, goalZ: 0, repathAt: 0,
    });
    if (this.melee) { a.attackTurnCap = ATTACK_TURN; a.onAttack = (who, dur) => { this.onWindup?.(who, dur); }; }
    return a;
  }

  /** a herd for an external spawner (Enemies.ts): returns its index for `animal.herd`; push the animals into `members` */
  addHerd(kind: AnimalKind, cx: number, cz: number): number {
    this.herds.push({ kind, cx, cz, members: [] });
    return this.herds.length - 1;
  }

  private footfall = (a: Animal, strength: number): void => {
    if (this.onSound === undefined) return;
    if (a.position.distanceToSquared(this.playerPos) > 35 * 35) return;
    if (strength > 0.5) this.onSound('hoofsteps', a.position);
  };

  // ── per frame ──────────────────────────────────────────────────────────────────────────

  /**
   * `viewPos` is where the frame is seen from — the player, or Explore's free camera (main.ts `viewer()`, E125).
   * Drawing (visible / castShadow / draw LOD / fur shells / animation rate) is measured from it; the AI, the
   * hitboxes and the footfalls stay on `playerPos`. Explore parks the player 3 km away, so a player-measured cull
   * hid every animal there. `camera`: the view — the far herd skips the far animals outside it (PH-P2).
   */
  /** E322 F-L4: every moving animal within 70 m of the player parts the grass and flattens a track (Nalati's trample map) */
  private trampleGrass(p: THREE.Vector3): void {
    for (const a of this.animals) {
      if (!a.alive || a.hidden || Math.abs(a.speed) < 0.4) continue;
      const dx = a.position.x - p.x, dz = a.position.z - p.z;
      if (dx * dx + dz * dz > 70 * 70) continue;
      const r = speciesDef(a.kind).trampleRadius ?? 0.4;
      app.world.trample?.push(a.position.x, a.position.z, r, Math.min(1, 0.35 + Math.abs(a.speed) / 5), Math.sin(a.yaw) * a.speed, Math.cos(a.yaw) * a.speed);
    }
  }

  update(dt: number, t: number, playerPos: THREE.Vector3, playerSprinting = false, viewPos: THREE.Vector3 = playerPos, camera: THREE.PerspectiveCamera | null = null): void {
    this.playerPos.copy(playerPos);
    this.playerSprinting = playerSprinting;
    this.scheduler.beginFrame(dt, playerPos);
    this.clock += dt;
    if (app.world.trample !== null && !practiceRoom.open) this.trampleGrass(playerPos); // E322 F-L4: Pine Hollow's grass trample
    // hitboxes posed from last frame's bones, bodies handed out / back by distance (PHYSICS P6)
    this.bodiesFor()?.sync(this.animals, playerPos);
    // Decisions and bodies have independent per-subject clocks; the free camera never wakes a herd.
    const n = this.animals.length;
    if (dt > 0) {
      // the player's ground speed (m/s) is the noise they make: still / crouch / walk / sprint
      if (!this.playerInit) { this.playerPrev.copy(playerPos); this.playerInit = true; }
      const moved = Math.hypot(playerPos.x - this.playerPrev.x, playerPos.z - this.playerPrev.z);
      this.playerPrev.copy(playerPos);
      this.playerSpeed += (Math.min(moved / dt, 9) - this.playerSpeed) * (1 - 0.5 ** (dt * 10));
      this.repaths = 0;
      if (this.rules !== null) this.tokens.sweep(this.stillAttacking); // E297: the tokens of attacks that are over go back
      const t0 = frameCost.on ? performance.now() : 0;
      if (this.dodgeId !== dodgeFx.id) { this.dodgeId = dodgeFx.id; this.interruptTargets('target.dodge'); }
      for (const a of this.animals) {
        if (a.simulationBound || a.harnessHold || a.hidden) { this.scheduler.forget(a); continue; }
        const rate = this.tickRate(a);
        if (a.alive && a.aggressive && (a.state === 'charge' || a.state === 'stalk' || a.state === 'alert')) {
          const seen = this.canReach(a, playerPos);
          if (this.visibility.get(a) === true && !seen) this.scheduler.interrupt(a, 'lost.sight');
          this.visibility.set(a, seen);
        }
        const brainDt = this.scheduler.takeBrainDt(rate, a);
        if (brainDt > 0) this.think(a, brainDt, playerPos, playerSprinting);
      }
      if (frameCost.on) frameCost.sub('think', t0);
    }
    // fur shells: pick the SHELL_MAX nearest animals inside SHELL_DIST (tiny insertion sort, no allocs)
    const sd = this.shellDist, si = this.shellIdx;
    sd.fill(Infinity); si.fill(-1);
    const farD = TIER_CONFIG.animalFarBatchDist, far2 = farD > 0 ? farD * farD : Infinity;
    if (farD > 0) this.farHerd.begin(camera);
    const herdShadows = (this.shadowBatch ?? TIER_CONFIG.animalShadowBatch) && this.pbr;
    if (herdShadows) this.shadowHerd.begin(null);
    const poseT0 = frameCost.on ? performance.now() : 0;
    for (let i = 0; i < n; i++) {
      const a = this.animals[i];
      if (a === undefined || a.hidden) continue;
      const d2 = a.position.distanceToSquared(viewPos);
      const near = d2 < ANIM_LOD * ANIM_LOD;
      const bodyDt = a.harnessHold ? 0 : a.simulationBound ? dt : this.scheduler.bodyDt(this.tickRate(a), a);
      if (bodyDt > 0) {
        if (!a.simulationBound && a.alive && !a.stunned && a.state === 'charge' && speciesDef(a.kind).think === undefined) this.advanceCharge(a, bodyDt, playerPos);
        const act = speciesDef(a.kind).act;
        if (!a.simulationBound && act !== undefined && a.alive && !a.stunned) act(a, this.customContext(a, bodyDt, playerPos, this.playerSprinting));
        a.update(bodyDt, t, near);
        if (!a.simulationBound && a.alive) killBelowWorld(a, activeLevel().world, app.combat);
        if (!a.simulationBound && this.melee && a.state === 'charge' && a.alive && !a.stunned) this.chargeContact(a, playerPos);
        if (!a.simulationBound && this.rules !== null && a.alive && a.position.distanceToSquared(playerPos) < 36) this.clearBody(a, playerPos);
      }
      // draw / shadow distance by tier: a deer at 150 m is a few pixels on a phone, and only near animals shadow
      // … shrinking away over the last 15 % of the draw distance rather than blinking out at it (E117: no pop)
      const hide = TIER_CONFIG.animalHideDist;
      const fade = d2 < (hide * 0.85) ** 2 ? 1 : Math.max(0, Math.min(1, (hide - Math.sqrt(d2)) / (hide * 0.15)));
      a.mesh.visible = fade > 0;
      const sc = a.scale * fade * fade * (3 - 2 * fade);
      if (a.mesh.scale.x !== sc) a.mesh.scale.setScalar(sc);
      const fr = this.farRigs.get(a);
      // the rig's cull sphere: the model's bind-pose sphere + 0.6 m, as AnimalFactory.instantiate pads it
      const radius = fr === undefined ? 0 : ((fr.model.geometry.boundingSphere?.radius ?? 3) + 0.6) * a.scale;
      // the far herd draws it (or leaves it out of view): the rig's layers go to 0 — it is not drawn, what hangs on its
      // bones still is (the King's kit, a stuck bolt)
      // a generated hull (one group, no shells, no draw LOD) is the same pixels in the batch at any distance (desktop:
      // animalHullBatch); a procedural rig only once it is one draw (past animalOneDrawDist ≤ animalFarBatchDist)
      const from2 = fr?.model.hull !== undefined && TIER_CONFIG.animalHullBatch && herdShadows ? 0 : far2; // its shadow: the shadow herd
      const batched = fr !== undefined && farD > 0 && a.mesh.visible && d2 >= from2 && !a.fading && this.farHerd.take(fr, a.position, radius);
      if (fr !== undefined) {
        if (batched && fr.mask === null) { fr.mask = a.mesh.layers.mask; a.mesh.layers.mask = 0; }
        else if (!batched && fr.mask !== null) { a.mesh.layers.mask = fr.mask; fr.mask = null; }
      }
      // shadows within animalShadowDist: one draw per model per cascade (the shadow herd), else the rig's own caster
      let cast = d2 < TIER_CONFIG.animalShadowDist * TIER_CONFIG.animalShadowDist;
      if (cast && herdShadows && fr !== undefined && a.mesh.visible && !a.fading && this.shadowHerd.take(fr, a.position, radius)) cast = false;
      (this.casters.get(a) ?? a.mesh).castShadow = cast;
      a.setDrawLod(d2 < TIER_CONFIG.animalEyeDist * TIER_CONFIG.animalEyeDist ? 0 : d2 < TIER_CONFIG.animalOneDrawDist * TIER_CONFIG.animalOneDrawDist ? 1 : 2);
      if (TIER_CONFIG.furShells && d2 < SHELL_DIST * SHELL_DIST) {
        for (let k = 0; k < SHELL_MAX; k++) if (d2 < (sd[k] ?? Infinity)) {
          for (let m = SHELL_MAX - 1; m > k; m--) { sd[m] = sd[m - 1] ?? Infinity; si[m] = si[m - 1] ?? -1; }
          sd[k] = d2; si[k] = i; break;
        }
      }
    }
    if (frameCost.on) frameCost.sub('pose', poseT0);
    if (farD > 0) this.farHerd.end();
    if (herdShadows) this.shadowHerd.end();
    for (let i = 0; i < n; i++) {
      let level = 0;
      for (let k = 0; k < SHELL_MAX; k++) if (si[k] === i) { const d = Math.sqrt(sd[k] ?? Infinity); level = d < 6 ? 8 : d < 11 ? 6 : 4; }
      this.animals[i]?.setShellLevel(level);
    }
    this.blood.update(worldTime.realDt || dt); // blood keeps flying through a hit-stop (worldTime, Game.hitStop)
    if (this.debug) this.updateDebug();
  }

  private tickRate(a: Animal): string {
    if (a.driven || a.state === 'sidestep' || brainPinned(a)) return 'always';
    const species = speciesDef(a.kind);
    return species.tick ?? (species.think === undefined ? 'ai' : 'legacy');
  }

  /** Hit/target edges bypass the decision interval, including for a far animal. */
  interrupt(a: Animal, why: InterruptReason): void {
    if (a.simulationBound || a.hidden || a.harnessHold || !a.alive || (speciesDef(a.kind).think !== undefined && speciesDef(a.kind).tick === undefined)) return;
    this.scheduler.interrupt(a, why);
  }
  private interruptTargets(why: InterruptReason): void {
    for (const a of this.animals) if (a.aggressive || this.brains.get(a)?.sensed) this.interrupt(a, why);
  }

  private advanceCharge(a: Animal, dt: number, player: THREE.Vector3): void {
    const br = this.brains.get(a); if (!br) return;
    const sp = speciesDef(a.kind), M = a.mods, T = this.tuningFor(a);
    const dx = player.x - a.position.x, dz = player.z - a.position.z, dPlayer = Math.hypot(dx, dz);
    if (br.windup > 0) {
      // melee shard: the telegraph — stand, face the player, head down, paw (Animal.poseWindup); then run
      br.windup -= dt;
      a.setMotion(Math.atan2(dx, dz), 0, 3.0);
      a.lookTarget.copy(player); a.lookWeight = 1;
      if (br.windup <= 0) { br.windup = 0; a.cancelAttack(); }
      return;
    }
    br.timer -= dt;
    // melee shards: the last CHARGE_COMMIT m are committed (it can barely turn) — a late sidestep makes it thunder past
    if (this.melee && dPlayer < CHARGE_COMMIT) this.steer(a, Math.atan2(dx, dz), (sp.chargeSpeed ?? BOAR_CHARGE) * M.speed, CHARGE_COMMIT_TURN); // the committed stretch: straight
    else this.steerTo(a, br, player.x, player.z, (sp.chargeSpeed ?? BOAR_CHARGE) * M.speed, 4.0, 0.3);
    a.lookTarget.copy(player); a.lookWeight = 0.5;
    const after: Animal['state'] = T.stalk !== undefined ? 'stalk' : 'flee';   // a hunter keeps pressing; a boar wheels away
    if (dPlayer < CHARGE_COMMIT) br.committed = true;
    // E297: a charge you sidestepped thunders past and is over — it backs off and comes round again, not a U-turn into you
    const passed = this.rules !== null && br.committed && dPlayer > CHARGE_COMMIT && !this.facing(a, player, CHARGE_ARC);
    if (!this.melee && dPlayer < CHARGE_HIT_DIST * Math.max(1, a.scale) && this.canReach(a, player)) this.chargeHit(a, br);   // melee shards connect per frame on an arc (chargeContact)
    else if (br.timer <= 0 || passed) {
      br.chargeCd = this.rules !== null ? RULES_CD_MISS : T.stalk !== undefined ? T.stalk.rechargeCd : M.relentless ? 1.5 : 4;
      this.enter(a, br, after);
    }
    this.confine(a);
  }

  /** Decision and body callbacks share exactly the same sensing/reach/director ports. */
  private customContext(a: Animal, dt: number, player: THREE.Vector3, sprinting: boolean): ThinkCtx {
    const c = this.thinkCtx, herd = a.herd >= 0 ? this.herds[a.herd] ?? null : null;
    c.dt = dt; c.t = app.clock.now; c.player = player; c.playerSpeed = sprinting ? 7.2 : this.playerSpeed;
    c.calm = this.unaware; c.herd = herd?.members ?? null; c.world = this.enemyWorld;
    c.hurt = (damage) => { if ((!this.melee || this.facing(a, player, HURT_ARC)) && this.canReach(a, player)) this.onCharge?.(a, damage); };
    c.sound = (name) => { this.onSound?.(name, a.position); };
    return c;
  }

  private think(a: Animal, dt: number, player: THREE.Vector3, sprinting: boolean): void {
    if (a.simulationBound) return;
    const br = this.brains.get(a);
    if (br === undefined) throw new Error(`AnimalManager: ${a.kind} has no brain (not spawned through spawn())`);
    const self = speciesDef(a.kind).think;
    if (self !== undefined) {
      // a self-thinking species (the island's enemies): its own tick, its own reactions, its own bounds
      if (!a.alive) {
        a.lookWeight = 0;
        const fade = speciesDef(a.kind).corpseFade;
        if (fade && !a.hidden && performance.now() - a.lastHitT > fade * 1000) a.fadeOut();
        return;
      }
      if (a.stunned) { a.setMotion(a.yaw, 0, 1); a.setStrafe(0); a.lookTarget.copy(player); a.lookWeight = 1; return; }
      const c = this.customContext(a, dt, player, sprinting);
      const herd = a.herd >= 0 ? this.herds[a.herd] ?? null : null;
      a.sampleTerrain();
      self(a, c);
      if (herd !== null) this.updateHerd(herd);
      return;
    }
    if (!a.alive) { a.lookWeight = 0; return; }   // the corpse is a ragdoll (PHYSICS P8) or the keyframed collapse: nothing to think
    if (a.stunned) { br.chargeCd = Math.max(0, br.chargeCd - dt); a.setMotion(a.yaw, 0, 1); a.lookTarget.copy(player); a.lookWeight = 1; this.confine(a); return; }   // staggered by a sword blow (Animal.stagger): the AI holds (the charge cooldown still ticks)
    const rng = this.rng;
    const sp = speciesDef(a.kind);
    const charger = a.aggressive;                 // charges instead of only fleeing
    const T = this.tuningFor(a);
    const M = a.mods;
    const dx = player.x - a.position.x, dz = player.z - a.position.z;
    const dPlayer = Math.hypot(dx, dz);
    br.chargeCd = Math.max(0, br.chargeCd - dt);
    br.wary = Math.max(0, br.wary - dt);
    a.sampleTerrain();

    // ── senses → awareness meter ──
    // sight: inside the cone around the body heading, further when the head is up; a still player is far harder to spot
    const wary = br.wary > 0 ? T.waryBoost : 1;
    const pSpeed = sprinting ? 7.2 : this.playerSpeed;
    let rate = 0;
    if (!this.unaware && dPlayer > 0.01) {
      const grazing = a.state === 'graze';
      const sight = (grazing ? T.sightRangeGraze : T.sightRange) * wary;
      if (dPlayer < sight) {
        let rel = Math.atan2(dx, dz) - a.yaw;
        rel = Math.atan2(Math.sin(rel), Math.cos(rel));
        if (Math.abs(rel) < T.sightCone) {
          const still = pSpeed < 0.4 ? 0.3 : pSpeed < 2.6 ? 0.7 : 1;
          rate = Math.max(rate, T.noticeRate * (1 + (1 - dPlayer / sight)) * still);
        }
      }
      // hearing: any direction, radius from the noise the player makes
      const hear = (pSpeed < 0.4 ? T.hearStill : pSpeed < 2.6 ? T.hearCrouch : pSpeed < 5.2 ? T.hearWalk : T.hearSprint) * wary;
      if (dPlayer < hear) rate = Math.max(rate, T.noticeRate * 1.5 * (1 + (1 - dPlayer / hear)));
      if (T.stalk !== undefined && dPlayer < T.stalk.detect) rate = Math.max(rate, T.noticeRate * 3);   // a hunter smells you
    }
    br.sensed = rate > 0;
    br.awareness = br.sensed ? Math.min(1, br.awareness + rate * dt) : Math.max(0, br.awareness - T.forgetRate * dt);
    const panic = !this.unaware && dPlayer < T.panicDist * (charger ? M.chargeDist : 1);   // for chargers this is the charge trigger

    // ambient calls
    br.callT -= dt;
    if (br.callT <= 0) {
      const every = sp.sounds?.callEvery;
      br.callT = every !== undefined ? rng.range(every[0], every[1]) : rng.range(20, 90);
      // species may limit the call to some variants (elk: only bulls bugle) and it is a CALM sound — not mid-flight
      const caller = sp.sounds?.callVariants === undefined || sp.sounds.callVariants.includes(a.variant);
      if (caller && dPlayer < 80 && a.state !== 'flee' && a.state !== 'charge') this.onSound?.((sp.sounds?.call ?? fallbackSound(charger, 'call')), a.position);
    }

    const herd = a.herd >= 0 ? this.herds[a.herd] ?? null : null;
    // the player is inside the charge distance: chargers charge (hunters stalk while the charge cools down), the rest bolt
    const engage = (): void => { if (charger && br.chargeCd <= 0) this.enter(a, br, 'charge'); else if (T.stalk !== undefined) this.enter(a, br, 'stalk'); else { br.spooked = true; this.enter(a, br, 'flee'); } };

    switch (a.state) {
      case 'idle': case 'graze': case 'wander': {
        if (panic) { engage(); break; }
        if (br.awareness >= T.alertAt) { this.enter(a, br, 'alert'); break; }
        br.timer -= dt;
        if (a.state === 'wander') {
          const tdx = br.tx - a.position.x, tdz = br.tz - a.position.z;
          const td = Math.hypot(tdx, tdz);
          if (td < 1.2 || br.timer <= 0) { this.enter(a, br, rng.next() < 0.6 ? 'graze' : 'idle'); break; }
          this.steerTo(a, br, br.tx, br.tz, sp.walkSpeed ?? (charger ? CHARGER_WALK : GRAZER_WALK), 1.8, 4);
        } else {
          a.setMotion(a.desiredYaw, 0, 1.5);
          if (br.timer <= 0) {
            const r = rng.next();
            if (r < 0.45) this.enter(a, br, 'wander'); else this.enter(a, br, r < 0.8 ? 'graze' : 'idle');
          }
        }
        // a half-noticed player gets glances (awareness creeping up); otherwise the odd look around
        a.lookWeight = br.awareness > 0.12 ? 0.6 : dPlayer < 55 && Math.sin(a.seed * 20 + performance.now() * 0.0004) > 0.7 ? 0.4 : 0;
        a.lookTarget.copy(player);
        break;
      }
      case 'alert': {
        // head up, frozen, staring at you: the shot window
        a.setMotion(a.desiredYaw, 0, 2.0);
        a.lookTarget.copy(player); a.lookWeight = 1;
        br.freeze -= dt;
        if (panic) { engage(); break; }
        if (br.freeze <= 0 && (br.spooked || br.awareness >= T.boltAt)) {
          if (T.stalk === undefined) { this.enter(a, br, 'flee'); break; }
          // a hunter comes for you instead — unless it is nearly dead (it stands and watches), or you are out of reach
          const wounded = !M.relentless && a.hp / a.maxHp < T.stalk.fleeBelowHp;
          if (!wounded && dPlayer < T.impactAlert) this.enter(a, br, 'stalk');
          else { br.spooked = false; br.awareness = Math.min(br.awareness, T.alertAt * 0.5); this.enter(a, br, 'graze'); }
          break;
        }
        if (br.sensed) br.timer = T.relaxAfter;
        else { br.timer -= dt; if (br.timer <= 0) { br.spooked = false; br.awareness = Math.min(br.awareness, T.alertAt * 0.5); this.enter(a, br, 'graze'); } }
        break;
      }
      case 'flee': {
        br.fleeT += dt;
        // run away, biased back toward the herd's side of the map and away from the chunk edge
        let ax = -dx / (dPlayer + 1e-3), az = -dz / (dPlayer + 1e-3);
        if (herd !== null) { const hx = herd.cx - a.position.x, hz = herd.cz - a.position.z, hd = Math.hypot(hx, hz) + 1e-3; if (hd > 25) { ax += hx / hd * 0.35; az += hz / hd * 0.35; } }
        const farEnough = dPlayer > br.fleeUntil;
        const done = br.fleeT > T.fleeMaxTime || (br.fleeT > T.fleeMinTime && farEnough);
        if (done) { this.enter(a, br, 'alert'); br.freeze = T.lookBack; br.spooked = false; br.timer = T.relaxAfter; break; }
        // gallop, easing to a trot for the last stretch
        const speed = (dPlayer > br.fleeUntil * 0.8 && br.fleeT > T.fleeMinTime ? T.trotSpeed : T.runSpeed * (0.92 + 0.08 * Math.sin(a.seed * 9))) * M.speed;
        const al = Math.hypot(ax, az) + 1e-3;
        this.steerTo(a, br, a.position.x + ax / al * 20, a.position.z + az / al * 20, speed, 3.5, 1);
        a.lookWeight = 0;
        break;
      }
      case 'stalk': {
        // hunters only: walk the player down, huffing, and charge once inside panicDist (again after rechargeCd)
        const st = T.stalk;
        if (st === undefined) throw new Error(`AnimalManager: ${a.kind} is stalking without HuntTuning.stalk`);
        if (this.unaware || dPlayer > st.giveUp) { br.awareness = 0; br.spooked = false; br.backoff = 0; this.enter(a, br, 'wander'); break; }
        if (this.rules !== null) { if (this.circle(a, br, player, dPlayer, st.speed * M.speed, dt)) break; }
        else {
          if (panic && br.chargeCd <= 0) { this.enter(a, br, 'charge'); break; }
          this.steerTo(a, br, player.x, player.z, st.speed * M.speed, 2.5, 0.4);
          a.lookTarget.copy(player); a.lookWeight = 1;
        }
        br.timer -= dt;
        if (br.timer <= 0) { br.timer = rng.range(st.huffMin, st.huffMax); if (dPlayer < 80) this.onSound?.((sp.sounds?.call ?? fallbackSound(true, 'call')), a.position); }
        break;
      }
      case 'charge': break; // Wind-up, movement and contact run on the body clock.
      case 'attack': case 'dead': case 'hide': case 'perch': case 'rise': case 'sidestep': break;
      // no default
    }
    // keep every animal inside the chunk / off steep ground / out of trunks
    this.confine(a);
    if (herd !== null) this.updateHerd(herd);
  }

  /** a charge reached the player: the damage, the grunt, the cooldown, and back to stalk (hunters) / flee (a boar wheels away) */
  private chargeHit(a: Animal, br: Brain): void {
    const T = this.tuningFor(a), sp = speciesDef(a.kind);
    this.onCharge?.(a, a.mods.chargeDamage);
    this.onSound?.((sp.sounds?.call ?? fallbackSound(true, 'call')), a.position);
    br.chargeCd = this.rules !== null ? Math.max(RULES_CD_HIT, T.stalk?.rechargeCd ?? 0) : T.stalk !== undefined ? T.stalk.rechargeCd : a.mods.relentless ? 2 : 6;   // Old Ironhide wheels round and comes again
    this.enter(a, br, T.stalk !== undefined ? 'stalk' : 'flee');
  }

  /** melee shards, every frame: a running charge connects when it reaches the player AND the player is inside CHARGE_ARC of its heading */
  private chargeContact(a: Animal, player: THREE.Vector3): void {
    const br = this.brains.get(a);
    if (br === undefined || br.windup > 0) return;
    const dx = player.x - a.position.x, dz = player.z - a.position.z;
    const reach = CHARGE_HIT_DIST * Math.max(1, a.scale);
    if (dx * dx + dz * dz > reach * reach || Math.abs(player.y - a.position.y) > 2.5) return;
    if (!this.facing(a, player, CHARGE_ARC)) return; // it runs past a player who stepped aside
    if (!this.canReach(a, player)) return;           // nor through a wall, a rock or a deck (E296)
    this.chargeHit(a, br);
  }

  /** E297: the ring a charger circles on (m from the player): RING by kind, a little wider for a big one */
  private ringFor(a: Animal): number { return (speciesDef(a.kind).ringRadius ?? RING_DEFAULT) * Math.max(1, a.scale * 0.6); }

  /** E297: back off past the ring (fightRules.backoffPoint), arcing round you — the other way from last time */
  private startBackoff(a: Animal, br: Brain): void {
    br.side = -br.side;
    backoffPoint(this.playerPos.x, this.playerPos.z, a.position.x, a.position.z, this.ringFor(a), br.side, _ring);
    br.tx = _ring.x; br.tz = _ring.z; br.backoff = BACKOFF_MAX_T;
  }

  /**
   * E297 fight rules, the engaged charger's think (its 'stalk'): the back-off after a charge, then round and round on the
   * ring facing you until `reengage` says charge — it turns square to you first, then winds up (enter 'charge' takes the
   * token; none free → it keeps circling). Closer than the ring it steps back out; further, it closes at `speed`.
   * True when it charged (left the stalk).
   */
  private circle(a: Animal, br: Brain, player: THREE.Vector3, d: number, speed: number, dt: number): boolean {
    a.lookTarget.copy(player);
    if (br.backoff > 0) {
      br.backoff -= dt;
      if (br.backoff > 0 && Math.hypot(br.tx - a.position.x, br.tz - a.position.z) > 1.2) {
        this.steerTo(a, br, br.tx, br.tz, BACKOFF_SPEED * a.mods.speed, 4.5, 0.5);
        a.lookWeight = 0.5;
        return false;
      }
      br.backoff = 0;
    }
    a.lookWeight = 1;
    const T = this.tuningFor(a), ring = this.ringFor(a);
    const next = reengage({ hpFrac: a.hp / a.maxHp, relentless: a.mods.relentless, roll: 1, ready: br.chargeCd <= 0, token: this.tokens.free(a), dist: d, chargeDist: Math.max(T.panicDist * a.mods.chargeDist, ring + 2), hit: false });
    const toPlayer = Math.atan2(player.x - a.position.x, player.z - a.position.z);
    if (next === 'charge') {
      if (this.facing(a, player, FACE_BEFORE_CHARGE)) { this.enter(a, br, 'charge'); return a.state === 'charge'; }
      a.setMotion(toPlayer, 0, 4.0); // square up to you first: the wind-up reads as aimed at you
      return false;
    }
    if (d > ring + 2) this.steerTo(a, br, player.x, player.z, speed, 3.0, 0.4);
    else if (d < ring - 2) { aroundPoint(player.x, player.z, a.position.x, a.position.z, ring, br.side * 0.5, _ring); this.steerTo(a, br, _ring.x, _ring.z, speed, 3.5, 0.3); }
    else {
      // on the ring: walk round you (a step ahead along the ring), head turned to you
      aroundPoint(player.x, player.z, a.position.x, a.position.z, ring, br.side * 0.45, _ring);
      this.steerTo(a, br, _ring.x, _ring.z, CIRCLE_SPEED * a.mods.speed, 3.0, 0.3);
    }
    return false;
  }

  /** E297: a big animal's body never swallows the camera (the module's `clearBody`). Self-thinking species keep their own spacing. */
  private clearBody(a: Animal, player: THREE.Vector3): void {
    if (a.hidden || speciesDef(a.kind).think !== undefined) return;
    clearBody(a, player);
  }

  /**
   * E296: nothing solid between `a` and the player — the physics `lineOfSight` from the player's chest to the attacker's
   * (its body centre; on a tall one halfway up to the head, LockOnTarget's aim point), which only counts a world surface
   * short of the attacker's own body (so one brushing a wall, or a big one half inside a rock, still reaches you). Creatures
   * never block. Asked on the frame a hit would land (and by `ThinkCtx.reach` before a swing): one ray, not per frame.
   */
  private canReach(a: Animal, player: THREE.Vector3): boolean { return canReach(a, player, app.physics); }

  /** the player is within ±`arc` of the animal's heading */
  private facing(a: Animal, player: THREE.Vector3, arc: number): boolean {
    let rel = Math.atan2(player.x - a.position.x, player.z - a.position.z) - a.yaw;
    rel = Math.atan2(Math.sin(rel), Math.cos(rel));
    return Math.abs(rel) <= arc;
  }

  private thinkCtx: ThinkCtx = {
    dt: 0.1, t: 0, player: new THREE.Vector3(), playerSpeed: 0, rng: this.rng, calm: false, herd: null,
    hurt: () => undefined, sound: () => undefined, world: {}, heightAt, waterLevel,
    steer: (a, yaw, speed, turnRate) => { if (this.navSteer) this.steerNav(a, yaw, speed, turnRate); else this.steer(a, yaw, speed, turnRate); },
    flight: { steer: (a, yaw, speed, altitude, turnRate) => { a.fly(yaw, speed, altitude, turnRate); } },
    pathYaw: (a, tx, tz, every = 1) => { const br = this.brains.get(a); return br === undefined ? Math.atan2(tx - a.position.x, tz - a.position.z) : this.pathYaw(a, br, tx, tz, every); },
    confine: (a) => this.confine(a),
    reach: (a) => this.canReach(a, this.thinkCtx.player),
    claim: (a) => app.events.ask('ai.claim', a),
    mayAttack: (a) => app.events.ask('ai.mayAttack', a),
  };

  private enter(a: Animal, br: Brain, s: Animal['state']): void {
    const rng = this.rng;
    const T = this.tuningFor(a);
    const sp = speciesDef(a.kind);
    const from = a.state;
    if (this.rules !== null) {
      if (s === 'charge' && !this.tokens.take(a)) {
        // E297: two others are attacking — it holds back on the ring (a charger without a stalk holds its alert)
        if (T.stalk !== undefined) { if (from !== 'stalk') this.enter(a, br, 'stalk'); }
        else if (from !== 'alert') this.enter(a, br, 'alert');
        return;
      }
      if (from === 'charge' && s !== 'charge') {
        this.tokens.release(a);
        br.windup = 0; br.committed = false;
        if (s === 'stalk') this.startBackoff(a, br);   // after every charge: back off past the ring, then come round again
      }
    }
    a.state = s;
    switch (s) {
      case 'idle': br.timer = rng.range(3, 7); a.setMotion(a.desiredYaw, 0, 1.5); break;
      case 'graze': br.timer = rng.range(6, 14); a.setMotion(a.desiredYaw, 0, 1.5); break;
      case 'wander': {
        const herd = a.herd >= 0 ? this.herds[a.herd] ?? null : null;
        let ok = false;
        const nav = app.navmesh;
        const goal = app.events.ask('creature.wander-goal', { herd: a.herd, goal: this.wanderGoal?.(a) ?? null }).goal;
        if (goal !== null && nav !== null) {
          const t = nav.randomPointNear(_navFrom.set(goal.x, heightAt(goal.x, goal.z), goal.z), goal.r, this.agentRadius(a), () => rng.next(), _navTo);
          if (t !== null && inChunk(t.x, t.z, 20)) { br.tx = t.x; br.tz = t.z; ok = true; }
        }
        if (nav !== null && !ok) {
          // a reachable point 5–25 m away on the navmesh; a straggler > 15 m from its herd wanders back toward the centre
          const far = herd !== null && Math.hypot(a.position.x - herd.cx, a.position.z - herd.cz) > 15;
          const origin = herd !== null && far ? _navFrom.set(herd.cx, heightAt(herd.cx, herd.cz), herd.cz) : a.position;
          const t = nav.randomPointNear(origin, far ? 10 : rng.range(5, 25), this.agentRadius(a), () => rng.next(), _navTo);
          if (t !== null && inChunk(t.x, t.z, 20)) { br.tx = t.x; br.tz = t.z; ok = true; }
        }
        for (let i = 0; i < 12 && !ok; i++) {
          const ang = rng.range(0, Math.PI * 2), r = rng.range(5, 25);
          let tx = a.position.x + Math.cos(ang) * r, tz = a.position.z + Math.sin(ang) * r;
          if (herd !== null) { // stay within ~15 m of the herd centre
            const hx = tx - herd.cx, hz = tz - herd.cz, hd = Math.hypot(hx, hz);
            if (hd > 15) { tx = herd.cx + hx / hd * 14; tz = herd.cz + hz / hd * 14; }
          }
          if (!inChunk(tx, tz, 20) || normalAt(tx, tz)[1] < 0.78 || cabinMask(tx, tz) > 0 || !this.isDry(tx, tz)) continue;
          if (this.forest.nearby(tx, tz, 1.0).length > 0) continue;
          br.tx = tx; br.tz = tz; ok = true;
        }
        if (!ok) { a.state = 'idle'; br.timer = 2; break; }
        br.timer = rng.range(8, 20) + (goal !== null ? Math.hypot(br.tx - a.position.x, br.tz - a.position.z) : 0); // a goal: time to walk there
        break;
      }
      case 'alert':
        br.freeze = rng.range(T.freezeMin, T.freezeMax); br.timer = T.relaxAfter;
        a.setMotion(a.desiredYaw, 0, 2);
        if (a.aggressive && rng.next() < 0.5) this.onSound?.((sp.sounds?.call ?? fallbackSound(true, 'call')), a.position);
        // one head coming up makes the herd glance (awareness nudge) — only a BOLT brings every head up (alertHerd)
        if (from !== 'flee' && from !== 'alert') this.alertHerd(a, false);
        break;
      case 'flee':
        br.fleeT = 0; br.fleeUntil = rng.range(T.fleeUntil, T.fleeUntilMax);
        br.wary = T.waryTime; br.awareness = 1; br.spooked = false;
        if (!a.aggressive && rng.next() < 0.3) this.onSound?.((sp.sounds?.call ?? fallbackSound(false, 'call')), a.position);
        if (from !== 'charge') this.alertHerd(a, true);
        break;
      case 'stalk':
        br.timer = 0.4; br.wary = T.waryTime; br.awareness = 1; br.spooked = false;
        break;
      case 'charge':
        br.timer = a.mods.relentless ? 12 : 4; br.wary = T.waryTime; br.committed = false; br.backoff = 0;
        // melee shard: the charge opens with a readable wind-up (think 'charge'; the roar below is its cue)
        br.windup = this.melee ? sp.chargeWindup ?? CHARGE_WINDUP_DEFAULT : 0;
        if (br.windup > 0) { a.startAttack(br.windup); a.setMotion(a.yaw, 0, 3); }
        this.onSound?.((T.stalk?.roar ?? sp.sounds?.call ?? fallbackSound(true, 'call')), a.position);
        break;
      case 'attack': case 'dead': case 'hide': case 'perch': case 'rise': case 'sidestep': break;
      // no default
    }
  }

  /**
   * Herd-mates within herdAlertRadius: `bolt` = one of them is running, so they all come up alert and run too a beat
   * later; otherwise (a head came up) they only get a nudge of awareness — a sentry freezing must not empty the
   * clearing, or there is never a shot.
   */
  private alertHerd(a: Animal, bolt: boolean): void {
    if (a.herd < 0) return;
    const herd = this.herds[a.herd];
    if (herd === undefined) return;
    const T = this.tuningFor(a);
    const r2 = T.herdAlertRadius * T.herdAlertRadius;
    for (const m of herd.members) {
      if (m === a || !m.alive) continue;
      if (m.position.distanceToSquared(a.position) > r2) continue;
      const mb = this.brains.get(m);
      if (mb === undefined) continue;
      if (m.state === 'flee' || m.state === 'charge' || m.state === 'stalk') continue;
      if (!bolt) { mb.awareness = Math.min(T.alertAt * 0.7, mb.awareness + 0.12); continue; }
      if (m.state !== 'alert') { mb.awareness = Math.max(mb.awareness, T.alertAt); this.enter(m, mb, 'alert'); }
      mb.spooked = true; mb.freeze = Math.min(mb.freeze, this.rng.range(T.herdBoltDelayMin, T.herdBoltDelayMax));
    }
  }

  /**
   * Something loud landed at `point` (a bolt in a tree or the dirt): animals within impactSpook m bolt after a
   * short start, within impactAlert m their heads come up. `strength` scales both radii (1 = a bolt).
   */
  disturb(point: THREE.Vector3, strength = 1): void {
    if (this.unaware) return;
    for (const a of this.animals) {
      if (!a.alive) continue;
      const T = this.tuningFor(a);
      const d = Math.hypot(point.x - a.position.x, point.z - a.position.z);
      if (d > T.impactAlert * strength) continue;
      const br = this.brains.get(a);
      if (br === undefined) continue;
      if (a.state === 'flee' || a.state === 'charge' || a.state === 'stalk') continue;
      if (a.state !== 'alert') { br.awareness = Math.max(br.awareness, T.alertAt); this.enter(a, br, 'alert'); }
      if (d < T.impactSpook * strength) { br.spooked = true; br.freeze = Math.min(br.freeze, 0.25); }
      else br.awareness = Math.min(1, br.awareness + 0.3);
    }
  }

  /** the creature's navmesh layer radius — the same size as its physics body (src/engine/physics/creatures.ts) */
  private agentRadius(a: Animal): number {
    return THREE.MathUtils.clamp(Math.min(a.dims.bodyRadius, a.dims.bodyHalfLen) * a.scale, 0.12, 0.9);
  }

  private repaths = 0;
  /** seconds of world time (the path re-plan timers run on it) */
  private clock = 0; // path searches this think tick (capped: a herd bolting at once doesn't search 20 paths in one tick)

  /**
   * Head for (tx, tz) along the navmesh (PHYSICS P6b): re-path when the goal moved > 2 m or every `every` s, follow the
   * path's corners, and let the physics body resolve the last metre. Without a navmesh (dev scenes, an old build):
   * the straight heading through `steer`'s trunk / slope / edge bending, as before.
   */
  private steerTo(a: Animal, br: Brain, tx: number, tz: number, speed: number, turnRate: number, every: number): void {
    if (app.navmesh === null) { this.steer(a, Math.atan2(tx - a.position.x, tz - a.position.z), speed, turnRate); return; }
    a.setMotion(this.pathYaw(a, br, tx, tz, every), speed, turnRate);
  }

  /**
   * The heading toward (tx, tz) along the navmesh: the next corner of the path there (re-planned when the goal moved
   * > 2 m or every `every` s — at most 8 plans a think tick), the straight heading without a navmesh or a path.
   */
  private pathYaw(a: Animal, br: Brain, tx: number, tz: number, every: number): number {
    const nav = app.navmesh;
    if (nav === null) return Math.atan2(tx - a.position.x, tz - a.position.z);
    const now = this.clock;
    const stale = br.path.length === 0 || Math.hypot(tx - br.goalX, tz - br.goalZ) > 2 || now >= br.repathAt;
    if (stale && this.repaths < 8) {
      this.repaths++;
      _navTo.set(tx, heightAt(tx, tz), tz);
      const p = nav.findPath(a.position, _navTo, this.agentRadius(a), br.path);
      if (p === null) br.path.length = 0;
      br.pathI = 0; br.goalX = tx; br.goalZ = tz; br.repathAt = now + every;
    }
    while (br.pathI < br.path.length) {
      const c = br.path[br.pathI];
      if (c === undefined || Math.hypot(c.x - a.position.x, c.z - a.position.z) > 0.8) break;
      br.pathI++;
    }
    const c = br.path[br.pathI];
    const aimX = c === undefined ? tx : c.x, aimZ = c === undefined ? tz : c.z;
    return Math.atan2(aimX - a.position.x, aimZ - a.position.z);
  }

  /**
   * A shard's own thinkers steer by the navmesh (Nalati: `navSteer`, set by src/shards/nalati-grasslands/index.ts — NALATI-MERGE P3): the
   * heading is kept while the navmesh is clear `look` m along it; blocked (a yurt, a fence, a boulder, the river, ground
   * past 40°) it turns to the nearest clear bearing, toward the side the wall's normal opens on. Off the mesh (the
   * river bank, a creature shoved onto a crag) it falls back to `steer`.
   */
  navSteer = false;
  private steerNav(a: Animal, yaw: number, speed: number, turnRate: number): void {
    const nav = app.navmesh;
    if (nav === null || speed <= 0.05) { this.steer(a, yaw, speed, turnRate); return; }
    const r = this.agentRadius(a), look = Math.max(3, 1.5 + speed * 0.7);
    const ahead = nav.clearAhead(a.position, yaw, look, r);
    if (ahead === null) { this.steer(a, yaw, speed, turnRate); return; }
    if (ahead.clear >= 1) { a.setMotion(yaw, speed, turnRate); return; }
    // blocked: the side the wall opens toward first, then alternate, widening
    const side = Math.sin(yaw) * ahead.normalZ - Math.cos(yaw) * ahead.normalX >= 0 ? 1 : -1;
    let best = yaw, bestClear = ahead.clear;
    for (const step of NAV_FAN) {
      for (const s of [side, -side]) {
        const y = yaw + s * step, c = nav.clearAhead(a.position, y, look, r);
        if (c === null) continue;
        if (c.clear >= 1) { a.setMotion(y, speed, turnRate); return; }
        if (c.clear > bestClear + 0.05) { bestClear = c.clear; best = y; }
      }
    }
    a.setMotion(best, bestClear * look < 0.6 ? speed * 0.3 : speed, turnRate);
  }

  /** desired heading with trunk repulsion, slope + edge avoidance — the no-navmesh fallback of `steerTo` */
  private steer(a: Animal, yaw: number, speed: number, turnRate: number): void {
    let vx = Math.sin(yaw), vz = Math.cos(yaw);
    const px = a.position.x, pz = a.position.z;
    const look = 1.5 + speed * 0.45;
    for (const tr of this.forest.nearby(px + vx * look * 0.5, pz + vz * look * 0.5, look)) {
      const ox = px - tr.x, oz = pz - tr.z;
      const d = Math.hypot(ox, oz) + 1e-3;
      const range = tr.r + look;
      if (d < range) { const f = (1 - d / range) * 1.6; vx += ox / d * f; vz += oz / d * f; }
    }
    // steep ground ahead / chunk edge: bend toward the chunk centre
    const ax = px + vx * look, az = pz + vz * look;
    // A structures-only world has no analytic navigation surface. Keep the requested steering; WORLD collision
    // and the body's floor sampler own support. A brain wanting ledge avoidance can probe floorBelow explicitly.
    if (activeLevel().ground.terrain !== undefined && (!inChunk(ax, az, 22) || normalAt(ax, az)[1] < 0.75 || !this.isDry(ax, az))) {
      const cd = Math.hypot(px, pz) + 1e-3;
      vx += -px / cd * 1.5; vz += -pz / cd * 1.5;
      // and try the perpendiculars
      const sx = -vz, sz = vx;
      const lOk = inChunk(px + sx * look, pz + sz * look, 22) && normalAt(px + sx * look, pz + sz * look)[1] >= 0.75 && this.isDry(px + sx * look, pz + sz * look);
      if (lOk) { vx += sx; vz += sz; } else { vx -= sx; vz -= sz; }
    }
    a.setMotion(Math.atan2(vx, vz), speed, turnRate);
  }

  private confine(a: Animal): void {
    const p = a.position;
    if (!this.isDry(p.x, p.z)) {
      // stepped into the pond: back up toward the last dry heading
      p.x -= Math.sin(a.yaw); p.z -= Math.cos(a.yaw);
      a.desiredYaw = a.yaw + Math.PI * 0.75;
    }
    const lim = CHUNK_HALF - 4; // hard clamp; steering keeps AI animals ≥ 20 m from the edge
    if (Math.abs(p.x) > lim) p.x = Math.sign(p.x) * lim;
    if (Math.abs(p.z) > lim) p.z = Math.sign(p.z) * lim;
    for (const tr of this.forest.nearby(p.x, p.z, 0.6)) {
      const ox = p.x - tr.x, oz = p.z - tr.z;
      const d = Math.hypot(ox, oz), min = tr.r + 0.45;
      if (d < min && d > 1e-4) { p.x = tr.x + ox / d * min; p.z = tr.z + oz / d * min; }
    }
  }

  private updateHerd(h: Herd): void {
    let x = 0, z = 0, n = 0;
    for (const m of h.members) if (m.alive) { x += m.position.x; z += m.position.z; n++; }
    if (n > 0) { h.cx += (x / n - h.cx) * 0.2; h.cz += (z / n - h.cz) * 0.2; }
  }

  // ── combat ─────────────────────────────────────────────────────────────────────────────

  /** the reused raycast() result (made on the first hit) */
  private hitResult: AnimalHit | null = null;

  /** the DAMAGE model (Animal.ts): a body bolt from `dist` m (falloff past 40 m), ×headMul for the head */
  damageFor(headshot: boolean, dist: number): number { return damageFor(headshot, dist); }

  /**
   * Ray vs every living animal's head sphere + body capsule. Returns the nearest hit
   * (the returned object is reused between calls — copy what you need).
   */
  raycast(origin: THREE.Vector3, dir: THREE.Vector3, maxDist: number, aliveOnly = true): AnimalHit | null {
    // PHYSICS P6: the animals' head / body hitboxes in the physics world (posed every update); dead ones have none
    void aliveOnly;
    const hit = this.bodiesFor()?.cast(origin, dir, maxDist, app.equipmentHost?.player.mountedOn ?? null) ?? null;
    if (hit === null) return null;
    const h = this.hitResult ??= { animal: hit.creature, point: new THREE.Vector3(), distance: 0, headshot: false, damage: 0 };
    h.animal = hit.creature; h.distance = hit.distance; h.headshot = hit.head;
    h.point.copy(hit.point);
    h.damage = this.damageFor(hit.head, h.point.distanceTo(this.playerPos));
    return h;
  }

  private bodies: CreatureBodies<Animal> | null = null;
  /** the physics side of the herds (src/engine/physics/creatures.ts), made once the shard's world exists */
  private bodiesFor(): CreatureBodies<Animal> | null {
    if (this.bodies === null) { const p = app.physics; if (p !== null) this.bodies = new CreatureBodies<Animal>(p); }
    return this.bodies;
  }
  /** how many animals have a physics body (the near LOD) — the bench reads it */
  get physicsBodies(): number { return this.bodies?.bodies ?? 0; }

  /**
   * The living animal whose head sphere or body capsule passes within `tol` m of the ray (nearest along the ray),
   * or null. Cheap (one closest-point test per animal in range) — Combat asks every frame for the crosshair target.
   */
  nearRay(origin: THREE.Vector3, dir: THREE.Vector3, maxDist: number, tol: number): Animal | null {
    let best = maxDist, bestA: Animal | null = null;
    for (const a of this.animals) {
      if (!a.alive || a.hidden || a === app.equipmentHost?.player.mountedOn) continue;
      _c.copy(a.position); _c.y += a.dims.bodyY * a.scale;
      _d.subVectors(_c, origin);
      const t = _d.dot(dir);
      if (t < 0 || t > best) continue;
      const r = (a.dims.bodyHalfLen + a.dims.bodyRadius) * a.scale + tol;
      // (a second body capsule, dims.fore — the Antler King — reaches past that bound: the refine alone decides)
      if (a.dims.fore === undefined && _d.lengthSq() - t * t > r * r) continue;
      // refine against the head sphere and the body capsule
      a.headWorld(_p);
      const rh = a.dims.headRadius * a.scale + tol;
      _d.subVectors(_p, origin); const th = _d.dot(dir);
      let ok = th > 0 && _d.lengthSq() - th * th < rh * rh;
      if (!ok) {
        a.bodyCapsule(_a, _b);
        ok = segRayDist2(origin, dir, _a, _b) < (a.dims.bodyRadius * a.scale + tol) ** 2;
      }
      const fore = a.dims.fore;
      if (!ok && fore !== undefined && a.foreCapsule(_a, _b)) ok = segRayDist2(origin, dir, _a, _b) < (fore.radius * a.scale + tol) ** 2;
      if (ok) { best = t; bestA = a; }
    }
    return bestA;
  }

  /** Convenience: apply a raycast hit with its modelled damage. Returns true if it died. */
  hit(hit: AnimalHit, dir: THREE.Vector3): boolean {
    return hit.animal.applyDamage(hit.damage, hit.point, dir);
  }

  /** every applyDamage lands here: blood, sounds, AI reaction, kill event */
  private damaged = (a: Animal, amount: number, hitPoint: THREE.Vector3, dir: THREE.Vector3, died: boolean): void => {
    const sp = speciesDef(a.kind);
    if (sp.blood !== false) this.blood.burst(hitPoint, dir, amount >= 80 ? 1.5 : 1);
    this.onSound?.((sp.sounds?.hurt ?? fallbackSound(a.aggressive, 'hurt')), a.position);
    // headshot = the hit point sits inside the head sphere (a hair of slack for the ray step)
    a.headWorld(_p);
    const headshot = _p.distanceToSquared(hitPoint) < (a.dims.headRadius * a.scale + 0.06) ** 2;
    this.onDamage?.(a, amount, hitPoint, headshot, died);
    const br = this.brains.get(a);
    if (died) { tap.kill?.(a.kind); this.onKill?.(a); if (br !== undefined) br.timer = 0; return; }
    if (sp.think !== undefined) return;   // a self-thinking species reads animal.lastHitT / hp in its own tick
    if (br !== undefined && a.state !== 'charge' && !a.scripted) {
      // a wounded animal bolts at once — no freeze; a boar this close turns on you instead
      const T = this.tuningFor(a);
      br.wary = T.waryTime;
      const M = a.mods;
      if (T.stalk !== undefined) {
        // a hunter never runs from a hit — it comes for you from wherever it is (the charge times out into a stalk);
        // only a nearly dead, non-relentless one (a black bear under 20 %) may break off
        if (this.rules !== null) {
          // E297: the same decision every charger makes (fightRules.reengage) — break off only nearly dead; else it
          // charges when it can, and one you hit at arm's length first backs off to charge distance
          const d = Math.hypot(this.playerPos.x - a.position.x, this.playerPos.z - a.position.z);
          const next = reengage({ hpFrac: a.hp / a.maxHp, relentless: M.relentless, roll: this.rng.next(), ready: true, token: this.tokens.free(a), dist: d, chargeDist: T.panicDist * M.chargeDist, hit: true });
          if (next === 'flee') { br.spooked = true; this.enter(a, br, 'flee'); }
          else if (next === 'charge' && d > this.ringFor(a) * 0.6) { br.chargeCd = 0; this.enter(a, br, 'charge'); }
          else { if (a.state !== 'stalk') this.enter(a, br, 'stalk'); br.chargeCd = Math.min(br.chargeCd, 0.5); if (d < this.ringFor(a) * 0.6) this.startBackoff(a, br); }
        }
        else if (!M.relentless && a.hp / a.maxHp < T.stalk.fleeBelowHp && this.rng.next() < T.stalk.fleeChance) { br.spooked = true; this.enter(a, br, 'flee'); }
        else { br.chargeCd = 0; this.enter(a, br, 'charge'); }
      } else if (a.aggressive && this.playerPos.distanceTo(a.position) < CHARGE_WHEN_HIT_DIST * M.chargeDist && (br.chargeCd <= 0 || M.relentless) && (M.relentless || this.rng.next() < 0.7)) this.enter(a, br, 'charge');
      else { br.spooked = true; this.enter(a, br, 'flee'); }
    }
    this.interrupt(a, 'hit');
  };

  /**
   * every Animal.stagger lands here: a blow that lands on a RUNNING charge breaks it — the animal stops dead (the stun),
   * comes up alert glaring, and either resumes the charge as soon as the stun lifts (a light swing: chargeCd shorter than
   * the stun) or, off a heavy, wheels away and comes again (the after-charge cooldown path). A blow on a standing animal
   * only delays whatever `damaged` decided.
   */
  private staggered = (a: Animal, strength: number, running: boolean): void => {
    const br = this.brains.get(a);
    if (br === undefined || a.state !== 'charge' || speciesDef(a.kind).think !== undefined) return;
    const T = this.tuningFor(a);
    if (br.windup > 0) {
      // a blow during the wind-up interrupts the charge (melee shards): glare, then come again once the cooldown lets it
      br.windup = 0; br.chargeCd = 1.0 + strength;
      this.enter(a, br, T.stalk !== undefined ? 'stalk' : 'alert');
      br.freeze = 0.4 + strength * 0.6;
      return;
    }
    if (!running) return;
    br.chargeCd = strength >= 0.75 ? (T.stalk !== undefined ? T.stalk.rechargeCd : 1.4) : 0.3;
    this.enter(a, br, T.stalk !== undefined ? 'stalk' : 'alert');
    br.freeze = 0.3 + strength * 0.8;
  };

  // ── debug ──────────────────────────────────────────────────────────────────────────────

  private updateDebug(): void {
    if (this.debugMeshes.length === 0) {
      const mat = new THREE.MeshBasicMaterial({ color: 0x8fe3ff, wireframe: true });
      for (const a of this.animals) {
        const h = new THREE.Mesh(new THREE.SphereGeometry(a.dims.headRadius * a.scale, 10, 8), mat);
        const b = new THREE.Mesh(new THREE.CapsuleGeometry(a.dims.bodyRadius * a.scale, a.dims.bodyHalfLen * 2 * a.scale, 4, 10), mat);
        this.debugMeshes.push(h, b); this.group.add(h, b);
      }
    }
    this.animals.forEach((a, i) => {
      const h = this.debugMeshes[i * 2], b = this.debugMeshes[i * 2 + 1];
      if (h === undefined || b === undefined) return;
      a.headWorld(h.position);
      a.bodyCapsule(_a, _b);
      b.position.lerpVectors(_a, _b, 0.5);
      _d.subVectors(_b, _a).normalize();
      b.quaternion.setFromUnitVectors(_c.set(0, 1, 0), _d);
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────────────────
// Ray helpers
// ─────────────────────────────────────────────────────────────────────────────────────────

const _ab = new THREE.Vector3(), _ao = new THREE.Vector3();


/** squared distance between a ray (o, d unit) and a segment a-b (closest points, clamped to the segment and t ≥ 0) */
function segRayDist2(o: THREE.Vector3, d: THREE.Vector3, a: THREE.Vector3, b: THREE.Vector3): number {
  _ab.subVectors(b, a); _ao.subVectors(a, o);
  const abab = _ab.dot(_ab), abd = _ab.dot(d), aod = _ao.dot(d), abao = _ab.dot(_ao);
  const den = abab - abd * abd;
  let u = den > 1e-6 ? (abd * aod - abao) / den : 0;            // param on the segment
  u = THREE.MathUtils.clamp(u, 0, 1);
  let t = aod + u * abd;                                        // param on the ray
  if (t < 0) t = 0;
  const px = a.x + _ab.x * u - (o.x + d.x * t), py = a.y + _ab.y * u - (o.y + d.y * t), pz = a.z + _ab.z * u - (o.z + d.z * t);
  return px * px + py * py + pz * pz;
}
