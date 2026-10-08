import { diagnosticNow } from '../core/clock';
import { tap } from '../core/harnessTap';
import * as THREE from 'three';
import type { CharacterMotor } from '../physics/CharacterMotor';
import { ragdollsFor, type Ragdoll } from '../physics/ragdoll';
import { TIER } from '../core/tier';
import { frameCost } from '../core/frameCost';
import { heightAt } from '../world/Heightfield';
import type { AnimalModel, AnimalRig } from './AnimalFactory';
import { variantMods, type RigAnimCtx } from './species/registry';
import { app, gameplayRandom } from '../app/runtime';
import type { DamageRequest } from '../combat/pipeline';
import { AnimalSim, damageFor as simDamageFor, type AnimalPoseSample } from './AnimalSim';
import { floorBelow } from '../physics/query';

/**
 * Animal — one animal instance (any registered species): procedural skeletal animation + health.
 *
 * Animation is a weighted blend of gait/idle pose generators (idle, graze, walk, trot, gallop)
 * written into a flat Float32Array of joint angles, plus additive layers (alert look-at,
 * hit flinch, death collapse) and terrain adaptation (body tilt to the slope, per-foot
 * knee flex so hooves plant). The result is applied to the rig's bones every frame.
 *
 * DEATH (PHYSICS P8): the killing hit hands the body to a ragdoll (src/engine/physics/ragdoll.ts) — built at the pose it died
 * in, thrown by the hit's `dir` / damage, posed from the physics every frame, frozen to a static corpse once it rests.
 * A quadruped's bones are all physics; a custom rig (crab: one tumbling body; monkey / sailor: one upright body that
 * falls) keeps its species' keyframed death on the limbs. Past the tier's live-ragdoll cap (phone 2, desktop 6), or with
 * no physics world (dev scenes), the death is the keyframed collapse below.
 *
 * Public surface used by other systems:
 *   animal.kind: 'deer' | 'boar' | …  animal.alive      animal.position (feet, world)
 *   animal.variant / rarity / label   the rolled VariantDef ('white-stag', 'uncommon', "White stag"); mods = its gameplay multipliers
 *   animal.aggressive                 true for species that charge (boar, bear) — the minimap paints these red
 *   animal.hp / maxHp                 animal.state       animal.yaw (heading, radians)
 *   animal.lastHitT                   diagnosticNow() ms of the last applyDamage (health bars fade from it)
 *   animal.damageFor(headshot, distance)   → the DAMAGE model's number for a bolt (the crossbow asks before applyDamage)
 *   animal.applyDamage(amount, hitPoint, dir) → true if it died
 *   animal.stagger(dir, strength)     a melee blow: pushed STAGGER_PUSH m along `dir` over 0.25 s, AI frozen (`stunned`)
 *                                     for 0.4–0.8 s in a braced flinch; strength 0 = light (0.6 m / 0.4 s), 1 = heavy (1.5 m / 0.8 s)
 *   animal.headWorld(out) / bodyCapsule(a, b)  — hit volumes (world space)
 *   animal.hitFlash(strength)         a melee blow's white flash (Sword.ts): the body's per-animal material glows white and
 *                                     fades over FLASH_T s (world time — it holds through a hit-stop)
 *   animal.attackTurnCap              rad/s the heading may turn while an attack runs (Infinity = free; the Driftwood manager
 *                                     sets ATTACK_TURN so a committed swing can be strafed out of — "strafe is the dodge")
 *   A stagger CANCELS a running attack (a hit interrupts a wind-up: the species' think sees attackPhase < 0 and recovers).
 *   Custom rigs lean away from the blow (the root tilts by the directional flinch); quadrupeds with an attack running (the
 *   manager's charge wind-up) drop the head, lower the front and paw the ground (poseWindup).
 *
 * The AnimalManager owns AI state and calls animal.setMotion(desiredYaw, desiredSpeed).
 *
 * CUSTOM RIGS (`SpeciesDef.rig === 'custom'`: the Driftwood crab / monkey / sailor): the skeleton is whatever the
 * species built (`body` root + `head` are the only required bones); every frame Animal.ts fills a RigAnimCtx
 * (speed, strafe, gait phase, deathT, flinch, brace, attack, mem) and calls `species.animate(ctx)` instead of the
 * quadruped pose generators. Everything else — applyDamage, stagger, hit volumes, fadeOut, the manager's raycast —
 * is unchanged. Extra motion knobs for those species' AI: `setStrafe(mps)` (lateral speed, + = left),
 * `yOffset` (metres above the ground: a monkey in a crown, a sailor below the deck), `startAttack(seconds)` /
 * `attackPhase` (0..1 wind-up → strike, drives the telegraph pose), `mem` (per-animal numbers).
 */

/** Seeded legacy bolt formula shared with the headless simulation. */
export function damageFor(headshot: boolean, dist: number): number { return simDamageFor(headshot, dist, gameplayRandom); }

// pose parameter indices
const P_BODY_Y = 0, P_BODY_PITCH = 1, P_BODY_ROLL = 2, P_BODY_YAW = 3;
const P_NECK1 = 4, P_NECK2 = 5, P_HEAD_P = 6, P_HEAD_Y = 7, P_NECK_Y = 8;
const P_EARL_P = 9, P_EARL_Y = 10, P_EARR_P = 11, P_EARR_Y = 12;
const P_TAIL_P = 13, P_TAIL_Y = 14;
const P_LEG = 15; // + leg*3 (0 upper, 1 mid, 2 lower)   legs: 0 FL, 1 FR, 2 BL, 3 BR
const P_COUNT = 27;

const G_IDLE = 0, G_GRAZE = 1, G_WALK = 2, G_TROT = 3, G_GALLOP = 4;

interface GaitDef { offsets: [number, number, number, number]; stance: number; amp: number; lift: number; bob: number; pitch: number }
type MovingGait = typeof G_WALK | typeof G_TROT | typeof G_GALLOP;
const MOVING_GAITS: readonly MovingGait[] = [G_WALK, G_TROT, G_GALLOP];
const GAITS: Record<MovingGait, GaitDef> = {
  [G_WALK]: { offsets: [0.25, 0.75, 0.0, 0.5], stance: 0.62, amp: 0.36, lift: 0.9, bob: 0.012, pitch: 0.01 },
  [G_TROT]: { offsets: [0.0, 0.5, 0.5, 0.0], stance: 0.48, amp: 0.45, lift: 1.1, bob: 0.03, pitch: 0.02 },
  [G_GALLOP]: { offsets: [0.55, 0.68, 0.0, 0.12], stance: 0.36, amp: 0.66, lift: 1.5, bob: 0.06, pitch: 0.09 },
};

const smooth01 = (t: number) => t * t * (3 - 2 * t);
const pulse = (t: number, period: number, seed: number, width = 0.12) => {
  // a short unit bump once per `period` seconds at a seeded phase
  const p = ((t + seed * 7.13) / period) % 1;
  return p < width ? Math.sin((p / width) * Math.PI) : 0;
};

const _v = new THREE.Vector3();
const _cc = new THREE.Vector3(), _ca = new THREE.Vector3(), _cb = new THREE.Vector3();

/** a hit capsule on a bone (E350 F-X2, AnimalDims.bodyAt / fore): centre `at` (bone local, model units), the axis the bone's
 *  x or z tilted `pitch` rad toward its y, `halfLen` model units each way. The matrix's columns carry the mesh scale, so
 *  the segment comes out in world metres */
