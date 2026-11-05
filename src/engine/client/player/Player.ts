import { hoverSpeed } from '../../shared/player/hoverSpeed';
import { isDev } from '../core/devMode';
import { walkingSpeed } from '../../shared/player/walk';
import { NO_SPRINT_DEPTH, pondBob } from '../../shared/player/swim';
import { combatSpeedFactor } from '../../shared/player/combatMotion';
import { boardShoved, HOVER_HARD_LANDING } from '../../shared/player/board';
import { leaveSwim, PAGE_MOTION, stepPlayerMotion, type MotionOut, type MotionWorld, type PlayerMotionState } from '../../shared/player/motion';
import type { AimCommand, PlayerCommand, LocalSteer, RideCommandSample } from '../../shared/input/commands';
import type { InputService } from '../input/InputService';
import type { Events } from '../../shared/events/events';
import { dodgeFx, dodgeEnv } from '../../shared/player/dodge';
import * as THREE from 'three';
import { heightAt } from '../../shared/world/Heightfield';
import { app } from '../app/runtime';
import { WaterLine, type WaterLineView } from './WaterLine';
import { setUnderwater, updateUnderwater } from '../world/Atmosphere';
import { getNumber } from '../ui/Settings';
import { lockOn } from './AimTargets';
import { targetRadius } from '../../shared/combat/lungeTarget';
import { addLockOffset } from './LockOnTarget';
import { CharacterMotor, PLAYER_BODY, PLAYER_CAPSULE } from '../../shared/physics/CharacterMotor';
import { floorBelow } from '../../shared/physics/query';
import { addImpulse } from '../../shared/player/impulse';
import { shoveHop, startShove, type ShoveState } from '../../shared/player/shove';
import { COYOTE_MS, type JumpState } from '../../shared/player/jump';
import { DODGE_COOLDOWN, DODGE_TIME, DODGE_DIST, dashToward, dodgeHeading, startDash, startDodge, type DashState, type DodgeState } from '../../shared/player/dash';
import type { Physics } from '../../shared/physics/Physics';

/** Frame-local surfaces supplied with a motor rebind; null restores the standalone level's existing queries. */
export interface PlayerFrameQueries {
  heightAt: (x: number, z: number) => number;
  waterSurfaceAt: (x: number, z: number) => number | null;
  platforms: readonly ((x: number, z: number) => number | undefined)[];
}

const EYE = 1.68;

// ── hoverboard (toggle: H / the HOVER touch button) ──
          // m/s cruise
// the board's motion law and its tuning (accel, carve, ride height, spring, jump) are player/board.ts, shared with SimHost
const HOVER_ROLL = 6 * Math.PI / 180; // camera roll cap, reached at HOVER_ROLL_AT m/s sideways
const HOVER_ROLL_AT = 7;
const HOVER_PITCH = 0.03;             // rad nose-down at top speed

// ── water: wading → swimming (see `waterSurface`, `depth`, `wading`, `swimming`): the law and its tuning are player/swim.ts,
// shared with SimHost (SF34). The step that composes every motion law, slopes included, is player/motion.ts (P1-E4.1)
// ── dash (on foot): the DODGE (Left Alt / the DODGE disc) and the sword's lunge (Sword.ts) — a short fixed-velocity burst ──
// the dash and dodge law (distance, time, cooldown, the pier-edge probe) is player/dash.ts, shared with SimHost
const DODGE_FX_END = 700;              // ms: every dodge curve has settled
const DODGE_DIP = 0.07;               // m the eye drops at a dodge's start (the land-impulse spring brings it back)
const DODGE_ROLL = 0.122;             // rad of camera lean into a fully sideways T dodge at its peak (7°, E63; 0.06 before)
const DODGE_FOV_KICK = 5;             // ° wider while a dodge runs …
const LUNGE_FOV_KICK = 7;             // … and a lunge (Sword.ts reads `fovKick`)

