/**
 * The player's motion step: the one composer of the laws in this folder (walk, fall, jump, shove, impulse, dash, swim,
 * board), called per player by the server's tick (sim/playerSim.ts) and by the client's Player (player/Player.ts), so
 * prediction can replay what the server ran (P1-E4.1, E5-REPLICATION §5.1).
 *
 * It is a pure step over `PlayerMotionState`, a command and a `MotionWorld` of injected queries and moments: no renderer,
 * no DOM, no `app`, no device. What a caller does around it stays with the caller: reading devices, the lock-on's orbit
 * and side-hop, camera, bob and FOV on the client; drivers, traversal asks and the weapon's strike on the server.
 *
 * The two callers ran two composers until E4.1, and they do not agree. Where the difference is inside the step it is one
 * row of `MotionLaw`, read by name at its branch point; each caller keeps its own behaviour through its table
 * (`PAGE_MOTION`, `HOST_MOTION`). Nothing here hides one: E5.3's 2 cm parity is met by converging these rows, one at a
 * time, on the law the server runs.
 *
 * The dispatch at the end of `stepPlayerMotion` is the seam for a riding mode (E5.3): today a ride is a driver its caller
 * runs instead of this step.
 */
import { Vector3 } from 'three';
import type { LocalMovementCommand } from '../input/commands';
import type { CharacterMotor } from '../physics/CharacterMotor';
import { stepBoard, type BoardPorts, type BoardState, type BoardStepOut } from './board';
import { DODGE_DIST, DODGE_TIME, dashBlocked, dodgeHeading, startDash, startDodge, stepDash, stepDodge, type DashState, type DodgeState } from './dash';
import { fallStep, groundedVelocity, hardLanding, landingCushion } from './fall';
import { decayImpulse } from './impulse';
import { jump as jumpLaw, jumpClock, jumpSpeed, type JumpState } from './jump';
import { stepShove, type ShoveState } from './shove';
import { deepWater, entryKeep, NO_SPRINT_DEPTH, stepSwim, swimEntry, swimStroke, wadeFraction, type SwimPorts, type SwimState } from './swim';
import { walkingSpeed, walkVelocity } from './walk';

/** Slopes (on foot, on terrain, never a platform, the water or the board): ground normal y below this (≈ 53°) slides. */
const SLOPE_SLIDE = 0.6;
/** m/s down the fall line while sliding … */
const SLIDE_SPEED = 3.2;
/** … reached at this rate (/s). */
const SLIDE_ACCEL = 5;

/**
 * Where the two callers' motion differs inside the step. Each row names one difference; `PAGE_MOTION` and `HOST_MOTION`
 * are the two laws in force. A row exists only because a caller's recorded behaviour depends on it.
 */
export interface MotionLaw {
  /**
   * One velocity through every mode (the page: `walk`, `boardVelocity` and `swimVelocity` are one vector, so momentum
   * carries from foot to board to water and back), or one per mode (the host: a mode starts from no horizontal speed).
   */
  readonly oneVelocity: boolean;
  /**
   * The on-foot move. `true` (the page): a velocity. It approaches the input, a shove or a dash writes it (so it carries
   * out of them), a steep slope takes it over, and the step's move is (velocity + impulse) · dt, the impulse fading after
   * the step. `false` (the host): a displacement. Its velocity, if any (`MotionFoot.velocity`), runs underneath a shove or
   * a dash, which only override the step's move; there is no slope slide; the impulse adds and fades before the motor;
   * and without a velocity a grounded walker takes no gravity until the motor loses the ground.
   */
  readonly momentum: boolean;
  /** The depth a walk reads: the feet's last resolve (the page: `footing.depth`), or the water at the feet now (the host). */
  readonly depthNow: boolean;
  /** A grounded, still player with no command takes no step at all (the host: a resting body's bytes do not move). */
  readonly restsIdle: boolean;
}
/** The law the client's Player has always run. */
export const PAGE_MOTION: MotionLaw = { oneVelocity: true, momentum: true, depthNow: false, restsIdle: false };
/** The law SimHost has always run. */
export const HOST_MOTION: MotionLaw = { oneVelocity: false, momentum: false, depthNow: true, restsIdle: true };

