import * as THREE from 'three';
import { heightAt, pondMask, waterLevel, streamAt } from '../world/Heightfield';
import { getActiveChunk } from '../chunks/registry';
import { Hoverboard } from './Hoverboard';
import { WaterLine } from './WaterLine';
import { setUnderwater, updateUnderwater } from '../world/Atmosphere';
import { waveHeight } from '../world/waves';
import { getNumber } from '../ui/Settings';
import { lockOn, targetRadius } from './AimTargets';
import { addLockOffset } from './LockOnTarget';
import { CharacterMotor } from '../physics/CharacterMotor';
import { floorBelow } from '../physics/query';
import type { Physics } from '../physics/Physics';
import { stateSlot } from '../core/shardState';

export interface Collider { x: number; z: number; hw: number; hd: number; rot: number; yTop: number; yBottom: number }

const EYE = 1.68;
const RADIUS = 0.38;
const BODY_HEIGHT = 1.8;               // the capsule, feet to crown
const STEP_UP = 0.35;                  // m climbed without a jump (PHYSICS.md: stricter than the old 0.5)
const MAX_CLIMB_DEG = 40;              // steeper ground is a wall to walk into (the old SLOPE_WALK let 44° through)
const GRAVITY = 22;

// ── hoverboard (toggle: H / the HOVER touch button) ──
export const HOVER_TOP = 14;          // m/s cruise
const HOVER_ACCEL = 12;               // m/s² with input → 0 → top in ~1.2 s
const HOVER_DECEL = 3;                // m/s² gliding with no input (25 % of accel)
const HOVER_LAT_DRAG = 3.5;           // /s — sideways velocity (relative to the heading) bleeds off faster than forward: carve, not shopping cart
const HOVER_HEIGHT = 0.45;            // m above the terrain / platform
const HOVER_SPRING_K = 70;            // spring to the ride height (ω ≈ 8.4 rad/s) …
const HOVER_SPRING_C = 6.5;           // … slightly under-damped (ζ ≈ 0.39) so it bobs after a hop / a bump
const HOVER_SPRING_MAX = 30;          // m/s² — clamp so a cliff edge feels like falling, not a slingshot
const HOVER_JUMP = 9.5;               // m/s launch — a real jump, not a bob: the spring lets go and gravity (lighter) brings you down
const HOVER_JUMP_GRAVITY = 15;        // m/s² while airborne on the board (floatier than on foot)
const DOUBLE_JUMP = 8.6;              // m/s second jump on foot (E120: 6.8 → 8.6, ~1.7 m on top of the first: wading beside the pier you clear its deck by ~0.2 m)
const HOVER_ROLL = 6 * Math.PI / 180; // camera roll cap, reached at HOVER_ROLL_AT m/s sideways
const HOVER_ROLL_AT = 7;
const HOVER_PITCH = 0.03;             // rad nose-down at top speed

// ── water: wading → swimming (see `waterSurface`, `depth`, `wading`, `swimming`) ──
const WADE_MAX = 1.1;                 // m of water over the ground: shallower = wade on foot, deeper = swim (hysteresis below)
const SWIM_IN = WADE_MAX + 0.1;       // ground depth at which walking becomes swimming …
const SWIM_OUT = WADE_MAX - 0.05;     // … and swimming becomes wading again (the seabed / a beach rising under you)
const NO_SPRINT_DEPTH = 0.6;          // knee-deep and up: no sprint
const FLOAT_DEPTH = EYE - 0.35;       // feet float this far under the surface → the eye sits 0.35 m above it
export const SWIM_SPEED = 4.3 * 0.6;  // m/s, 60 % of walking (Hands.ts paces the stroke against it)
const SWIM_ACCEL = 5;                 // /s — sluggish in water
const BUOY_K = 14;                    // spring to the float height (ω ≈ 3.7 rad/s) …
const BUOY_C = 3.5;                   // … under-damped (ζ ≈ 0.47): a plunge off a pier dips the head under and pops back up
const CLIMB_REACH = 1.3;              // m a platform top may sit above the surface and still be climbed onto from the water
const CLIMB_K = 30; const CLIMB_C = 10; // stiffer pull when hauling out onto a deck
const CLIMB_PROBE = 0.7;              // m ahead of the feet where a platform is looked for while swimming toward it
export const STROKE_PERIOD = 0.85;    // s between strokes at full swim speed (`onStroke`; Hands.ts runs one arm cycle per stroke)
// ── diving (hold DIVE to go down, hold SURFACE to come up; nothing else moves you vertically — no drowning, no stamina) ──
const DIVE_SPEED = 1.6;               // m/s descent while DIVE is held …
const SURFACE_SPEED = 2.0;            // … and ascent while SURFACE is held
const DIVE_EASE = 5;                  // /s — a short ease-in / ease-out on the vertical speed (a heavy, watery start)
const DIVE_ENTER = 0.35;              // m below the float height at which the dive "latches" (neutral buoyancy from here down)
const DIVE_SWIM = 0.85;               // horizontal swim speed underwater, as a fraction of the surface swim
// ── slopes (on foot, on terrain — not platforms, not water, never the hoverboard): past MAX_CLIMB_DEG the motor won't climb ──
const SLOPE_SLIDE = 0.6;              // ground normal y below this (≈ 53°) under the feet: you slide down it with no control
const SLIDE_SPEED = 3.2;              // m/s down the fall line while sliding …
const SLIDE_ACCEL = 5;                // … reached at this rate (/s)
// ── dash (on foot): the DODGE (Left Alt / the DODGE disc) and the sword's lunge (Sword.ts) — a short fixed-velocity burst ──
const DODGE_DIST = 3;                 // m …
const DODGE_TIME = 0.25;              // … over this long (12 m/s), toward the move input; no input = a backstep
/** the running dodge, for the viewmodel (Sword.ts) and the screen FX (SpeedLines.ts): `t` ms since it started (-1 = none),
 *  `side` −1 left … +1 right, `back` a backstep (no input) */