export class Player {
  position: THREE.Vector3 = new THREE.Vector3(0, 0, 0);
  velocity: THREE.Vector3 = new THREE.Vector3();
  yaw = 0;
  pitch = 0;
  onGround = true;
  crouching = false;
  /** The actor carried by the current traversal, excluded from player targeting. */
  mountedOn: object | null = null;
  private crouchWanted = false;
  sprinting = false;
  speedFactor = 0;   // for headbob / audio
  bobTime = 0;
  locked = false;
  /** the world's hand-made boxes; src/engine/physics/bridge.ts mirrors them into Rapier until P4 / P3 replace them */
  /** extra walkable surfaces (cabin floors, porch decks): return a world y or undefined */
  platforms: ((x: number, z: number) => number | undefined)[] = [];
  keys: Set<string> = new Set<string>();
  /** analog input from on-screen controls (TouchControls): x = strafe (+right), y = forward (+ahead), both -1..1 */
  touchMove = { x: 0, y: 0 };
  touchSprint = false;
  touchJump = false;
  /** hoverboard mode (H key / HOVER touch button) — see setHover() */
  hover = false;
  /** 0..1 smoothed hover state (viewmodel fade, camera blend) */
  hoverBlend = 0;
  /** hover telemetry for the viewmodel / camera: lateral (+right) and forward velocity along the heading, forward acceleration, ride-height error */
  hoverLat = 0; hoverFwd = 0; hoverAccel = 0; hoverBob = 0;
  /** airborne after a board jump (spring disengaged); `hoverLanded` is a one-frame impulse (m/s) for the viewmodel */
  hoverAir = false; hoverLanded = 0; hoverJumpKick = 0;
  private jumpWasDown = false;
  /** the on-foot jump's clocks (player/jump.ts, the law SimHost shares): ms since grounded, air jumps left */
  private readonly jumpState: JumpState = { ago: Infinity, left: 0 };
  onHoverChange?: (on: boolean) => void;
  // ── water ──
  /** height of the water surface under the player (app.world.water: the sea, a pond / river, a creek); null on dry land */
  waterSurface: number | null = null;
  /** metres of water above the feet (0 when dry or the feet are above the surface) */
  depth = 0;
  /** on foot with water over the feet (speed scaled by depth, no sprint past knee-deep, splashy steps) */
  wading = false;
  /** floating: the feet hang FLOAT_DEPTH under the surface and buoyancy, not gravity, holds them there */
  swimming = false;
  /** the DIVE control (Space / the DIVE disc) is held while swimming: descend at DIVE_SPEED (the dive latches past DIVE_ENTER — see `diving`) */
  diveHeld = false;
  /** touch DIVE disc state (TouchControls) — summed into `diveHeld` with Space */
  touchDive = false;
  /** the SURFACE control (Shift / the SURFACE disc) is held while swimming: ascend at SURFACE_SPEED until the float height */
  surfaceHeld = false;
  /** touch SURFACE disc state (TouchControls) — summed into `surfaceHeld` with Shift */
  touchSurface = false;
  /** the eye is under the water surface (the underwater look, muffled audio, the SURFACE disc). Also true for the beat a plunge dips the head under. */
  submerged = false;
  /** on foot on ground too steep to stand on (normal y < SLOPE_SLIDE): sliding down the fall line, no control, no jump */
  sliding = false;
  /** the ground under the feet this frame is a platform (deck, floor, steps), not the terrain — platforms are never "too steep" */
  onPlatform = false;
  /** diving: the dive latched (feet more than DIVE_ENTER below the float height) — neutral buoyancy holds the depth until SURFACE brings you back up */
  diving = false;
  /** the eye went under / came back up (Audio.dive() plunge / Audio.surface() gasp) */
  onSubmerge?: () => void;
  onSurface?: () => void;
  /** wave clock for the swim bob (seconds) */
  waveTime = 0;
  /** feet dropped below the surface (splash; `impact` = entry speed m/s, ~0 walking in, 10+ off a pier) / came back out */
  onEnterWater?: (impact: number) => void;
  onExitWater?: () => void;
  /** swimming started / stopped (touch: JUMP ↔ DIVE disc) */
  onSwimChange?: (on: boolean) => void;
  /** one swim stroke while moving through water (audio) */
  onStroke?: () => void;
  private inWater = false;
  /** the swim law's clocks (player/swim.ts SwimState): the stroke phase, a haul-out's deck top and its cooldown */
  strokeTime = 0; climbTo: number | null = null; climbCooldown = 0;
  private readonly waterLine: WaterLineView;
  /** Ground grace window, authored by the active level. */
  coyoteMs: number = COYOTE_MS;
  private eyeOffset = EYE;
  private landImpulse = 0;
  private roll = 0; private pitchLean = 0;
  onJump?: () => void;
  /** Shard traversal may consume a fresh jump press before the ordinary jump is queued. */
  inputService: InputService | null = null;
  traversalEvents: Events | null = null;
  /** A traversal verb may drive the capsule for one fixed step through the CharacterMotor. */