/** What a step resolved about the ground and water under the feet, for the view and the next step. */
export interface MotionFooting {
  /** the water surface at the feet, null on dry land */
  water: number | null;
  /** m of water over the feet (0 dry, on the board, or above the surface) */
  depth: number;
  /** on foot and grounded with water over the feet */
  wading: boolean;
  /** the ground under the feet is a floor function (a deck), never too steep */
  onPlatform: boolean;
  /** on ground too steep to stand on, sliding with no control */
  sliding: boolean;
}

/** One player's motion state. Server: PlayerSim itself. Client: a view over Player, where the velocities are one vector. */
export interface PlayerMotionState {
  readonly position: Vector3;
  yaw: number;
  /** what an owner scales the walk by (an input lock: 0, a slowing zone) */
  moveScale: number;
  /** transient world velocity (m/s), player/impulse.ts */
  readonly impulse: Vector3;
  /** vertical speed (m/s, negative = falling) and whether the feet last stood on ground */
  readonly fall: { vy: number; grounded: boolean };
  /** on-foot horizontal velocity (m/s) */
  readonly walk: { x: number; z: number };
  readonly shove: ShoveState;
  readonly dash: DashState;
  readonly dodge: DodgeState;
  /** the jump clocks, or null until the first press: a player that never jumps keeps its exact bytes */
  jump: JumpState | null;
  readonly board: BoardState & { readonly on: boolean };
  /** the riding board's world velocity */
  readonly boardVelocity: Vector3;
  readonly swim: SwimState & { on: boolean; stood: boolean };
  /** the swimmer's world velocity */
  readonly swimVelocity: Vector3;
  readonly footing: MotionFooting;
}

/** One fixed step's input. World-space move; `moveX`/`moveZ` are not yet clamped. A SimCommand is one as it stands. */
export interface MotionCommand extends LocalMovementCommand {
  readonly moveX: number; readonly moveZ: number; readonly yaw: number;
  /** presses */
  readonly jump?: boolean; readonly dodge?: boolean;
  /** held while swimming */
  readonly dive?: boolean; readonly surface?: boolean;
}

/** A floor function: a walkable surface's height at (x, z), or undefined off it. */
export type MotionPlatform = (x: number, z: number) => number | undefined;

/** The on-foot control for this step, read live. */
export interface MotionFoot {
  /** m/s the walk asks for at this wade fraction */
  speed: (wadeT: number) => number;
  readonly crouching: boolean;
  /** the walk's velocity under `MotionLaw.momentum` false; absent, the walk is a plain displacement at `speed` */
  readonly velocity: { x: number; z: number } | undefined;
  /** the walk keeps stepping with no command (`MotionLaw.restsIdle`) */
  readonly active: boolean;
  /** the ground grace window (ms) */
  readonly coyoteMs: number;
}

/** What a step reads of the world and tells it, injected by each caller. */
export interface MotionWorld {
  readonly law: MotionLaw;
  /** this player's capsule */
  readonly motor: Pick<CharacterMotor, 'move' | 'carry' | 'result'>;
  /** false: this world has no water and asks nothing of it */
  readonly hasWater: boolean;
  /** the rest water surface at (x, z), or null */
  water: (x: number, z: number) => number | null;
  /** the terrain at (x, z) */
  heightAt: (x: number, z: number) => number;
  /** floor functions, the bridge for decks that are not colliders; a world without them has none */
  readonly platforms: readonly MotionPlatform[];
  /** the first floor collider below (x, fromY, z) within `maxDrop`, this player's capsule excluded */
  floor: (x: number, z: number, fromY: number, maxDrop: number) => number | undefined;
  /** the surface's swell over its rest level at (x, z) */
  bob: (x: number, z: number) => number;
  readonly foot: MotionFoot;
  /** the board's cruise speed, and whether it is a hard limit */
  boardTop: () => number;
  boardCapped: () => boolean;
  /** a jump left the ground or the board */
  jumped: () => void;
  /** this step's press started a dodge */
  dodged: () => void;
  /** the feet touched down from the air at `vy` m/s, on `cushion` of water */
  landed: (hard: boolean, vy: number, cushion: number) => void;
  /** an airborne board touched down at `speed` m/s */
  boardLanded: (speed: number) => void;
  /** swimming started or stopped */
  swimChanged: (on: boolean) => void;
  /** one swim stroke */
  stroked: () => void;
  /** the step's own reusable scratch: start it null */
  scratch: MotionScratch | null;
}