function capsuleOn(m: THREE.Matrix4, at: readonly [number, number, number], axis: 'x' | 'z', pitch: number, halfLen: number, a: THREE.Vector3, b: THREE.Vector3): void {
  _cc.set(at[0], at[1], at[2]).applyMatrix4(m);
  const e = m.elements;
  if (axis === 'x') _ca.set(e[0], e[1], e[2]); else _ca.set(e[8], e[9], e[10]);
  _ca.multiplyScalar(Math.cos(pitch)).addScaledVector(_cb.set(e[4], e[5], e[6]), Math.sin(pitch));
  a.copy(_cc).addScaledVector(_ca, -halfLen); b.copy(_cc).addScaledVector(_ca, halfLen);
}

/** stagger (a sword blow, Sword.ts): push distance / hold time at strength 0 (light) and 1 (heavy), the push's duration */

/** the melee hit flash: seconds to fade, emissive intensity at strength 1 */
const FLASH_T = 0.14, FLASH_I = 0.9;

/** the bones Animal.ts poses by name on a quadruped rig (resolved once at construction; a custom rig only has body + head) */
interface QuadBones { body: THREE.Bone; neck1: THREE.Bone; neck2: THREE.Bone; head: THREE.Bone; earL: THREE.Bone; earR: THREE.Bone; tail: THREE.Bone; belly: THREE.Bone }
type LegBones = readonly [THREE.Bone, THREE.Bone, THREE.Bone];

/** Client creature view over headless state: rigs, animation, material LOD and corpse presentation. */
export class Animal extends AnimalSim {
  mesh: THREE.SkinnedMesh;
  readonly custom: boolean;
  private flashMat: THREE.MeshStandardMaterial | THREE.MeshLambertMaterial | null = null;
  private flashBase = new THREE.Color();
  private flashBaseI = 1;
  private flash = 0;
  private bones: Record<string, THREE.Bone>;
  private readonly bBody: THREE.Bone;
  private readonly bHead: THREE.Bone;
  private readonly bFore: THREE.Bone | null;
  private quad: QuadBones | null = null;
  private model: AnimalModel;
  private pose = new Float32Array(P_COUNT);
  private tmp = new Float32Array(P_COUNT);
  private gaitW = new Float32Array(5);
  private gaitTarget = new Float32Array(5);
  private phase = 0;
  get gaitPhase(): number { return this.phase; }
  private lookAmt = 0;
  onStaggered?: (animal: Animal, strength: number, running: boolean) => void;
  private tiltPitch = 0;
  private tiltRoll = 0;
  private footDelta = new Float32Array(4);
  private legDir: LegBones[] = [];
  private lastFootPhase = new Float32Array(4);
  onFootfall?: (animal: Animal, strength: number) => void;
  debugGait?: { gait: string; phase: number };
  onDamaged?: (animal: Animal, amount: number, hitPoint: THREE.Vector3, dir: THREE.Vector3, died: boolean) => void;
  shells: THREE.SkinnedMesh[] = [];
  makeShells?: (animal: Animal) => THREE.SkinnedMesh[];
  prepareMaterial?: (m: THREE.Material) => void;
  shellLevel = 0;
  hidden = false;
  private fadeT = -1;
  private fadeMats: THREE.Material[] = [];
  private drawLod = 0;
  private lodBase: { geometry: THREE.BufferGeometry; materials: THREE.Material[] } | null = null;
  private legAbd = new Float32Array(4);
  private ragdoll: Ragdoll | null = null;
  private externalSimulation: AnimalSim | null = null;
  private observedHit = -Infinity;
  private observedAlive = true;
  private readonly simPose: AnimalPoseSample = { attackT: -1, attackDur: 1, groundY: 0, tiltRollT: 0,
    stunT: 0, flinch: 0, flinchRoll: 0, flinchPitch: 0, brace: 0, deathSide: 1 };

  /** True when the authoritative host, rather than the legacy manager, owns decisions and physics. */
  get simulationBound(): boolean { return this.externalSimulation !== null; }
  /** Bind a fresh rig to the host creature. Rendering never advances or disposes its simulation body. */
  bindSimulation(sim: AnimalSim): this {
    if (this.externalSimulation !== null || this.motor !== null || this.ragdoll !== null
      || sim === this || sim.entityId !== this.entityId || sim.kind !== this.kind) throw new Error('Incompatible creature view binding');
    this.externalSimulation = sim;
    const share = (key: keyof AnimalSim): void => {
      Object.defineProperty(this, key, { configurable: false, enumerable: true,
        get: () => sim[key], set: (value: unknown) => { Reflect.set(sim, key, value); } });
    };
    for (const key of ['kind', 'variant', 'rarity', 'label', 'aggressive', 'mods', 'alive', 'hp', 'maxHp',
      'position', 'yaw', 'speed', 'state', 'herd', 'desiredYaw', 'desiredSpeed', 'turnRate', 'lastHitT',
      'lookTarget', 'lookWeight', 'seed', 'scale', 'strafe', 'desiredStrafe', 'yOffset', 'driven', 'levelGround',
      'groundHeight', 'mem', 'attackTurnCap', 'scripted', 'harnessHold'] as const) share(key);
    Object.defineProperties(this, {
      combatActor: { value: sim.combatActor.bind(sim) }, applyDamage: { value: sim.applyDamage.bind(sim) },
      applyFinalDamage: { value: sim.applyFinalDamage.bind(sim) }, stagger: { value: sim.stagger.bind(sim) },
      setMotion: { value: sim.setMotion.bind(sim) }, setStrafe: { value: sim.setStrafe.bind(sim) },
      impulse: { value: sim.impulse.bind(sim) }, fly: { value: sim.fly.bind(sim) },
      startAttack: { value: sim.startAttack.bind(sim) }, cancelAttack: { value: sim.cancelAttack.bind(sim) },
      damageFor: { value: sim.damageFor.bind(sim) }, step: { value: sim.step.bind(sim) },
      snapshot: { value: sim.snapshot.bind(sim) }, restore: { value: sim.restore.bind(sim) },
      attackPhase: { get: () => sim.attackPhase }, stunned: { get: () => sim.stunned },
      flying: { get: () => sim.flying }, lockable: { get: () => sim.lockable },
      lockRange: { get: () => sim.lockRange }, hasImpulse: { get: () => sim.hasImpulse },
      place: { value: (x: number, z: number, yaw: number, y?: number): void => {
        sim.place(x, z, yaw, y); this.mesh.position.copy(sim.position); this.mesh.rotation.y = sim.yaw;
      } },
    });
    this.rigCtx.position = sim.position; this.rigCtx.lookTarget = sim.lookTarget; this.rigCtx.mem = sim.mem;
    this.observedHit = sim.lastHitT; this.observedAlive = sim.alive;
    return this;
  }

