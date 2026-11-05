import { Vector3 } from 'three';
import { Scope } from '../app/scope';
import { StrikeRunner } from '../ai/strikes';
import { PlayerHealth } from '../combat/health';
import { FIXED_STEP } from '../core/fixedStep';
import type { CharacterMotor, MotorOptions } from '../physics/CharacterMotor';
import { floorBelow } from '../physics/query';
import { addImpulse } from '../player/impulse';
import { hardFallHit } from '../player/fall';
import { hitShoveSpeed, shoveHop, startShove, type ShoveState } from '../player/shove';
import { boardShoved, HOVER_HARD_LANDING, type BoardState } from '../player/board';
import { hoverSpeed } from '../player/hoverSpeed';
import { COYOTE_MS, type JumpState } from '../player/jump';
import { pondBob, type SwimState } from '../player/swim';
import { localWalkingMove, wadeScale } from '../player/walk';
import { PlayerModes, type ModePlayer } from '../player/modes';
import { HOST_MOTION, leaveSwim, stepPlayerMotion, versionedWalk, waterDepth, type MotionFooting, type MotionOut, type MotionWorld, type PlayerMotionState } from '../player/motion';
import { dashToward, startDash, type DashState, type DodgeState } from '../player/dash';
import { validateLocalMovement } from '../input/commands';
import { netSimCommand } from './netMotion';
import type { SimCommand, SimExternalPlayer, SimHost, SimPlayerBody, SimPlayerDriver, SimPlayerMotionSample, SimTickCommand, SimWalkingControl } from '../sim';

/** The world-space command a tick's input means. */
export function simCommandOf(input: SimTickCommand): SimCommand { return 'seq' in input ? netSimCommand(input) : input; }
/** How a host makes a player's body. */
export interface PlayerSimBody {
  /** The page's own player: this sim reads it and leaves its motion to the page. */
  readonly borrowed?: SimPlayerBody | undefined;
  /** A player a frozen region holds logically, with no capsule. */
  readonly bodiless?: boolean;
  readonly id: string;
  readonly at: { readonly x: number; readonly y: number; readonly z: number };
  readonly yaw: number;
  readonly motor: (health: PlayerHealth) => CharacterMotor | undefined;
}

/**
 * One player of a SimHost (P1-E5.2a): its body, health, strike runner and the movement law's state. The law is the client
 * Player's, step for step; a host runs one `input` for every player before its physics step and one `move` after it.
 */