/** What a step did, reused from step to step: read it before the next. */
export interface MotionOut {
  /** the motion mode this step ran; 'rest' took no step (`MotionLaw.restsIdle`) */
  mode: 'board' | 'swim' | 'foot' | 'rest';
  /** a jump left the ground or the board */
  jumped: boolean;
  /** how a swim step ended: still floating, drifted off the water, or stood up */
  left: 'swim' | 'dry' | 'stood' | null;
  /** a displacement walk's velocity before the impulse (combat's motion sample); 0 otherwise */
  walkX: number; walkZ: number;
  /** the board's telemetry */
  readonly board: BoardStepOut;
  /** the fraction of the fall speed the last water entry kept */
  entryKeep: number;
}

/** The step's reusable objects, one per world. */
export interface MotionScratch {
  readonly out: MotionOut;
  readonly want: Vector3;
  readonly dashVelocity: { x: number; z: number };
  readonly heading: { x: number; z: number };
  readonly swimOut: { water: number | null };
  readonly boardPorts: BoardPorts;
  readonly swimPorts: SwimPorts;
  readonly ground: () => number;
  readonly deep: (x: number, z: number) => boolean;
}

/** The highest floor under the feet: the terrain, a floor function they are at or just under, or the first collider
 *  floor within 80 m below the feet + 0.5 m. */
function groundUnderFeet(s: PlayerMotionState, w: MotionWorld): number {
  const p = s.position;
  let g = w.heightAt(p.x, p.z);
  for (const platform of w.platforms) {
    const y = platform(p.x, p.z);
    if (y !== undefined && y > g && p.y >= y - 0.5) g = y;
  }
  const c = w.floor(p.x, p.z, p.y + 0.5, 80);
  return c !== undefined && c > g ? c : g;
}
/** The highest floor function under the feet that they can stand on (at or above it, or ≤ 0.5 m below its top). */
function platformUnderFeet(s: PlayerMotionState, w: MotionWorld): number | undefined {
  const p = s.position;
  let best: number | undefined;
  for (const platform of w.platforms) {
    const y = platform(p.x, p.z);
    if (y !== undefined && p.y >= y - 0.5 && (best === undefined || y > best)) best = y;
  }
  return best;
}
/** m of water over the feet right now (0 dry). */
export function waterDepth(s: PlayerMotionState, w: MotionWorld): number {
  const p = s.position, ws = w.water(p.x, p.z);
  return ws === null ? 0 : Math.max(0, ws - p.y);
}

function motionScratch(s: PlayerMotionState, w: MotionWorld): MotionScratch {
  const ground = (): number => groundUnderFeet(s, w);
  const out: MotionOut = { mode: 'rest', jumped: false, left: null, walkX: 0, walkZ: 0, board: { lat: 0, fwd: 0, accel: 0, water: null }, entryKeep: 0.3 };
  return { out, ground, want: new Vector3(), dashVelocity: { x: 0, z: 0 }, heading: { x: 0, z: 0 }, swimOut: { water: null },
    deep: (x, z) => w.hasWater && deepWater(x, z, s.position.y, w.water(x, z), w.heightAt(x, z), w.platforms, w.floor),
    boardPorts: { move: (feet, want) => { w.motor.move(feet, want, true); }, ground, water: (x, z) => w.water(x, z),
      jumped: () => { out.jumped = true; w.jumped(); }, landed: (speed) => { w.boardLanded(speed); } },
    swimPorts: { move: (feet, want) => w.motor.move(feet, want, true), water: (x, z) => w.water(x, z), ground,
      get platforms() { return w.platforms; }, floor: w.floor, bob: (x, z) => w.bob(x, z), leave: () => { leaveSwim(s, w); } } };
}

/** Stop swimming (the swim law's `leave`, or the board): the dive and the haul-out let go. */
export function leaveSwim(s: PlayerMotionState, w: MotionWorld): void {
  const { swim } = s;
  if (!swim.on) return;
  swim.on = false; swim.climbTo = null; swim.diving = false;
  w.swimChanged(false);
}
/** Start swimming, from the walk: most of the fall speed goes into the splash. The two callers' velocities meet here: on
 *  one vector, the walk's own (`vx`, `vz`) stay and the vertical is the kept part; on two, the swim starts from them. */