  private readSimulationPose(): void {
    const sim = this.externalSimulation;
    if (sim === null) return;
    const motion = this.simPose; sim.samplePose(motion);
    this.attackT = motion.attackT; this.attackDur = motion.attackDur; this.groundY = motion.groundY;
    this.tiltRollT = motion.tiltRollT; this.stunT = motion.stunT;
    if (sim.lastHitT !== this.observedHit) {
      this.observedHit = sim.lastHitT; this.flinch = motion.flinch;
      this.flinchRoll = motion.flinchRoll; this.flinchPitch = motion.flinchPitch; this.brace = motion.brace;
      this.hitFlash();
    }
    if (sim.alive !== this.observedAlive) {
      this.observedAlive = sim.alive; this.deathT = sim.alive ? -1 : 0; this.deathSide = motion.deathSide;
    }
    this.rigCtx.mem = sim.mem;
  }

constructor(rig: AnimalRig, model: AnimalModel, seed: number, scale = 1, entityId = `creature.${model.kind}.${String(seed)}`) {
    const v = model.variantDef;
    super({ kind: model.kind, label: v.label || model.species.label, variant: v.id, rarity: v.rarity,
      hp: v.hp ?? model.species.tuning?.hp ?? (model.species.aggressive === true ? 100 : 60),
      aggressive: model.species.aggressive ?? false, dims: model.dims, mods: variantMods(model.species, v),
      ...(model.species.flight === undefined ? {} : { flight: model.species.flight }),
      ...(model.species.lockable === undefined ? {} : { lockable: model.species.lockable }) }, seed, scale, entityId, {
      heightAt: (x, z) => heightAt(x, z), random: gameplayRandom, now: () => diagnosticNow(),
      floorBelow: (x, z, fromY, maxDrop) => app.physics === null ? heightAt(x, z) : floorBelow(app.physics, x, z, fromY, maxDrop),
    });
    this.mesh = rig.mesh; this.bones = rig.bones; this.model = model;
    this.mesh.scale.setScalar(scale);
    this.mesh.rotation.order = 'YXZ';
    this.custom = model.species.rig === 'custom';
    const bone = (name: string): THREE.Bone => {
      const bn = rig.bones[name];
      if (bn === undefined) throw new Error(`animal '${model.kind}': rig has no bone '${name}'`);
      return bn;
    };
    this.bBody = bone('body'); this.bHead = bone('head');
    const fore = model.dims.fore;
    this.bFore = fore === undefined ? null : bone(fore.bone);
    if (!this.custom) {
      this.quad = { body: this.bBody, neck1: bone('neck1'), neck2: bone('neck2'), head: this.bHead, earL: bone('earL'), earR: bone('earR'), tail: bone('tail'), belly: bone('belly') };
      this.legDir = [
        [bone('FL_shoulder'), bone('FL_carpus'), bone('FL_fetlock')], [bone('FR_shoulder'), bone('FR_carpus'), bone('FR_fetlock')],
        [bone('BL_hip'), bone('BL_stifle'), bone('BL_hock')], [bone('BR_hip'), bone('BR_stifle'), bone('BR_hock')],
      ];
    }
    this.gaitW[G_IDLE] = 1;
    this.gaitTrot = model.species.gait?.trot ?? 2.4; this.gaitGallop = model.species.gait?.gallop ?? 4.6;
    const fur = rig.materials[0];
    if (fur !== undefined && fur !== model.hard) { this.flashMat = fur; this.flashBase.copy(fur.emissive); this.flashBaseI = fur.emissiveIntensity; }
    this.rigCtx = {
      bones: this.bones, dims: model.dims, dt: 0, t: 0, seed, scale, speed: 0, strafe: 0, phase: 0, state: 'idle', alive: true,
      deathT: -1, flinch: 0, brace: 0, attack: -1, lookTarget: this.lookTarget, lookWeight: 0, position: this.position, yaw: 0, mem: this.mem, animal: this,
    };
  }
  private rigCtx: RigAnimCtx;
  /** A restored snapshot replaces `mem` (AnimalSim.restore copies it), so the rig poses from the restored memory, not the
   *  object it was built with (G254: a restored grid region's Drowned Sailor posed from its pre-restore memory, its deck
   *  offset lost, 0.6 m under the hold's floor). An externally simulated body reads its simulation's memory instead. */
  override restore(saved: ReturnType<AnimalSim['snapshot']>): void {
    super.restore(saved);
    this.rigCtx.mem = this.mem;
  }
  /** walk → trot and trot → gallop blend starts, m/s at scale 1 (SpeciesDef.gait; deer defaults 2.4 / 4.6) */
  private readonly gaitTrot: number; private readonly gaitGallop: number;

  /** The flight body opts into 3-D lock acquisition and camera tracking, independent of species kind. */
  
  /** Authored species eligibility; flight bodies retain their default opt-in. */

  /** fading out (fadeOut): its own transparent materials, so the far herd leaves it alone */
  get fading(): boolean { return this.fadeT >= 0; }

  /** Place on analytic ground (plus flight altitude), or at an exact world feet `y`, facing `yaw`. */
  override place(x: number, z: number, yaw: number, y?: number): void {
    super.place(x, z, yaw, y);
    this.mesh.position.copy(this.position);
    this.mesh.rotation.y = yaw;
  }

  /** Add world velocity (m/s), decaying at 3.5/s. WORLD ground bodies retain Y for a fall; flyers use XYZ. */

  /** Public flight command; the species must declare its flight body. */
  
  /** lateral desired speed, m/s, + = the animal's left (the crab sidesteps around you) */

  /** begin an attack lasting `dur` s: `attackPhase` runs 0 → 1 (the species' animate poses the wind-up and the strike from it) */
  
  /** set by the manager: an attack (a wind-up) just started — the telegraph's sound cue */
  onAttack?: ((animal: Animal, dur: number) => void) | undefined;
  /** 0..1 through the current attack, -1 when none (held at 1 until the next startAttack / cancelAttack) */

  /** a melee blow's white flash (0..1): the body glows white and fades over FLASH_T s (see the header) */
  hitFlash(strength = 1): void {
    if (this.flashMat === null) return;
    this.flash = Math.max(this.flash, THREE.MathUtils.clamp(strength, 0, 1));
    this.applyFlash();
  }
  private applyFlash(): void {
    const m = this.flashMat;
    if (m === null) return;
    const k = this.flash;
    if (k <= 0) { m.emissive.copy(this.flashBase); m.emissiveIntensity = this.flashBaseI; return; }
    m.emissive.setRGB(1, 1, 1).lerp(this.flashBase, 1 - k); m.emissiveIntensity = THREE.MathUtils.lerp(this.flashBaseI, FLASH_I, k);
  }

  // ── combat ─────────────────────────────────────────────────────────────────────────────

  /** damage a bolt does to this animal: body 32–40 with distance falloff, ×2.5 to the head (see DAMAGE) */

  /** world-space head hit sphere centre (the head joint, or dims.headAt on the head bone) */
  override headWorld(out: THREE.Vector3): THREE.Vector3 {
    const at = this.model.dims.headAt;
    if (at !== undefined) return out.set(at[0], at[1], at[2]).applyMatrix4(this.bHead.matrixWorld);
    const m = this.bHead.matrixWorld.elements;
    return out.set(m[12], m[13], m[14]);
  }
  /** world-space body capsule segment (a = rump, b = chest; or bottom → top for an upright rig, dims.capsuleAxis 'y') */
  override bodyCapsule(a: THREE.Vector3, b: THREE.Vector3): void {
    const d = this.model.dims;
    if (d.capsuleAxis !== 'y' && (d.bodyAt !== undefined || d.bodyPitch !== undefined)) {
      capsuleOn(this.bBody.matrixWorld, d.bodyAt ?? [0, 0, 0], 'z', d.bodyPitch ?? 0, d.bodyHalfLen, a, b);
      return;
    }
    const m = this.bBody.matrixWorld.elements;
    // body bone world matrix: columns are the body axes in world space
    const cx = m[12], cy = m[13], cz = m[14];
    const o = d.capsuleAxis === 'y' ? 4 : 8;
    const fx = m[o] * d.bodyHalfLen, fy = (m[o + 1] ?? 0) * d.bodyHalfLen, fz = (m[o + 2] ?? 0) * d.bodyHalfLen;
    a.set(cx - fx, cy - fy, cz - fz); b.set(cx + fx, cy + fy, cz + fz);
  }
  /** world-space segment of the second body capsule (dims.fore); false when the species has none */
  foreCapsule(a: THREE.Vector3, b: THREE.Vector3): boolean {
    const f = this.model.dims.fore, bone = this.bFore;
    if (f === undefined || bone === null) return false;
    capsuleOn(bone.matrixWorld, f.at, 'x', 0, f.halfLen, a, b);
    return true;
  }