  onLand?: (hard: boolean) => void;
  onStep?: (sprinting: boolean) => void;
  /** runs first thing in update(), before input is read and the camera is posed — the touch aim assist nudges yaw/pitch here */
  preUpdate?: (dt: number) => void;
  /** riding (Nalati B7, src/shards/nalati-grasslands/ride/Mount.ts): while set, the frame is handed to it — `drive` reads the input (input
   *  phase), `step` moves the horse on its own motor (each fixed step), `pose` places the rider and the camera from the
   *  interpolated saddle (update, `alpha`) — and walking / swimming / the board are skipped */
  ride: { drive: (dt: number) => void; step: (dt: number) => void; pose: (dt: number, alpha: number) => void; sampleCommand?: () => RideCommandSample; dismount: () => void } | null = null;
  private lastBobPhase = 0;
  // ── dash: dodge + lunge (see `dodge()` / `dash()`) ──
  /** the DODGE disc was tapped (TouchControls) — consumed next update, like `touchJump` */
  touchDodge = false;
  /** walking speed multiplier a weapon may pin (the Nalati spear's BRACE: 0 = planted, the view still turns) */
  moveScale = 1;
  /** Grid driver supplies a position-dependent board limit; standalone cruise retains HOVER_TOP. */
  hoverSpeedLimit: (() => number) | null = null;
  /** Developer HUD latch; the motion law also fences it with isDev on every step. */
  hoverBoost = false;
  /** Status effects have their own channels; weapons keep moveScale. */
  effectMoveScale = 1;
  effectMoveLocked = false;
  /** a sword swing is running (Sword.ts sets it every frame): the look speed takes the 'swingLook' factor */
  swinging = false;
  /** the held weapon's zoom slows the look by this (Nalati's bow sets 1 / its AIM zoom; nothing else touches it) */
  zoomLook = 1;
  /** look-speed multiplier for mouse AND touch (Settings 'look', × 'swingLook' while swinging, × `zoomLook`) — TouchControls reads it too */
  get lookMult(): number { return getNumber('look') * (this.swinging ? getNumber('swingLook') : 1) * this.zoomLook; }
  /** a dodge started / a lunge dash started (audio, haptics — main.ts) */
  onDodge?: () => void;
  onLunge?: () => void;
  /** degrees to widen the view by: kicked by a dodge / lunge, held while the dash runs, eased out after — Sword.ts adds it to its FOV */
  fovKick = 0;
  /** the running dodge / lunge burst and the dodge's clocks (player/dash.ts, the law SimHost shares) */
  private readonly dashState: DashState = { t: 0, vx: 0, vz: 0 };
  private readonly dodgeState: DodgeState = { cd: 0, t: 0 };
  private dashRoll = 0; // camera lean into a sideways dodge (rad), from the dodge envelope
  private readonly dodgeDir = { x: 0, z: 0 };
  private dodgeClock = -1; // ms since the running dodge started (-1 = none): the E63 feel curves
  /** a creature hit's knockback (player/shove.ts): it overrides the walk input and fades, through the controller */
  private readonly shoveState: ShoveState = { t: 0, vx: 0, vz: 0 };
  private readonly impulseVelocity = new THREE.Vector3();
  /** something else owns the position (the zipline's cable, the finale's reward shot): the fixed step leaves it alone */
  carried = false;
  // ── the fixed step (PHYSICS.md P2): input() reads intents, step() moves at 60 Hz, update() poses the camera ──
  private inFwd = 0; private inStr = 0; private jumpQueued = false;
  private activeCommand: PlayerCommand | null = null;
  /** The admitted input during this fixed step only; traversal reads it without sampling the device or allocating again. */
  get traversalCommand(): PlayerCommand | null { return this.activeCommand; }
  private commandJumpUsed = false;
  private commandDodgeUsed = false;
  private dodgeQueued = false;
  /** Optional recording sink; called once per fixed step, before the command is applied. */
  recordCommand: ((command: PlayerCommand) => void) | null = null;
  /** the feet before the last fixed step: update() interpolates the camera between it and `position` */
  private readonly prevFeet = new THREE.Vector3();
  private readonly renderFeet = new THREE.Vector3();
  /** the capsule + Rapier character controller that collides the move (src/engine/shared/physics/CharacterMotor.ts) */
  private currentMotor: CharacterMotor;
  /** The current frame's one capsule/controller; replacement is committed by bindFrame. */
  get motor(): CharacterMotor { return this.currentMotor; }
  /** true while a dodge / lunge burst is carrying the player */
  get dashing(): boolean { return this.dashState.t > 0; }
  /** the dodge cooldown still to run, 1 → 0 (0 = ready) — the touch DODGE disc's clock sweep (E59) */
  get dodgeCooldown(): number { return this.dodgeState.cd / (DODGE_COOLDOWN * this.dodgeCooldownScale); }
  /** E314 sea glass charm II: the dodge's cooldown × this (1 = DODGE_COOLDOWN; src/shards/driftwood-isle/loot/perks.ts) */
  dodgeCooldownScale = 1;
  /** true while a DODGE's burst carries you (not a lunge) — the boar tusk's i-frames (src/shards/driftwood-isle/loot/perks.ts) */
  get dodging(): boolean { return this.dodgeState.t > 0; }

  public camera: THREE.PerspectiveCamera;
  private physics: Physics;
  private frameQueries: PlayerFrameQueries | null = null;
  private canvas: HTMLCanvasElement;
  /** `waterLine`: the swimming water-line view (the DOM WaterLine by default; a test or a headless tool passes its own) */
  constructor(camera: THREE.PerspectiveCamera, physics: Physics, canvas: HTMLCanvasElement, views: { waterLine?: WaterLineView } = {}) {
    this.camera = camera;
    this.physics = physics;
    this.canvas = canvas;
    this.waterLine = views.waterLine ?? new WaterLine();
    this.currentMotor = new CharacterMotor(physics, { ...PLAYER_CAPSULE, ...PLAYER_BODY, owner: this });
    this.motionState = pageMotionState(this, { impulse: this.impulseVelocity, shove: this.shoveState, dash: this.dashState, dodge: this.dodgeState, jump: this.jumpState });
    this.motionWorld = this.pageMotionWorld();
  }