export const dodgeFx: { t: number; side: number; back: boolean; id: number } = { t: -1, side: 0, back: false, id: 0 };
/** the shared envelope (DODGE-FEEL "Shared timeline"): load 0–40 ms, burst to 120, hold to 250, then an underdamped spring
 *  (ζ ≈ 0.55, ω ≈ 13 rad/s) that overshoots ~12 % at ~390 ms and settles by ~500 */
export function dodgeEnv(ms: number): number {
  if (ms < 0) return 0;
  if (ms < 40) return 0.25 * (ms / 40) ** 2;
  if (ms < 120) { const u = (ms - 40) / 80; return 0.25 + 0.75 * (1 - (1 - u) ** 3); }
  if (ms < 250) return 1 - 0.15 * ((ms - 120) / 130);
  const r = (ms - 250) / 1000;
  return 0.85 * Math.exp(-7.15 * r) * Math.cos(10.86 * r);
}
const DODGE_FX_END = 700;              // ms: every dodge curve has settled
const DODGE_COOLDOWN = 0.8;           // s from one dodge's start to the next (E59: 0.6 → 0.8, shown as a sweep on the DODGE disc)
const DASH_PROBE = 0.5;               // m ahead of the feet: deep water there (no deck under it) ends a dash — it never carries you off a pier
const DODGE_DIP = 0.07;               // m the eye drops at a dodge's start (the land-impulse spring brings it back)
const DODGE_ROLL = 0.122;             // rad of camera lean into a fully sideways T dodge at its peak (7°, E63; 0.06 before)
const DODGE_FOV_KICK = 5;             // ° wider while a dodge runs …
const LUNGE_FOV_KICK = 7;             // … and a lunge (Sword.ts reads `fovKick`)
// ── shove: a creature's hit knocks you back a step, through the controller (a wall behind you stops it) ──
const SHOVE_TIME = 0.18;              // s of the burst; the speed fades to 0 over it
const SHOVE_HOP = 1.6;                // m/s up, so it reads as a knock, not a slide

export class Player {
  position = new THREE.Vector3(0, 0, 0);
  velocity = new THREE.Vector3();
  yaw = 0;
  pitch = 0;
  onGround = true;
  crouching = false;
  sprinting = false;
  speedFactor = 0;   // for headbob / audio
  bobTime = 0;
  locked = false;
  /** the world's hand-made boxes; src/physics/bridge.ts mirrors them into Rapier until P4 / P3 replace them */
  colliders: Collider[] = [];
  /** extra walkable surfaces (cabin floors, porch decks): return a world y or undefined */
  platforms: ((x: number, z: number) => number | undefined)[] = [];
  keys = new Set<string>();
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
  private jumpWasDown = false; private jumpsLeft = 0;
  onHoverChange?: (on: boolean) => void;
  // ── water ──
  /** height of the water surface under the player (the chunk's ocean, or the pond where `pondMask > 0`); null on dry land */
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
  private inWater = false; private strokeTime = 0; private climbTo: number | null = null; private climbCooldown = 0; private entryKeep = 0.3;
  private readonly waterLine = new WaterLine();
  readonly board: Hoverboard;
  private eyeOffset = EYE;
  private landImpulse = 0;
  private roll = 0; private pitchLean = 0;
  onJump?: () => void;
  /** Shard traversal may consume a fresh jump press before the ordinary jump is queued. */
  onJumpRequest?: () => boolean;
  /** A traversal verb may drive the capsule for one fixed step through the CharacterMotor. */
  traversalStep?: (dt: number) => boolean;
  onLand?: (hard: boolean) => void;
  onStep?: (sprinting: boolean) => void;
  /** runs first thing in update(), before input is read and the camera is posed — the touch aim assist nudges yaw/pitch here */
  preUpdate?: (dt: number) => void;
  /** riding (Nalati B7, src/player/Mount.ts): while set, the frame is handed to it — `drive` reads the input (input
   *  phase), `step` moves the horse on its own motor (each fixed step), `pose` places the rider and the camera from the
   *  interpolated saddle (update, `alpha`) — and walking / swimming / the board are skipped */
  ride: { drive: (dt: number) => void; step: (dt: number) => void; pose: (dt: number, alpha: number) => void } | null = null;
  private lastBobPhase = 0;
  // ── dash: dodge + lunge (see `dodge()` / `dash()`) ──
  /** the DODGE disc was tapped (TouchControls) — consumed next update, like `touchJump` */
  touchDodge = false;
  /** walking speed multiplier a weapon may pin (the Nalati spear's BRACE: 0 = planted, the view still turns) */
  moveScale = 1;
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
  private dashT = 0; private dashVx = 0; private dashVz = 0; private dodgeCd = 0;
  private dashRoll = 0; // camera lean into a sideways dodge (rad), from the dodge envelope
  private dodgeClock = -1; // ms since the running dodge started (-1 = none): the E63 feel curves
  private shoveT = 0; private shoveVx = 0; private shoveVz = 0;
  /** something else owns the position (the zipline's cable, the finale's reward shot): the fixed step leaves it alone */
  carried = false;
  // ── the fixed step (PHYSICS.md P2): input() reads intents, step() moves at 60 Hz, update() poses the camera ──
  private inFwd = 0; private inStr = 0; private jumpQueued = false;
  /** the feet before the last fixed step: update() interpolates the camera between it and `position` */
  private readonly prevFeet = new THREE.Vector3();
  private readonly renderFeet = new THREE.Vector3();
  private readonly want = { x: 0, y: 0, z: 0 };
  /** the capsule + Rapier character controller that collides the move (src/physics/CharacterMotor.ts) */
  readonly motor: CharacterMotor;
  /** true while a dodge / lunge burst is carrying the player */
  get dashing(): boolean { return this.dashT > 0; }
  /** the dodge cooldown still to run, 1 → 0 (0 = ready) — the touch DODGE disc's clock sweep (E59) */
  get dodgeCooldown(): number { return this.dodgeCd / DODGE_COOLDOWN; }