export class PlayerSim implements PlayerMotionState {
  readonly id: string;
  readonly position: Vector3;
  /** This player's strike clock; the host also lists it by id, so a strike is resolved like any other actor's. */
  readonly strike: StrikeRunner = new StrikeRunner();
  /** The loadout slot this player holds, for the wire. The loadout writes it each tick and keeps the saved truth. */
  held = 0;
  /** Transient world velocity (m/s), the client Player's impulse law (player/impulse.ts). */
  readonly impulse: Vector3 = new Vector3();
  /** Vertical speed (m/s, negative = falling) and whether the motor last stood it on ground, the client Player's on-foot
   * fall law (player/fall.ts). At rest (grounded, still) an idle tick leaves the player untouched. */
  readonly fall = { vy: 0, grounded: true };
  /** Version-1 on-foot velocity, inactive on legacy hosts. */
  readonly walk = { active: false, x: 0, z: 0 };
  /** The client Player's moveScale: what its owner (an input lock: 0, a slowing zone) scales the version-1 walk by, and
   *  what a mounted driver's reins read. Saved while it is not 1. */
  moveScale = 1;
  /** The running creature-hit knockback, the client Player's shove law (player/shove.ts). */
  readonly shove: ShoveState = { t: 0, vx: 0, vz: 0 };
  /** The hoverboard (SF72): on the board, each step runs the client Player's board law (player/board.ts) instead of the
   * walk, and the board-only colliders (SimHost.boardColliders) collide. Off by default. */
  readonly board: BoardState & { on: boolean } = { on: false, hoverAir: false, hoverBob: 0, onGround: false };
  /** The riding board's world velocity (m/s), the client Player's `velocity` while it hovers; zero on foot. */
  readonly boardVelocity: Vector3 = new Vector3();
  /** SF34: the swim (player/swim.ts, the client Player's water law), only on a host with water (useWater): on once the
   *  feet float, with the law's dive, haul-out and stroke clocks. */
  readonly swim: SwimState & { on: boolean; stood: boolean } = { on: false, diving: false, climbTo: null, climbCooldown: 0, strokeTime: 0, stood: false };
  /** The swimming player's world velocity (m/s), the client Player's `velocity` while it swims; zero otherwise. */
  readonly swimVelocity: Vector3 = new Vector3();
  /**
   * SF34: this player's modes, the page Player's own registry (player/modes.ts): the motor mode (foot, board, swim, wade)
   * read from this state, and a driven mode a runtime declares and enters (`modes.register(def, scope)`,
   * `modes.enter('ride', driver)`), whose SimPlayerDriver then owns the motion ahead of any useDriver driver until
   * `modes.exit`. The entered driver is not snapshot state: the installer re-enters it from its own adapter's
   * continuation before native restore, as useDriver's.
   */
  readonly modes: PlayerModes<SimPlayerDriver>;
  /** The on-foot jump clocks (player/jump.ts), or null until the first JUMP press (SF72): tracking starts there
   * (grounded: the client's own state; in the air: no coyote window left), so a player that never jumps keeps its exact
   * snapshot bytes. */
  jump: JumpState | null = null;
  /** The running dash: a dodge's burst or a lunge (dashTo), the client Player's dash law (player/dash.ts). */
  readonly dash: DashState = { t: 0, vx: 0, vz: 0 };
  /** The dodge clocks (cooldown, the burst's i-frames read by its health's `dodging`). */
  readonly dodge: DodgeState = { cd: 0, t: 0 };
  /** The motion step's read of the feet. Never saved: on this law it is derived from the position and the water. */
  readonly footing: MotionFooting = { water: null, depth: 0, wading: false, onPlatform: false, sliding: false };
  private readonly host: SimHost;
  private readonly body: SimPlayerBody;
  /** The page lends this player; its motion, impulse and knockback stay the page's. */
  readonly borrowed: boolean;
  private bodyMotor: CharacterMotor | undefined;
  private driver: SimPlayerDriver | undefined;
  private walkingControl: SimWalkingControl | undefined;
  private motionObserver: { receive: (sample: SimPlayerMotionSample | null) => void; sample: { velocityX: number; velocityZ: number; grounded: boolean; swimming: boolean; hover: boolean } } | undefined;
  private external: { value: SimExternalPlayer; health: PlayerHealth; scope: Scope } | undefined;
  private modeDriver: SimPlayerDriver | null = null;
  private readonly versionedWalking = { speed: 4.3, crouching: false, clientMotion: this.walk };
  private readonly localMove = { x: 0, z: 0 };
  /** The motion step's world (player/motion.ts): this player's motor, the host's queries, and the host's moments. */
  private readonly world: MotionWorld = this.motionWorld();
  // This tick's command and what `input` decided, for `move`.
  private command: SimCommand | undefined;
  private tickDriver: SimPlayerDriver | undefined;
  private delegated = false;
  private versioned = false;
  private walking: SimWalkingControl | undefined;

