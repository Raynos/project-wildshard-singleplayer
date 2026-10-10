import { validateLocalMovement, type LocalMovementCommand } from './input/commands';
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
import { CharacterMotor, PLAYER_BODY, type MotorOptions } from './physics/CharacterMotor';
import { BodyBandClocks, creatureBodyDistance, creatureBodyShape, keepsCreatureBody, tickDistance, type BandsState } from './sim/bands';
import type { TickRate } from './app/scheduler';
import { addImpulse, decayImpulse } from './player/impulse';
import { fallStep, groundedVelocity, hardFallHit, hardLanding, landingCushion } from './player/fall';
import { hitShoveSpeed, shoveHop, startShove, stepShove, type ShoveState } from './player/shove';
import { boardShoved, HOVER_HARD_LANDING, stepBoard, type BoardPorts, type BoardState, type BoardStepOut } from './player/board';
import { hoverSpeed } from './player/hoverSpeed';
import { COYOTE_MS, JUMP_SPEED, jump as jumpLaw, jumpClock, jumpSpeed, type JumpState } from './player/jump';
import { deepWater, entryKeep, pondBob, stepSwim, swimEntry, swimStroke, wadeFraction, type SwimPorts, type SwimState } from './player/swim';
import { wadeScale } from './player/walk';
import { modeCollides, PlayerModes, type ModePlayer } from './player/modes';
import { DODGE_DIST, DODGE_TIME, dashBlocked, dashToward, dodgeHeading, startDash, startDodge, stepDash, stepDodge, type DashState, type DodgeState } from './player/dash';
import { floorBelow } from './physics/query';
import type { Rapier } from './physics/rapier';
import { groups } from './physics/groups';
import { tagCollider } from './physics/surface';
import { Flags } from './world/interact/flags';
import { QuestState, type QuestDef } from './quest/core';
import type { DayCycle, DayCycleClock, DayCycleSpec } from './world/dayCycle';
import { clockDayPhase, clockPeriod, wrapClock, type DayClockState } from './sim/dayClock';

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
  /** SF72: where the day clock a runtime installs (SimHost.useDayClock) starts, in that clock's own units (its spec's
   *  `start`: the day fraction for a 'phase' clock, the hour for an 'hour' clock), over the clock's own start. A witness
   *  sets it to begin near dusk without ticking a whole day. Absent keeps the level's exact bytes. */
  day?: { start: number };
}
/** Resolved world-space movement and an optional targeted attack for one fixed tick. */
export interface SimCommand extends LocalMovementCommand {
  moveX: number; moveZ: number; yaw: number; attack?: { targetId: string };
  /** The HOVER press this tick (SF72): steps on or off the hoverboard, as the client's `hover` action toggles
   * `Player.setHover(!hover)`. A press, not a held state: `advance`, which repeats its command, refuses it. */
  hover?: true;
  /** The JUMP press this tick (SF72): on foot the client Player's jump (player/jump.ts: on the ground or within its
   * 100 ms coyote window, else the double jump), on the board the board jump. A press: `advance` refuses it. */
  jump?: true;
  /** The DODGE press this tick (SF72): the client Player's dodge (player/dash.ts) toward this command's move, a backstep
   * with none; refused on its 0.8 s cooldown and on the board. A press: `advance` refuses it. */
  dodge?: true;
  /** SF34: the DIVE and SURFACE controls held this tick while swimming (player/swim.ts; the page's Space / Shift and the
   *  touch discs). Held states, so `advance` repeats them; read only by a host with water (useWater). */
  dive?: boolean; surface?: boolean;
}
/** Resident on-foot tuning supplied by an owned driver; the ordinary native motor, fall and jump remain authoritative. */
export interface SimWalkingControl { readonly speed: number; readonly crouching: boolean }
/** Combat's motion input, not corrected displacement. Delegated movement owns these same scalar observations. */
export interface SimPlayerMotionSample {
  readonly velocityX: number; readonly velocityZ: number;
  readonly grounded: boolean; readonly swimming: boolean; readonly hover: boolean;
}
/** One owned host's alternative player-motion law, without changing its single physics/system authority.
 * Input runs before physics and returns true only while it owns motion; step then runs after physics instead of the
 * ordinary walk/board/dodge/jump. False retains that ordinary law. Register mutable state through a SimStateAdapter. */
export interface SimPlayerDriver {
  /** Consulted only when input returns false, outside board motion; absent keeps the level speed and ordinary jump. */
  readonly walking?: SimWalkingControl;
  /** Queried after step, only when a motion observer is installed. Missing delegated samples are unavailable. */
  readonly motionSample?: () => SimPlayerMotionSample;
  input: (command: Readonly<SimCommand> | undefined, dt: number, host: SimHost) => boolean;
  step: (dt: number, host: SimHost) => void;
}
/**
 * SF34: the water an owned host's player wades and swims in (SimHost.useWater), the level's water bodies as the page
 * Player reads them (app.world.water): the rest surface, and the surface's swell over it.
 */
export interface SimWater {
  /** the rest water surface at (x, z), or null on dry land (the page's `app.world.water.restAt`) */
  surfaceAt: (x: number, z: number) => number | null;
  /** the surface's swell over its rest level at (x, z) (a sea's waves); absent = the pond's gentle bob on the host clock */
  bob?: (x: number, z: number) => number;
}
/** Each future brain/script instance registers its own continuation state, never a process singleton. */
export interface SimStateAdapter {
  snapshot: () => SimValue; restore: (value: SimValue) => void;
  /** Reconnect saved native handles after world replacement and owner tagging, without allocating or stepping gameplay. */
  physicsRestored?: () => void;
}

/**
 * SF72: run this host's bodies on the page's distance bands (sim/bands.ts), as the page's AnimalManager runs a native
 * shard's creatures: each body's update cadence on its tick rate ('ai': every tick within 60 m of the player, every
 * other tick with the two ticks' time to 160 m, paused beyond) and the physics body LOD (a creature motor in the page's
 * capsule only within 45 m, released past 55 m). Off by default: a host that never opts in keeps every body stepped and
 * collided every tick, and its exact snapshot bytes.
 */