  /** Bind an already committed local frame without respawning, advancing physics or clearing travel state. */
  bindFrame(physics: Physics, motor: CharacterMotor, queries: PlayerFrameQueries | null = null): void {
    if (physics.world.getCollider(motor.collider.handle) !== motor.collider) throw new Error('Player motor belongs to another frame');
    this.physics = physics; this.currentMotor = motor; this.frameQueries = queries;
    this.prevFeet.copy(this.position); this.renderFeet.copy(this.position);
  }
  private groundHeightAt(x: number, z: number): number { return this.frameQueries === null ? heightAt(x, z) : this.frameQueries.heightAt(x, z); }
  private walkableSurfaces(): readonly ((x: number, z: number) => number | undefined)[] { return this.frameQueries?.platforms ?? this.platforms; }
  /** This Player as the motion step's state (player/motion.ts): its own fields, read and written through. */
  private readonly motionState: PlayerMotionState;
  private readonly motionWorld: MotionWorld;
  /** The step's world: this Player's motor, the level's queries, and the moments the view hangs off. */
  private pageMotionWorld(): MotionWorld {
    const motor = (): CharacterMotor => this.motor, walkable = (): readonly ((x: number, z: number) => number | undefined)[] => this.walkableSurfaces();
    const crouching = (): boolean => this.crouching, coyote = (): number => this.coyoteMs;
    return {
      law: PAGE_MOTION,
      get motor() { return motor(); },
      hasWater: true,
      water: (x, z) => this.waterSurfaceAt(x, z),
      heightAt: (x, z) => this.groundHeightAt(x, z),
      get platforms() { return walkable(); },
      floor: (x, z, fromY, maxDrop) => floorBelow(this.physics, x, z, fromY, maxDrop, this.motor.collider),
      // the open sea: ride the Ocean's own Gerstner swell (DRIFTWOOD-REMASTER W3); the pond keeps its gentle sine bob
      bob: (x, z) => { const sea = app.world.water.sea; return sea !== null ? sea.surfaceAt(x, z) - sea.level : pondBob(this.waveTime); },
      foot: { speed: wadeT => walkingSpeed(this.crouching, this.sprinting, wadeT, this.moveScale, this.effectMoveScale),
        get crouching() { return crouching(); }, velocity: undefined, active: true, get coyoteMs() { return coyote(); } },
      boardTop: () => hoverSpeed(this.hoverSpeedLimit?.(), this.hoverBoost && isDev()),
      boardCapped: () => this.hoverSpeedLimit !== null || this.hoverBoost,
      jumped: () => { this.commandJumpUsed = true; if (this.hover) this.hoverJumpKick = 1; app.events.emit('player.jump', true); this.onJump?.(); },
      dodged: () => undefined, // the page presses its own dodge: dodge()
      landed: (hard, vy, cushion) => { this.landImpulse = Math.min(0.35, -vy * 0.03) * (1 - 0.7 * cushion); this.onLand?.(hard); },
      boardLanded: (speed) => { this.hoverLanded = speed; this.onLand?.(speed > HOVER_HARD_LANDING); },
      swimChanged: (on) => { this.swimChanged(on); },
      stroked: () => { this.onStroke?.(); },
      scratch: null,
    };
  }

  /** The input service owns mouse events; the player owns look sensitivity and lock offsets. */
  look(x: number, y: number): void {
    if (!this.locked) return;
    const s = 0.0022 * this.lookMult;
    if (lockOn.state === 'locked') { addLockOffset(-x * s, -y * s); return; }
    this.yaw -= x * s; this.pitch = Math.max(-1.45, Math.min(1.45, this.pitch - y * s));
  }
  private moveInput(): { x: number; y: number } {
    const input = this.inputService;
    if (input !== null) { input.setAxis('move', this.touchMove.x, this.touchMove.y); return input.axis2('move'); }
    const k = this.keys;
    return { x: Math.max(-1, Math.min(1, Number(k.has('KeyD')) - Number(k.has('KeyA')) + this.touchMove.x)),
      y: Math.max(-1, Math.min(1, Number(k.has('KeyW')) - Number(k.has('KeyS')) + this.touchMove.y)) };
  }
  // absent on iOS Safari; present but rejecting ("UnknownError") in the Android WebView — touch input never needs it,
  // and an unhandled rejection would raise the uncaught-exception modal on ENTER WORLD
  lock(): void { if ('requestPointerLock' in this.canvas) this.canvas.requestPointerLock().catch(() => { /* no pointer lock here: touch play */ }); }

  /** step on / off the hoverboard. Off: the board fades and gravity lands you; on: the spring lifts you to ride height. */
  setHover(on: boolean): void {
    if (on === this.hover) return;
    this.hover = on;
    if (on) { this.crouching = false; this.sprinting = false; this.onGround = false; leaveSwim(this.motionState, this.motionWorld); }
    this.onHoverChange?.(on); app.events.emit('player.hover', on);
  }

  /** water surface height at (x, z): the level's water bodies' rest surface (app.world.water, in registration order: the
   *  sea, a pond / river basin, running water such as a creek), else null */
  waterSurfaceAt(x: number, z: number): number | null {
    return this.frameQueries === null ? app.world.water.restAt(x, z) : this.frameQueries.waterSurfaceAt(x, z);
  }

  /** Swimming started or stopped: the held controls let go with it. */
  private swimChanged(on: boolean): void {
    if (!on) { this.diveHeld = false; this.touchDive = false; this.surfaceHeld = false; this.touchSurface = false; }
    this.onSwimChange?.(on); app.events.emit('player.swim', on);
  }

  /** `y`: the feet's height (a shard whose floor is built: ShardManifest.spawn.y); omitted = the ground's */
  spawn(x: number, z: number, yaw: number, y?: number): void {
    this.position.set(x, y ?? this.groundHeightAt(x, z), z);
    this.motor.release();
    this.prevFeet.copy(this.position);
    this.yaw = yaw; this.pitch = 0;
    this.velocity.set(0, 0, 0);
    this.impulseVelocity.set(0, 0, 0);
    this.dashState.t = 0;
    leaveSwim(this.motionState, this.motionWorld); this.inWater = false; this.depth = 0; this.wading = false;
  }

