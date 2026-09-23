import * as THREE from 'three';
import { heightAt, normalAt, pondMask, waterLevel } from '../world/Heightfield';
import { getActiveChunk } from '../chunks/registry';
import { CHUNK_HALF } from '../core/config';
import type { Forest } from '../world/Forest';
import { Hoverboard } from './Hoverboard';
import { WaterLine } from './WaterLine';
import { setUnderwater, updateUnderwater } from '../world/Atmosphere';
import { getNumber } from '../ui/Settings';

export interface Collider { x: number; z: number; hw: number; hd: number; rot: number; yTop: number; yBottom: number }

const EYE = 1.68;
const RADIUS = 0.38;
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
const DOUBLE_JUMP = 6.8;              // m/s second jump on foot
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
// ── slopes (on foot, on terrain — not platforms, not water, never the hoverboard) ──
const SLOPE_WALK = 0.72;              // ground normal y below this (≈ 44°) is too steep to walk UP: the uphill part of the move is cancelled
const SLOPE_SLIDE = 0.6;              // below this (≈ 53°) you slide down it with no control
const SLOPE_PROBE = 0.6;              // m ahead of the feet, along the move, where the slope is also sampled (so a wall stops you before you're on it)
const SLIDE_SPEED = 3.2;              // m/s down the fall line while sliding …
const SLIDE_ACCEL = 5;                // … reached at this rate (/s)
// ── dash (on foot): the DODGE (Left Alt / the DODGE disc) and the sword's lunge (Sword.ts) — a short fixed-velocity burst ──
const DODGE_DIST = 3;                 // m …
const DODGE_TIME = 0.25;              // … over this long (12 m/s), toward the move input; no input = a backstep
const DODGE_COOLDOWN = 0.6;           // s from one dodge's start to the next
const DASH_PROBE = 0.5;               // m ahead of the feet: deep water there (no deck under it) ends a dash — it never carries you off a pier
const DODGE_DIP = 0.07;               // m the eye drops at a dodge's start (the land-impulse spring brings it back)
const DODGE_ROLL = 0.06;              // rad of camera lean into a fully sideways dodge
const DODGE_FOV_KICK = 5;             // ° wider while a dodge runs …
const LUNGE_FOV_KICK = 7;             // … and a lunge (Sword.ts reads `fovKick`)

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
  onLand?: (hard: boolean) => void;
  onStep?: (sprinting: boolean) => void;
  /** runs first thing in update(), before input is read and the camera is posed — the touch aim assist nudges yaw/pitch here */
  preUpdate?: (dt: number) => void;
  private lastBobPhase = 0;
  // ── dash: dodge + lunge (see `dodge()` / `dash()`) ──
  /** the DODGE disc was tapped (TouchControls) — consumed next update, like `touchJump` */
  touchDodge = false;
  /** a sword swing is running (Sword.ts sets it every frame): the look speed takes the 'swingLook' factor */
  swinging = false;
  /** look-speed multiplier for mouse AND touch (Settings 'look', × 'swingLook' while swinging) — TouchControls reads it too */
  get lookMult(): number { return getNumber('look') * (this.swinging ? getNumber('swingLook') : 1); }
  /** a dodge started / a lunge dash started (audio, haptics — main.ts) */
  onDodge?: () => void;
  onLunge?: () => void;
  /** degrees to widen the view by: kicked by a dodge / lunge, held while the dash runs, eased out after — Sword.ts adds it to its FOV */
  fovKick = 0;
  private dashT = 0; private dashVx = 0; private dashVz = 0; private dodgeCd = 0;
  private dashRoll = 0; // camera lean into a sideways dodge (rad), eased out
  /** true while a dodge / lunge burst is carrying the player */
  get dashing(): boolean { return this.dashT > 0; }

  constructor(public camera: THREE.PerspectiveCamera, private forest: Forest, private canvas: HTMLCanvasElement) {
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

  /** water surface height at (x, z): the shard's ocean if it has one, else the pond where the basin mask is set, else null */
  waterSurfaceAt(x: number, z: number): number | null {
    const ocean = getActiveChunk().ocean;
    if (ocean) return ocean.level;
    return pondMask(x, z) > 0 ? waterLevel() : null;
  }

  private setSwimming(on: boolean): void {
    if (on === this.swimming) return;
    this.swimming = on;
    if (!on) { this.climbTo = null; this.diveHeld = false; this.touchDive = false; this.surfaceHeld = false; this.touchSurface = false; this.diving = false; }
    this.onSwimChange?.(on);
  }

  spawn(x: number, z: number, yaw: number): void {
    this.position.set(x, heightAt(x, z), z);
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
  /** DODGE (Left Alt / the DODGE disc): DODGE_DIST m in DODGE_TIME s toward the move input, a backstep with none; DODGE_COOLDOWN s between */
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
    if (!this.dash(mx * v, mz * v, DODGE_TIME)) return false;
    this.dodgeCd = DODGE_COOLDOWN;
    // feel: a dip (the knees load), a lean into a sideways dodge, a small FOV kick
    this.landImpulse = Math.max(this.landImpulse, DODGE_DIP);
    this.dashRoll = -(mx * cos - mz * sin) * DODGE_ROLL; // + = the dodge goes right → roll right
    this.fovKick = Math.max(this.fovKick, DODGE_FOV_KICK);
    this.onDodge?.();
    return true;
  }
  /** deep water at (x, z) with no deck over it — where a dash must not carry you */
  private deepAt(x: number, z: number): boolean {
    const ws = this.waterSurfaceAt(x, z);
    if (ws === null || ws - heightAt(x, z) <= WADE_MAX) return false;
    for (const p of this.platforms) { const y = p(x, z); if (y !== undefined && y > ws - 0.5) return false; }
    return true;
  }

  update(dtRaw: number): void {
    const dt = Math.min(dtRaw, 0.05);
    this.preUpdate?.(dt);
    const k = this.keys;
    const fwd = Math.max(-1, Math.min(1, (k.has('KeyW') ? 1 : 0) - (k.has('KeyS') ? 1 : 0) + this.touchMove.y));
    const str = Math.max(-1, Math.min(1, (k.has('KeyD') ? 1 : 0) - (k.has('KeyA') ? 1 : 0) + this.touchMove.x));
    const hover = this.hover;
    const swim = this.swimming && !hover;
    // wading: how deep the feet are right now (last frame's resolve) — slows walking, kills sprint past the knee
    const wadeT = !hover && !swim && this.onGround ? Math.min(1, this.depth / WADE_MAX) : 0;
    this.crouching = !hover && !swim && (k.has('ControlLeft') || k.has('KeyC'));
    this.sprinting = !hover && !swim && this.depth < NO_SPRINT_DEPTH && (k.has('ShiftLeft') || this.touchSprint) && fwd > 0 && !this.crouching;
    const speed = (this.crouching ? 2.2 : this.sprinting ? 7.2 : 4.3) * (1 - 0.55 * wadeT);
    this.waveTime += dt;

    const sin = Math.sin(this.yaw), cos = Math.cos(this.yaw);
    let mx = (-sin * fwd + cos * str), mz = (-cos * fwd - sin * str);
    const len = Math.hypot(mx, mz);
    if (len > 1) { mx /= len; mz /= len; }
    // jump is an EDGE (press), not a held state — so holding Space can't chain a double jump
    const jumpDown = k.has('Space') || this.touchJump; this.touchJump = false;
    const jump = jumpDown && !this.jumpWasDown && !swim; this.jumpWasDown = jumpDown;
    // while swimming Space / the DIVE disc and Shift / the SURFACE disc are HELD controls (the swim branch reads them)
    this.diveHeld = swim && (k.has('Space') || this.touchDive);
    this.surfaceHeld = swim && (k.has('ShiftLeft') || k.has('ShiftRight') || this.touchSurface);
    this.dodgeCd = Math.max(0, this.dodgeCd - dt);
    if (this.touchDodge) { this.touchDodge = false; this.dodge(); }
    if (hover || swim) this.dashT = 0;

    // ground: terrain, or a platform if we are at/above it (step up ≤ 0.5 m)
    const groundAt = () => {
      let g = heightAt(this.position.x, this.position.z);
      this.onPlatform = false;
      for (const p of this.platforms) {
        const y = p(this.position.x, this.position.z);
        if (y !== undefined && y > g && this.position.y >= y - 0.5) { g = y; this.onPlatform = true; }
      }
      return g;
    };

    if (hover) {
      // ── hoverboard: momentum steering — velocity is pulled toward the input direction at a fixed rate, glides with no input ──
      const v = this.velocity;
      const inAir = this.hoverBob > 0.35;                            // above the ride height (hop / ledge): half the grip
      const grip = inAir ? 0.5 : 1;
      const want = len > 0.02;
      const tx = want ? mx * HOVER_TOP : 0, tz = want ? mz * HOVER_TOP : 0;
      const dx = tx - v.x, dz = tz - v.z, dl = Math.hypot(dx, dz);
      const rate = (want ? HOVER_ACCEL : HOVER_DECEL) * grip;
      const step = Math.min(dl, rate * dt);
      const vfx = v.x, vfz = v.z;
      if (dl > 1e-6) { v.x += dx / dl * step; v.z += dz / dl * step; }
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

      // ride height: a stiff, slightly under-damped spring to ground + HOVER_HEIGHT (no gravity — the repulsors hold you)
      this.position.x += v.x * dt;
      this.position.z += v.z * dt;
      this.collide();
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
      this.waterSurface = ws; this.depth = 0; this.wading = false;
    } else if (swim) {
      // ── swimming: sluggish horizontal drift, buoyancy (not gravity) eases the feet to the float height; no jump / sprint / crouch ──
      const v = this.velocity;
      const swimSpeed = SWIM_SPEED * (this.diving ? DIVE_SWIM : 1); // a touch slower under the surface
      v.x += (mx * swimSpeed - v.x) * Math.min(1, SWIM_ACCEL * dt);
      v.z += (mz * swimSpeed - v.z) * Math.min(1, SWIM_ACCEL * dt);
      const x0 = this.position.x, z0 = this.position.z;
      this.position.x += v.x * dt;
      this.position.z += v.z * dt;
      this.collide(); // pilings, walls: still solid in the water
      const p = this.position;
      // pinned against a piling / bollard while hauling out: let go of the climb (and don't grab again for a beat) so we
      // sink back to the float height instead of hanging in the air beside the deck
      const blocked = Math.hypot(p.x - x0, p.z - z0) < Math.hypot(v.x, v.z) * dt * 0.25;
      if (this.climbTo !== null && blocked) { this.climbTo = null; this.climbCooldown = 0.6; }
      this.climbCooldown = Math.max(0, this.climbCooldown - dt);
      const ws = this.waterSurfaceAt(p.x, p.z);
      const g = groundAt();
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
          const bob = Math.sin(this.waveTime * 1.4) * 0.05 + Math.sin(this.waveTime * 2.3 + 1.0) * 0.02;
          const floatY = ws - FLOAT_DEPTH + bob;
          if (climbing) this.diving = false;
          if (!climbing && (this.diving || this.diveHeld)) {
            // ── diving: the vertical speed is driven, not sprung — DIVE eases you down, SURFACE eases you up, neither holds
            // the depth (neutral buoyancy: no bobbing back up). The seabed / a collider still stops you.
            const want = this.diveHeld && !this.surfaceHeld ? -DIVE_SPEED : this.surfaceHeld ? SURFACE_SPEED : 0;
            v.y += (want - v.y) * Math.min(1, DIVE_EASE * dt);
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
      // ── too steep: cliffs, crags and rock walls are not stairs. On terrain (not a deck / floor platform, not in the water)
      // the ground normal under the feet and a step ahead along the move is checked: past SLOPE_WALK the uphill part of the
      // move is cancelled (you slide along the contour), past SLOPE_SLIDE you slide down it with no control. The hoverboard
      // never comes here (its repulsors glide up anything); downhill and flat are untouched.
      this.sliding = false;
      if (this.onGround && !this.onPlatform && !this.wading) {
        const p = this.position;
        let [nx, ny, nz] = normalAt(p.x, p.z, 0.6);
        if (len > 0.05) {
          const [ax, ay, az] = normalAt(p.x + mx / len * SLOPE_PROBE, p.z + mz / len * SLOPE_PROBE, 0.6);
          if (ay < ny) { nx = ax; ny = ay; nz = az; }
        }
        if (ny < SLOPE_WALK) {
          const dl = Math.hypot(nx, nz) || 1, dx = nx / dl, dz = nz / dl; // the downhill direction (the normal leans down the slope)
          const up = -(wx * dx + wz * dz);
          if (up > 0) { wx += dx * up; wz += dz * up; }
          if (ny < SLOPE_SLIDE) { wx = dx * SLIDE_SPEED; wz = dz * SLIDE_SPEED; accel = SLIDE_ACCEL; this.sliding = true; }
          else accel = Math.min(accel, 8); // feet scrabbling on the steep face: less grip
        }
      }
      if (this.dashT > 0) {
        // dash (dodge / lunge): the burst overrides the input; deep water just ahead (off a pier edge, no deck) ends it on the spot
        this.dashT -= dt;
        const dl = Math.hypot(this.dashVx, this.dashVz) || 1;
        if (this.deepAt(this.position.x + this.dashVx / dl * DASH_PROBE, this.position.z + this.dashVz / dl * DASH_PROBE)) { this.dashT = 0; this.velocity.x = this.velocity.z = 0; }
        else if (this.dashT > 0) { this.velocity.x = this.dashVx; this.velocity.z = this.dashVz; }
        else { this.velocity.x = this.dashVx * 0.25; this.velocity.z = this.dashVz * 0.25; } // the last frame: brake, so a lunge stops where it aimed
      } else {
        this.velocity.x += (wx - this.velocity.x) * Math.min(1, accel * dt);
        this.velocity.z += (wz - this.velocity.z) * Math.min(1, accel * dt);
      }

      if (this.onGround) this.jumpsLeft = 1; // one more jump available once you've left the ground
      const jumpV = 7.2 * (1 - 0.35 * wadeT); // wading: the water saps the push-off
      if (jump && this.onGround && !this.crouching && !this.sliding) { this.velocity.y = jumpV; this.onGround = false; this.onJump?.(); }
      else if (jump && !this.onGround && this.jumpsLeft > 0) { this.jumpsLeft--; this.velocity.y = Math.max(this.velocity.y, 0) * 0.3 + DOUBLE_JUMP; this.onJump?.(); } // double jump
      this.velocity.y -= GRAVITY * dt;

      this.position.x += this.velocity.x * dt;
      this.position.z += this.velocity.z * dt;
      this.position.y += this.velocity.y * dt;

      this.collide();

      const g = groundAt();
      const ws = this.waterSurfaceAt(this.position.x, this.position.z);
      const groundDepth = ws === null ? 0 : ws - g;
      const wet = ws !== null && this.position.y < ws;
      if (wet && groundDepth > SWIM_IN) {
        // deep enough to float: hand over to the swim branch (this frame's fall speed is mostly eaten by the splash)
        this.setSwimming(true);
        this.entryKeep = this.velocity.y < -6 ? 0.45 : 0.3; // a hard plunge keeps enough speed to dip the head under for a beat
        this.velocity.y *= this.entryKeep; this.onGround = false; this.strokeTime = 0;
        if (this.position.y < g) this.position.y = g;
      } else if (this.position.y <= g) {
        if (!this.onGround) {
          // landing in water is soft: the splash takes the impact (never the hard-landing damage path past ankle depth)
          const cushion = wet ? Math.min(1, groundDepth / 0.5) : 0;
          const hard = this.velocity.y < -9 && cushion < 0.6;
          this.landImpulse = Math.min(0.35, -this.velocity.y * 0.03) * (1 - 0.7 * cushion);
          this.onLand?.(hard);
        }
        this.position.y = g; this.velocity.y = 0; this.onGround = true;
      } else if (this.position.y - g > 0.05) this.onGround = false;
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

    // chunk boundary: invisible wall (the chunk floats — nothing to walk onto)
    const lim = CHUNK_HALF - 1.2;
    this.position.x = Math.max(-lim, Math.min(lim, this.position.x));
    this.position.z = Math.max(-lim, Math.min(lim, this.position.z));

    // camera
    const hSpeed = Math.hypot(this.velocity.x, this.velocity.z);
    this.speedFactor = (this.onGround || swim) && !hover ? hSpeed / 7.2 : 0;
    const targetEye = this.crouching ? EYE - 0.65 : EYE;
    this.eyeOffset += (targetEye - this.eyeOffset) * Math.min(1, dt * 10);
    this.landImpulse *= Math.exp(-dt * 9);
    // dodge / lunge feel: the lean eases out, the FOV kick holds while the dash runs and eases out after
    this.dashRoll *= Math.exp(-dt * 7);
    if (this.dashT <= 0) this.fovKick *= Math.exp(-dt * 8);
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

    this.camera.position.set(this.position.x + bobX * cos, this.position.y + this.eyeOffset + bobY - this.landImpulse, this.position.z - bobX * sin);
    this.camera.rotation.set(0, 0, 0, 'YXZ');
    this.camera.rotation.y = this.yaw;
    this.camera.rotation.x = this.pitch + this.pitchLean;
    this.camera.rotation.z = Math.sin(this.bobTime) * bobAmp * 0.25 - str * 0.012 * (1 - this.hoverBlend) + this.roll + this.dashRoll;

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

  private collide() {
    // trees (cylinders)
    const p = this.position;
    for (const t of this.forest.nearby(p.x, p.z, RADIUS)) {
      const dx = p.x - t.x, dz = p.z - t.z;
      const d = Math.hypot(dx, dz), min = t.r + RADIUS;
      if (d < min && d > 1e-4) { p.x = t.x + (dx / d) * min; p.z = t.z + (dz / d) * min; }
    }
    // oriented boxes (cabin walls etc.)
    for (const c of this.colliders) {
      if (p.y + 0.2 > c.yTop || p.y + 1.6 < c.yBottom) continue;
      const cos = Math.cos(-c.rot), sin = Math.sin(-c.rot);
      const lx = (p.x - c.x) * cos - (p.z - c.z) * sin;
      const lz = (p.x - c.x) * sin + (p.z - c.z) * cos;
      const ox = c.hw + RADIUS - Math.abs(lx), oz = c.hd + RADIUS - Math.abs(lz);
      if (ox > 0 && oz > 0) {
        let nx = lx, nz = lz;
        if (ox < oz) { nx = Math.sign(lx || 1) * (c.hw + RADIUS); } else { nz = Math.sign(lz || 1) * (c.hd + RADIUS); }
        const c2 = Math.cos(c.rot), s2 = Math.sin(c.rot);
        p.x = c.x + nx * c2 - nz * s2;
        p.z = c.z + nx * s2 + nz * c2;
      }
    }
  }
}