function enterSwim(s: PlayerMotionState, w: MotionWorld, run: MotionScratch, vx: number, vz: number): void {
  const { swim, fall } = s, keep = entryKeep(fall.vy), vy = fall.vy * keep;
  swim.on = true; swim.strokeTime = 0; run.out.entryKeep = keep;
  fall.vy = 0; fall.grounded = false;
  s.swimVelocity.set(vx, vy, vz);
  w.swimChanged(true);
}

/** The DODGE press: toward the command's world move, a backstep with none, at DODGE_DIST / DODGE_TIME. The page's
 *  dodge knows the lock-on, a client-only target: it presses for itself and never sends this. */
function pressDodge(s: PlayerMotionState, cmd: MotionCommand, w: MotionWorld, run: MotionScratch): void {
  const { dodge, board, swim } = s, heading = run.heading, v = DODGE_DIST / DODGE_TIME;
  if (dodge.cd > 0 || board.on || swim.on) return;
  dodgeHeading(cmd.moveX, cmd.moveZ, cmd.yaw, heading);
  if (!startDash(s.dash, heading.x * v, heading.z * v, DODGE_TIME)) return;
  startDodge(dodge, 1);
  w.dodged();
}

/** The walk's speed and crouch from a raw version-1 command, the on-foot law a host runs for a client: no effect channels
 *  yet, and the wade applied after (`MotionFoot.speed`). */
export function versionedWalk(s: PlayerMotionState, cmd: MotionCommand | undefined, w: MotionWorld, out: { speed: number; crouching: boolean }): void {
  const forward = cmd === undefined ? 0 : cmd.steer === undefined
    ? -Math.sin(cmd.yaw) * cmd.moveX - Math.cos(cmd.yaw) * cmd.moveZ
    : Math.max(-1, Math.min(1, cmd.steer.keyY + cmd.steer.stickY));
  const crouching = cmd?.crouch === true && !s.board.on && !s.swim.on;
  out.crouching = crouching;
  out.speed = walkingSpeed(crouching, cmd?.sprint === true && forward > 0 && !crouching && (!w.hasWater || waterDepth(s, w) < NO_SPRINT_DEPTH), 0, s.moveScale, 1);
}

function stepOnBoard(s: PlayerMotionState, w: MotionWorld, run: MotionScratch, mx: number, mz: number, len: number, jump: boolean, dt: number): void {
  const { out, boardPorts } = run, { footing } = s;
  stepBoard(s.position, s.boardVelocity, s.impulse, run.want, s.board, { mx, mz, len, yaw: s.yaw, top: w.boardTop(), capped: w.boardCapped(), jump }, boardPorts, dt, out.board);
  decayImpulse(s.impulse, dt);
  footing.onPlatform = false; footing.water = out.board.water; footing.depth = 0; footing.wading = false;
}

function stepInWater(s: PlayerMotionState, cmd: MotionCommand | undefined, w: MotionWorld, run: MotionScratch, mx: number, mz: number, len: number, dt: number): void {
  const { fall, footing, swim, swimVelocity: v } = s, { oneVelocity } = w.law;
  s.impulse.set(0, 0, 0);
  footing.onPlatform = false;
  const left = stepSwim(s.position, v, run.want, swim, { mx, mz, len, dive: cmd?.dive === true, surface: cmd?.surface === true }, run.swimPorts, dt, run.swimOut);
  run.out.left = left;
  footing.wading = false;
  if (left === 'dry') {
    // drifted off the water: back on foot, and gravity takes it from here
    fall.vy = v.y; fall.grounded = false; if (!oneVelocity) v.set(0, 0, 0);
    footing.water = null; footing.depth = 0;
    return;
  }
  const ws = run.swimOut.water;
  footing.water = ws;
  footing.depth = ws === null ? 0 : Math.max(0, ws - s.position.y);
  fall.grounded = left === 'stood';
  if (left === 'stood') { fall.vy = 0; if (!oneVelocity) v.set(0, 0, 0); swim.stood = true; }
  swimStroke(swim, v, dt, w.stroked); // on the step a swimmer stands up too
}