export interface SimBodyBands {
  /** Tick rates by id over the page scheduler's defaults ('always', 'ai', 'npc', 'fx', 'weather') and the manager's
   *  'legacy' (decisions 10 Hz, the body every tick at any distance): the level's tier `ticks`. */
  rates?: Readonly<Record<string, TickRate>>;
  /** A body's rate id this tick (the page's AnimalManager.tickRate); default 'always' for a driven or fight-scripted
   *  ('sidestep') body, else 'ai'. A body that changes rate starts a fresh clock, as on the page. */
  rate?: (body: AnimalSim) => string;
  /** Roster presence, independent of distance: an absent body has no brain/body clock, and physics LOD releases its motor. The roster owns this
   * predicate and restores its state before the next tick. Omitted means every installed body remains present. */
  present?: (body: AnimalSim) => boolean;
  /** The physics body LOD (default true); false keeps every body's host motor. */
  physics?: boolean;
}

/** Hooks around each body's own step (SimHost.useBodyStep), in the host's body order: the page creature manager's per-body
 *  loop runs a body's `act` right before it moves and its contact checks right after, before the next body acts. */
export interface SimBodyStep {
  before?: (id: string, body: AnimalSim, dt: number) => void;
  after?: (id: string, body: AnimalSim, dt: number) => void;
}

