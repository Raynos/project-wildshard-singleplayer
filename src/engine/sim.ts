import { Vector3 } from 'three';
import { Scope } from './app/scope';
import { withOwner } from './app/ownership';
import { Events } from './events/events';
import { GameClock } from './core/clock';
import { RngService } from './core/rng';
import { FIXED_STEP } from './core/fixedStep';
import { AnimalSim, type AnimalSimSpec } from './entities/AnimalSim';
import { StrikeRunner, type StrikeSpec } from './ai/strikes';
import { canReach } from './ai/reach';
import { CombatPipeline } from './combat/pipeline';
import { PlayerHealth } from './combat/health';
import { Physics } from './physics/Physics';
import { CharacterMotor } from './physics/CharacterMotor';
import { addImpulse, decayImpulse } from './player/impulse';
import { fallStep, groundedVelocity, hardFallHit, hardLanding } from './player/fall';
import type { Rapier } from './physics/rapier';
import { groups } from './physics/groups';
import { tagCollider } from './physics/surface';
import { Flags } from './world/interact/flags';
import { QuestState, type QuestDef } from './quest/core';

/** The embedded simulation contract. Versions change when level or command semantics change. */
export const SIM_API_VERSION = 1;
/** Serializable F1 extension values, without callbacks or renderer objects. */
export type SimValue = null | boolean | number | string | SimValue[] | { [key: string]: SimValue };
/** Script instance memory, module globals, authored quest data and ledger dedupe live on the host. */
export interface SimSlots {
  scriptMemory: Record<string, SimValue>; scriptGlobals: Record<string, SimValue>;
  questState: Record<string, SimValue>; ledgerDedupe: string[];
}
/** Pure strike data. The host supplies the constant selection weight. */
export type SimStrike = Omit<StrikeSpec, 'weight'>;
/** One authored creature spawn, with its instance identity independent of view or streaming. */
export interface SimSpawn {
  id: string; spec: AnimalSimSpec; seed: number; scale: number;
  at: { x: number; y: number; z: number }; yaw: number; strike?: SimStrike;
}
/** A renderer-free level. F1 installs richer behaviours through scoped step callbacks. */
export interface SimLevel {
  version: number; id: string; seed: number;
  ground: { size: number; height: number };
  player: { at: { x: number; y: number; z: number }; yaw: number; speed: number };
  entities: readonly SimSpawn[]; weapon: SimStrike; quests: readonly QuestDef[];
}
/** Resolved world-space movement and an optional targeted attack for one fixed tick. */
export interface SimCommand { moveX: number; moveZ: number; yaw: number; attack?: { targetId: string } }
/** Each future brain/script instance registers its own continuation state, never a process singleton. */
export interface SimStateAdapter {
  snapshot: () => SimValue; restore: (value: SimValue) => void;
  /** Reconnect saved native handles after world replacement and owner tagging, without allocating or stepping gameplay. */
  physicsRestored?: () => void;
}

/** The existing page owns this traveller, its health update and its one physics/movement step. */
export interface SimExternalPlayer { position: Vector3; readonly yaw: number; health: PlayerHealth; owner: object }

/** Borrowed client state is stepped and disposed by its existing world owner. */
export interface SimHostPorts {
  rapier: Rapier; physics?: Physics; player?: { id: string; position: Vector3; yaw: number; health: PlayerHealth; motor: CharacterMotor };
  events?: Events; clock?: GameClock; combat?: CombatPipeline; scope?: Scope;
  ground?: boolean; heightAt?: (x: number, z: number) => number;
  /** Grid-only native flat boundary lattice; absent preserves the standalone two-triangle datum. */
  groundResolution?: 256 | 257;
  /** Frozen grid neighbours have logical player state, but no player capsule or controller. */
  playerBody?: boolean;
  fixedStep?: (run: () => void) => () => void;
}