  constructor(public camera: THREE.PerspectiveCamera, private readonly physics: Physics, private canvas: HTMLCanvasElement) {
    this.motor = new CharacterMotor(physics, { radius: RADIUS, height: BODY_HEIGHT, step: STEP_UP, maxClimbDeg: MAX_CLIMB_DEG, snap: 0.3, group: 'PLAYER', blockedBy: ['WORLD', 'CREATURE', 'ITEM'], owner: this, weight: 80 });
    document.addEventListener('keydown', (e) => {
      this.keys.add(e.code);
      if (e.code === 'Space') e.preventDefault();
      if (e.code === 'KeyH' && !e.repeat) this.setHover(!this.hover);
      if (e.code === 'AltLeft') { e.preventDefault(); if (!e.repeat && this.locked) this.dodge(); } // Alt alone would focus the browser's menu bar
    });
    document.addEventListener('keyup', (e) => { this.keys.delete(e.code); });
    document.addEventListener('mousemove', (e) => {
      if (!this.locked) return;
      const s = 0.0022 * this.lookMult;
      if (lockOn.state === 'locked') { addLockOffset(-e.movementX * s, -e.movementY * s); return; } // locked (E50): a glance, not a turn
      this.yaw -= e.movementX * s;
      this.pitch -= e.movementY * s;
      this.pitch = Math.max(-1.45, Math.min(1.45, this.pitch));
    });
    document.addEventListener('pointerlockchange', () => { this.locked = document.pointerLockElement === this.canvas; if (!this.locked) this.keys.clear(); });
    window.addEventListener('blur', () => this.keys.clear());
    this.board = new Hoverboard(camera, HOVER_TOP);
  }

  // absent on iOS Safari; present but rejecting ("UnknownError") in the Android WebView — touch input never needs it,
  // and an unhandled rejection would raise the uncaught-exception modal on ENTER WORLD
  lock(): void { if ('requestPointerLock' in this.canvas) this.canvas.requestPointerLock().catch(() => { /* no pointer lock here: touch play */ }); }

  /** step on / off the hoverboard. Off: the board fades and gravity lands you; on: the spring lifts you to ride height. */
  setHover(on: boolean): void {
    if (on === this.hover) return;
    this.hover = on;
    if (on) { this.crouching = false; this.sprinting = false; this.onGround = false; this.setSwimming(false); }
    this.onHoverChange?.(on);
  }

  /** water surface height at (x, z): the shard's ocean if it has one, else the pond where the basin mask is set, else running
   *  water (Pine Hollow's creek, PH-L9), else null */
  waterSurfaceAt(x: number, z: number): number | null {
    const ocean = getActiveChunk().ocean;
    if (ocean) return ocean.level;
    return pondMask(x, z) > 0 ? waterLevel() : streamAt(x, z);
  }

  private setSwimming(on: boolean): void {
    if (on === this.swimming) return;
    this.swimming = on;
    if (!on) { this.climbTo = null; this.diveHeld = false; this.touchDive = false; this.surfaceHeld = false; this.touchSurface = false; this.diving = false; }
    this.onSwimChange?.(on);
  }

  /** `y`: the feet's height (a shard whose floor is built: ChunkDef.spawn.y); omitted = the ground's */
  spawn(x: number, z: number, yaw: number, y?: number): void {
    this.position.set(x, y ?? heightAt(x, z), z);
    this.motor.release();
    this.prevFeet.copy(this.position);
    this.yaw = yaw; this.pitch = 0;
    this.velocity.set(0, 0, 0);
    this.setSwimming(false); this.inWater = false; this.depth = 0; this.wading = false;
  }