  constructor(host: SimHost, body: PlayerSimBody, scope: Scope) {
    this.host = host; this.id = body.id;
    this.modes = new PlayerModes<SimPlayerDriver>(this.modePlayer(), () => host.traversing === null || host.traversing === this);
    if (body.borrowed !== undefined) {
      this.borrowed = true; this.body = body.borrowed; this.position = body.borrowed.position;
    } else {
      const position = new Vector3(body.at.x, body.at.y, body.at.z);
      const health = new PlayerHealth(host.events, { now: () => host.clock.now * 1000, position: () => position, dodging: () => this.dodge.t > 0, dodgeGuard: () => false }, body.id);
      this.borrowed = false; this.position = position;
      this.bodyMotor = body.bodiless === true ? undefined : body.motor(health);
      this.bodyMotor?.resetAt(position);
      const readMotor = (): CharacterMotor => { if (this.bodyMotor === undefined) throw new Error('Frozen simulation has no player motor'); return this.bodyMotor; };
      const writeMotor = (motor: CharacterMotor): void => { this.bodyMotor = motor; };
      this.body = { id: body.id, position, yaw: body.yaw, health,
        get motor(): CharacterMotor { return readMotor(); }, set motor(motor: CharacterMotor) { writeMotor(motor); } };
      host.combat.playerRules(scope, { target: health });
      // a creature's blow knocks this player back, as the client's PlayerHurt shoves its Player on `feel.blow`
      host.events.on('damage.dealt', ({ req, dealt }) => {
        if (req.target === this.health && this.external === undefined && this.hasMotor && req.sourceTags.includes('feel.blow')) this.knockBack(req.point.x, req.point.z, hitShoveSpeed(dealt));
      }, scope);
    }
  }
  get yaw(): number { return this.body.yaw; }
  set yaw(value: number) { this.body.yaw = value; }
  get health(): PlayerHealth { return this.body.health; }
  set health(value: PlayerHealth) { this.body.health = value; }
  get motor(): CharacterMotor { return this.body.motor; }
  set motor(value: CharacterMotor) { this.body.motor = value; }
  /** True only while this host owns the player's capsule and controller. */
  get hasMotor(): boolean { return this.borrowed || this.bodyMotor !== undefined; }
  /** Dispose an owned capsule with the host. */
  disposeMotor(): void { if (!this.borrowed) this.bodyMotor?.dispose(); }
  /** The original capsule law also reconstructs a saved motor for a bodyless restore target. */
  motorOptions(fallback: () => MotorOptions): MotorOptions {
    if (this.borrowed) throw new Error('Borrowed player motor belongs to its world owner');
    return this.bodyMotor?.opts ?? fallback();
  }
  /** Freeze a regional player after its checkpoint. */
  detachMotor(): void {
    if (this.borrowed) throw new Error('Borrowed player motor belongs to its world owner');
    if (this.bodyMotor !== undefined) this.releaseMotor().dispose();
  }
  /** Transfer ownership after a prepared frame commit has already retired the old collider. */
  releaseMotor(): CharacterMotor {
    if (this.borrowed || this.bodyMotor === undefined) throw new Error('Invalid regional motor release');
    const motor = this.bodyMotor; this.bodyMotor = undefined; return motor;
  }
  /** Commit a prepared motor, without allocating or stepping during the fixed-step frame change. */
  attachMotor(motor: CharacterMotor): void {
    if (this.borrowed || this.bodyMotor !== undefined || this.host.disposed) throw new Error('Invalid regional motor attachment');
    this.bodyMotor = motor;
  }
  /** Bind the page traveller to an owned bodyless region; deactivation leaves the page's health and motor intact. */
  bindExternal(value: SimExternalPlayer): () => void {
    if (this.host.disposed || this.borrowed || this.hasMotor || this.external !== undefined || value.health.id !== this.id) throw new Error('Invalid external regional player');
    const scope = new Scope(`sim:${this.host.level.id}:traveller`), binding = { value, health: this.health, scope };
    this.external = binding; this.health = value.health;
    this.host.combat.playerRules(scope, { target: value.health });
    return () => {
      if (this.external !== binding) return;
      scope.dispose(); this.health = binding.health; this.external = undefined;
    };
  }
  /** Drop an external binding with its host. */
  releaseExternal(): void { this.external?.scope.dispose(); this.external = undefined; }
  /** Trusted page-object alias used only by same-engine continuation encoding, never author-selected query input. */
  isExternalObject(value: unknown): boolean { return this.external !== undefined && value === this.external.value.owner; }
  /** The bound page traveller's pose into this player, or throw while none is bound. */
  followExternal(): void {
    const external = this.external;
    if (external === undefined) throw new Error('External regional player is not bound');
    const { position, yaw } = external.value;
    if (![position.x, position.y, position.z, yaw].every(Number.isFinite)) throw new RangeError('Invalid external player pose');
    this.position.copy(position); this.yaw = yaw;
  }
  private claim<T>(what: string, slot: () => T | undefined, value: T, set: (next: T | undefined) => void): () => void {
    if (this.host.disposed || this.host.embedded || this.borrowed || !this.hasMotor || slot() !== undefined) throw new Error(`${what} belongs to one owned active host`);
    set(value);
    let installed = true, forget: () => void = () => undefined;
    const remove = (): void => {
      if (!installed) return;
      installed = false; forget();
      if (slot() === value) set(undefined);
    };
    forget = this.host.scope.capture('disposers', remove); return remove;
  }
  /** Bind one active motion driver to this owned player. Borrowed, frozen and disposed hosts refuse; the returned remover
   * releases the scope's reference early. Reinstall alongside its continuation adapter before native restore. */
  useDriver(driver: SimPlayerDriver): () => void { return this.claim('Player driver', () => this.driver, driver, next => { this.driver = next; }); }
  /** Bind one scoped on-foot law without replacing the native riding/input driver. A delegated mode still owns motion;
   * borrowed hosts refuse. */
  useWalkingControl(control: SimWalkingControl): () => void { return this.claim('Walking control', () => this.walkingControl, control, next => { this.walkingControl = next; }); }
  /** Observe owned movement before gameplay callbacks. Native walk samples commanded/shove/dash velocity before the motor,
   * excluding transient impulse velocity, then publishes post-move ground/hover state. Board samples its own velocity. An
   * alternative driver supplies its own sample or null is delivered. The native sample is reused: copy scalars if
   * retaining it. Observers and delegated mutable samples own their continuation; absent preserves all bytes. */
  observeMotion(observer: (sample: SimPlayerMotionSample | null) => void): () => void {
    const binding = { receive: observer, sample: { velocityX: 0, velocityZ: 0, grounded: true, swimming: false, hover: false } };
    return this.claim('Player motion observer', () => this.motionObserver, binding, next => { this.motionObserver = next; });
  }
  private refuseBorrowed(what: string): void {
    if (this.host.disposed || this.host.embedded) throw new Error(`Borrowed simulation player owns its ${what}`);
  }
  /** Shove this player: add transient world velocity in m/s, carried by the motor with each step's own move and decayed
   * after it exactly as the client Player's `impulse` (player/impulse.ts). A borrowed player owns its impulse. */
  addImpulse(velocity: Readonly<Vector3>): void {
    this.refuseBorrowed('impulse');
    addImpulse(this.impulse, velocity);
    if (this.board.on) boardShoved(this.board, velocity.y); // an upward shove (an updraft) lifts the board off
  }
  /** Knock this player `speed` m/s away from (fromX, fromZ), exactly as the client Player's `shove`: the knockback
   * overrides the walk input and fades over SHOVE_TIME through the motor, and a grounded player hops off the ground. */
  knockBack(fromX: number, fromZ: number, speed: number): void {
    this.refuseBorrowed('knockback');
    if (![fromX, fromZ, speed].every(Number.isFinite)) throw new RangeError('Invalid player knockback');
    if (this.board.on || this.swim.on) return; // the client Player ignores a creature's knockback on the board and swimming
    startShove(this.shove, this.position.x, this.position.z, fromX, fromZ, this.yaw, speed);
    this.dash.t = 0; // a knockback ends a dash
    const { fall } = this;
    if (fall.grounded) { fall.vy = shoveHop(fall.vy); fall.grounded = false; }
  }
  /** Dash this player at (vx, vz) m/s for `time` s, whatever the input says: the client Player's `dash` (a shard's
   * knock-down). The dash law's own rules hold (player/dash.ts: a wall ends it, a knockback cancels it, its last step
   * brakes). False (nothing happens) on the board or for no time. */
  dashAt(vx: number, vz: number, time: number): boolean {
    this.refuseBorrowed('dash');
    if (![vx, vz, time].every(Number.isFinite)) throw new RangeError('Invalid player dash');
    if (this.board.on || this.swim.on) return false;
    return startDash(this.dash, vx, vz, time);
  }
  /** Dash this player toward (x, z), stopping `stopAt` m short, over `time` s: the client Player's `dashTo`, a sword's
   * lunge (combat/sweptMeleeCore `sweptLunge` gives the numbers). The dash overrides the walk, a wall ends it, a knockback
   * cancels it. False (nothing happens) when already that close, or on the board. */
  dashTo(x: number, z: number, stopAt: number, time: number): boolean {
    this.refuseBorrowed('dash');
    if (![x, z, stopAt, time].every(Number.isFinite)) throw new RangeError('Invalid player dash');
    if (this.board.on || this.swim.on) return false;
    return dashToward(this.dash, this.position.x, this.position.z, x, z, stopAt, time);
  }
  /** Step on or off the hoverboard, as the client Player's `setHover`: on, the board starts from the feet's vertical speed
   * with no horizontal speed (the host's walk keeps none) and is not yet riding; off, the board's vertical speed becomes
   * the fall's and the feet drop from the ride height. The board-only colliders follow on the next step, before physics,
   * as the client's movers sync before its world step. */
  setBoard(on: boolean): void {
    this.refuseBorrowed('board');
    const { board, fall } = this;
    if (on === board.on) return;
    if (on && this.swim.on) { leaveSwim(this, this.world); fall.vy = this.swimVelocity.y; fall.grounded = false; this.swimVelocity.set(0, 0, 0); } // the client's setHover ends the swim
    board.on = on; board.hoverAir = false; board.hoverBob = 0; board.onGround = false;
    if (on) { this.boardVelocity.set(0, fall.vy, 0); fall.vy = 0; fall.grounded = true; }
    else { fall.vy = this.boardVelocity.y; fall.grounded = false; this.boardVelocity.set(0, 0, 0); }
  }
  /** Reposition this owned native traveller without stepping the world. Like the page's spawn, release the old ride,
   * velocity, dash and swimming state. */
  resetPose(feet: { x: number; y: number; z: number }, yaw: number): void {
    if (this.host.disposed || this.host.embedded || this.borrowed || !this.hasMotor) throw new Error('Player pose belongs to an owned active host');
    if (![feet.x, feet.y, feet.z, yaw].every(Number.isFinite)) throw new RangeError('Invalid native player pose');
    this.setBoard(false); leaveSwim(this, this.world);
    this.position.set(feet.x, feet.y, feet.z); this.yaw = yaw;
    this.motor.resetAt(this.position); this.impulse.set(0, 0, 0); this.dash.t = 0;
    this.fall.vy = 0; this.fall.grounded = false; this.swim.stood = false;
    Object.assign(this.walk, { active: false, x: 0, z: 0 });
  }
  /** The registry's view of this player: the mode driver slot and the motor state. */
  private modePlayer(): ModePlayer<SimPlayerDriver> {
    const read = (): SimPlayerDriver | null => this.modeDriver, write = (driver: SimPlayerDriver | null): void => { this.modeDriver = driver; };
    const hover = (): boolean => this.board.on, swimming = (): boolean => this.swim.on, wading = (): boolean => this.wading;
    return { get ride() { return read(); }, set ride(driver) { write(driver); }, get hover() { return hover(); }, get swimming() { return swimming(); }, get wading() { return wading(); } };
  }
  /** The current mode (SF34): an entered driven mode, else the motor mode (board, swim, wade, foot). */
  get mode(): ReturnType<PlayerModes['current']> { return this.modes.current(); }
  /** Water over the standing feet (SF34: a host with water, on foot, grounded, the feet more than 2 cm under). */
  get wading(): boolean {
    // the tick the swimmer stands up is on foot, not yet wading, as the client Player's (its wade resolves on the next walk)
    if (this.host.water === undefined || this.board.on || this.swim.on || this.swim.stood || !this.fall.grounded) return false;
    return waterDepth(this, this.world) > 0.02;
  }
  /** This host's side of the motion step, built before the constructor runs, so every read of the host is lazy. Its law
   *  is `HOST_MOTION`; what it has no way to know is absent here: floor functions, a grid limit on the board, an authored
   *  coyote window. */
  private motionWorld(): MotionWorld {
    const motor = (): CharacterMotor => this.motor, water = (): boolean => this.host.water !== undefined;
    const walking = (): SimWalkingControl | undefined => this.walking, versioned = (): boolean => this.versioned;
    return {
      law: HOST_MOTION,
      get motor() { return motor(); },
      get hasWater() { return water(); },
      // the level's water (useWater): the board rides its surface, as the client's; none without it
      water: (x, z) => this.host.water?.surfaceAt(x, z) ?? null,
      heightAt: (x, z) => this.host.heightAt(x, z),
      platforms: [],
      floor: (x, z, fromY, maxDrop) => floorBelow(this.host.physics, x, z, fromY, maxDrop, this.motor.collider),
      bob: (x, z) => this.host.water?.bob?.(x, z) ?? pondBob(this.host.clock.now),
      foot: {
        speed: (wadeT) => {
          const control = this.walking, levelSpeed = this.host.level.player.speed;
          if (control === undefined) return this.host.water === undefined ? levelSpeed : levelSpeed * wadeScale(wadeT);
          return control.speed * (control.clientMotion === undefined ? 1 : wadeScale(wadeT));
        },
        get crouching() { return walking()?.crouching === true; },
        get velocity() { return walking()?.clientMotion; },
        get active() { return versioned(); },
        coyoteMs: COYOTE_MS,
      },
      boardTop: () => hoverSpeed(),
      boardCapped: () => false,
      jumped: () => { this.host.events.emit('player.jump', true); },
      dodged: () => { this.host.events.emit('player.dodge', true); },
      // a hard landing files the client's fall hit (Player.onLand(hard) → PlayerHurt.fall)
      landed: (hard) => { if (hard) this.host.combat.hit(hardFallHit(this.health, this.position)); },
      boardLanded: (speed) => { if (speed > HOVER_HARD_LANDING) this.host.combat.hit(hardFallHit(this.health, this.position)); },
      swimChanged: (on) => { this.host.events.emit('player.swim', on); },
      stroked: () => undefined,
      scratch: null,
    };
  }
  /** Check this tick's command before the host moves anything, and resolve raw axes to a world move. */
  take(input: SimTickCommand | undefined): void {
    if (input === undefined) { this.command = undefined; return; }
    const command = simCommandOf(input);
    if (![command.moveX, command.moveZ, command.yaw].every(Number.isFinite)) throw new RangeError('Invalid simulation command');
    validateLocalMovement(command);
    if ((command.dive !== undefined && typeof command.dive !== 'boolean') || (command.surface !== undefined && typeof command.surface !== 'boolean')) throw new RangeError('Invalid held swim control');
    if (command.commandVersion !== 1 || command.steer === undefined) { this.command = command; return; }
    localWalkingMove(command.steer, command.yaw, this.localMove);
    this.command = { ...command, moveX: this.localMove.x, moveZ: this.localMove.z };
  }
  /** The tick's input phase, before the world steps: the drivers, the walk's speed and the HOVER press. */
  input(): void {
    const { command } = this;
    // an entered driven mode's driver (SF34, modes.enter) owns the motion ahead of a useDriver driver
    const driver = this.modeDriver ?? this.driver, delegated = driver?.input(command, FIXED_STEP, this.host) === true;
    this.tickDriver = driver; this.delegated = delegated;
    const observe = this.motionObserver;
    if (observe !== undefined) { observe.sample.velocityX = 0; observe.sample.velocityZ = 0; }
    const versioned = !delegated && (command?.commandVersion === 1 || command === undefined && this.walk.active);
    this.versioned = versioned;
    if (versioned) {
      this.walk.active = true;
      versionedWalk(this, command, this.world, this.versionedWalking);
    } else Object.assign(this.walk, { active: false, x: 0, z: 0 });
    const walking = delegated ? undefined : this.walkingControl ?? (versioned ? this.versionedWalking : driver?.walking);
    this.walking = walking;
    if (walking !== undefined && (!Number.isFinite(walking.speed) || walking.speed < 0 || typeof walking.crouching !== 'boolean')) throw new RangeError('Invalid walking control');
    if (walking?.clientMotion !== undefined && ![walking.clientMotion.x, walking.clientMotion.z].every(Number.isFinite)) throw new RangeError('Invalid client walking velocity');
    // the HOVER press lands in the ordinary input phase; an active alternative driver owns its own motion switches
    if (!delegated && command?.hover === true) this.setBoard(!this.board.on);
  }
  /** The tick's motion phase, after the world steps. */
  move(): void {
    const { command, delegated } = this, driver = this.tickDriver, host = this.host;
    const observe = this.motionObserver;
    // An unanswered ask returns its numeric dt input; only an explicit true claims motion.
    const traversal: unknown = delegated ? false : host.askTraversal(this);
    const traversed = traversal === true;
    let motion: MotionOut | undefined;
    if (delegated) driver?.step(FIXED_STEP, host);
    else if (traversed) this.impulse.set(0, 0, 0);
    else motion = stepPlayerMotion(this, command, this.world, FIXED_STEP);
    if (command?.attack !== undefined) host.startStrike(this.id, command.attack.targetId);
    if (observe !== undefined) {
      let sample: SimPlayerMotionSample | null;
      if (delegated || traversed) {
        sample = delegated ? driver?.motionSample?.() ?? null : null;
        if (sample !== null && (![sample.velocityX, sample.velocityZ].every(Number.isFinite)
          || typeof sample.grounded !== 'boolean' || typeof sample.swimming !== 'boolean' || typeof sample.hover !== 'boolean')) throw new RangeError('Invalid delegated player motion sample');
      } else {
        const native = observe.sample;
        native.velocityX = motion?.walkX ?? 0; native.velocityZ = motion?.walkZ ?? 0;
        native.grounded = this.fall.grounded; native.swimming = this.swim.on; native.hover = this.board.on;
        if (native.hover) { native.velocityX = this.boardVelocity.x; native.velocityZ = this.boardVelocity.z; }
        else if (native.swimming) { native.velocityX = this.swimVelocity.x; native.velocityZ = this.swimVelocity.z; }
        sample = native;
      }
      observe.receive(sample);
    }
    this.command = undefined;
  }
  /** The strike actor view of this player. */
  actor(): { position: Vector3; yaw: number; scale: number; alive: boolean; startAttack: (seconds: number) => void; cancelAttack: () => void; setMotion: (yaw: number, speed: number, turn: number) => void } {
    return { position: this.position, yaw: this.yaw, scale: 1, alive: this.health.alive,
      startAttack: (_seconds: number) => { /* Weapon runner owns the clock. */ }, cancelAttack: () => { /* Weapon runner owns the clock. */ },
      setMotion: (_yaw: number, _speed: number, _turn: number) => { /* Commands own player movement. */ } };
  }
}