  /**
   * Apply damage (`amount` is final: AnimalManager.raycast() hands back `hit.damage` from the DAMAGE model —
   * body 32–40 with distance falloff, head ×2.5 — and AnimalManager.hit(hit, dir) applies it). `hitPoint`/`dir`
   * (world) drive the flinch and the collapse side. Returns true if this shot killed it. Blood, sounds, AI reaction and manager.onKill
   * happen through `onDamaged`, so calling this directly is enough. A variant's `mods.damageTaken` scales BODY hits
   * (Old Ironhide shrugs off 40 %); a headshot always lands in full — `onDamaged` gets the amount actually dealt.
   */
  override applyDamage(amount: number, hitPoint: THREE.Vector3, dir: THREE.Vector3): boolean {
    if (!this.alive) return false;
    return app.combat.hit({ source: 'env', sourceTags: ['dmg.legacy', 'cover.checked'], target: this.combatActor(), amount, point: hitPoint, dir })?.killed ?? false;
  }

  override get dims(): AnimalModel['dims'] { return this.model.dims; }
  protected override hitTime(): number { return diagnosticNow(); }

  /** Stable bridge for weapons until the creature runtime supplies its own Actor. */

  /** Pipeline output only: variant and species modifiers have already run once, in order. */

  /**
   * The death's ragdoll (see the header): the build from the rig, the animal's own motion plus the hit's throw. Null
   * past the tier cap or with no physics world — then the keyframed collapse runs as before.
   */
  private startRagdoll(damage: number, hitPoint: THREE.Vector3, dir: THREE.Vector3): void {
    const physics = app.physics;
    if (physics === null) return;
    const d = this.model.dims;
    const sin = Math.sin(this.yaw), cos = Math.cos(this.yaw);
    this.mesh.updateMatrixWorld(true);
    this.ragdoll = ragdollsFor(physics).spawn({
      build: !this.custom ? 'quadruped' : d.capsuleAxis === 'y' ? 'upright' : 'rigid',
      root: this.mesh, bones: this.bones, dims: d, scale: this.scale, lite: TIER === 'phone',
      // forward along the heading, strafe to the animal's left (world (cos yaw, -sin yaw))
      velocity: { x: sin * this.speed + cos * this.strafe, y: 0, z: cos * this.speed - sin * this.strafe },
      hitPoint, dir, damage,
    });
  }

  /** A ragdolled death's frame: the physics poses the mesh (and a quadruped's bones), a custom rig's limbs keep their keyframes. */
  private updateRagdoll(r: Ragdoll, dt: number, t: number, near: boolean): void {
    this.speed = 0; this.strafe = 0;
    if (this.custom && near) {
      if (this.flinch > 0.001) this.flinch *= Math.exp(-dt * 5.5);
      if (this.deathT >= 0) this.deathT = Math.min(1, this.deathT + dt / 0.8);
      const c = this.rigCtx;
      c.dt = dt; c.t = t; c.speed = 0; c.strafe = 0; c.phase = this.phase; c.state = this.state; c.alive = false;
      c.deathT = this.deathT; c.flinch = this.flinch; c.brace = 0; c.attack = -1; c.lookWeight = 0; c.yaw = this.yaw;
      this.model.species.animate?.(c);
    }
    r.pose(dt);
    // the corpse's place (loot, harvest): under the torso, or the custom rig's root
    r.rootPosition(this.position);
    if (!this.custom) this.position.y -= this.model.dims.halfWidth * this.scale;
    this.updateFade(dt);
    if (this.hidden) r.dispose();
  }

  /** the physics body while near the player (src/engine/physics/creatures.ts hands it out and takes it back) */
  override motor: CharacterMotor | null = null;
  /** Explicit retirement releases a corpse's ragdoll even when it receives no later update. */
  retireBody(): void {
    this.ragdoll?.dispose(); this.ragdoll = null;
    if (this.externalSimulation === null) { this.motor?.dispose(); this.motor = null; }
  }
  /** the last update left the skeleton's pose as it was (the far LOD): the animals' group may keep its bones' world
   *  matrices while the root stands still too (src/engine/entities/animalMatrices.ts) */
  poseFrozen = false;

  /** true while a stagger holds it: the manager skips its think, it neither steers nor walks */

  /**
   * A melee blow (Sword.ts calls it right after applyDamage): the animal stops dead, is shoved along `dir` (world,
   * flattened) over STAGGER_PUSH_T s and holds a braced flinch for the stun — 0.6 m / 0.4 s at strength 0 (a light
   * swing) up to 1.5 m / 0.8 s at 1 (the heavy). Big animals (scale > 1) are shoved proportionally less. Bolts never
   * call this, so Pine Hollow's crossbow hunting is unchanged. `onStaggered` lets the manager break a running charge.
   */

  protected override moveBody(want: { x: number; y: number; z: number }): void {
    const t0 = frameCost.on ? diagnosticNow() : 0;
    super.moveBody(want);
    if (frameCost.on) frameCost.sub('motor', t0);
  }
  protected override attackStarted(dur: number): void { this.onAttack?.(this, dur); }
  protected override damageRequested(req: DamageRequest): void { tap.hit?.(this.kind, req.amount); }
  protected override hasDamageMultiplier(): boolean { return this.model.species.damageMul !== undefined; }
  protected override damageMultiplier(req: DamageRequest): number { return this.model.species.damageMul?.(this, req.point, req.dir, req) ?? 1; }
  protected override died(dealt: number, point: THREE.Vector3, dir: THREE.Vector3): void {
    for (let l = 0; l < 4; l++) this.legAbd[l] = ((l % 2 === 0) === (this.deathSide < 0)) ? 0.35 : 0.25;
    this.startRagdoll(dealt, point, dir);
  }
  protected override damaged(dealt: number, point: THREE.Vector3, dir: THREE.Vector3, died: boolean): void { this.onDamaged?.(this, dealt, point, dir, died); }
  protected override staggered(strength: number, running: boolean): void { this.onStaggered?.(this, strength, running); }

  // ── per-frame ──────────────────────────────────────────────────────────────────────────