  get forward(): THREE.Vector3 { return new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw)); }

  /** on foot, not swimming / on the board / sliding: a dash (dodge, lunge) may start */
  private get canDash(): boolean { return !this.hover && !this.swimming && !this.sliding; }
  /** a dash: move at (vx, vz) m/s for `time` s, whatever the input says (gravity, collisions and the pier-edge probe still apply) */
  dash(vx: number, vz: number, time: number): boolean {
    if (!this.canDash) return false;
    return startDash(this.dashState, vx, vz, time);
  }
  /** the sword's lunge: dash toward (x, z) and stop `stopAt` m short of it, over `time` s. False (nothing happens) when already that close. */
  dashTo(x: number, z: number, stopAt: number, time: number): boolean {
    if (!this.canDash || !dashToward(this.dashState, this.position.x, this.position.z, x, z, stopAt, time)) return false;
    this.fovKick = Math.max(this.fovKick, LUNGE_FOV_KICK);
    this.onLunge?.();
    return true;
  }
  /** DODGE (Left Alt / the DODGE disc): DODGE_DIST m in DODGE_TIME s toward the move input, a backstep with none;
   *  DODGE_COOLDOWN s between. The feel is E63's T "lean + smear" — the user locked it in and V was deleted (E82) */
  dodge(): boolean {
    if (this.dodgeState.cd > 0 || !this.canDash) return false;
    const move = this.moveInput(), fwd = move.y, str = move.x;
    const sin = Math.sin(this.yaw), cos = Math.cos(this.yaw);
    const heading = this.dodgeDir;
    const len = dodgeHeading(-sin * fwd + cos * str, -cos * fwd - sin * str, this.yaw, heading); // no input: straight back
    let mx = heading.x, mz = heading.z;
    const v = DODGE_DIST / DODGE_TIME;
    // locked on (E50 §2.4): the dodge is relative to the target — sideways = a side-hop of DODGE_DIST m of ARC round it (the
    // radius kept), forward = a short close-in dash that stops at lunge distance, back / none = the backstep, straight away
    const lt = lockOn.state === 'locked' ? lockOn.target : null;
    let ok: boolean | null = null;
    if (lt !== null && len >= 0.2) {
      const dx = lt.position.x - this.position.x, dz = lt.position.z - this.position.z, r = Math.hypot(dx, dz);
      if (r > 0.3) {
        const ux = dx / r, uz = dz / r, radial = mx * ux + mz * uz, tang = -mx * uz + mz * ux; // input split: toward / round (right = (−uz, ux))
        if (Math.abs(tang) >= Math.abs(radial)) {
          const th = DODGE_DIST / Math.max(r, 1.5), ox = -ux * r, oz = -uz * r;
          let best: [number, number] | null = null;
          for (const a of [th, -th]) { // the rotation that moves along the pushed side
            const c = Math.cos(a), sn = Math.sin(a);
            const tx = lt.position.x + ox * c - oz * sn, tz = lt.position.z + ox * sn + oz * c;
            if (((tx - this.position.x) * -uz + (tz - this.position.z) * ux) * tang > 0) best = [tx, tz];
          }
          if (best) { mx = best[0] - this.position.x; mz = best[1] - this.position.z; const l = Math.hypot(mx, mz) || 1; ok = this.dash(mx / DODGE_TIME, mz / DODGE_TIME, DODGE_TIME); mx /= l; mz /= l; }
        } else if (radial > 0) ok = this.dashTo(lt.position.x, lt.position.z, targetRadius(lt) + 1.1, 0.2);
      }
    }
    ok ??= this.dash(mx * v, mz * v, DODGE_TIME);
    if (!ok) return false;
    startDodge(this.dodgeState, this.dodgeCooldownScale);
    // feel (E63): the camera / viewmodel / screen curves run off one clock — see the camera block in update()
    const side = len < 0.2 ? 0 : Math.max(-1, Math.min(1, mx * cos - mz * sin)); // + = the dodge goes right (view space)
    this.dodgeClock = 0;
    dodgeFx.t = 0; dodgeFx.side = side; dodgeFx.back = len < 0.2; dodgeFx.id++;
    app.events.emit('player.dodge', true); this.onDodge?.();
    return true;
  }
  /** Add transient world velocity in m/s independently of steering; every displacement uses the motor. */
  impulse(worldVelocityMps: THREE.Vector3): void {
    if (![worldVelocityMps.x, worldVelocityMps.y, worldVelocityMps.z].every(Number.isFinite)) throw new Error('Player impulse must be finite');
    if (this.ride !== null || this.carried || this.effectMoveLocked || this.swimming) return;
    addImpulse(this.impulseVelocity, worldVelocityMps);
    if (worldVelocityMps.y > 0) { if (this.hover) boardShoved(this, worldVelocityMps.y); else this.onGround = false; }
  }

  /** A creature hit you from (fromX, fromZ): knocked `speed` m/s away from it, fading over SHOVE_TIME (≈ a step at 6 m/s). */
  shove(fromX: number, fromZ: number, speed: number): void {
    if (this.hover || this.swimming) return;
    startShove(this.shoveState, this.position.x, this.position.z, fromX, fromZ, this.yaw, speed);
    this.dashState.t = 0;
    if (this.onGround) { this.velocity.y = shoveHop(this.velocity.y); this.onGround = false; }
  }

  /**
   * Frame start (Game's input phase): the aim assist's nudge, then the controls read into intents the fixed steps
   * consume — the move stick / keys, a jump press (an EDGE, queued until a step takes it), a tapped dodge.
   */
  input(dtRaw: number): void {
    const dt = Math.min(dtRaw, 0.05);
    this.preUpdate?.(dt);
    const crouch = (want: boolean, via: 'toggle' | 'hold'): boolean => {
      const answer = this.traversalEvents?.ask('player.crouch', { want, via });
      return answer !== undefined && (answer.latched || (want && answer.allowed));
    };
    const toggle = crouch(this.keys.has('KeyC') || (this.inputService?.held('crouch') ?? false), 'toggle');
    const hold = crouch(this.keys.has('ControlLeft') || (this.inputService?.held('crouch.hold') ?? false), 'hold');
    this.crouchWanted = toggle || hold;
    if (this.mountedOn !== null) this.crouching = false;
    if (this.ride !== null) { this.ride.drive(dt); return; }
    const k = this.keys, move = this.moveInput();
    this.inFwd = move.y; this.inStr = move.x;
    // jump is an EDGE (press), not a held state — so holding Space can't chain a double jump
    if (this.inputService === null) {
      const jumpDown = k.has('Space') || this.touchJump; this.touchJump = false;
      if (jumpDown && !this.jumpWasDown) this.jumpQueued = true;
      this.jumpWasDown = jumpDown;
    }
    if (this.touchDodge) { this.touchDodge = false; this.dodgeQueued = true; }
  }

  /** Sample jump edges before contexts claim them; movement still reads at its original input point. */
  collectActions(): void {
    if (this.touchJump) { this.inputService?.press('jump'); this.touchJump = false; }
  }

  /** Explore's free camera / the tour own the view: the body leaves the world's way until they hand it back (and it
   *  stays out while you ride — bootstrap re-enables it every fixed step, so the gate is here). */
  setBodyEnabled(on: boolean): void { this.motor.setEnabled(on && this.ride === null); }   // in the saddle the horse is the body (N17)

  /** Canonical eye and heading. Presentation offsets never affect hit selection. */
  sampleAimCommand(): AimCommand {
    const recorded = this.inputService?.commandAim;
    if (recorded !== undefined) return recorded;
    const cos = Math.cos(this.pitch);
    return { origin: { x: this.position.x, y: this.position.y + (this.crouching ? EYE - 0.65 : EYE), z: this.position.z },
      direction: { x: -Math.sin(this.yaw) * cos, y: Math.sin(this.pitch), z: -Math.cos(this.yaw) * cos } };
  }

  /** Raw local directions from the same controls as movement, without summing keyboard and analog strengths. */
  sampleSteer(): LocalSteer {
    const input = this.inputService, keys = this.keys;
    const held = (action: 'move.forward' | 'move.back' | 'move.left' | 'move.right', key: string): number =>
      Number(input === null ? keys.has(key) : input.held(action));
    return { keyX: held('move.right', 'KeyD') - held('move.left', 'KeyA'), keyY: held('move.forward', 'KeyW') - held('move.back', 'KeyS'),
      stickX: this.touchMove.x, stickY: this.touchMove.y };
  }
  /** Device edge. Version 1 adds detached raw steering; ordinary recordings keep their original shape. */
  sampleCommand(commandVersion?: 1): PlayerCommand {
    const input = this.inputService, k = this.keys;
    const ride = commandVersion === 1 ? this.ride?.sampleCommand?.() : undefined;
    return {
      moveX: this.inStr, moveY: this.inFwd, yaw: this.yaw, pitch: this.pitch,
      crouch: this.crouchWanted, aim: this.sampleAimCommand(),
      sprint: ride?.sprint ?? ((input?.held('sprint') ?? k.has('ShiftLeft')) || this.touchSprint),
      jump: ride?.jump ?? (input?.pressed('jump') ?? this.jumpQueued),
      dodge: (input?.pressed('dodge') ?? false) || this.dodgeQueued,
      dive: (input?.held('dive') ?? k.has('Space')) || this.touchDive,
      surface: (input?.held('surface') ?? (k.has('ShiftLeft') || k.has('ShiftRight'))) || this.touchSurface,
      ...(commandVersion === 1 ? { commandVersion, steer: ride === undefined ? this.sampleSteer() : { ...ride.steer } } : {}),
    };
  }

  /** Live callers sample at the edge; Node replays pass a recorded command. */
  step(dt: number, command?: PlayerCommand): void {
    const resolved = command ?? this.sampleCommand();
    this.recordCommand?.({ ...resolved });
    this.commandJumpUsed = false; this.commandDodgeUsed = false;
    this.activeCommand = resolved;
    try { this.stepCommand(dt, resolved); } finally { this.activeCommand = null; }
    const used = this.commandUse(); // read back after the step: stepCommand sets the flags in nested calls
    if (command === undefined && used.jump) this.inputService?.consume('jump');
    if (command === undefined && used.dodge) this.inputService?.consume('dodge');
  }

  private commandUse(): { jump: boolean; dodge: boolean } { return { jump: this.commandJumpUsed, dodge: this.commandDodgeUsed }; }

  /** One fixed step (Game's `post` slot, dt = FIXED_STEP): the move, against the stepped physics world. */
  private stepCommand(dt: number, command: PlayerCommand): void {
    this.yaw = command.yaw; this.pitch = command.pitch;
    this.crouchWanted = command.crouch;
    if (command.dodge && this.dodge()) {
      this.dodgeQueued = false; this.commandDodgeUsed = true;
    }
    this.prevFeet.copy(this.position);
    // in the saddle the horse carries you (Mount.step, on the horse's own motor): no walk, no motor of yours
    if (this.ride !== null) { this.impulseVelocity.set(0, 0, 0); this.ride.step(dt); return; }
    if (this.traversalEvents?.ask('player.traversal', dt) === true) { this.impulseVelocity.set(0, 0, 0); this.jumpQueued = false; return; }
    if (this.carried || this.effectMoveLocked) { this.impulseVelocity.set(0, 0, 0); this.velocity.set(0, 0, 0); this.onGround = false; return; }
    const fwd = command.moveY, str = command.moveX;
    const hover = this.hover;
    const swim = this.swimming && !hover;
    this.crouching = !hover && !swim && this.crouchWanted;
    this.sprinting = !hover && !swim && this.depth < NO_SPRINT_DEPTH && command.sprint && fwd > 0 && !this.crouching;
    this.waveTime += dt;

    const sin = Math.sin(this.yaw), cos = Math.cos(this.yaw);
    let mx = (-sin * fwd + cos * str), mz = (-cos * fwd - sin * str);
    // locked on (E50 §2.4): MOVE orbits the target — stick x = round it, y = in / out; a pure sideways push holds the radius
    // you had (a straight strafe under a tracking view spirals out), and never closer than its body + 0.9 m
    const lt = lockOn.state === 'locked' ? lockOn.target : null;
    if (lt !== null && !hover && !swim) {
      const dx = lt.position.x - this.position.x, dz = lt.position.z - this.position.z, r = Math.hypot(dx, dz);
      if (r > 0.2) {
        const ux = dx / r, uz = dz / r, minR = targetRadius(lt) + 0.9;
        let f = fwd;
        if (f > 0 && r <= minR) f = 0;
        if (Math.abs(f) > 0.15) lockOn.r0 = r;
        else if (Math.abs(str) > 0.1) f = Math.max(-0.6, Math.min(0.6, (r - lockOn.r0) * 0.8));
        mx = ux * f - uz * str; mz = uz * f + ux * str;
      }
    }
    this.jumpQueued = false;
    // while swimming Space / the DIVE disc and Shift / the SURFACE disc are HELD controls (the swim branch reads them)
    this.diveHeld = swim && command.dive;
    this.surfaceHeld = swim && command.surface;
    if (hover) { this.hoverLanded = 0; this.hoverJumpKick = Math.max(0, this.hoverJumpKick - dt * 4); }

    // the move: the one motion step SimHost also runs (player/motion.ts), on this Player's law (PAGE_MOTION). dodge()
    // above pressed its own dodge, because the lock-on's side-hop is client-only.
    const out = stepPlayerMotion(this.motionState, { moveX: mx, moveZ: mz, yaw: this.yaw, jump: command.jump && !swim, dive: this.diveHeld, surface: this.surfaceHeld }, this.motionWorld, dt);
    this.afterMotion(out, hover, dt);
  }

  /** What the view keeps from a step: the board's telemetry, the stand-up's dip, the splash. */
  private afterMotion(out: MotionOut, hover: boolean, dt: number): void {
    if (hover) {
      this.hoverLat = out.board.lat; this.hoverFwd = out.board.fwd;
      this.hoverAccel += (out.board.accel - this.hoverAccel) * Math.min(1, dt * 8);
    } else this.hoverLat = this.hoverFwd = this.hoverAccel = this.hoverBob = 0;
    if (out.left === 'stood') this.landImpulse = 0.06; // stood up on the rising bottom: wade out

    // water entry / exit (the feet crossing the surface): splash on the way in, the impact = how fast we hit it
    const inWater = this.depth > 0.02;
    if (inWater !== this.inWater) {
      this.inWater = inWater;
      if (inWater) this.onEnterWater?.(Math.max(0, -this.velocity.y / (this.swimming ? out.entryKeep : 1)) + Math.hypot(this.velocity.x, this.velocity.z) * 0.3);
      else this.onExitWater?.();
    }
  }

  /**
   * Every frame (after the fixed steps): the camera, posed from the feet interpolated between the last two steps by
   * `alpha` (Game.alpha) so it glides at any frame rate and through a hit-stop, where a step lands only every ~25 frames.
   */
  update(dtRaw: number, alpha = 1): void {
    const dt = Math.min(dtRaw, 0.05);
    if (this.ride !== null) { this.ride.pose(dt, alpha); this.renderFeet.copy(this.position); return; }   // the saddle's eye (Mount.pose) owns the camera
    const hover = this.hover;
    const swim = this.swimming && !hover;
    const sin = Math.sin(this.yaw), cos = Math.cos(this.yaw);
    // a teleport (respawn, Explore's park, a quest's move) is not a glide
    const feet = this.renderFeet;
    if (this.prevFeet.distanceToSquared(this.position) > 25) feet.copy(this.position);
    else feet.lerpVectors(this.prevFeet, this.position, Math.max(0, Math.min(1, alpha)));

    const hSpeed = Math.hypot(this.velocity.x, this.velocity.z);
    this.speedFactor = combatSpeedFactor(hSpeed, this.onGround, swim, hover, 7.2);
    const targetEye = this.crouching ? EYE - 0.65 : EYE;
    this.eyeOffset += (targetEye - this.eyeOffset) * Math.min(1, dt * 10);
    this.landImpulse *= Math.exp(-dt * 9);
    // dodge / lunge feel: the lean eases out, the FOV kick holds while the dash runs and eases out after
    if (this.dashState.t <= 0) this.fovKick *= Math.exp(-dt * 8);
    // the dodge feel (E63 T, project/archive/2026-09-29-dodge-feel.md): leans 7° into the side, leads 4 cm, dips 7 cm, +5° FOV, all on the
    // shared envelope; a backstep pitches up instead of leaning
    let dodgeDip = 0, dodgeLead = 0, dodgePitch = 0; this.dashRoll = 0;
    if (this.dodgeClock >= 0) {
      this.dodgeClock += dt * 1000;
      const ms = this.dodgeClock, e = dodgeEnv(ms), side = dodgeFx.side;
      dodgeDip = DODGE_DIP * e; dodgeLead = 0.04 * side * e;
      if (dodgeFx.back) dodgePitch = (1.5 * Math.PI / 180) * e; else this.dashRoll = -side * DODGE_ROLL * e; // −: roll toward the dodge side
      if (ms < 450) this.fovKick = Math.max(this.fovKick, DODGE_FOV_KICK * Math.max(0, e));
      if (ms > DODGE_FX_END) this.dodgeClock = -1;
    }
    dodgeFx.t = this.dodgeClock;
    if (this.fovKick < 0.02) this.fovKick = 0;
    this.hoverBlend += ((hover ? 1 : 0) - this.hoverBlend) * Math.min(1, dt * 4);
    if (!hover && !swim) this.bobTime += dt * (this.sprinting ? 11.5 : 8.5) * Math.min(1, hSpeed / 2);
    const bobAmp = this.onGround && !hover && !swim ? Math.min(1, hSpeed / 3) * (this.sprinting ? 0.055 : 0.03) : 0;
    const bobY = Math.sin(this.bobTime * 2) * bobAmp;
    const bobX = Math.cos(this.bobTime) * bobAmp * 0.8;
    const phase = Math.floor(this.bobTime / Math.PI);
    if (phase !== this.lastBobPhase && bobAmp > 0.005) { this.lastBobPhase = phase; this.onStep?.(this.sprinting); }
    // hover: roll gently into strafes / carves (from lateral velocity), nose down a hair at speed
    const rollT = hover ? -Math.max(-1, Math.min(1, this.hoverLat / HOVER_ROLL_AT)) * HOVER_ROLL : swim ? Math.sin(this.waveTime * 1.1) * 0.012 : 0;
    const pitchT = hover ? -(hSpeed / hoverSpeed(this.hoverSpeedLimit?.(), this.hoverBoost && isDev())) * HOVER_PITCH : 0;
    this.roll += (rollT - this.roll) * Math.min(1, dt * 5);
    this.pitchLean += (pitchT - this.pitchLean) * Math.min(1, dt * 3);

    this.camera.position.set(feet.x + (bobX + dodgeLead) * cos, feet.y + this.eyeOffset + bobY - this.landImpulse - dodgeDip, feet.z - (bobX + dodgeLead) * sin);
    this.camera.rotation.set(0, 0, 0, 'YXZ');
    this.camera.rotation.y = this.yaw;
    this.camera.rotation.x = this.pitch + this.pitchLean + dodgePitch;
    this.camera.rotation.z = Math.sin(this.bobTime) * bobAmp * 0.25 - this.inStr * 0.012 * (1 - this.hoverBlend) + this.roll + this.dashRoll;

    // water line: tint the bottom of the view as the eye nears / dips under the surface; under it, the underwater look
    const eyeAbove = this.waterSurface === null ? Infinity : this.camera.position.y - this.waterSurface;
    const submerged = eyeAbove < 0;
    if (submerged !== this.submerged) {
      this.submerged = submerged;
      setUnderwater(submerged);
      if (submerged) this.onSubmerge?.(); else this.onSurface?.();
    }
    updateUnderwater(dt, (this.camera.parent as THREE.Scene | null)?.fog ?? null);
    this.waterLine.update(eyeAbove, dt);
    this.waterLine.setHint(!swim ? 0 : submerged ? 2 : 1);
  }
}