/** The day clock a host steps: the page's DayCycle (world/dayCycle.ts), read through its usual query surface. */
type SimDayClock = DayCycleClock & Pick<DayCycle, 'snapshot' | 'restore'> & { readonly spec: Pick<DayCycleSpec, 'units' | 'schedule' | 'dayFraction'> };

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
  private playerDriver: SimPlayerDriver | undefined;
  private playerMotionObserver: { receive: (sample: SimPlayerMotionSample | null) => void; sample: { velocityX: number; velocityZ: number; grounded: boolean; swimming: boolean; hover: boolean } } | undefined;
  private readonly callbacks = new Map<string, (dt: number, host: SimHost) => void>();
  private readonly afterCallbacks = new Map<string, (dt: number, host: SimHost) => void>();
  private readonly weapons = new Map<string, StrikeSpec>();
  private readonly dynamicActors = new Set<string>();
  private readonly targetIds = new Map<string, string>();
  private readonly wanted = new Vector3();
  /** The owned player's transient world velocity (m/s), the client Player's impulse law (player/impulse.ts). */
  readonly playerImpulse = new Vector3();
  /** The owned player's vertical speed (m/s, negative = falling) and whether the motor last stood it on ground, the client
   * Player's on-foot fall law (player/fall.ts). At rest (grounded, still) an idle tick leaves the player untouched. */
  readonly playerFall = { vy: 0, grounded: true };
  /** The owned player's running creature-hit knockback, the client Player's shove law (player/shove.ts). */
  readonly playerShove: ShoveState = { t: 0, vx: 0, vz: 0 };
  /** The owned player's hoverboard (SF72): on the board, each step runs the client Player's board law (player/board.ts)
   * instead of the walk, and the board-only colliders (boardColliders) collide. Off by default. */
  readonly playerBoard: BoardState & { on: boolean } = { on: false, hoverAir: false, hoverBob: 0, onGround: false };
  /** The riding board's world velocity (m/s), the client Player's `velocity` while it hovers; zero on foot. */
  readonly boardVelocity = new Vector3();
  /** SF34: the owned player's swim (player/swim.ts, the client Player's water law), only on a host with water
   *  (useWater): on once the feet float, with the law's dive, haul-out and stroke clocks. */
  readonly playerSwim: SwimState & { on: boolean; stood: boolean } = { on: false, diving: false, climbTo: null, climbCooldown: 0, strokeTime: 0, stood: false };
  /** The swimming player's world velocity (m/s), the client Player's `velocity` while it swims; zero otherwise. */
  readonly swimVelocity = new Vector3();
  /**
   * SF34: the player's modes, the page Player's own registry (player/modes.ts) over this host's player: the motor mode
   * (foot, board, swim, wade) read from the host's own state, and a driven mode a runtime declares and enters
   * (`modes.register(def, scope)`, `modes.enter('ride', driver)`), whose SimPlayerDriver then owns the player's motion
   * ahead of any usePlayerDriver driver until `modes.exit`. The entered driver is not snapshot state: the installer
   * re-enters it from its own adapter's continuation before native restore, as usePlayerDriver's.
   */
  readonly modes = new PlayerModes<SimPlayerDriver>(this.modePlayer());
  private modeDriver: SimPlayerDriver | null = null;
  private water: SimWater | undefined;
  private readonly swimOut: { water: number | null } = { water: null };
  private readonly swimPorts: SwimPorts = {
    move: (feet, want) => this.player.motor.move(feet, want, true),
    water: (x, z) => this.water?.surfaceAt(x, z) ?? null,
    ground: () => this.groundUnderFeet(),
    platforms: [],
    floor: (x, z, fromY, maxDrop) => floorBelow(this.physics, x, z, fromY, maxDrop, this.player.motor.collider),
    bob: (x, z) => this.water?.bob?.(x, z) ?? pondBob(this.clock.now),
    leave: () => { this.leaveSwim(); },
  };
  /** The owned player's on-foot jump clocks (player/jump.ts), or null until the first JUMP press (SF72): tracking starts
   * there (grounded: the client's own state; in the air: no coyote window left), so a host that never jumps keeps its
   * exact snapshot bytes. */
  playerJump: JumpState | null = null;
  /** The owned player's running dash: a dodge's burst or a lunge (dashTo), the client Player's dash law (player/dash.ts). */
  readonly playerDash: DashState = { t: 0, vx: 0, vz: 0 };
  /** The owned player's dodge clocks (cooldown, the burst's i-frames read by its health's `dodging`). */
  readonly playerDodge: DodgeState = { cd: 0, t: 0 };
  private readonly dashVelocity = { x: 0, z: 0 };
  private readonly dodgeDir = { x: 0, z: 0 };
  private boardHandles: number[] = [];
  private readonly boardOut: BoardStepOut = { lat: 0, fwd: 0, accel: 0, water: null };
  private readonly boardPorts: BoardPorts = {
    move: (feet, want) => { this.player.motor.move(feet, want, true); },
    ground: () => this.groundUnderFeet(),
    // the level's water (useWater): the board rides its surface, as the client's; none without it
    water: (x, z) => this.water?.surfaceAt(x, z) ?? null,
    jumped: () => { this.events.emit('player.jump', true); },
    // a hard board touchdown files the client's fall hit (Player.onLand(hard) → PlayerHurt.fall)
    landed: (speed) => { if (speed > HOVER_HARD_LANDING) this.combat.hit(hardFallHit(this.player.health, this.player.position)); },
  };
  private readonly direction = new Vector3();
  private readonly hitOrigin = new Vector3();
  private readonly hitPoint = new Vector3();
  private disposed = false;
  readonly embedded: boolean;
  private readonly ownsPlayer: boolean;
  private playerMotor: CharacterMotor | undefined;
  private externalPlayer: { value: SimExternalPlayer; health: PlayerHealth; scope: Scope } | undefined;
  private heightAt: (x: number, z: number) => number;
  private bands: { clocks: BodyBandClocks; rate: (body: AnimalSim) => string; present: ((body: AnimalSim) => boolean) | undefined; physics: boolean } | undefined;
  private bodyStep: SimBodyStep | undefined;
  private floorQuery: ((x: number, z: number, fromY: number, maxDrop: number) => number | undefined) | undefined;
  private day: SimDayClock | undefined;

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
    const health = new PlayerHealth(this.events, { now: () => this.clock.now * 1000, position: () => position, dodging: () => this.playerDodge.t > 0, dodgeGuard: () => false });
    if (ports.player !== undefined && ports.playerBody === false) throw new Error('A borrowed player owns its motor');
    this.playerMotor = ports.player === undefined && ports.playerBody !== false ? this.motor('PLAYER', 0.35, 1.8, health.id) : undefined;
    this.playerMotor?.resetAt(position);
    const readMotor = (): CharacterMotor => { if (this.playerMotor === undefined) throw new Error('Frozen simulation has no player motor'); return this.playerMotor; };
    const writeMotor = (motor: CharacterMotor): void => { this.playerMotor = motor; };
    this.player = ports.player ?? { id: health.id, position, yaw: level.player.yaw, health,
      get motor(): CharacterMotor { return readMotor(); }, set motor(motor: CharacterMotor) { writeMotor(motor); } };
    if (this.ownsPlayer) {
      this.combat.playerRules(this.scope, { target: health });
      // a creature's blow knocks the owned player back, as the client's PlayerHurt shoves its Player on `feel.blow`
      this.events.on('damage.dealt', ({ req, dealt }) => {
        if (req.target === this.player.health && this.externalPlayer === undefined && this.hasPlayerMotor && req.sourceTags.includes('feel.blow')) this.shovePlayer(req.point.x, req.point.z, hitShoveSpeed(dealt));
      }, this.scope);
    }
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
    // under the physics body LOD a body spawns bodiless, as on the page: the next tick's sync gives it one when near
    if (this.bands?.physics !== true) {
      const body = this.motor('CREATURE', spawn.spec.dims.bodyRadius * spawn.scale, spawn.spec.dims.bodyY * spawn.scale * 2, spawn.id);
      // The capsule starts at the spawn: a creature that never walks (an idle boss) never moves it, and Rapier would
      // otherwise leave it at the world origin, an invisible wall at the cell centre (G222 playtest #7).
      body.resetAt(entity.position);
      entity.motor = body;
    }
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
    if (this.disposed || this.entities.has(spawn.id) || spawn.id === this.player.id || this.adapters.has(`runtime.actor.${spawn.id}`) || this.hasStep(`runtime.actor.${spawn.id}`)
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
    this.adapters.delete(`runtime.actor.${id}`); this.bands?.clocks.forget(id);
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
  /** The player's capsule on the page's body law (PLAYER_BODY: ITEM bodies stop it and its 80 kg pushes them), a creature's
   * on the page's creature filter. */
  private motor(group: 'PLAYER' | 'CREATURE', radius: number, height: number, owner: string): CharacterMotor {
    const law = group === 'PLAYER' ? PLAYER_BODY : { group, blockedBy: ['WORLD', 'PLAYER', 'CREATURE'] as const };
    return new CharacterMotor(this.physics, { radius, height, step: 0.3, maxClimbDeg: 45, snap: 0.2, ...law, owner });
  }
  /** Opt into the page's distance bands for every body (SimBodyBands), once, before the first step; the installer runs
   * it again on a restoring host, before restore. The physics body LOD drops the bodies' host motors at once. */
  useBodyBands(options: SimBodyBands = {}): void {
    if (this.disposed || this.embedded || this.bands !== undefined) throw new Error('Body bands belong to an owned host, once');
    const clocks = new BodyBandClocks(options.rates);
    this.bands = { clocks, rate: options.rate ?? ((body) => body.driven || body.state === 'sidestep' ? 'always' : 'ai'),
      present: options.present, physics: options.physics ?? true };
    if (this.bands.physics) for (const entity of this.entities.values()) { entity.motor?.dispose(); entity.motor = null; }
  }
  /** Wrap every body's step (SimBodyStep), once, by the installer that owns the bodies' brains (restoring too: hooks hold
   *  no state of the host's). A body that does not step this tick (paused, the off tick of 'half') runs neither hook. */
  useBodyStep(hooks: SimBodyStep): void {
    if (this.disposed || this.bodyStep !== undefined) throw new Error('Body step hooks belong to one installer, once');
    this.bodyStep = hooks;
  }
  /** Bind one active player-motion driver to this owned host. Borrowed, frozen and disposed hosts refuse; the returned
   * remover releases the scope's reference early. Reinstall alongside its continuation adapter before native restore. */
  usePlayerDriver(driver: SimPlayerDriver): () => void {
    if (this.disposed || this.embedded || !this.ownsPlayer || !this.hasPlayerMotor || this.playerDriver !== undefined) throw new Error('Player driver belongs to one owned active host');
    this.playerDriver = driver;
    let installed = true;
    let forget: () => void = () => undefined;
    const remove = (): void => {
      if (!installed) return;
      installed = false; forget();
      if (this.playerDriver === driver) this.playerDriver = undefined;
    };
    forget = this.scope.capture('disposers', remove); return remove;
  }
  /** Observe owned movement before gameplay callbacks. Native walk samples commanded/shove/dash velocity before the
   * motor, excluding transient impulse velocity, then publishes post-move ground/hover state. Board samples its own
   * velocity. An alternative driver supplies its own sample or null is delivered. The native sample is reused: copy
   * scalars if retaining it. Observers and delegated mutable samples own their continuation; absent preserves all bytes. */
  observePlayerMotion(observer: (sample: SimPlayerMotionSample | null) => void): () => void {
    if (this.disposed || this.embedded || !this.ownsPlayer || !this.hasPlayerMotor || this.playerMotionObserver !== undefined) throw new Error('Player motion observer belongs to one owned active host');
    const binding = { receive: observer, sample: { velocityX: 0, velocityZ: 0, grounded: true, swimming: false, hover: false } };
    this.playerMotionObserver = binding;
    let installed = true, forget: () => void = () => undefined;
    const remove = (): void => {
      if (!installed) return;
      installed = false; forget();
      if (this.playerMotionObserver === binding) this.playerMotionObserver = undefined;
    };
    forget = this.scope.capture('disposers', remove); return remove;
  }
  /** Whether the host runs on body bands, and with the physics body LOD. */
  get bodyBands(): { physics: boolean } | undefined { return this.bands === undefined ? undefined : { physics: this.bands.physics }; }
  /** This tick's update step for body `id` (s): the fixed step without bands; with them 0 while paused or on the off
   * tick of 'half' (the next takes both ticks). Asked first in a tick it fixes the tick's value, as the page's clock. */
  bodyDt(id: string): number {
    const entity = this.entities.get(id);
    if (entity === undefined) throw new RangeError(`Unknown simulation body ${id}`);
    const bands = this.bands;
    if (bands === undefined) return FIXED_STEP;
    if (entity.harnessHold || bands.present?.(entity) === false) { bands.clocks.forget(id); return 0; }
    return bands.clocks.bodyDt(id, bands.rate(entity), tickDistance(entity.position, this.player.position));
  }
  /** Take this tick's decision step for body `id` on its band (the page scheduler's takeBrainDt): 0 until its rate's
   * period has passed, the time since its last decision when due; `urgent` (a hit, a lost sight line) wakes it now.
   * Without bands every tick decides (the fixed step). */
  brainDt(id: string, urgent = false): number {
    const entity = this.entities.get(id);
    if (entity === undefined) throw new RangeError(`Unknown simulation body ${id}`);
    const bands = this.bands;
    if (bands === undefined) return FIXED_STEP;
    if (bands.present?.(entity) === false) { bands.clocks.forget(id); return 0; }
    return bands.clocks.takeBrainDt(id, bands.rate(entity), tickDistance(entity.position, this.player.position), urgent);
  }
  /** The page's creature capsule for a body under the physics body LOD (physics/creatures.ts's recipe), owned by its id. */
  creatureMotorOptions(entity: AnimalSim): MotorOptions {
    return { ...creatureBodyShape(entity.dims, entity.scale), group: 'CREATURE', blockedBy: ['WORLD', 'PLAYER', 'CREATURE'], owner: entity.entityId };
  }
  /** The band clocks as plain values (SimSnapshot.bands); undefined without bands. */
  bodyBandState(): BandsState | undefined { return this.bands?.clocks.snapshot(); }
  /** Exact band restore: saved state is refused unless this host runs on the same bands, and the reverse. */
  restoreBodyBands(saved: BandsState | undefined): void {
    if ((saved === undefined) !== (this.bands === undefined)) throw new RangeError('Snapshot body bands do not match');
    if (saved !== undefined) this.bands?.clocks.restore(saved, new Set(this.entities.keys()));
  }
  /** CreatureBodies.sync's physics body LOD, before the tick's decisions as on the page. */
  private syncBodies(): void {
    const player = this.player.position;
    for (const entity of this.entities.values()) {
      const keep = this.bands?.present?.(entity) !== false
        && keepsCreatureBody(entity.motor !== null, entity.alive, entity.driven, creatureBodyDistance(entity.position, player));
      if (entity.motor === null && keep) {
        const motor = new CharacterMotor(this.physics, this.creatureMotorOptions(entity));
        motor.resetAt(entity.position); // at the animal, not the world origin (G222 playtest #7)
        entity.motor = motor;
      } else if (entity.motor !== null && !keep) { entity.motor.dispose(); entity.motor = null; }
    }
  }
  /**
   * SF72: step the page's own day clock on this host, once, at install (a restoring host installs it again before
   * restore): build the shard's DayCycle exactly as its page sky does (its spec, cycle, scale) and hand it here. It then
   * advances one fixed step at the start of every tick, before the step callbacks, so a runtime reads `dayPhase`,
   * `night`, `dusk`, `hour` and hears `onDusk` / `onNight` / `onPhase` as the page's systems do. The level's `day.start`
   * (if any) moves it there first, silently. It rides the strict snapshot as `day` with exact restore; a host without a
   * clock keeps its exact bytes. Returns the clock.
   */
  useDayClock<C extends SimDayClock>(clock: C): C {
    if (this.disposed || this.embedded || this.day !== undefined) throw new Error('A day clock belongs to an owned host, once');
    const start = this.level.day?.start;
    if (start !== undefined) {
      if (!Number.isFinite(start)) throw new RangeError('Invalid simulation day start');
      const value = wrapClock(start, clockPeriod(clock.spec));
      clock.restore({ ...clock.snapshot(), value, last: clockDayPhase(clock.spec, value) });
    }
    this.day = clock;
    return clock;
  }
  /** The installed day clock, if any (its query surface: hour, phase, dayPhase, night, dusk, onDusk…). */
  get dayClock(): DayCycleClock | undefined { return this.day; }
  /** The day clock as plain values (SimSnapshot.day); undefined without a clock. */
  dayClockState(): DayClockState | undefined { return this.day?.snapshot(); }
  /** Exact day clock restore: saved state is refused unless this host has a clock, and the reverse. */
  restoreDayClock(saved: DayClockState | undefined): void {
    if ((saved === undefined) !== (this.day === undefined)) throw new RangeError('Snapshot day clock does not match');
    if (saved !== undefined) this.day?.restore(saved);
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
  hasStep(id: string): boolean { return this.callbacks.has(id) || this.afterCallbacks.has(id); }
  /** Scoped fixed-step work before bodies by default; afterBodies matches equipment following creature contact.
   * Removing a registration releases its future snapshot adapter. Registration order remains snapshot order. */
  onStep(id: string, run: (dt: number, host: SimHost) => void, adapter?: SimStateAdapter, phase: 'beforeBodies' | 'afterBodies' = 'beforeBodies'): () => void {
    if (this.disposed || this.hasStep(id) || this.adapters.has(id)) throw new Error(`Invalid simulation registration ${id}`);
    const callbacks = phase === 'afterBodies' ? this.afterCallbacks : this.callbacks;
    callbacks.set(id, run); if (adapter !== undefined) this.adapters.set(id, adapter);
    let registered = true;
    let forget: () => void = () => undefined;
    const remove = (): void => {
      if (!registered) return;
      registered = false; forget(); // an early remove drops the host scope's hold on `run`
      callbacks.delete(id); this.adapters.delete(id);
    };
    forget = this.scope.capture('disposers', remove); return remove;
  }
  /** Shove the owned player: add transient world velocity in m/s, carried by the motor with each step's own move and
   * decayed after it exactly as the client Player's `impulse` (player/impulse.ts). A borrowed player owns its impulse. */
  impulsePlayer(velocity: Readonly<Vector3>): void {
    if (this.disposed || this.embedded) throw new Error('Borrowed simulation player owns its impulse');
    addImpulse(this.playerImpulse, velocity);
    if (this.playerBoard.on) boardShoved(this.playerBoard, velocity.y); // an upward shove (an updraft) lifts the board off
  }
  /** Knock the owned player `speed` m/s away from (fromX, fromZ), exactly as the client Player's `shove`: the knockback
   * overrides the walk input and fades over SHOVE_TIME through the motor, and a grounded player hops off the ground. */
  shovePlayer(fromX: number, fromZ: number, speed: number): void {
    if (this.disposed || this.embedded) throw new Error('Borrowed simulation player owns its knockback');
    if (![fromX, fromZ, speed].every(Number.isFinite)) throw new RangeError('Invalid player knockback');
    if (this.playerBoard.on || this.playerSwim.on) return; // the client Player ignores a creature's knockback on the board and swimming
    startShove(this.playerShove, this.player.position.x, this.player.position.z, fromX, fromZ, this.player.yaw, speed);
    this.playerDash.t = 0; // a knockback ends a dash
    const fall = this.playerFall;
    if (fall.grounded) { fall.vy = shoveHop(fall.vy); fall.grounded = false; }
  }
  /** Dash the owned player at (vx, vz) m/s for `time` s, whatever the input says: the client Player's `dash` (a shard's
   * knock-down). The dash law's own rules hold (player/dash.ts: a wall ends it, a knockback cancels it, its last step
   * brakes). False (nothing happens) on the board or for no time. */
  dashPlayer(vx: number, vz: number, time: number): boolean {
    if (this.disposed || this.embedded) throw new Error('Borrowed simulation player owns its dash');
    if (![vx, vz, time].every(Number.isFinite)) throw new RangeError('Invalid player dash');
    if (this.playerBoard.on || this.playerSwim.on) return false;
    return startDash(this.playerDash, vx, vz, time);
  }
  /** Dash the owned player toward (x, z), stopping `stopAt` m short, over `time` s: the client Player's `dashTo`, a sword's
   * lunge (combat/sweptMeleeCore `sweptLunge` gives the numbers). The dash overrides the walk, a wall ends it, a knockback
   * cancels it. False (nothing happens) when already that close, or on the board. */
  dashTo(x: number, z: number, stopAt: number, time: number): boolean {
    if (this.disposed || this.embedded) throw new Error('Borrowed simulation player owns its dash');
    if (![x, z, stopAt, time].every(Number.isFinite)) throw new RangeError('Invalid player dash');
    if (this.playerBoard.on || this.playerSwim.on) return false;
    return dashToward(this.playerDash, this.player.position.x, this.player.position.z, x, z, stopAt, time);
  }
  /** The DODGE press: the client Player's dodge (no lock-on headless) toward the command's world move, a backstep with
   * none (yaw = the command's), at DODGE_DIST / DODGE_TIME; the cooldown and the burst start, and 'player.dodge' fires. */
  private dodgePlayer(command: SimCommand): void {
    if (this.playerDodge.cd > 0 || this.playerBoard.on || this.playerSwim.on) return;
    const heading = this.dodgeDir, v = DODGE_DIST / DODGE_TIME;
    dodgeHeading(command.moveX, command.moveZ, command.yaw, heading);
    if (!startDash(this.playerDash, heading.x * v, heading.z * v, DODGE_TIME)) return;
    startDodge(this.playerDodge, 1);
    this.events.emit('player.dodge', true);
  }
  /** Step the owned player on or off the hoverboard, as the client Player's `setHover`: on, the board starts from the
   * feet's vertical speed with no horizontal speed (the host's walk keeps none) and is not yet riding; off, the board's
   * vertical speed becomes the fall's and the feet drop from the ride height. The board-only colliders follow on the
   * next step, before physics, as the client's movers sync before its world step. */
  setBoard(on: boolean): void {
    if (this.disposed || this.embedded) throw new Error('Borrowed simulation player owns its board');
    const board = this.playerBoard, fall = this.playerFall;
    if (on === board.on) return;
    if (on && this.playerSwim.on) { this.leaveSwim(); fall.vy = this.swimVelocity.y; fall.grounded = false; this.swimVelocity.set(0, 0, 0); } // the client's setHover ends the swim
    board.on = on; board.hoverAir = false; board.hoverBob = 0; board.onGround = false;
    if (on) { this.boardVelocity.set(0, fall.vy, 0); fall.vy = 0; fall.grounded = true; }
    else { fall.vy = this.boardVelocity.y; fall.grounded = false; this.boardVelocity.set(0, 0, 0); }
  }
  /** The client Player's ground with no floor functions: the terrain, or the first WORLD floor within 80 m under the
   *  feet + 0.5 m (decks, islands and, while riding, the board-only decks), for the board, the swim and the wade. */
  private groundUnderFeet(): number {
    const p = this.player.position, g = this.heightAt(p.x, p.z);
    const c = floorBelow(this.physics, p.x, p.z, p.y + 0.5, 80, this.player.motor.collider);
    return c !== undefined && c > g ? c : g;
  }
  /** The registry's view of this host's player: the mode driver slot and the motor state. */
  private modePlayer(): ModePlayer<SimPlayerDriver> {
    const read = (): SimPlayerDriver | null => this.modeDriver, write = (driver: SimPlayerDriver | null): void => { this.modeDriver = driver; };
    const hover = (): boolean => this.playerBoard.on, swimming = (): boolean => this.playerSwim.on, wading = (): boolean => this.playerWading;
    return { get ride() { return read(); }, set ride(driver) { write(driver); }, get hover() { return hover(); }, get swimming() { return swimming(); }, get wading() { return wading(); } };
  }
  /** The player's current mode (SF34): an entered driven mode, else the motor mode (board, swim, wade, foot). */
  get playerMode(): ReturnType<PlayerModes['current']> { return this.modes.current(); }
  /** Water over the standing player's feet (SF34: a host with water, on foot, grounded, the feet more than 2 cm under). */
  get playerWading(): boolean {
    // the tick the swimmer stands up is on foot, not yet wading, as the client Player's (its wade resolves on the next walk)
    if (this.water === undefined || this.playerBoard.on || this.playerSwim.on || this.playerSwim.stood || !this.playerFall.grounded) return false;
    return this.waterDepth() > 0.02;
  }
  /** m of water over the feet right now (0 dry, or without water). */
  private waterDepth(): number {
    const p = this.player.position, ws = this.water?.surfaceAt(p.x, p.z) ?? null;
    return ws === null ? 0 : Math.max(0, ws - p.y);
  }
  /**
   * SF34: give the owned player the level's water (SimWater), once, before the first step; the installer runs it again
   * on a restoring host, before restore. From then the client Player's water law (player/swim.ts) holds headless: on foot
   * the feet wade (the walk slows by the wade, the jump saps, a landing in water is soft, a dash stops at deep water),
   * past SWIM_IN they swim (the command's dive / surface held), and the board rides the surface. A host without water
   * keeps its exact bytes.
   */
  useWater(water: SimWater): void {
    if (this.disposed || this.embedded || !this.ownsPlayer || this.water !== undefined) throw new Error('Water belongs to an owned host, once');
    this.water = water;
  }
  /** Whether the host has water (useWater). */
  get hasWater(): boolean { return this.water !== undefined; }
  /** Start swimming, as the client Player's hand-over from the walk: the fall speed is mostly eaten by the splash. */
  private enterSwim(vx: number, vz: number): void {
    const swim = this.playerSwim, fall = this.playerFall;
    swim.on = true; swim.strokeTime = 0;
    this.swimVelocity.set(vx, fall.vy * entryKeep(fall.vy), vz);
    fall.vy = 0; fall.grounded = false;
    this.events.emit('player.swim', true);
  }
  /** Stop swimming (the swim law's `leave`, or the board): the dive and the haul-out let go, as the client's setSwimming(false). */
  private leaveSwim(): void {
    const swim = this.playerSwim;
    if (!swim.on) return;
    swim.on = false; swim.climbTo = null; swim.diving = false;
    this.events.emit('player.swim', false);
  }
  /** The swim step: the client Player's law (player/swim.ts) on the command's world move; then back on foot when it leaves. */
  private stepSwimPlayer(command: SimCommand | undefined): void {
    if (command !== undefined) this.player.yaw = command.yaw;
    let mx = command?.moveX ?? 0, mz = command?.moveZ ?? 0;
    const len = Math.hypot(mx, mz);
    if (len > 1) { mx /= len; mz /= len; }
    this.playerImpulse.set(0, 0, 0); this.playerDash.t = 0;
    const v = this.swimVelocity, fall = this.playerFall;
    const left = stepSwim(this.player.position, v, this.wanted, this.playerSwim, { mx, mz, len, dive: command?.dive === true, surface: command?.surface === true }, this.swimPorts, FIXED_STEP, this.swimOut);
    if (left === 'dry') { fall.vy = v.y; fall.grounded = false; v.set(0, 0, 0); }
    else if (left === 'stood') { fall.vy = 0; fall.grounded = true; v.set(0, 0, 0); this.playerSwim.stood = true; }
    else swimStroke(this.playerSwim, v, FIXED_STEP, () => undefined);
    if (command?.attack !== undefined) this.startStrike(this.player.id, command.attack.targetId);
  }
  /** Deep water at (x, z) where a dash stops (player/swim.ts deepWater over the host's terrain and colliders). */
  private deepAt(x: number, z: number): boolean {
    return deepWater(x, z, this.player.position.y, this.water?.surfaceAt(x, z) ?? null, this.heightAt(x, z), [],
      (fx, fz, fromY, maxDrop) => floorBelow(this.physics, fx, fz, fromY, maxDrop, this.player.motor.collider));
  }
  /** Register board-only colliders (Sky Reach's hover decks and updraft, `Piece.active` = the player is on the board):
   * enabled only while the owned player rides, synced every step before physics. Their handles are snapshot state. */
  boardColliders(colliders: readonly { readonly handle: number }[]): void {
    if (this.disposed || this.embedded) throw new Error('Board-only colliders belong to an owned host');
    for (const collider of colliders) {
      if (this.boardHandles.includes(collider.handle) || !this.physics.world.colliders.contains(collider.handle)) throw new Error('Invalid board-only collider');
      this.boardHandles.push(collider.handle);
    }
    this.syncBoardColliders();
  }
  /** The registered board-only collider handles, in registration order (SimSnapshot.boardColliders). */
  boardColliderHandles(): readonly number[] { return [...this.boardHandles]; }
  /** Exact restore: the saved handles, each present in the restored world, then synced to the restored board. */
  restoreBoardColliders(handles: readonly number[]): void {
    if (new Set(handles).size !== handles.length || handles.some((handle) => !this.physics.world.colliders.contains(handle))) throw new RangeError('Snapshot board collider does not exist');
    this.boardHandles = [...handles]; this.syncBoardColliders();
  }
  private syncBoardColliders(): void {
    const on = modeCollides('board', this.modes.current()); // the page's Piece.mode rule (SF34)
    for (const handle of this.boardHandles) { const collider = this.physics.world.getCollider(handle); if (collider.isEnabled() !== on) collider.setEnabled(on); }
  }
  /** The board step: the client Player's law (player/board.ts) on the command's world move, then the impulse decays. */
  private stepBoardPlayer(command: SimCommand | undefined): void {
    if (command !== undefined) this.player.yaw = command.yaw;
    let mx = command?.moveX ?? 0, mz = command?.moveZ ?? 0;
    const len = Math.hypot(mx, mz);
    if (len > 1) { mx /= len; mz /= len; }
    stepBoard(this.player.position, this.boardVelocity, this.playerImpulse, this.wanted, this.playerBoard,
      { mx, mz, len, yaw: this.player.yaw, top: hoverSpeed(), capped: false, jump: command?.jump === true }, this.boardPorts, FIXED_STEP, this.boardOut);
    decayImpulse(this.playerImpulse, FIXED_STEP);
    if (command?.attack !== undefined) this.startStrike(this.player.id, command.attack.targetId);
  }
  /** One simulation tick. No wall clock, renderer, active app or device input is consulted. */
  step(command?: SimCommand): void {
    if (this.disposed) throw new Error('Simulation host is disposed');
    if (this.embedded) throw new Error('Borrowed simulation uses the existing fixed-step driver');
    if (!this.hasPlayerMotor) throw new Error('Frozen simulation cannot step');
    if (command !== undefined) {
      if (![command.moveX, command.moveZ, command.yaw].every(Number.isFinite)) throw new RangeError('Invalid simulation command');
      validateLocalMovement(command);
      if ((command.dive !== undefined && typeof command.dive !== 'boolean') || (command.surface !== undefined && typeof command.surface !== 'boolean')) throw new RangeError('Invalid held swim control');
    }
    this.events.beginFrame(); this.clock.tick(FIXED_STEP);
    // an entered driven mode's driver (SF34, modes.enter) owns the motion ahead of a usePlayerDriver driver
    const driver = this.modeDriver ?? this.playerDriver, delegated = driver?.input(command, FIXED_STEP, this) === true;
    const observeMotion = this.playerMotionObserver;
    if (observeMotion !== undefined) { observeMotion.sample.velocityX = 0; observeMotion.sample.velocityZ = 0; }
    const walking = delegated ? undefined : driver?.walking;
    if (walking !== undefined && (!Number.isFinite(walking.speed) || walking.speed < 0 || typeof walking.crouching !== 'boolean')) throw new RangeError('Invalid walking control');
    // the HOVER press lands in the ordinary input phase; an active alternative driver owns its own motion switches
    if (!delegated && command?.hover === true) this.setBoard(!this.playerBoard.on);
    if (this.boardHandles.length > 0) this.syncBoardColliders();
    this.physics.step();
    // An unanswered ask returns its numeric dt input; only an explicit true claims motion.
    const traversal: unknown = delegated ? false : this.events.ask('player.traversal', FIXED_STEP);
    const traversed = traversal === true;
    if (delegated) {
      driver.step(FIXED_STEP, this);
      if (command?.attack !== undefined) this.startStrike(this.player.id, command.attack.targetId);
    }
    else if (traversed) {
      this.playerImpulse.set(0, 0, 0);
      if (command?.attack !== undefined) this.startStrike(this.player.id, command.attack.targetId);
    }
    else {
      const shoved = this.playerImpulse.lengthSq() > 0, fall = this.playerFall, knocked = this.playerShove, dash = this.playerDash, dodge = this.playerDodge;
      // the DODGE press, then the dodge clocks, as the client Player's step; the board ends a dash
      if (command?.dodge === true) this.dodgePlayer(command);
      if (dodge.cd > 0 || dodge.t > 0) stepDodge(dodge, dash.t > 0, FIXED_STEP);
      const water = this.water;
      if (!this.playerSwim.on) this.playerSwim.stood = false; // last tick's stand-up is over
      if (this.playerBoard.on) { dash.t = 0; this.stepBoardPlayer(command); }
      else if (this.playerSwim.on) this.stepSwimPlayer(command);
      else if (command !== undefined || shoved || knocked.t > 0 || dash.t > 0 || !fall.grounded || fall.vy !== 0) {
        // SF34 the wade (player/swim.ts): last step's water over the grounded feet slows the walk and saps the jump
        const wadeT = water === undefined ? 0 : wadeFraction(fall.grounded, this.waterDepth());
        if (command === undefined) this.wanted.set(0, 0, 0);
        else {
          this.player.yaw = command.yaw;
          const speed = walking?.speed ?? (water === undefined ? this.level.player.speed : this.level.player.speed * wadeScale(wadeT));
          this.wanted.set(command.moveX, 0, command.moveZ).clampLength(0, 1).multiplyScalar(speed * FIXED_STEP);
        }
        if (knocked.t > 0) {
          // knocked back: the shove overrides the walk and fades out; the motor stops it at a wall
          const k = stepShove(knocked, FIXED_STEP);
          this.wanted.x = knocked.vx * k * FIXED_STEP; this.wanted.z = knocked.vz * k * FIXED_STEP;
        } else if (dash.t > 0) {
          // a dash (dodge / lunge) overrides the walk; its last step brakes; deep water just ahead (with water) ends it
          stepDash(dash, FIXED_STEP, this.player.position.x, this.player.position.z, water === undefined ? () => false : (x, z) => this.deepAt(x, z), this.dashVelocity);
          this.wanted.x = this.dashVelocity.x * FIXED_STEP; this.wanted.z = this.dashVelocity.z * FIXED_STEP;
        }
        const walkX = this.wanted.x / FIXED_STEP, walkZ = this.wanted.z / FIXED_STEP;
        if (observeMotion !== undefined) { observeMotion.sample.velocityX = walkX; observeMotion.sample.velocityZ = walkZ; }
        if (shoved) { this.wanted.addScaledVector(this.playerImpulse, FIXED_STEP); decayImpulse(this.playerImpulse, FIXED_STEP); }
        // gravity first, then the whole move (walk + fall + impulse) through the motor, as the client Player's walk step.
        // Walking on the ground (grounded, no vertical speed, a sideways move) the step adds no downward push: the motor's
        // snap-to-ground holds the feet as the client's one-tick push does, without snagging on a collider seam; the tick
        // the motor loses the ground takes that tick's gravity, so the fall speed runs exactly the client's from there.
        // the jump (player/jump.ts) on last step's ground, before the step's gravity, as the client Player's walk
        if (this.playerJump !== null) jumpClock(this.playerJump, fall.grounded, FIXED_STEP);
        if (command?.jump === true) {
          this.playerJump ??= { ago: fall.grounded ? 0 : Infinity, left: 1 };
          const vy = jumpLaw(this.playerJump, fall.grounded, fall.vy, COYOTE_MS, walking?.crouching === true, water === undefined ? JUMP_SPEED : jumpSpeed(wadeT));
          if (vy !== null) { fall.vy = vy; fall.grounded = false; this.events.emit('player.jump', true); }
        }
        const standing = fall.grounded && fall.vy === 0 && (this.wanted.x !== 0 || this.wanted.z !== 0);
        if (!standing) fall.vy = fallStep(fall.vy, FIXED_STEP);
        this.wanted.y += fall.vy * FIXED_STEP;
        const moved = this.player.motor.move(this.player.position, this.wanted);
        dashBlocked(dash, moved.horizontalFreedom, this.dashVelocity); // a dash that runs into a wall ends there
        // SF34 with water: the client Player's hand-over to the swim, and the water's cushion on a landing
        const p = this.player.position, ws = water === undefined ? null : water.surfaceAt(p.x, p.z), g = ws === null ? 0 : this.groundUnderFeet();
        if (swimEntry(p.y, ws, g)) {
          this.enterSwim(walkX, walkZ);
          if (p.y < g) p.y = g;
        } else {
          if (moved.grounded) {
            // touching down from the air: a hard landing files the client's fall hit (PlayerHurt.fall); water softens it
            if (!fall.grounded && hardLanding(fall.vy, ws === null ? 0 : landingCushion(p.y < ws, ws - g))) this.combat.hit(hardFallHit(this.player.health, this.player.position));
            fall.vy = groundedVelocity(fall.vy);
          } else if (standing) fall.vy = fallStep(fall.vy, FIXED_STEP);
          fall.grounded = moved.grounded;
        }
        if (command?.attack !== undefined) this.startStrike(this.player.id, command.attack.targetId);
      }
    }
    if (observeMotion !== undefined) {
      let sample: SimPlayerMotionSample | null;
      if (delegated || traversed) {
        sample = delegated ? driver.motionSample?.() ?? null : null;
        if (sample !== null && (![sample.velocityX, sample.velocityZ].every(Number.isFinite)
          || typeof sample.grounded !== 'boolean' || typeof sample.swimming !== 'boolean' || typeof sample.hover !== 'boolean')) throw new RangeError('Invalid delegated player motion sample');
      } else {
        const native = observeMotion.sample;
        native.grounded = this.playerFall.grounded; native.swimming = this.playerSwim.on; native.hover = this.playerBoard.on;
        if (native.hover) { native.velocityX = this.boardVelocity.x; native.velocityZ = this.boardVelocity.z; }
        else if (native.swimming) { native.velocityX = this.swimVelocity.x; native.velocityZ = this.swimVelocity.z; }
        sample = native;
      }
      observeMotion.receive(sample);
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
    const bands = this.bands;
    if (bands !== undefined) { bands.clocks.beginTick(FIXED_STEP); if (bands.physics) this.syncBodies(); }
    this.day?.update(FIXED_STEP);
    for (const key of Object.keys(this.state.timers)) this.state.timers[key] = Math.max(0, (this.state.timers[key] ?? 0) - FIXED_STEP);
    for (const run of this.callbacks.values()) run(FIXED_STEP, this);
    for (const [id, runner] of this.strikes) this.updateStrike(id, runner);
    const hooks = this.bodyStep;
    for (const [id, entity] of this.entities) {
      const dt = bands === undefined ? FIXED_STEP : this.bodyDt(id);
      if (dt <= 0) continue;
      hooks?.before?.(id, entity, dt);
      entity.step(dt);
      hooks?.after?.(id, entity, dt);
    }
    for (const run of this.afterCallbacks.values()) run(FIXED_STEP, this);
  }
  /** Accumulate elapsed simulation seconds; a caller can submit exactly the same command tape after restoration. */
  advance(seconds: number, command?: SimCommand): number {
    if (this.disposed) throw new Error('Simulation host is disposed');
    if (this.embedded) throw new Error('Borrowed simulation uses the existing fixed-step driver');
    if (!Number.isFinite(seconds) || seconds < 0) throw new RangeError('Invalid simulation delta');
    if (command !== undefined) {
      if (![command.moveX, command.moveZ, command.yaw].every(Number.isFinite)) throw new RangeError('Invalid simulation command');
      validateLocalMovement(command);
    }
    if (command?.hover !== undefined || command?.jump !== undefined || command?.dodge !== undefined) throw new RangeError('A HOVER, JUMP or DODGE press is one tick\'s input; advance repeats its command');
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