  /** Integrate motion and animate. `t` = global seconds; `near` = within animation LOD range. */
  update(dt: number, t: number, near: boolean): void {
    this.poseFrozen = false;
    const d = this.model.dims;
    if (this.flash > 0) { this.flash = Math.max(0, this.flash - dt / FLASH_T); this.applyFlash(); }
    if (this.ragdoll !== null) { this.updateRagdoll(this.ragdoll, dt, t, near); return; }
    if (this.externalSimulation === null) this.stepMotion(dt); else this.readSimulationPose();

    // gait weights from speed
    const gw = this.gaitTarget;
    gw.fill(0);
    const s = Math.hypot(this.speed, this.strafe) / this.scale;
    if (this.debugGait) {
      const gi = ['idle', 'graze', 'walk', 'trot', 'gallop'].indexOf(this.debugGait.gait);
      this.gaitW.fill(0); this.gaitW[Math.max(0, gi)] = 1; this.phase = this.debugGait.phase;
      if (this.externalSimulation === null) { this.speed = 0; this.desiredSpeed = 0; }
      gw.set(this.gaitW);
    } else if (!this.alive) { gw[G_IDLE] = 1; }
    else if (s < 0.15) { if (this.state === 'graze') gw[G_GRAZE] = 1; else gw[G_IDLE] = 1; }
    else if (s < this.gaitTrot) { const k = THREE.MathUtils.clamp((s - 0.15) / 0.6, 0, 1); gw[G_WALK] = k; gw[this.state === 'graze' ? G_GRAZE : G_IDLE] = 1 - k; }
    else if (s < this.gaitGallop) { const k = THREE.MathUtils.clamp((s - this.gaitTrot) / (this.gaitTrot * 0.5), 0, 1); gw[G_TROT] = k; gw[G_WALK] = 1 - k; }
    else { const k = THREE.MathUtils.clamp((s - this.gaitGallop) / (this.gaitGallop * 0.3), 0, 1); gw[G_GALLOP] = k; gw[G_TROT] = 1 - k; }
    const bl = Math.min(1, dt * 6);
    const W = this.gaitW;
    let wsum = 0;
    for (let i = 0; i < 5; i++) { W[i] = (W[i] ?? 0) + ((gw[i] ?? 0) - (W[i] ?? 0)) * bl; wsum += W[i] ?? 0; }
    for (let i = 0; i < 5; i++) W[i] = (W[i] ?? 0) / wsum;

    // gait phase: stride frequency from speed so hooves don't slide
    const wWalk = W[G_WALK] ?? 0, wTrot = W[G_TROT] ?? 0, wGallop = W[G_GALLOP] ?? 0;
    const moving = wWalk + wTrot + wGallop;
    if (moving > 0.01 && this.alive && !this.debugGait) {
      const g = wGallop > 0.5 ? GAITS[G_GALLOP] : wTrot > 0.5 ? GAITS[G_TROT] : GAITS[G_WALK];
      const stride = 2 * d.legLen * Math.sin(g.amp) * this.scale * (g === GAITS[G_GALLOP] ? 1.9 : g === GAITS[G_TROT] ? 1.35 : 1.0);
      const freq = Math.max(0.6, Math.hypot(this.speed, this.strafe) * g.stance / stride);
      this.phase = (this.phase + freq * dt) % 1;
    }
    if (this.externalSimulation === null && this.attackT >= 0) this.attackT += dt;

    if (!near) {
      // far LOD: just move the root; skip pose maths (skeleton keeps its last pose). A flier still eases into its bank:
      // it is seen against the sky from far off
      if (this.flight !== null) this.easeTilt(Math.min(1, dt * 5));
      this.applyRoot();
      this.poseFrozen = true;
      return;
    }

    if (this.custom) {
      // a custom rig: advance the shared timers, then the species poses its own bones
      if (this.flinch > 0.001) this.flinch *= Math.exp(-dt * 5.5);
      if (this.brace > 0.001 && this.stunT <= 0) this.brace *= Math.exp(-dt * 7);
      if (this.deathT >= 0) this.deathT = Math.min(1, this.deathT + dt / 0.8);
      this.lookAmt += ((this.alive ? this.lookWeight : 0) - this.lookAmt) * Math.min(1, dt * 4);
      this.applyTerrain(dt);
      const c = this.rigCtx;
      c.dt = dt; c.t = t; c.speed = this.speed; c.strafe = this.strafe; c.phase = this.phase; c.state = this.state; c.alive = this.alive;
      c.deathT = this.deathT; c.flinch = this.flinch; c.brace = smooth01(this.brace); c.attack = this.attackPhase; c.lookWeight = this.lookAmt; c.yaw = this.yaw;
      this.model.species.animate?.(c);
      this.applyRoot();
      this.updateFade(dt);
      return;
    }

    const pose = this.pose;
    pose.fill(0);
    const seed = this.seed;
    // ── blended base layers ──
    const wIdle = W[G_IDLE] ?? 0, wGraze = W[G_GRAZE] ?? 0;
    if (wIdle > 0.001) { this.poseIdle(t, seed); this.accumulate(wIdle); }
    if (wGraze > 0.001) { this.poseGraze(t, seed); this.accumulate(wGraze); }
    for (const g of MOVING_GAITS) { const w = W[g] ?? 0; if (w > 0.001) { this.poseGait(GAITS[g], t, seed); this.accumulate(w); } }

    // ── alert look-at (additive) ──
    const lookTarget = this.alive ? this.lookWeight : 0;
    this.lookAmt += (lookTarget - this.lookAmt) * Math.min(1, dt * 4);
    if (this.lookAmt > 0.001) {
      _v.subVectors(this.lookTarget, this.position);
      let ly = Math.atan2(_v.x, _v.z) - this.yaw;
      ly = Math.atan2(Math.sin(ly), Math.cos(ly));
      ly = THREE.MathUtils.clamp(ly, -1.2, 1.2);
      const dist = Math.hypot(_v.x, _v.z);
      const lp = THREE.MathUtils.clamp(-Math.atan2(_v.y - d.bodyY * 1.6, dist), -0.5, 0.5);
      this.add(P_NECK_Y, ly * 0.55 * this.lookAmt);
      this.add(P_HEAD_Y, ly * 0.45 * this.lookAmt);
      this.add(P_HEAD_P, lp * this.lookAmt);
      // head up (lifts out of a graze), ears pricked forward, neck raised
      this.blendTo(P_NECK1, -0.15, this.lookAmt); this.blendTo(P_NECK2, -0.05, this.lookAmt);
      this.add(P_HEAD_P, (0.12 - (pose[P_HEAD_P] ?? 0)) * this.lookAmt * 0.8);
      this.add(P_EARL_P, -0.35 * this.lookAmt); this.add(P_EARR_P, -0.35 * this.lookAmt);
      this.add(P_EARL_Y, 0.25 * this.lookAmt); this.add(P_EARR_Y, -0.25 * this.lookAmt);
    }

    // ── hit flinch (additive, decays) ──
    if (this.flinch > 0.001) {
      const f = this.flinch;
      this.add(P_BODY_ROLL, this.flinchRoll * f);
      this.add(P_BODY_PITCH, this.flinchPitch * f);
      this.add(P_BODY_Y, -0.06 * f * d.bodyY);
      this.add(P_HEAD_P, 0.35 * f); this.add(P_NECK1, -0.2 * f);
      this.add(P_EARL_P, 0.5 * f); this.add(P_EARR_P, 0.5 * f);
      this.add(P_TAIL_P, -0.6 * f);
      this.flinch *= Math.exp(-dt * 5.5);
    }
    // ── stagger brace (held for the stun, then released): hunkered low, nose down, ears pinned, tail clamped ──
    if (this.brace > 0.001) {
      const b = smooth01(this.brace);
      this.add(P_BODY_Y, -0.14 * b * d.bodyY);
      this.add(P_BODY_PITCH, 0.06 * b);
      this.add(P_NECK1, 0.28 * b); this.add(P_NECK2, 0.12 * b); this.add(P_HEAD_P, 0.25 * b);
      this.add(P_EARL_P, 0.6 * b); this.add(P_EARR_P, 0.6 * b);
      this.add(P_TAIL_P, -0.7 * b);
      for (let l = 0; l < 4; l++) this.add(P_LEG + l * 3 + 1, 0.16 * b);   // knees bent: legs take the shove
      if (this.stunT <= 0) this.brace *= Math.exp(-dt * 7);
    }

    // ── attack wind-up (the manager's charge telegraph on a melee shard): head down, front low, a front hoof paws ──
    if (this.alive && this.attackT >= 0) this.poseWindup(t);

    // ── death collapse ──
    if (this.deathT >= 0) {
      this.deathT = Math.min(1, this.deathT + dt / 0.8);
      const k = smooth01(this.deathT);
      const side = this.deathSide;
      // legs buckle first, then the body rolls onto its side
      const buckle = smooth01(Math.min(1, this.deathT * 1.8));
      const roll = smooth01(Math.max(0, (this.deathT - 0.25) / 0.75));
      const restY = d.halfWidth * 0.95 - d.bodyY;                 // body bone height when lying on its side
      this.blendTo(P_BODY_Y, restY, k);
      this.blendTo(P_BODY_ROLL, side * (Math.PI / 2 - 0.12), roll);
      this.blendTo(P_BODY_PITCH, 0.05, k);
      this.blendTo(P_NECK1, 0.55 - 0.25 * buckle, k); this.blendTo(P_NECK2, 0.35, k);
      this.blendTo(P_HEAD_P, 0.45, k); this.blendTo(P_HEAD_Y, side * 0.25, k); this.blendTo(P_NECK_Y, side * 0.2, k);
      this.blendTo(P_EARL_P, 0.6, k); this.blendTo(P_EARR_P, 0.6, k); this.blendTo(P_EARL_Y, 0, k); this.blendTo(P_EARR_Y, 0, k);
      this.blendTo(P_TAIL_P, 0.3, k); this.blendTo(P_TAIL_Y, 0, k);
      for (let l = 0; l < 4; l++) {
        const front = l < 2, down = (l % 2 === 0) === (side < 0); // legs on the ground side tuck, top legs drape
        this.blendTo(P_LEG + l * 3, (front ? -0.45 : 0.3) * (down ? 1 : 0.6) + 0.2 * buckle, k);
        this.blendTo(P_LEG + l * 3 + 1, (front ? 0.55 : 0.5) * (down ? 1 : 0.7) * buckle, k);
        this.blendTo(P_LEG + l * 3 + 2, (front ? 0.2 : -0.3) * buckle, k);
      }
    }

    this.applyTerrain(dt);
    this.applyPose(dt);
    const post = this.model.species.postPose;
    if (post !== undefined) {
      // species-only motion on top of the standard pose (a horse's mane and rearing, a wolf's jaw) — SpeciesDef.postPose
      const c = this.rigCtx;
      c.dt = dt; c.t = t; c.speed = this.speed; c.strafe = this.strafe; c.phase = this.phase; c.state = this.state; c.alive = this.alive;
      c.deathT = this.deathT; c.flinch = this.flinch; c.brace = smooth01(this.brace); c.attack = this.attackPhase; c.lookWeight = this.lookAmt; c.yaw = this.yaw;
      post(c);
    }
    this.applyRoot();
    this.updateFade(dt);
  }

