import { clearBody as clearNativeBody } from './bodyClear';
import { EntityIds } from './ids';
import { app } from '../app/runtime';
import { ParticlePool } from '../fx/ParticlePool';
import { tap } from '../core/harnessTap';
import * as THREE from 'three';
import { canReach } from '../ai/reach';
import { brainPinned, inspectTick } from '../ai/inspect';
import { TickScheduler, type InterruptReason, type TickRate } from '../app/scheduler';
import { dodgeFx } from '../player/dodge';
import { castRay, floorBelow } from '../physics/query';
import { CreatureBodies } from '../physics/creatures';
import type { CharacterMotor } from '../physics/CharacterMotor';
import { SEED, CHUNK_HALF } from '../core/config';
import { HuntBrain, spawnRolls, fallbackSound, ATTACK_TURN, HURT_ARC, type HuntGround, type HuntHerd } from '../ai/hunt';
import { Rng } from '../core/rng';
import { heightAt, normalAt, trailDistance, cabinMask, inChunk, waterLevel, hasPond, POND, streamAt } from '../world/Heightfield';
import type { Forest } from '../world/forest/Forest';
import type { SkyRig as Sky } from '../world/skyRig';
import { speciesDef, type EnemyWorld, type ThinkCtx } from './species/registry';
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

export type Herd = HuntHerd<Animal>;

/** the far LOD distance of the per-frame animation (m) */
const ANIM_LOD = 140;
/** E297 body clearance: the player's capsule radius (Player.ts RADIUS) + a margin for the camera's near plane (m) */

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

/** Shared renderer-free law; the page mesh follows the same native displacement. */
export function clearBody(a: BodyClearable, player: THREE.Vector3): boolean { return clearNativeBody(a, player); }

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

/** a rig as the far herd sees it (its model: the batch's material) */
interface FarRig extends FarMember {
  readonly model: AnimalModel;
  /** the rig's own layer mask while the far herd draws it (its layers are 0 then: the rig is not drawn, its children are) */
  mask: number | null;
}
/** E322 F-L4: the grass a body parts (m, the trample's radius) */