  get forward(): THREE.Vector3 { return new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw)); }

  /** on foot, not swimming / on the board / sliding: a dash (dodge, lunge) may start */
  private get canDash(): boolean { return !this.hover && !this.swimming && !this.sliding; }
  /** a dash: move at (vx, vz) m/s for `time` s, whatever the input says (gravity, collisions and the pier-edge probe still apply) */
  dash(vx: number, vz: number, time: number): boolean {
    if (!this.canDash || time <= 0) return false;
    this.dashVx = vx; this.dashVz = vz; this.dashT = time;
    return true;
  }
  /** the sword's lunge: dash toward (x, z) and stop `stopAt` m short of it, over `time` s. False (nothing happens) when already that close. */
  dashTo(x: number, z: number, stopAt: number, time: number): boolean {
    const dx = x - this.position.x, dz = z - this.position.z, d = Math.hypot(dx, dz), go = d - stopAt;
    if (go < 0.15) return false;
    if (!this.dash(dx / d * go / time, dz / d * go / time, time)) return false;
    this.fovKick = Math.max(this.fovKick, LUNGE_FOV_KICK);
    this.onLunge?.();
    return true;
  }
  /** DODGE (Left Alt / the DODGE disc): DODGE_DIST m in DODGE_TIME s toward the move input, a backstep with none;
   *  DODGE_COOLDOWN s between. The feel is E63's T "lean + smear" — the user locked it in and V was deleted (E82) */
  dodge(): boolean {
    if (this.dodgeCd > 0 || !this.canDash) return false;
    const k = this.keys;
    const fwd = Math.max(-1, Math.min(1, (k.has('KeyW') ? 1 : 0) - (k.has('KeyS') ? 1 : 0) + this.touchMove.y));
    const str = Math.max(-1, Math.min(1, (k.has('KeyD') ? 1 : 0) - (k.has('KeyA') ? 1 : 0) + this.touchMove.x));
    const sin = Math.sin(this.yaw), cos = Math.cos(this.yaw);
    let mx = -sin * fwd + cos * str, mz = -cos * fwd - sin * str;
    const len = Math.hypot(mx, mz);
    if (len < 0.2) { mx = sin; mz = cos; } else { mx /= len; mz /= len; } // no input: straight back
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
    this.dodgeCd = DODGE_COOLDOWN;
    // feel (E63): the camera / viewmodel / screen curves run off one clock — see the camera block in update()
    const side = len < 0.2 ? 0 : Math.max(-1, Math.min(1, mx * cos - mz * sin)); // + = the dodge goes right (view space)
    this.dodgeClock = 0;
    dodgeFx.t = 0; dodgeFx.side = side; dodgeFx.back = len < 0.2; dodgeFx.id++;
    this.onDodge?.();
    return true;
  }
  /** A creature hit you from (fromX, fromZ): knocked `speed` m/s away from it, fading over SHOVE_TIME (≈ a step at 6 m/s). */
  shove(fromX: number, fromZ: number, speed: number): void {
    if (this.hover || this.swimming) return;
    const dx = this.position.x - fromX, dz = this.position.z - fromZ, d = Math.hypot(dx, dz);
    const ux = d > 1e-3 ? dx / d : Math.sin(this.yaw), uz = d > 1e-3 ? dz / d : Math.cos(this.yaw); // on top of us: straight back
    this.shoveVx = ux * speed; this.shoveVz = uz * speed; this.shoveT = SHOVE_TIME;
    this.dashT = 0;
    if (this.onGround) { this.velocity.y = Math.max(this.velocity.y, SHOVE_HOP); this.onGround = false; }
  }
  /** deep water at (x, z) with no deck over it — where a dash must not carry you */
  private deepAt(x: number, z: number): boolean {
    const ws = this.waterSurfaceAt(x, z);
    if (ws === null || ws - heightAt(x, z) <= WADE_MAX) return false;
    for (const p of this.platforms) { const y = p(x, z); if (y !== undefined && y > ws - 0.5) return false; }
    const deck = floorBelow(this.physics, x, z, ws + 3, 3.5, this.motor.collider); // a pier / jetty / boat deck over the water
    return deck === undefined || deck <= ws - 0.5;
  }

  /**
   * Frame start (Game's input phase): the aim assist's nudge, then the controls read into intents the fixed steps
   * consume — the move stick / keys, a jump press (an EDGE, queued until a step takes it), a tapped dodge.
   */
  input(dtRaw: number): void {
    const dt = Math.min(dtRaw, 0.05);
    this.preUpdate?.(dt);
    if (this.ride !== null) { this.ride.drive(dt); return; }
    const k = this.keys;
    this.inFwd = Math.max(-1, Math.min(1, (k.has('KeyW') ? 1 : 0) - (k.has('KeyS') ? 1 : 0) + this.touchMove.y));
    this.inStr = Math.max(-1, Math.min(1, (k.has('KeyD') ? 1 : 0) - (k.has('KeyA') ? 1 : 0) + this.touchMove.x));
    // jump is an EDGE (press), not a held state — so holding Space can't chain a double jump
    const jumpDown = k.has('Space') || this.touchJump; this.touchJump = false;
    if (jumpDown && !this.jumpWasDown && this.onJumpRequest?.() !== true) this.jumpQueued = true;
    this.jumpWasDown = jumpDown;
    if (this.touchDodge) { this.touchDodge = false; this.dodge(); }
  }

  /** Explore's free camera / the tour own the view: the body leaves the world's way until they hand it back (and it
   *  stays out while you ride — bootstrap re-enables it every fixed step, so the gate is here). */
  setBodyEnabled(on: boolean): void { this.motor.setEnabled(on && this.ride === null); }   // in the saddle the horse is the body (N17)

  /** One fixed step (Game's `post` slot, dt = FIXED_STEP): the move, against the stepped physics world. */
  step(dt: number): void {
    this.prevFeet.copy(this.position);
    // in the saddle the horse carries you (Mount.step, on the horse's own motor): no walk, no motor of yours
    if (this.ride !== null) { this.ride.step(dt); return; }
    if (this.traversalStep?.(dt) === true) { this.jumpQueued = false; return; }
    if (this.carried) { this.velocity.set(0, 0, 0); this.onGround = false; return; }
    const k = this.keys;
    const fwd = this.inFwd, str = this.inStr;
    const hover = this.hover;
    const swim = this.swimming && !hover;
    // wading: how deep the feet are right now (last step's resolve) — slows walking, kills sprint past the knee
    const wadeT = !hover && !swim && this.onGround ? Math.min(1, this.depth / WADE_MAX) : 0;
    this.crouching = !hover && !swim && (k.has('ControlLeft') || k.has('KeyC'));
    this.sprinting = !hover && !swim && this.depth < NO_SPRINT_DEPTH && (k.has('ShiftLeft') || this.touchSprint) && fwd > 0 && !this.crouching;
    const speed = (this.crouching ? 2.2 : this.sprinting ? 7.2 : 4.3) * (1 - 0.55 * wadeT) * this.moveScale;
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
    const len = Math.hypot(mx, mz);
    if (len > 1) { mx /= len; mz /= len; }
    const jump = this.jumpQueued && !swim; this.jumpQueued = false;
    // while swimming Space / the DIVE disc and Shift / the SURFACE disc are HELD controls (the swim branch reads them)
    this.diveHeld = swim && (k.has('Space') || this.touchDive);
    this.surfaceHeld = swim && (k.has('ShiftLeft') || k.has('ShiftRight') || this.touchSurface);
    this.dodgeCd = Math.max(0, this.dodgeCd - dt);
    if (hover || swim) this.dashT = 0;

    // ground for the hover spring, the swim float and the water depth: terrain, or a deck / floor / stair platform we
    // are at or above (step up ≤ 0.5 m). Walking collides through the motor; this is the P2 bridge for the platforms
    // (floor functions) that are not Rapier colliders until P4 / P3.
    const groundAt = () => {
      const p = this.position;
      let g = heightAt(p.x, p.z);
      for (const f of this.platforms) {
        const y = f(p.x, p.z);
        if (y !== undefined && y > g && p.y >= y - 0.5) g = y;
      }
      // decks, floors, stairs, rocks as colliders (P4): the first surface below the feet + 0.5 m
      const c = floorBelow(this.physics, p.x, p.z, p.y + 0.5, 80, this.motor.collider);
      return c !== undefined && c > g ? c : g;
    };
    /** the highest platform floor under the feet that they can stand on (at or above it, or ≤ 0.5 m below its top) */
    const platformAt = (): number | undefined => {
      let best: number | undefined;
      for (const p of this.platforms) {
        const y = p(this.position.x, this.position.z);
        if (y !== undefined && this.position.y >= y - 0.5 && (best === undefined || y > best)) best = y;
      }
      return best;
    };
    const want = this.want;

    if (hover) {
      // ── hoverboard: momentum steering — velocity is pulled toward the input direction at a fixed rate, glides with no input ──
      const v = this.velocity;
      const inAir = this.hoverBob > 0.35;                            // above the ride height (hop / ledge): half the grip
      const grip = inAir ? 0.5 : 1;
      const wantMove = len > 0.02;
      const tx = wantMove ? mx * HOVER_TOP : 0, tz = wantMove ? mz * HOVER_TOP : 0;
      const dx = tx - v.x, dz = tz - v.z, dl = Math.hypot(dx, dz);
      const rate = (wantMove ? HOVER_ACCEL : HOVER_DECEL) * grip;
      const stepV = Math.min(dl, rate * dt);
      const vfx = v.x, vfz = v.z;
      if (dl > 1e-6) { v.x += dx / dl * stepV; v.z += dz / dl * stepV; }
      // carve: the sideways component (relative to the heading) is pulled toward what the stick asks for much faster
      // than the forward one — turn at speed and the old momentum, now sideways, bleeds off instead of sliding you
      const fx = -sin, fz = -cos, rx = cos, rz = -sin;
      const vf = v.x * fx + v.z * fz; let vl = v.x * rx + v.z * rz;
      const tl = tx * rx + tz * rz;
      vl += (tl - vl) * (1 - Math.exp(-HOVER_LAT_DRAG * grip * dt));
      v.x = fx * vf + rx * vl; v.z = fz * vf + rz * vl;
      this.hoverLat = vl; this.hoverFwd = vf;
      const af = ((v.x - vfx) * fx + (v.z - vfz) * fz) / dt;
      this.hoverAccel += (af - this.hoverAccel) * Math.min(1, dt * 8);

      // across: walls, posts and trunks stop the board; the terrain never does (the repulsors glide up anything)
      want.x = v.x * dt; want.y = 0; want.z = v.z * dt;
      this.motor.move(this.position, want, true);
      // ride height: a stiff, slightly under-damped spring to ground + HOVER_HEIGHT (no gravity — the repulsors hold you)
      const ws = this.waterSurfaceAt(this.position.x, this.position.z);
      const g = Math.max(groundAt(), ws ?? -Infinity); // the repulsors ride the water surface, not the seabed
      const target = g + HOVER_HEIGHT;
      const err = target - this.position.y;
      this.hoverLanded = 0; this.hoverJumpKick = Math.max(0, this.hoverJumpKick - dt * 4);
      if (jump && this.onGround && !this.hoverAir) { v.y = HOVER_JUMP; this.hoverAir = true; this.hoverJumpKick = 1; this.onGround = false; this.onJump?.(); }
      if (this.hoverAir) {
        // ── airborne: the repulsors can't reach the ground — ballistic, a little floaty, until we fall back to the ride height
        v.y -= HOVER_JUMP_GRAVITY * dt;
        this.position.y += v.y * dt;
        if (v.y < 0 && this.position.y <= target + 0.05) { this.hoverAir = false; this.hoverLanded = -v.y; this.onLand?.(-v.y > 9); }
      } else {
        const a = Math.max(-HOVER_SPRING_MAX, Math.min(HOVER_SPRING_MAX, HOVER_SPRING_K * err)) - HOVER_SPRING_C * v.y;
        v.y += a * dt;
        this.position.y += v.y * dt;
      }
      if (this.position.y < g) { this.position.y = g; if (v.y < 0) v.y = 0; } // steep slope / bump: the board never goes under
      this.hoverBob = this.position.y - target;
      this.onGround = !this.hoverAir && Math.abs(this.hoverBob) < 0.3; // "grounded" = riding near the ride height (jump allowed)
      this.onPlatform = false;
      this.waterSurface = ws; this.depth = 0; this.wading = false;
    } else if (swim) {
      // ── swimming: sluggish horizontal drift, buoyancy (not gravity) eases the feet to the float height; no jump / sprint / crouch ──
      const v = this.velocity;
      const swimSpeed = SWIM_SPEED * (this.diving ? DIVE_SWIM : 1); // a touch slower under the surface
      v.x += (mx * swimSpeed - v.x) * Math.min(1, SWIM_ACCEL * dt);
      v.z += (mz * swimSpeed - v.z) * Math.min(1, SWIM_ACCEL * dt);
      want.x = v.x * dt; want.y = 0; want.z = v.z * dt;
      const r = this.motor.move(this.position, want, true); // pilings, walls, hulls: still solid in the water
      const p = this.position;
      // pinned against a piling / bollard while hauling out: let go of the climb (and don't grab again for a beat) so we
      // sink back to the float height instead of hanging in the air beside the deck
      const blocked = r.horizontalFreedom < 0.25;
      if (this.climbTo !== null && blocked) { this.climbTo = null; this.climbCooldown = 0.6; }
      this.climbCooldown = Math.max(0, this.climbCooldown - dt);
      const ws = this.waterSurfaceAt(p.x, p.z);
      const g = groundAt();
      this.onPlatform = false;
      if (ws === null) {
        // drifted off the water (the pond's mask edge) — back on foot; gravity takes it from here
        this.setSwimming(false); this.onGround = false; this.waterSurface = null; this.depth = 0; this.wading = false;
      } else {
        const groundDepth = ws - g;
        // climbing out: moving toward a platform (the pier deck) whose top is within reach above the surface — and we are
        // not already under it — latches a pull-up to its level; groundAt() then accepts it and we stand up on the deck
        if (len > 0.3) {
          const px = p.x + mx * CLIMB_PROBE, pz = p.z + mz * CLIMB_PROBE;
          let here = false, ahead: number | undefined;
          for (const pl of this.platforms) {
            if (pl(p.x, p.z) !== undefined) here = true;
            const y = pl(px, pz);
            if (y !== undefined && y > ws - 0.3 && y - ws < CLIMB_REACH && (ahead === undefined || y < ahead)) ahead = y;
          }
          // decks as colliders (P4): a surface within reach over the water here / just ahead
          const top = ws + CLIMB_REACH + 0.2;
          const overHere = floorBelow(this.physics, p.x, p.z, top, CLIMB_REACH + 0.5, this.motor.collider);
          if (overHere !== undefined && overHere > ws - 0.3) here = true;
          const y = floorBelow(this.physics, px, pz, top, CLIMB_REACH + 0.5, this.motor.collider);
          if (y !== undefined && y > ws - 0.3 && y - ws < CLIMB_REACH && (ahead === undefined || y < ahead)) ahead = y;
          if (ahead !== undefined && this.climbCooldown === 0 && (!here || this.climbTo !== null)) this.climbTo = ahead;
          else if (this.climbTo !== null && ahead === undefined && !here) this.climbTo = null;
        } else this.climbTo = null;
        if (groundDepth < SWIM_OUT) {
          // the bottom rose under us (beach / seabed / a deck we climbed onto): stand up and wade out
          this.setSwimming(false);
          this.position.y = Math.max(this.position.y, g); this.velocity.y = 0; this.onGround = true;
          this.landImpulse = 0.06;
        } else {
          const climbing = this.climbTo !== null;
          // the open sea: ride the Ocean's own Gerstner swell (DRIFTWOOD-REMASTER W3); the pond keeps its gentle sine bob
          const bob = getActiveChunk().ocean ? waveHeight(this.position.x, this.position.z) : Math.sin(this.waveTime * 1.4) * 0.05 + Math.sin(this.waveTime * 2.3 + 1.0) * 0.02;
          const floatY = ws - FLOAT_DEPTH + bob;
          if (climbing) this.diving = false;
          if (!climbing && (this.diving || this.diveHeld)) {
            // ── diving: the vertical speed is driven, not sprung — DIVE eases you down, SURFACE eases you up, neither holds
            // the depth (neutral buoyancy: no bobbing back up). The seabed / a collider still stops you.
            const wantV = this.diveHeld && !this.surfaceHeld ? -DIVE_SPEED : this.surfaceHeld ? SURFACE_SPEED : 0;
            v.y += (wantV - v.y) * Math.min(1, DIVE_EASE * dt);
            p.y += v.y * dt;
            if (p.y < g) { p.y = g; if (v.y < 0) v.y = 0; }
            if (p.y < floatY - DIVE_ENTER) this.diving = true;
            if (p.y >= floatY) {
              // broke the surface (SURFACE held to the top, or DIVE released before the latch): the float logic takes it from here
              this.diving = false; p.y = floatY; v.y = Math.max(0, v.y) * 0.6;
            }
          } else {
            const target = climbing ? (this.climbTo as number) + 0.02 : floatY;
            const kk = climbing ? CLIMB_K : BUOY_K, cc = climbing ? CLIMB_C : BUOY_C;
            v.y += (kk * (target - p.y) - cc * v.y) * dt;
            p.y += v.y * dt;
            if (p.y < g) { p.y = g; if (v.y < 0) v.y = 0; }
          }
          this.onGround = false;
        }
        this.waterSurface = ws;
        this.depth = Math.max(0, ws - this.position.y);
        this.wading = false;
        // strokes: one per STROKE_PERIOD at full speed, scaled by how fast we are actually moving
        const hs = Math.hypot(v.x, v.z);
        if (hs > 0.4) {
          this.strokeTime += dt * (hs / SWIM_SPEED) / STROKE_PERIOD;
          if (this.strokeTime >= 1) { this.strokeTime -= 1; this.onStroke?.(); }
        } else this.strokeTime = Math.min(this.strokeTime, 0.6);
      }
      this.hoverLat = this.hoverFwd = this.hoverAccel = this.hoverBob = 0;
    } else {
      let accel = this.onGround ? 14 : 3;
      let wx = mx * speed, wz = mz * speed; // the velocity the input asks for
      // ── too steep: the controller won't climb ground past MAX_CLIMB_DEG (it's a wall); past SLOPE_SLIDE (the ground
      // the feet stood on last step, from the motor's contact normal) you slide down the fall line with no control.
      // Decks and floors (platforms) are never too steep; the hoverboard and the water never come here.
      this.sliding = false;
      const last = this.motor.result;
      if (this.onGround && !this.onPlatform && !this.wading && last.groundNormalY < SLOPE_SLIDE) {
        wx = last.downhillX * SLIDE_SPEED; wz = last.downhillZ * SLIDE_SPEED; accel = SLIDE_ACCEL; this.sliding = true;
      }
      if (this.shoveT > 0) {
        // knocked back: the shove overrides the input and fades out; the motor below stops it at a wall
        this.shoveT = Math.max(0, this.shoveT - dt);
        const k2 = this.shoveT / SHOVE_TIME;
        this.velocity.x = this.shoveVx * k2; this.velocity.z = this.shoveVz * k2;
      } else if (this.dashT > 0) {
        // dash (dodge / lunge): the burst overrides the input; deep water just ahead (off a pier edge, no deck) ends it on the spot
        this.dashT -= dt;
        const dl = Math.hypot(this.dashVx, this.dashVz) || 1;
        if (this.deepAt(this.position.x + this.dashVx / dl * DASH_PROBE, this.position.z + this.dashVz / dl * DASH_PROBE)) { this.dashT = 0; this.velocity.x = this.velocity.z = 0; }
        else if (this.dashT > 0) { this.velocity.x = this.dashVx; this.velocity.z = this.dashVz; }
        else { this.velocity.x = this.dashVx * 0.25; this.velocity.z = this.dashVz * 0.25; } // the last step: brake, so a lunge stops where it aimed
      } else {
        this.velocity.x += (wx - this.velocity.x) * Math.min(1, accel * dt);
        this.velocity.z += (wz - this.velocity.z) * Math.min(1, accel * dt);
      }

      if (this.onGround) this.jumpsLeft = 1; // one more jump available once you've left the ground
      const jumpV = 7.2 * (1 - 0.35 * wadeT); // wading: the water saps the push-off
      if (jump && this.onGround && !this.crouching && !this.sliding) { this.velocity.y = jumpV; this.onGround = false; this.onJump?.(); }
      else if (jump && !this.onGround && this.jumpsLeft > 0) { this.jumpsLeft--; this.velocity.y = Math.max(this.velocity.y, 0) * 0.3 + DOUBLE_JUMP; this.onJump?.(); } // double jump
      this.velocity.y -= GRAVITY * dt;

      // the move: walls, posts, trunks and the terrain stop it, steps ≤ 0.35 m are climbed, the feet snap down slopes
      want.x = this.velocity.x * dt; want.y = this.velocity.y * dt; want.z = this.velocity.z * dt;
      // standing on something that moves (the boat on the swell): the feet ride the deck's new pose first, and the move
      // gets no downward push (the controller's slide would spread it along the moving contact into a sideways drift)
      const riding = this.onGround && this.motor.carry(this.position);
      if (riding && this.velocity.y <= 0) want.y = 0;
      const r = this.motor.move(this.position, want, false);
      // a dash that runs into a wall ends there, not grinding along it
      if (this.dashT > 0 && r.horizontalFreedom < 0.3) { this.dashT = 0; this.velocity.x *= 0.25; this.velocity.z *= 0.25; }
      // the P2 bridge: decks, floors and stairs are still floor functions — stand on one we are on or just under
      let grounded = r.grounded;
      this.onPlatform = false;
      const plat = platformAt();
      if (plat !== undefined && this.position.y - plat <= 0.05 && this.velocity.y <= 0) { this.position.y = plat; grounded = true; this.onPlatform = true; }

      const g = groundAt();
      const ws = this.waterSurfaceAt(this.position.x, this.position.z);
      const groundDepth = ws === null ? 0 : ws - g;
      const wet = ws !== null && this.position.y < ws;
      if (wet && groundDepth > SWIM_IN) {
        // deep enough to float: hand over to the swim branch (this step's fall speed is mostly eaten by the splash)
        this.setSwimming(true);
        this.entryKeep = this.velocity.y < -6 ? 0.45 : 0.3; // a hard plunge keeps enough speed to dip the head under for a beat
        this.velocity.y *= this.entryKeep; this.onGround = false; this.strokeTime = 0;
        if (this.position.y < g) this.position.y = g;
      } else if (grounded) {
        if (!this.onGround) {
          // landing in water is soft: the splash takes the impact (never the hard-landing damage path past ankle depth)
          const cushion = wet ? Math.min(1, groundDepth / 0.5) : 0;
          const hard = this.velocity.y < -9 && cushion < 0.6;
          this.landImpulse = Math.min(0.35, -this.velocity.y * 0.03) * (1 - 0.7 * cushion);
          this.onLand?.(hard);
        }
        if (this.velocity.y < 0) this.velocity.y = 0;
        this.onGround = true;
      } else this.onGround = false;
      this.waterSurface = ws;
      this.depth = ws === null ? 0 : Math.max(0, ws - this.position.y);
      this.wading = this.onGround && this.depth > 0.02;
      this.hoverLat = this.hoverFwd = this.hoverAccel = this.hoverBob = 0;
    }

    // water entry / exit (the feet crossing the surface): splash on the way in, the impact = how fast we hit it
    const inWater = this.depth > 0.02;
    if (inWater !== this.inWater) {
      this.inWater = inWater;
      if (inWater) this.onEnterWater?.(Math.max(0, -this.velocity.y / (this.swimming ? this.entryKeep : 1)) + Math.hypot(this.velocity.x, this.velocity.z) * 0.3);
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
    this.speedFactor = (this.onGround || swim) && !hover ? hSpeed / 7.2 : 0;
    const targetEye = this.crouching ? EYE - 0.65 : EYE;
    this.eyeOffset += (targetEye - this.eyeOffset) * Math.min(1, dt * 10);
    this.landImpulse *= Math.exp(-dt * 9);
    // dodge / lunge feel: the lean eases out, the FOV kick holds while the dash runs and eases out after
    if (this.dashT <= 0) this.fovKick *= Math.exp(-dt * 8);
    // the dodge feel (E63 T, docs/plans/DODGE-FEEL.md): leans 7° into the side, leads 4 cm, dips 7 cm, +5° FOV, all on the
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
    const pitchT = hover ? -(hSpeed / HOVER_TOP) * HOVER_PITCH : 0;
    this.roll += (rollT - this.roll) * Math.min(1, dt * 5);
    this.pitchLean += (pitchT - this.pitchLean) * Math.min(1, dt * 3);

    this.camera.position.set(feet.x + (bobX + dodgeLead) * cos, feet.y + this.eyeOffset + bobY - this.landImpulse - dodgeDip, feet.z - (bobX + dodgeLead) * sin);
    this.camera.rotation.set(0, 0, 0, 'YXZ');
    this.camera.rotation.y = this.yaw;
    this.camera.rotation.x = this.pitch + this.pitchLean + dodgePitch;
    this.camera.rotation.z = Math.sin(this.bobTime) * bobAmp * 0.25 - this.inStr * 0.012 * (1 - this.hoverBlend) + this.roll + this.dashRoll;

    this.board.update(dt, this);
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

// E155 (src/core/shardState.ts): the running shard's dodge
stateSlot('player.dodgeFx', dodgeFx);