  /** Show `n` of the fur-shell layers (0 = none; spread across the 8 layers so 4 still spans the coat depth). */
  setShellLevel(n: number): void {
    if (n === this.shellLevel) return;
    if (n > 0 && this.shells.length === 0 && this.makeShells !== undefined) this.shells = this.makeShells(this);
    this.shellLevel = n;
    const N = this.shells.length;
    for (const sh of this.shells) sh.visible = false;
    if (this.hidden) return;
    // pick n layers evenly spaced, always including the outermost
    for (let j = 0; j < Math.min(n, N); j++) { const sh = this.shells[Math.round(((j + 1) * N) / Math.min(n, N)) - 1]; if (sh !== undefined) sh.visible = true; }
  }

  /**
   * Draw LOD, set by the manager from the camera distance (tier.ts animalEyeDist / animalOneDrawDist):
   * 0 = fur / hard / eye, three draws; 1 = the eyes drawn in the hard material (two draws — an eye is under a pixel
   * there); 2 = the whole body in the fur material (one draw — hooves / antlers are a pixel or two). Rigs whose
   * geometry is not the fur / hard / eye split (custom and low-poly models) stay at 0.
   */
  setDrawLod(level: number): void {
    if (level === this.drawLod || this.fadeT >= 0) return;
    const mesh = this.mesh;
    if (this.lodBase === null) {
      if (!Array.isArray(mesh.material) || mesh.material.length !== 3 || eyesInHard(mesh.geometry) === null) return;
      this.lodBase = { geometry: mesh.geometry, materials: mesh.material };
    }
    const { geometry, materials } = this.lodBase;
    const merged = level === 1 ? eyesInHard(geometry) : null;
    const fur = materials[0];
    if (level === 1 && merged !== null) { mesh.geometry = merged; mesh.material = materials; this.drawLod = 1; }
    else if (level === 2 && fur !== undefined) { mesh.geometry = geometry; mesh.material = fur; this.drawLod = 2; }
    else { mesh.geometry = geometry; mesh.material = materials; this.drawLod = 0; }
  }

  /** Fade the (dead) animal out over 1.5 s, then hide it. Used when a carcass has been harvested. */
  fadeOut(): void {
    if (this.fadeT >= 0 || this.hidden) return;
    this.setDrawLod(0);
    this.fadeT = 0;
    this.setShellLevel(0);
    // give this mesh its own transparent materials (hard + eye are shared per model)
    const mats = this.mesh.material as THREE.Material[];
    this.fadeMats = mats.map((m) => { const c = m.clone(); c.transparent = true; c.depthWrite = true; this.prepareMaterial?.(c); return c; });
    // the fur clone loses its rim patch; a plain transparent fade is fine for 1.5 s
    this.mesh.material = this.fadeMats;
  }

  private updateFade(dt: number): void {
    if (this.fadeT < 0) return;
    this.fadeT += dt / 1.5;
    const k = Math.min(1, this.fadeT);
    for (const m of this.fadeMats) m.opacity = 1 - k;
    this.mesh.position.y -= 0.12 * k;                 // sinks into the ground as it goes
    if (k >= 1) { this.hidden = true; this.mesh.visible = false; this.fadeT = -1; }
  }

  /** the charge telegraph, additive on the pose: eased in over the first 30 % of the attack, held, eased out in the last 15 % */
  private poseWindup(t: number): void {
    const ph = this.attackPhase;
    const env = smooth01(Math.min(1, ph / 0.3)) * smooth01(Math.min(1, (1 - ph) / 0.15));
    if (env <= 0.001) return;
    this.add(P_BODY_PITCH, 0.1 * env);                       // nose down, rump up
    this.add(P_BODY_Y, -0.05 * env * this.model.dims.bodyY);
    this.add(P_NECK1, 0.45 * env); this.add(P_NECK2, 0.15 * env); this.add(P_HEAD_P, 0.25 * env);
    this.add(P_EARL_P, 0.55 * env); this.add(P_EARR_P, 0.55 * env);  // ears pinned
    this.add(P_TAIL_P, 0.6 * env);                          // tail up
    const paw = Math.max(0, Math.sin(t * 13 + this.seed * 5));        // the front-right hoof scrapes back, twice a second
    this.add(P_LEG + 1 * 3, (-0.35 + 0.7 * paw) * env); this.add(P_LEG + 1 * 3 + 1, 0.45 * paw * env);
    this.add(P_LEG + 2 * 3 + 1, 0.12 * env); this.add(P_LEG + 3 * 3 + 1, 0.12 * env);  // hind legs load
  }