/** `MotionLaw.momentum`: the velocity the input asks for, or a slide, a shove or a dash in its place. */
function momentumWalk(s: PlayerMotionState, w: MotionWorld, run: MotionScratch, mx: number, mz: number, wadeT: number, dt: number): void {
  const { dash, fall, footing, position: p, shove, walk } = s, speed = w.foot.speed(wadeT);
  let accel = fall.grounded ? 14 : 3, wx = mx * speed, wz = mz * speed;
  // too steep: the controller will not climb ground past its limit (it is a wall); past SLOPE_SLIDE (the ground the feet
  // stood on last step) the feet slide down the fall line with no control
  footing.sliding = false;
  const last = w.motor.result;
  if (fall.grounded && !footing.onPlatform && !footing.wading && last.groundNormalY < SLOPE_SLIDE) {
    wx = last.downhillX * SLIDE_SPEED; wz = last.downhillZ * SLIDE_SPEED; accel = SLIDE_ACCEL; footing.sliding = true;
  }
  if (shove.t > 0) {
    const k = stepShove(shove, dt);
    walk.x = shove.vx * k; walk.z = shove.vz * k;
  } else if (dash.t > 0) stepDash(dash, dt, p.x, p.z, run.deep, walk);
  else { walk.x = walkVelocity(walk.x, wx, accel, dt); walk.z = walkVelocity(walk.z, wz, accel, dt); }
}

/** Not `MotionLaw.momentum`: this step's displacement into `run.want`, its impulse added and faded. */
function displacementWalk(s: PlayerMotionState, cmd: MotionCommand | undefined, w: MotionWorld, run: MotionScratch, wadeT: number, shoved: boolean, dt: number): void {
  const { dash, fall, impulse, position: p, shove } = s, { foot } = w, { out, want } = run;
  if (cmd === undefined) want.set(0, 0, 0);
  else want.set(cmd.moveX, 0, cmd.moveZ).clampLength(0, 1).multiplyScalar(foot.speed(wadeT) * dt);
  const velocity = foot.velocity;
  if (velocity !== undefined) {
    const acceleration = fall.grounded ? 14 : 3;
    velocity.x = walkVelocity(velocity.x, want.x / dt, acceleration, dt);
    velocity.z = walkVelocity(velocity.z, want.z / dt, acceleration, dt);
    want.x = velocity.x * dt; want.z = velocity.z * dt;
  }
  if (shove.t > 0) {
    const k = stepShove(shove, dt);
    want.x = shove.vx * k * dt; want.z = shove.vz * k * dt;
  } else if (dash.t > 0) {
    stepDash(dash, dt, p.x, p.z, run.deep, run.dashVelocity);
    want.x = run.dashVelocity.x * dt; want.z = run.dashVelocity.z * dt;
  }
  out.walkX = want.x / dt; out.walkZ = want.z / dt;
  if (shoved) { want.addScaledVector(impulse, dt); decayImpulse(impulse, dt); }
}