export class AnimalManager {
  /** the animals' own world-matrix pass: a still, far animal's bones are not recomputed (animalMatrices.ts) */
  group = new AnimalGroup();
  animals: Animal[] = [];
  private readonly entityIds = new EntityIds('creature');
  private readonly spawnedActors = new WeakSet<Animal>();
  private readonly retiredActors = new WeakSet<Animal>();
  /** the herds (the hunting brain's: placement and external spawners add to it) */
  get herds(): Herd[] { return this.hunt.herds; }
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
  /** the hunting brain (src/engine/ai/hunt.ts, SF72): every herd animal's decisions, its memory, the herds and the tokens */
  private readonly hunt: HuntBrain<Animal>;
  /** a melee shard (the sword): telegraphed charges, attacks on an arc (see the header) — Driftwood's swords, Nalati's sabre / spear */
  private get melee(): boolean { return this.hunt.melee; }
  /** E297: the shard's fight rules (Driftwood), null = the old fights (see the header) */
  private get rules(): ReturnType<typeof activeLevel>['fight'] | null { return this.hunt.rules; }
  /** E297: the attack tokens — at most `rules.maxAttackers` attacking at once */
  get tokens(): HuntBrain<Animal>['tokens'] { return this.hunt.tokens; }
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
    // the hunting brain's world: the live Heightfield (its exports are live bindings: read at call time), the forest, the app
    const ground: HuntGround = {
      heightAt: (x, z) => heightAt(x, z), normalY: (x, z) => normalAt(x, z)[1], trailDistance: (x, z) => trailDistance(x, z),
      cabinMask: (x, z) => cabinMask(x, z), inChunk: (x, z, margin) => inChunk(x, z, margin), streamAt: (x, z) => streamAt(x, z),
      waterLevel: () => waterLevel(), pond: () => hasPond() ? POND : null, sea: () => app.world.water.sea !== null,
      wetAt: (x, z) => this.wetAt?.(x, z) === true, trees: (x, z, r) => this.forest.nearby(x, z, r),
      treeless: () => this.forest.trees.length === 0, // Driftwood Isle: palms are not Forest trees
      terrain: () => activeLevel().ground.terrain !== undefined, chunkHalf: CHUNK_HALF,
    };
    this.hunt = new HuntBrain<Animal>({ rng: this.rng, fight: activeLevel().fight, faunaTuning: () => activeLevel().faunaTuning }, {
      ground, nav: () => app.navmesh, reach: (a, player) => this.canReach(a, player),
      wanderGoal: (a) => app.events.ask('creature.wander-goal', { herd: a.herd, goal: this.wanderGoal?.(a) ?? null }).goal,
      unaware: () => this.unaware, now: () => performance.now(),
      sound: (name, a) => { this.onSound?.(name, a.position); }, charge: (a, damage) => { this.onCharge?.(a, damage); },
    }, this.playerPos);
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
      await this.factory.settled();   // the herds' coats, painted in slices (SpeciesLook.settle), before any animal is shown
      return this.finish();
    }
    // Each resumed herd reads its retained level/terrain/services, never the intervening page frame.
    // Keep the ambient binding synchronous: another region may enter while pause() is pending.
    const herds = this.spawnHerds();
    while (!frame.run(app, () => herds.next()).done) await pause();
    await frame.run(app, () => this.factory.settled());
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

  /** Places the shard's herds, yielding after each one (`build` drains it, `buildAsync` pauses between). */
  private *spawnHerds(): Generator<number, void, undefined> {
    // herd placement comes from the shard: each HerdPlan asks for a clearing (or canopy) in a band of
    // distances off the trails, optionally in a ring around an anchor (a trail, a cabin…) — the hunting brain's recipe
    const { spawns: plan, spawn } = activeLevel();
    yield* this.hunt.placeHerds(plan, spawn, (kind, x, z, yaw, variants) => this.spawn(kind, x, z, yaw, variants));
  }

  /** the species' hunting-loop numbers (the hunting brain's: its own `tuning`, else the baseline, with the shard's overrides) */
  private tuningFor(a: Animal): ReturnType<HuntBrain<Animal>['tuningFor']> { return this.hunt.tuningFor(a); }

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
    this.hunt.forget(a); this.farRigs.delete(a); this.casters.delete(a); this.tokens.release(a); this.scheduler.forget(a);
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
    const { variant: v, scale, rigSeed, seed } = spawnRolls(this.rng, kind, variant, this.hasLegendary(kind)); // the shared stream's spawn rolls (hunt.ts)
    const model = this.factory.model(kind, v.id);
    const rig = this.factory.instantiate(model, rigSeed);
    const a = new Animal(rig, model, seed, scale, identity ?? this.entityIds.allocate(placement?.entityId));
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
    this.hunt.adopt(a, x, z); // its memory: three more draws on the shared stream
    if (this.melee) { a.attackTurnCap = ATTACK_TURN; a.onAttack = (who, dur) => { this.onWindup?.(who, dur); }; }
    return a;
  }

  /** a herd for an external spawner (Enemies.ts): returns its index for `animal.herd`; push the animals into `members` */
  addHerd(kind: AnimalKind, cx: number, cz: number): number { return this.hunt.addHerd(kind, cx, cz); }

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
    this.hunt.beginTick(dt);
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
      this.hunt.resetRepaths();
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
        if (!a.simulationBound && a.alive && !a.stunned && a.state === 'charge' && speciesDef(a.kind).think === undefined) this.hunt.advanceCharge(a, bodyDt, playerPos);
        const act = speciesDef(a.kind).act;
        if (!a.simulationBound && act !== undefined && a.alive && !a.stunned) act(a, this.customContext(a, bodyDt, playerPos, this.playerSprinting));
        a.update(bodyDt, t, near);
        if (!a.simulationBound && a.alive) killBelowWorld(a, activeLevel().world, app.combat);
        if (!a.simulationBound && this.melee && a.state === 'charge' && a.alive && !a.stunned) this.hunt.chargeContact(a, playerPos);
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
    for (const a of this.animals) if (a.aggressive || this.hunt.sensed(a)) this.interrupt(a, why);
  }

  /** Decision and body callbacks share exactly the same sensing/reach/director ports. */
  private customContext(a: Animal, dt: number, player: THREE.Vector3, sprinting: boolean): ThinkCtx {
    const c = this.thinkCtx, herd = a.herd >= 0 ? this.herds[a.herd] ?? null : null;
    c.dt = dt; c.t = app.clock.now; c.player = player; c.playerSpeed = sprinting ? 7.2 : this.playerSpeed;
    c.calm = this.unaware; c.herd = herd?.members ?? null; c.world = this.enemyWorld;
    c.hurt = (damage) => { if ((!this.melee || this.hunt.facing(a, player, HURT_ARC)) && this.canReach(a, player)) this.onCharge?.(a, damage); };
    c.sound = (name) => { this.onSound?.(name, a.position); };
    return c;
  }

  private think(a: Animal, dt: number, player: THREE.Vector3, sprinting: boolean): void {
    if (a.simulationBound) return;
    if (this.hunt.memory(a) === undefined) throw new Error(`AnimalManager: ${a.kind} has no brain (not spawned through spawn())`);
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
      if (herd !== null) this.hunt.updateHerd(herd);
      return;
    }
    this.hunt.think(a, dt, player, sprinting, this.playerSpeed);
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

  private thinkCtx: ThinkCtx = {
    dt: 0.1, t: 0, player: new THREE.Vector3(), playerSpeed: 0, rng: this.rng, calm: false, herd: null,
    hurt: () => undefined, sound: () => undefined, world: {}, heightAt, waterLevel,
    steer: (a, yaw, speed, turnRate) => { this.hunt.steerAny(a, yaw, speed, turnRate); },
    flight: { steer: (a, yaw, speed, altitude, turnRate) => { a.fly(yaw, speed, altitude, turnRate); } },
    pathYaw: (a, tx, tz, every = 1) => this.hunt.pathYawFor(a, tx, tz, every),
    confine: (a) => { this.hunt.confine(a); },
    reach: (a) => this.canReach(a, this.thinkCtx.player),
    claim: (a) => app.events.ask('ai.claim', a),
    mayAttack: (a) => app.events.ask('ai.mayAttack', a),
  };

  /**
   * Something loud landed at `point` (a bolt in a tree or the dirt): animals within impactSpook m bolt after a
   * short start, within impactAlert m their heads come up. `strength` scales both radii (1 = a bolt).
   */
  disturb(point: THREE.Vector3, strength = 1): void { this.hunt.disturb(this.animals, point, strength); }

  /** A shard's own thinkers steer by the navmesh (Nalati: set by src/shards/nalati-grasslands/index.ts — NALATI-MERGE P3; hunt.ts `steerNav`). */
  get navSteer(): boolean { return this.hunt.navSteer; }
  set navSteer(on: boolean) { this.hunt.navSteer = on; }

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
    if (died) { tap.kill?.(a.kind); this.onKill?.(a); this.hunt.died(a); return; }
    if (sp.think !== undefined) return;   // a self-thinking species reads animal.lastHitT / hp in its own tick
    this.hunt.hurt(a);   // the hunting brain's hit reaction (hunt.ts): bolt, turn on you, or come for you
    this.interrupt(a, 'hit');
  };

  /**
   * every Animal.stagger lands here: a blow that lands on a RUNNING charge breaks it — the animal stops dead (the stun),
   * comes up alert glaring, and either resumes the charge as soon as the stun lifts (a light swing: chargeCd shorter than
   * the stun) or, off a heavy, wheels away and comes again (the after-charge cooldown path). A blow on a standing animal
   * only delays whatever `damaged` decided.
   */
  private staggered = (a: Animal, strength: number, running: boolean): void => {
    if (speciesDef(a.kind).think !== undefined) return;
    this.hunt.staggered(a, strength, running);
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