  // ── pose generators (write into this.tmp) ────────────────────────────────────────────

  private accumulate(w: number): void { const p = this.pose, t = this.tmp; for (let i = 0; i < P_COUNT; i++) p[i] = (p[i] ?? 0) + (t[i] ?? 0) * w; }
  private add(i: number, v: number): void { this.pose[i] = (this.pose[i] ?? 0) + v; }
  private blendTo(i: number, v: number, k: number): void { const cur = this.pose[i] ?? 0; this.pose[i] = cur + (v - cur) * k; }

  private poseIdle(t: number, seed: number): void {
    const p = this.tmp; p.fill(0);
    const br = Math.sin(t * 1.5 + seed * 3);                        // breathing
    p[P_BODY_Y] = 0.006 * br;
    p[P_BODY_PITCH] = 0.004 * br;
    // slow, wandering head + neck (perlin-ish from summed sines)
    const hy = Math.sin(t * 0.37 + seed) * 0.5 + Math.sin(t * 0.91 + seed * 2.3) * 0.3;
    p[P_NECK_Y] = hy * 0.25; p[P_HEAD_Y] = hy * 0.2;
    p[P_NECK1] = 0.02 * Math.sin(t * 0.53 + seed * 1.7) + 0.05;
    p[P_HEAD_P] = 0.1 + 0.06 * Math.sin(t * 0.71 + seed);
    // ear flicks
    const fl = pulse(t, 4.3, seed), fr = pulse(t, 5.7, seed + 0.5);
    p[P_EARL_Y] = 0.15 + fl * 0.6; p[P_EARR_Y] = -0.15 - fr * 0.6;
    p[P_EARL_P] = fl * 0.3 + 0.05 * Math.sin(t * 1.3 + seed); p[P_EARR_P] = fr * 0.3 + 0.05 * Math.cos(t * 1.1 + seed);
    // tail swish
    const sw = 0.5 + 0.5 * Math.sin(t * 0.29 + seed * 4);
    p[P_TAIL_Y] = Math.sin(t * 3.1 + seed) * 0.45 * sw; p[P_TAIL_P] = 0.08 * Math.sin(t * 1.9);
    // relaxed stance: one hind leg slightly cocked
    const cock = ((seed * 10) | 0) % 2 === 0 ? 2 : 3;
    p[P_LEG + cock * 3 + 1] = 0.12; p[P_LEG + cock * 3] = 0.06;
    p[P_LEG + 0 * 3] = 0.03; p[P_LEG + 1 * 3] = -0.03;
  }

  private poseGraze(t: number, seed: number): void {
    this.poseIdle(t, seed);
    const p = this.tmp;
    const gn = this.model.species.pose?.grazeNeck ?? 1;   // a species sets its own (SpeciesDef.pose: the kit boar's 0.3)
    // head to the ground; deer (grazeNeck 1) need the whole neck down, boars (0.3) only nose down a little
    p[P_NECK1] = 0.35 + 0.85 * gn; p[P_NECK2] = 0.2 + 0.75 * gn; p[P_HEAD_P] = 0.35 + 0.35 * gn;
    p[P_NECK_Y] = (p[P_NECK_Y] ?? 0) * 0.6; p[P_HEAD_Y] = (p[P_HEAD_Y] ?? 0) * 0.4;
    // nibbling
    const nib = Math.sin(t * 6 + seed) * 0.5 + 0.5;
    p[P_HEAD_P] += 0.05 * nib; p[P_HEAD_Y] += 0.08 * Math.sin(t * 2.2 + seed);
    // front legs a touch spread / one forward
    p[P_LEG + 0] = 0.1; p[P_LEG + 3] = -0.06;
    p[P_EARL_Y] = 0.5 + 0.3 * pulse(t, 3.1, seed); p[P_EARR_Y] = -0.5 - 0.3 * pulse(t, 4.4, seed + 0.3);
  }

  private poseGait(g: GaitDef, t: number, seed: number): void {
    const p = this.tmp; p.fill(0);
    const ph = this.phase;
    const gallop = g === GAITS[G_GALLOP], trot = g === GAITS[G_TROT];
    for (let l = 0; l < 4; l++) {
      const lp = (ph + (g.offsets[l] ?? 0)) % 1;
      const front = l < 2;
      let upper: number, mid: number, lower: number;
      if (lp < g.stance) {
        const u = lp / g.stance;
        upper = g.amp * (1 - 2 * u);                                 // foot on the ground sweeping back
        mid = 0.12 * g.lift * Math.sin(u * Math.PI) * 0.35;
        lower = 0.1 * Math.sin(u * Math.PI);
        if (u < 0.08 && (this.lastFootPhase[l] ?? 0) > 0.5) this.onFootfall?.(this, gallop ? 1 : trot ? 0.6 : 0.35);
        this.lastFootPhase[l] = 0;
      } else {
        const v = (lp - g.stance) / (1 - g.stance);
        upper = -g.amp + 2 * g.amp * smooth01(v);                    // swing forward
        const lift = Math.sin(v * Math.PI) * g.lift;
        mid = lift * (front ? 0.7 : 0.5);
        lower = lift * (front ? 0.3 : -0.35);
        this.lastFootPhase[l] = v;
      }
      // hind legs: hip drives the thigh; stifle/hock fold
      const amp = front ? 1 : 0.85;
      p[P_LEG + l * 3] = upper * amp;
      p[P_LEG + l * 3 + 1] = front ? mid : mid * 0.9;
      p[P_LEG + l * 3 + 2] = lower;
    }
    const beat = gallop ? Math.sin(ph * Math.PI * 2 + 0.6) : Math.sin(ph * Math.PI * 4);
    p[P_BODY_Y] = g.bob * beat;
    p[P_BODY_PITCH] = g.pitch * (gallop ? Math.sin(ph * Math.PI * 2 - 0.3) : beat) * (gallop ? 1 : 0.5);
    // neck counter-motion + head held forward when running
    p[P_NECK1] = (gallop ? 0.25 : trot ? 0.15 : 0.06) - beat * (gallop ? 0.12 : 0.03);
    p[P_NECK2] = gallop ? 0.1 : 0.03;
    p[P_HEAD_P] = (gallop ? -0.05 : 0.15) + beat * (gallop ? 0.08 : 0.02);
    p[P_HEAD_Y] = Math.sin(t * 0.7 + seed) * 0.08;
    // ears back at speed, tail up when fleeing
    p[P_EARL_P] = gallop ? 0.7 : 0.1; p[P_EARR_P] = gallop ? 0.7 : 0.1;
    p[P_EARL_Y] = 0.2; p[P_EARR_Y] = -0.2;
    p[P_TAIL_P] = gallop ? (this.model.species.pose?.gallopTail ?? 1.0) : 0.1 + 0.15 * beat;   // + = raised
    p[P_TAIL_Y] = Math.sin(ph * Math.PI * 2) * 0.15;
  }

  // ── terrain adaptation ──────────────────────────────────────────────────────────────────