/** A session-local 60 Hz host using the same creature motion, damage, strikes, events and physics as the client. */
export class SimHost {
  readonly level: SimLevel;
  readonly scope: Scope;
  readonly events: Events;
  readonly clock: GameClock;
  readonly rng: RngService;
  readonly flags: Flags;
  readonly quests: QuestState[];
  readonly entities = new Map<string, AnimalSim>();
  readonly strikes = new Map<string, StrikeRunner>();
  readonly adapters = new Map<string, SimStateAdapter>();
  readonly state = { tick: 0, accumulator: 0, timers: {} as Record<string, number> };
  readonly slots: SimSlots = { scriptMemory: {}, scriptGlobals: {}, questState: {}, ledgerDedupe: [] };
  readonly combat: CombatPipeline;
  physics: Physics;
  readonly player: { id: string; position: Vector3; yaw: number; health: PlayerHealth; motor: CharacterMotor };
  private readonly callbacks = new Map<string, (dt: number, host: SimHost) => void>();
  private readonly weapons = new Map<string, StrikeSpec>();
  private readonly dynamicActors = new Set<string>();
  private readonly targetIds = new Map<string, string>();
  private readonly wanted = new Vector3();
  /** The owned player's transient world velocity (m/s), the client Player's impulse law (player/impulse.ts). */
  readonly playerImpulse = new Vector3();
  /** The owned player's vertical speed (m/s, negative = falling) and whether the motor last stood it on ground, the client
   * Player's on-foot fall law (player/fall.ts). At rest (grounded, still) an idle tick leaves the player untouched. */
  readonly playerFall = { vy: 0, grounded: true };
  private readonly direction = new Vector3();
  private readonly hitOrigin = new Vector3();
  private readonly hitPoint = new Vector3();
  private disposed = false;
  readonly embedded: boolean;
  private readonly ownsPlayer: boolean;
  private playerMotor: CharacterMotor | undefined;
  private externalPlayer: { value: SimExternalPlayer; health: PlayerHealth; scope: Scope } | undefined;
  private heightAt: (x: number, z: number) => number;
  private floorQuery: ((x: number, z: number, fromY: number, maxDrop: number) => number | undefined) | undefined;