/**
 * This Player as `PlayerMotionState`. The page has one velocity through every mode (`PAGE_MOTION.oneVelocity`), so the
 * state's walk, board and swim velocities are that one vector and the fall's speed is its y. The rest reads and writes the
 * Player's public fields, which the view, the weapons and the shards read, or the motion state the Player owns (`own`).
 */
function pageMotionState(player: Player, own: Pick<PlayerMotionState, 'impulse' | 'shove' | 'dash' | 'dodge' | 'jump'>): PlayerMotionState {
  const { position, velocity } = player;
  return { ...own, position, walk: velocity, boardVelocity: velocity, swimVelocity: velocity,
    get yaw() { return player.yaw; }, set yaw(value) { player.yaw = value; },
    get moveScale() { return player.moveScale; }, set moveScale(value) { player.moveScale = value; },
    fall: { get vy() { return velocity.y; }, set vy(value) { velocity.y = value; },
      get grounded() { return player.onGround; }, set grounded(value) { player.onGround = value; } },
    board: { get on() { return player.hover; }, get onGround() { return player.onGround; }, set onGround(value) { player.onGround = value; },
      get hoverAir() { return player.hoverAir; }, set hoverAir(value) { player.hoverAir = value; },
      get hoverBob() { return player.hoverBob; }, set hoverBob(value) { player.hoverBob = value; } },
    swim: { stood: false, get on() { return player.swimming; }, set on(value) { player.swimming = value; },
      get diving() { return player.diving; }, set diving(value) { player.diving = value; },
      get climbTo() { return player.climbTo; }, set climbTo(value) { player.climbTo = value; },
      get climbCooldown() { return player.climbCooldown; }, set climbCooldown(value) { player.climbCooldown = value; },
      get strokeTime() { return player.strokeTime; }, set strokeTime(value) { player.strokeTime = value; } },
    footing: { get water() { return player.waterSurface; }, set water(value) { player.waterSurface = value; },
      get depth() { return player.depth; }, set depth(value) { player.depth = value; },
      get wading() { return player.wading; }, set wading(value) { player.wading = value; },
      get onPlatform() { return player.onPlatform; }, set onPlatform(value) { player.onPlatform = value; },
      get sliding() { return player.sliding; }, set sliding(value) { player.sliding = value; } } };
}