  /** Sample the slope under the body (called by the manager at 10 Hz — heightAt is not free). */
  sampleTerrain(): void {
    if (this.levelGround) { this.tiltPitchT = 0; this.tiltRollT = 0; this.footDeltaT.fill(0); return; }
    // a live flier's body follows its own turn (update), not the slope of the ground far below it
    if (this.flight !== null && this.alive) { this.tiltPitchT = 0; this.footDeltaT.fill(0); return; }
    const d = this.model.dims;
    const sin = Math.sin(this.yaw), cos = Math.cos(this.yaw);
    const L = d.bodyHalfLen * 0.9 * this.scale, W = d.halfWidth * this.scale;
    const hf = heightAt(this.position.x + sin * L, this.position.z + cos * L);
    const hb = heightAt(this.position.x - sin * L, this.position.z - cos * L);
    const hl = heightAt(this.position.x + cos * W, this.position.z - sin * W);
    const hr = heightAt(this.position.x - cos * W, this.position.z + sin * W);
    this.tiltPitchT = Math.atan2(hb - hf, 2 * L);
    this.tiltRollT = Math.atan2(hl - hr, 2 * W);
    // per-foot delta vs the tilted body plane
    const feet = d.feet;
    for (let i = 0; i < Math.min(4, feet.length); i++) {
      const ft = feet[i];
      if (ft === undefined) continue;
      const fx = ft[0] * this.scale, fz = ft[1] * this.scale;
      const wx = this.position.x + cos * fx + sin * fz, wz = this.position.z - sin * fx + cos * fz;
      const planeY = this.groundY - Math.tan(this.tiltPitchT) * fz + Math.tan(this.tiltRollT) * fx;
      this.footDeltaT[i] = THREE.MathUtils.clamp(heightAt(wx, wz) - planeY, -0.35, 0.35);
    }
  }
  private tiltPitchT = 0;  private footDeltaT = new Float32Array(4);

  private easeTilt(k: number): void {
    this.tiltPitch += (this.tiltPitchT - this.tiltPitch) * k;
    this.tiltRoll += (this.tiltRollT - this.tiltRoll) * k;
  }
  private applyTerrain(dt: number): void {
    const k = Math.min(1, dt * 5);
    this.easeTilt(k);
    let minD = 0;
    for (let i = 0; i < 4; i++) {
      this.footDelta[i] = (this.footDelta[i] ?? 0) + ((this.footDeltaT[i] ?? 0) - (this.footDelta[i] ?? 0)) * k;
      minD = Math.min(minD, this.footDelta[i] ?? 0);
    }
    if (!this.alive || this.custom) return;
    const legLen = this.model.dims.legLen;
    const p = this.pose;
    // lower the body so the lowest hoof reaches the ground, flex knees for feet on higher ground
    p[P_BODY_Y] = (p[P_BODY_Y] ?? 0) + minD * 0.7;
    for (let i = 0; i < 4; i++) {
      const dlt = (this.footDelta[i] ?? 0) - minD * 0.7;
      if (dlt > 0.005) {
        const f = Math.min(1.2, dlt / legLen) * 1.6;
        this.add(P_LEG + i * 3 + 1, f);                 // knee/hock flex
        this.add(P_LEG + i * 3, (i < 2 ? 0.25 : -0.15) * f);
        this.add(P_LEG + i * 3 + 2, (i < 2 ? 0.2 : -0.35) * f);
      }
    }
  }

  // ── apply to bones ──────────────────────────────────────────────────────────────────────

  private applyPose(dt: number): void {
    const p = this.pose, b = this.quad, d = this.model.dims;
    if (b === null) return;
    b.body.position.y = d.bodyY + (p[P_BODY_Y] ?? 0);
    b.body.rotation.set(p[P_BODY_PITCH] ?? 0, p[P_BODY_YAW] ?? 0, p[P_BODY_ROLL] ?? 0, 'YXZ');
    b.neck1.rotation.set(p[P_NECK1] ?? 0, (p[P_NECK_Y] ?? 0) * 0.5, 0);
    b.neck2.rotation.set(p[P_NECK2] ?? 0, (p[P_NECK_Y] ?? 0) * 0.5, 0);
    b.head.rotation.set(p[P_HEAD_P] ?? 0, p[P_HEAD_Y] ?? 0, 0);
    b.earL.rotation.set(-(p[P_EARL_P] ?? 0), 0, -(p[P_EARL_Y] ?? 0));   // ear pitch: + = laid back
    b.earR.rotation.set(-(p[P_EARR_P] ?? 0), 0, -(p[P_EARR_Y] ?? 0));
    b.tail.rotation.set(p[P_TAIL_P] ?? 0, 0, p[P_TAIL_Y] ?? 0);
    const dead = !this.alive ? smooth01(Math.max(0, this.deathT)) : 0;
    for (let l = 0; l < 4; l++) {
      const leg = this.legDir[l];
      if (leg === undefined) continue;
      const [u, m, lo] = leg;
      u.rotation.x = -(p[P_LEG + l * 3] ?? 0);
      m.rotation.x = p[P_LEG + l * 3 + 1] ?? 0;
      lo.rotation.x = p[P_LEG + l * 3 + 2] ?? 0;
      // keyframed corpse: legs swing sideways by legAbd; ground is local +X when the body rolled onto its left side
      // (side < 0), local -X otherwise
      u.rotation.z = dead * (this.legAbd[l] ?? 0) * (this.deathSide < 0 ? 1 : -1);
    }
    // breathing: the belly bone swells (visible at a few metres), faster after running
    if (this.alive) {
      const rate = 1.4 + 2.6 * Math.min(1, this.speed / 6);
      this.breathPhase += rate * dt * 2 * Math.PI * 0.45;
      const br = 0.5 + 0.5 * Math.sin(this.breathPhase);
      const sc = 1 + 0.045 * br;
      b.belly.scale.set(sc, sc * 0.85, 1 + 0.01 * br);
    }
  }
  private breathPhase = 0;

  private applyRoot(): void {
    const m = this.mesh;
    m.position.copy(this.position);
    // a custom rig has no flinch in its bones' pose code here: the whole body leans away from the blow instead
    const f = this.custom && this.alive ? this.flinch * 1.8 : 0;
    m.rotation.set(this.tiltPitch + this.flinchPitch * f, this.yaw, this.tiltRoll + this.flinchRoll * f, 'YXZ');
  }
}

export { P_COUNT };

/**
 * The fur / hard / eye rig geometry with the eye range folded into the hard group (same buffers, one group fewer),
 * cached per geometry; null when the groups are not that contiguous three-way split.
 */
const eyesMerged = new WeakMap<THREE.BufferGeometry, THREE.BufferGeometry | null>();
function eyesInHard(g: THREE.BufferGeometry): THREE.BufferGeometry | null {
  const hit = eyesMerged.get(g);
  if (hit !== undefined) return hit;
  const [fur, hard, eye] = g.groups;
  let out: THREE.BufferGeometry | null = null;
  const split = g.groups.length === 3 && fur?.materialIndex === 0 && hard?.materialIndex === 1 && eye?.materialIndex === 2;
  if (split && eye.start === hard.start + hard.count) {
    out = new THREE.BufferGeometry();
    out.setIndex(g.index);
    for (const [name, attr] of Object.entries(g.attributes)) out.setAttribute(name, attr);
    out.morphAttributes = g.morphAttributes; out.morphTargetsRelative = g.morphTargetsRelative;
    out.boundingSphere = g.boundingSphere; out.boundingBox = g.boundingBox;
    out.addGroup(fur.start, fur.count, 0);
    out.addGroup(hard.start, hard.count + eye.count, 1);
  }
  eyesMerged.set(g, out);
  return out;
}