  constructor(level: SimLevel, ports: SimHostPorts) {
    if (level.version !== SIM_API_VERSION) throw new RangeError('Unsupported simulation level version');
    if (!Number.isFinite(level.ground.height) || !Number.isFinite(level.ground.size) || level.ground.size <= 0
      || !Number.isFinite(level.player.speed) || level.player.speed < 0) throw new RangeError('Invalid simulation level');
    const ids = level.entities.map((entity) => entity.id);
    if (new Set(ids).size !== ids.length || ids.includes(ports.player?.id ?? 'actor.player')) throw new Error('Duplicate simulation entity identity');
    if ((ports.physics === undefined) !== (ports.player === undefined) || (ports.physics !== undefined && (ports.events === undefined || ports.clock === undefined || ports.combat === undefined))) throw new Error('Borrowed simulation needs physics, player, events, clock and combat together');
    if (ports.fixedStep !== undefined && ports.physics === undefined) throw new Error('A fixed-step driver belongs to a borrowed world');
    if (ports.groundResolution !== undefined && ![256, 257].includes(ports.groundResolution)) throw new RangeError('Invalid native ground resolution');
    this.embedded = ports.physics !== undefined; this.ownsPlayer = ports.player === undefined;
    this.level = level; this.scope = ports.scope?.child(`sim:${level.id}`) ?? new Scope(`sim:${level.id}`); this.rng = new RngService(level.seed);
    this.heightAt = ports.heightAt ?? (() => level.ground.height);
    this.events = ports.events ?? new Events(); this.clock = ports.clock ?? new GameClock();
    this.physics = ports.physics ?? new Physics(ports.rapier, undefined, this.scope);
    if (ports.ground !== false && !this.embedded) {
      const count = ports.groundResolution ?? 2;
      const ground = this.physics.world.createCollider(ports.rapier.ColliderDesc.heightfield(count - 1, count - 1,
      new Float32Array(count ** 2).fill(level.ground.height), { x: level.ground.size, y: 1, z: level.ground.size }).setCollisionGroups(groups('WORLD')));
      tagCollider(ground, 'ground');
    }
    this.combat = ports.combat ?? new CombatPipeline(this.events, this.scope, () => this.physics);
    const position = new Vector3(level.player.at.x, level.player.at.y, level.player.at.z);
    const health = new PlayerHealth(this.events, { now: () => this.clock.now * 1000, position: () => position, dodging: () => false, dodgeGuard: () => false });
    if (ports.player !== undefined && ports.playerBody === false) throw new Error('A borrowed player owns its motor');
    this.playerMotor = ports.player === undefined && ports.playerBody !== false ? this.motor('PLAYER', 0.35, 1.8, health.id) : undefined;
    this.playerMotor?.resetAt(position);
    const readMotor = (): CharacterMotor => { if (this.playerMotor === undefined) throw new Error('Frozen simulation has no player motor'); return this.playerMotor; };
    const writeMotor = (motor: CharacterMotor): void => { this.playerMotor = motor; };
    this.player = ports.player ?? { id: health.id, position, yaw: level.player.yaw, health,
      get motor(): CharacterMotor { return readMotor(); }, set motor(motor: CharacterMotor) { writeMotor(motor); } };
    if (this.ownsPlayer) this.combat.playerRules(this.scope, { target: health });
    this.flags = new Flags(level.id, false);
    this.quests = level.quests.map((def) => new QuestState(def, this.flags, this.events, this.scope));
    this.strikes.set(this.player.id, new StrikeRunner());
    this.weapons.set(this.player.id, { ...level.weapon, weight: () => 1 });
    for (const spawn of level.entities) this.createActor(spawn);
    this.events.on('actor.died', ({ actor }) => { this.flags.set(`dead:${actor.id}`); }, this.scope);
    this.scope.onDispose(() => {
      this.disposed = true;
      this.externalPlayer?.scope.dispose(); this.externalPlayer = undefined;
      if (this.ownsPlayer) this.playerMotor?.dispose();
      for (const entity of this.entities.values()) entity.motor?.dispose();
      if (!this.embedded) this.physics.dispose();
    });
    if (!this.embedded) this.physics.step();
    if (ports.fixedStep !== undefined) {
      this.scope.onDispose(ports.fixedStep(() => { this.stepEmbedded(); }));
    }
  }
  private createActor(spawn: SimSpawn): AnimalSim {
    const entity = new AnimalSim(spawn.spec, spawn.seed, spawn.scale, spawn.id, {
      heightAt: (x, z) => this.heightAt(x, z), now: () => this.clock.now * 1000,
      floorBelow: (x, z, fromY, maxDrop) => this.floorQuery === undefined ? this.heightAt(x, z) : this.floorQuery(x, z, fromY, maxDrop),
      random: () => this.rng.stream('gameplay').next(), hit: (req) => this.combat.hit(req),
    });
    entity.place(spawn.at.x, spawn.at.z, spawn.yaw, spawn.at.y);
    const body = this.motor('CREATURE', spawn.spec.dims.bodyRadius * spawn.scale, spawn.spec.dims.bodyY * spawn.scale * 2, spawn.id);
    // The capsule starts at the spawn: a creature that never walks (an idle boss) never moves it, and Rapier would
    // otherwise leave it at the world origin, an invisible wall at the cell centre (G222 playtest #7).
    body.resetAt(entity.position);
    entity.motor = body;
    this.entities.set(spawn.id, entity);
    if (spawn.strike !== undefined) {
      this.strikes.set(spawn.id, new StrikeRunner()); this.weapons.set(spawn.id, { ...spawn.strike, weight: () => 1 });
    }
    return entity;
  }
  /** Materialize a trusted deferred actor. Stable identity and immutable recipe are included in exact continuation.
   * The installer reinstalls the saved dynamic roster before restore; native motors belong to this host, never its caller.
   */
  spawn(spawn: SimSpawn): AnimalSim {
    if (this.disposed || this.entities.has(spawn.id) || spawn.id === this.player.id || this.adapters.has(`runtime.actor.${spawn.id}`) || this.callbacks.has(`runtime.actor.${spawn.id}`)
      || !/^[a-zA-Z0-9._:-]{1,128}$/u.test(spawn.id) || ![spawn.seed, spawn.scale, spawn.at.x, spawn.at.y, spawn.at.z, spawn.yaw].every(Number.isFinite) || spawn.scale <= 0) throw new Error('Invalid dynamic simulation actor');
    const recipe = structuredClone(spawn), contract = JSON.stringify(recipe);
    const actor = withOwner(null, () => this.createActor(recipe));
    this.dynamicActors.add(spawn.id);
    this.adapters.set(`runtime.actor.${spawn.id}`, { snapshot: () => contract, restore: saved => {
      if (saved !== contract) throw new Error('Incompatible dynamic simulation actor recipe');
    } });
    return actor;
  }
  /** Retire only an explicitly spawned actor and its native motor/strike. Static level actors retain their existing lifetime. */
  retire(id: string): boolean {
    if (this.disposed) throw new Error('Simulation host is disposed');
    if (!this.dynamicActors.has(id)) return false;
    this.entities.get(id)?.motor?.dispose(); this.dynamicActors.delete(id); this.entities.delete(id); this.strikes.delete(id); this.weapons.delete(id);
    this.adapters.delete(`runtime.actor.${id}`);
    for (const [source, target] of this.targetIds) if (source === id || target === id) {
      this.strikes.get(source)?.cancel(); this.entities.get(source)?.cancelAttack(); this.targetIds.delete(source);
    }
    return true;
  }
  /** Exact restore resolves pending strikes from the currently installed static or trusted dynamic recipe. */
  strikeSpecifications(id: string): readonly StrikeSpec[] {
    const spec = this.weapons.get(id);
    return spec === undefined ? [] : [{ ...spec, shape: { ...spec.shape }, tags: [...spec.tags] }];
  }
  private motor(group: 'PLAYER' | 'CREATURE', radius: number, height: number, owner: string): CharacterMotor {
    return new CharacterMotor(this.physics, { radius, height, step: 0.3, maxClimbDeg: 45, snap: 0.2, group, blockedBy: ['WORLD', 'PLAYER', 'CREATURE'], owner });
  }
  /** Reinstall the admitted terrain height query before a fresh host's same-engine continuation resumes. */
  setHeightQuery(heightAt: (x: number, z: number) => number): void { this.heightAt = heightAt; }
  /** Opt into layered native ground queries, including flight, after admitted colliders install or reconnect.
   * The default keeps the existing analytic height reader; a missing native floor stays undefined over a void.
   */
  setFloorQuery(query: (x: number, z: number, fromY: number, maxDrop: number) => number | undefined): void { this.floorQuery = query; }
  /** Read admitted frame-local terrain without decoding a second copy for the page traveller. */
  groundHeightAt(x: number, z: number): number {
    if (!Number.isFinite(x) || !Number.isFinite(z)) throw new RangeError('Invalid regional ground query');
    return this.heightAt(x, z);
  }
  /** True only while this regional world owns the traveller's capsule and controller. */
  get hasPlayerMotor(): boolean { return this.embedded || this.playerMotor !== undefined; }
  /** Freeze a regional host after its checkpoint; its authored creatures and colliders remain available for views. */
  detachPlayerMotor(): void {
    if (this.embedded) throw new Error('Borrowed player motor belongs to its world owner');
    if (this.playerMotor !== undefined) this.releasePlayerMotor().dispose();
  }
  /** Transfer ownership after a prepared frame commit has already retired the old collider. */
  releasePlayerMotor(): CharacterMotor {
    if (this.embedded || this.playerMotor === undefined) throw new Error('Invalid regional motor release');
    const motor = this.playerMotor; this.playerMotor = undefined; return motor;
  }
  /** Commit a prepared motor, without allocating or stepping during the fixed-step frame change. */
  attachPlayerMotor(motor: CharacterMotor): void {
    if (this.embedded || this.playerMotor !== undefined || this.disposed) throw new Error('Invalid regional motor attachment');
    this.playerMotor = motor;
  }
  /** Bind the page traveller to an owned bodyless region; deactivation leaves the page's health and motor intact. */
  bindExternalPlayer(value: SimExternalPlayer): () => void {
    if (this.disposed || this.embedded || this.hasPlayerMotor || this.externalPlayer !== undefined || value.health.id !== this.player.id) throw new Error('Invalid external regional player');
    const scope = new Scope(`sim:${this.level.id}:traveller`), binding = { value, health: this.player.health, scope };
    this.externalPlayer = binding; this.player.health = value.health;
    this.combat.playerRules(scope, { target: value.health });
    return () => {
      if (this.externalPlayer !== binding) return;
      scope.dispose(); this.player.health = binding.health; this.externalPlayer = undefined;
    };
  }
  /** Trusted page-object alias used only by same-engine continuation encoding, never author-selected query input. */
  isExternalPlayerObject(value: unknown): boolean { return this.externalPlayer !== undefined && value === this.externalPlayer.value.owner; }
  /** One active region's systems/local clock after the page move; no physics, player, health or page event phase advances. */
  stepExternal(): void {
    const external = this.externalPlayer;
    if (this.disposed || external === undefined || this.embedded) throw new Error('External regional player is not bound');
    const { position, yaw } = external.value;
    if (![position.x, position.y, position.z, yaw].every(Number.isFinite)) throw new RangeError('Invalid external player pose');
    this.events.beginFrame(); this.clock.tick(FIXED_STEP);
    this.player.position.copy(position); this.player.yaw = yaw;
    this.stepSystems(); this.events.flush('fixed.post');
  }
  /** Preflight a fixed-step registration without installing a callback or consuming any simulation state. */
  hasStep(id: string): boolean { return this.callbacks.has(id); }
  /** Scoped fixed-step work; removing a registration also releases its future snapshot adapter. */
  onStep(id: string, run: (dt: number, host: SimHost) => void, adapter?: SimStateAdapter): () => void {
    if (this.disposed || this.callbacks.has(id) || this.adapters.has(id)) throw new Error(`Invalid simulation registration ${id}`);
    this.callbacks.set(id, run); if (adapter !== undefined) this.adapters.set(id, adapter);
    let registered = true;
    let forget: () => void = () => undefined;
    const remove = (): void => {
      if (!registered) return;
      registered = false; forget(); // an early remove drops the host scope's hold on `run`
      this.callbacks.delete(id); this.adapters.delete(id);
    };
    forget = this.scope.capture('disposers', remove); return remove;
  }
  /** Shove the owned player: add transient world velocity in m/s, carried by the motor with each step's own move and
   * decayed after it exactly as the client Player's `impulse` (player/impulse.ts). A borrowed player owns its impulse. */
  impulsePlayer(velocity: Readonly<Vector3>): void {
    if (this.disposed || this.embedded) throw new Error('Borrowed simulation player owns its impulse');
    addImpulse(this.playerImpulse, velocity);
  }
  /** One simulation tick. No wall clock, renderer, active app or device input is consulted. */
  step(command?: SimCommand): void {
    if (this.disposed) throw new Error('Simulation host is disposed');
    if (this.embedded) throw new Error('Borrowed simulation uses the existing fixed-step driver');
    if (!this.hasPlayerMotor) throw new Error('Frozen simulation cannot step');
    if (command !== undefined && ![command.moveX, command.moveZ, command.yaw].every(Number.isFinite)) throw new RangeError('Invalid simulation command');
    this.events.beginFrame(); this.clock.tick(FIXED_STEP);
    this.physics.step();
    const shoved = this.playerImpulse.lengthSq() > 0, fall = this.playerFall;
    if (command !== undefined || shoved || !fall.grounded || fall.vy !== 0) {
      if (command === undefined) this.wanted.set(0, 0, 0);
      else {
        this.player.yaw = command.yaw;
        this.wanted.set(command.moveX, 0, command.moveZ).clampLength(0, 1).multiplyScalar(this.level.player.speed * FIXED_STEP);
      }
      if (shoved) { this.wanted.addScaledVector(this.playerImpulse, FIXED_STEP); decayImpulse(this.playerImpulse, FIXED_STEP); }
      // gravity first, then the whole move (walk + fall + impulse) through the motor, as the client Player's walk step.
      // Walking on the ground (grounded, no vertical speed, a sideways move) the step adds no downward push: the motor's
      // snap-to-ground holds the feet as the client's one-tick push does, without snagging on a collider seam; the tick
      // the motor loses the ground takes that tick's gravity, so the fall speed runs exactly the client's from there.
      const standing = fall.grounded && fall.vy === 0 && (this.wanted.x !== 0 || this.wanted.z !== 0);
      if (!standing) fall.vy = fallStep(fall.vy, FIXED_STEP);
      this.wanted.y += fall.vy * FIXED_STEP;
      const moved = this.player.motor.move(this.player.position, this.wanted);
      if (moved.grounded) {
        // touching down from the air: a hard landing files the client's fall hit (PlayerHurt.fall); the headless ground is dry
        if (!fall.grounded && hardLanding(fall.vy, 0)) this.combat.hit(hardFallHit(this.player.health, this.player.position));
        fall.vy = groundedVelocity(fall.vy);
      } else if (standing) fall.vy = fallStep(fall.vy, FIXED_STEP);
      fall.grounded = moved.grounded;
      if (command?.attack !== undefined) this.startStrike(this.player.id, command.attack.targetId);
    }
    this.stepSystems();
    this.player.health.update(FIXED_STEP); this.events.flush('fixed.post');
  }
  /** Called once by the client's fixed.post slot; it never advances physics, clock, player or event phases. */
  stepEmbedded(): void {
    if (this.disposed || !this.embedded) throw new Error('Invalid borrowed simulation step');
    this.stepSystems();
  }
  private stepSystems(): void {
    this.state.tick++;
    for (const key of Object.keys(this.state.timers)) this.state.timers[key] = Math.max(0, (this.state.timers[key] ?? 0) - FIXED_STEP);
    for (const run of this.callbacks.values()) run(FIXED_STEP, this);
    for (const [id, runner] of this.strikes) this.updateStrike(id, runner);
    for (const entity of this.entities.values()) entity.step(FIXED_STEP);
  }
  /** Accumulate elapsed simulation seconds; a caller can submit exactly the same command tape after restoration. */
  advance(seconds: number, command?: SimCommand): number {
    if (this.disposed) throw new Error('Simulation host is disposed');
    if (this.embedded) throw new Error('Borrowed simulation uses the existing fixed-step driver');
    if (!Number.isFinite(seconds) || seconds < 0) throw new RangeError('Invalid simulation delta');
    if (command !== undefined && ![command.moveX, command.moveZ, command.yaw].every(Number.isFinite)) throw new RangeError('Invalid simulation command');
    this.state.accumulator += seconds; let ticks = 0;
    while (this.state.accumulator + Number.EPSILON >= FIXED_STEP) { this.state.accumulator -= FIXED_STEP; this.step(command); ticks++; }
    return ticks;
  }
  /** Start an authored strike; active/recovery/cooldown timing remains in StrikeRunner. */
  startStrike(sourceId: string, targetId: string): boolean {
    const runner = this.strikes.get(sourceId), spec = this.weapons.get(sourceId), source = this.entities.get(sourceId), target = this.entities.get(targetId);
    const position = sourceId === this.player.id ? this.player.position : source?.position;
    const targetPosition = targetId === this.player.id ? this.player.position : target?.position;
    if (runner === undefined || spec === undefined || runner.busy || position === undefined || targetPosition === undefined) return false;
    const actor = source ?? this.playerActor();
    if (!actor.alive) return false;
    runner.start(spec, actor, targetPosition); this.targetIds.set(sourceId, targetId); return true;
  }
  private playerActor() {
    return { position: this.player.position, yaw: this.player.yaw, scale: 1, alive: this.player.health.alive,
      startAttack: (_seconds: number) => { /* Weapon runner owns the clock. */ }, cancelAttack: () => { /* Weapon runner owns the clock. */ },
      setMotion: (_yaw: number, _speed: number, _turn: number) => { /* Commands own player movement. */ } };
  }
  private updateStrike(id: string, runner: StrikeRunner): void {
    const targetId = this.targetIds.get(id), source = this.entities.get(id), target = targetId === undefined ? undefined : this.entities.get(targetId);
    const health = targetId === this.player.id ? this.player.health : target?.combatActor();
    const position = targetId === this.player.id ? this.player.position : target?.position;
    if (health === undefined || position === undefined) return;
    const actor = source ?? this.playerActor();
    runner.update(FIXED_STEP, { actor, target: position, canReach: () => source === undefined ? true : canReach(source, position, this.physics), hit: (spec) => {
      this.direction.subVectors(position, actor.position).normalize();
      this.hitOrigin.copy(actor.position); this.hitOrigin.y += source === undefined ? 1.2 : source.dims.bodyY * source.scale;
      this.hitPoint.copy(position); this.hitPoint.y += target === undefined ? 1.2 : target.dims.bodyY * target.scale;
      this.combat.hit({ source: source?.combatActor() ?? this.player.health, sourceTags: spec.tags, target: health,
        amount: spec.damage, point: this.hitPoint, dir: this.direction, from: this.hitOrigin, moveId: spec.id });
    } });
  }
  /** Timed attack targets are host state; snapshot restoration must reconnect them before replay. */
  attackTargets(): readonly [string, string][] { return [...this.targetIds]; }
  restoreAttackTargets(entries: readonly (readonly [string, string])[]): void { this.targetIds.clear(); for (const [id, target] of entries) this.targetIds.set(id, target); }
  dispose(): void {
    if (this.disposed) return; this.disposed = true;
    this.scope.dispose();
  }
}
/** Embed a level with an initialized Rapier module. Its own scope owns teardown, independently of the caller's ambient page callback. */
export function createSimHost(level: SimLevel, ports: SimHostPorts): SimHost { return withOwner(null, () => new SimHost(level, ports)); }