function stepOnFoot(s: PlayerMotionState, cmd: MotionCommand | undefined, w: MotionWorld, run: MotionScratch, mx: number, mz: number, dt: number): void {
  const { law, foot } = w, { out, want } = run, { dash, fall, footing, impulse, position: p, shove, walk } = s, { momentum } = law;
  const shoved = impulse.lengthSq() > 0;
  if (law.restsIdle && cmd === undefined && !foot.active && !shoved && !(shove.t > 0) && !(dash.t > 0) && fall.grounded && fall.vy === 0) { out.mode = 'rest'; return; }
  // the wade: water over the grounded feet slows the walk and saps the jump
  const wadeT = wadeFraction(fall.grounded, law.depthNow ? waterDepth(s, w) : footing.depth);
  if (momentum) momentumWalk(s, w, run, mx, mz, wadeT, dt);
  else displacementWalk(s, cmd, w, run, wadeT, shoved, dt);
  // the jump on last step's ground, before the step's gravity
  if (s.jump !== null) jumpClock(s.jump, fall.grounded, dt);
  if (cmd?.jump === true) {
    s.jump ??= { ago: fall.grounded ? 0 : Infinity, left: 1 };
    const vy = jumpLaw(s.jump, fall.grounded, fall.vy, foot.coyoteMs, foot.crouching || footing.sliding, jumpSpeed(wadeT));
    if (vy !== null) { fall.vy = vy; fall.grounded = false; out.jumped = true; w.jumped(); }
  }
  // gravity first, then the whole move through the motor. A displacement walker on the ground adds no downward push: the
  // motor's snap holds the feet, without snagging on a collider seam, and the tick it loses the ground takes that tick's
  // gravity below, so the fall speed runs exactly the velocity law's from there.
  const standing = !momentum && foot.velocity === undefined && fall.grounded && fall.vy === 0 && (want.x !== 0 || want.z !== 0);
  if (!standing) fall.vy = fallStep(fall.vy, dt);
  if (momentum) want.set((walk.x + impulse.x) * dt, (fall.vy + impulse.y) * dt, (walk.z + impulse.z) * dt);
  else want.y += fall.vy * dt;
  // standing on something that moves: the feet ride the deck's new pose first, and the move gets no downward push (the
  // controller's slide would spread it along the moving contact into a sideways drift)
  if (fall.grounded && w.motor.carry(p) && want.y <= 0) want.y = 0;
  const moved = w.motor.move(p, want);
  // a dash that runs into a wall ends there, not grinding along it
  dashBlocked(dash, moved.horizontalFreedom, momentum ? walk : run.dashVelocity);
  // the floor-function bridge: a deck that is not a collider, stood on from on it or just under
  let grounded = moved.grounded;
  footing.onPlatform = false;
  const platform = platformUnderFeet(s, w);
  if (platform !== undefined && p.y - platform <= 0.05 && fall.vy <= 0) { p.y = platform; grounded = true; footing.onPlatform = true; }
  // The motor already resolved dry grounding: this extra ground query decides only water depth, entry and the cushion.
  const ws = w.hasWater ? w.water(p.x, p.z) : null, g = ws === null ? 0 : run.ground();
  if (swimEntry(p.y, ws, g)) {
    enterSwim(s, w, run, momentum ? walk.x : out.walkX, momentum ? walk.z : out.walkZ);
    if (p.y < g) p.y = g;
  } else {
    if (grounded) {
      if (!fall.grounded) {
        // a landing in water is soft: the splash takes the impact
        const cushion = ws === null ? 0 : landingCushion(p.y < ws, ws - g);
        w.landed(hardLanding(fall.vy, cushion), fall.vy, cushion);
      }
      fall.vy = groundedVelocity(fall.vy);
    } else if (standing) fall.vy = fallStep(fall.vy, dt);
    fall.grounded = grounded;
  }
  footing.water = ws;
  footing.depth = ws === null ? 0 : Math.max(0, ws - p.y);
  footing.wading = fall.grounded && footing.depth > 0.02;
  if (momentum) decayImpulse(impulse, dt);
}

/** One fixed step of one player's own motion (`cmd` undefined: no input this tick). Reuses and returns the world's
 *  `MotionOut`. The world has stepped first; a driven mode that owns the step keeps its caller from calling this. */
export function stepPlayerMotion(s: PlayerMotionState, cmd: MotionCommand | undefined, w: MotionWorld, dt: number): MotionOut {
  const run = w.scratch ??= motionScratch(s, w), { out } = run, { board, dash, swim, walk } = s;
  out.jumped = false; out.left = null; out.walkX = 0; out.walkZ = 0;
  if (cmd !== undefined) s.yaw = cmd.yaw;
  if (cmd?.dodge === true) pressDodge(s, cmd, w, run);
  stepDodge(s.dodge, dash.t > 0, dt);
  if (!swim.on) swim.stood = false; // last tick's stand-up is over
  let mx = cmd?.moveX ?? 0, mz = cmd?.moveZ ?? 0;
  const len = Math.hypot(mx, mz);
  if (len > 1) { mx /= len; mz /= len; }
  if (board.on || swim.on) { // the board and the water end a dash
    dash.t = 0;
    if (!w.law.oneVelocity) { walk.x = 0; walk.z = 0; }
  }
  if (board.on) { out.mode = 'board'; stepOnBoard(s, w, run, mx, mz, len, cmd?.jump === true, dt); }
  else if (swim.on) { out.mode = 'swim'; stepInWater(s, cmd, w, run, mx, mz, len, dt); }
  else { out.mode = 'foot'; stepOnFoot(s, cmd, w, run, mx, mz, dt); }
  return out;
}
