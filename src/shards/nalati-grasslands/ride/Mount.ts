import * as THREE from 'three';
import { app } from '@wildshard/engine/app/runtime';
import type { EquipmentService } from '@wildshard/engine/combat/EquipmentService';
import { Animal } from '@wildshard/engine/entities/AnimalView';
import type { InputService } from '@wildshard/engine/input/InputService';
import type { RideCommandSample } from '@wildshard/engine/input/commands';
import { CharacterMotor } from '@wildshard/engine/physics/CharacterMotor';
import { lockOn } from '@wildshard/engine/player/AimTargets';
import type { Player } from '@wildshard/engine/player/Player';
import type { Forest } from '@wildshard/engine/world/forest/Forest';
import { inChunk, waterLevel } from '@wildshard/engine/world/Heightfield';
import type { Interactable } from '@wildshard/engine/world/interact/types';
import { terrainHeight as heightAt } from '@wildshard/engine/world/terrainHeight';
import { HorseHerd } from '../runtime/groupRegistry';
import { HORSE_SPEED } from '../species/horse';
import { wildEnv } from '../creatures/env';
import { Bow } from '@wildshard/game/weapons/Bow';
import { Sabre, type MountState } from '../runtime/weapons/Sabre';
import { Spear } from '../runtime/weapons/Spear';
import type { RoadXZ } from './rideAssist';
import type { ReinsFrame } from '../runtime/rideReins';
import { MountedBody, mountedMotorOptions, type MountedWorld } from '../runtime/rideBody';
import type { NalatiRecord } from '../runtime/persistence';
import { horseKey, savedHorseName, saveHorseName } from './horseNames';

/**
 * Mount — riding a horse (Nalati row B7; docs/design/nalati/wolves-horses-taming.md "Riding", controls.md "The mounted
 * layout", combat.md "from the saddle"). The horse is an ordinary AnimalManager `Animal` (species/horse.ts); while you
 * ride it the herd AI lets go (`mem.ridden`, HorseHerd.setRidden) and this drives its `setMotion` from your input.
 *
 *   const mount = new Mount({ player, forest, kit, isDrawing: () => weapons.adsHeld });
 *   mount.addMountable(horse, 'Tulpar')        // a camp horse / Tulpar: a MOUNT prompt (`mount.interactables` → main's list)
 *   mount.mount(horse) / mount.dismount()
 *   game.onUpdate((dt) => mount.update(dt))    // companions (whistle, the bolt to the rail, resting), the prompt labels
 *   player.ride = mount (set by mount()) → Player hands it the frame: `drive(dt)` (input), `step(dt)` (each fixed step),
 *                                          `pose(dt, alpha)` (update: the rider and the camera from the interpolated saddle)
 *
 * Controls (N17 — docs/design/nalati/riding-research.md): the reins work in the HORSE's frame, never the camera's; there is
 * no strafing. The stick's 8 ways: ahead = go (walk < 45 % · trot 45–85 % · canter > 85 % pushed), ahead-left / right = go
 * and turn, beside = a collected turn (at most a trot; from a stand a pivot on the spot), behind = rein in, then back up.
 * Keyboard the same: W = trot, held 0.9 s canter · S = rein in / back · A / D = turn. The turn rate falls with speed
 * (86°/s standing → 37°/s at a gallop, a ~21 m radius) and eases in, the neck leading it (horse.ts `turnLead`); speed has
 * inertia (let go and the horse coasts down; S / back reins it in hard). GALLOP (Shift / the GALLOP disc, hold) = 13 m/s
 * and drains STEED (−12 /s; +15 /s at a walk / trot, +5 at a canter; exhausted → no gallop until 25). The view rides the
 * horse (it turns with the heading); mouse / LOOK is a free look ±140° off it (B1) that eases back behind the ears after
 * 0.7–1.6 s untouched (sooner at speed), held while DRAW is latched (`isDrawing`, the Parthian shot — the rein turns at
 * 60 % then) or a lock-on steers the view. Space = jump; the horse also jumps a fence / log / brook by itself at a canter
 * or faster. E / USE / the DISMOUNT tab = off (to the left side).
 * Auto LEAN LOW at a full gallop when not drawing (lower, forward; drawing sits you up).
 *
 * NALATI-FINISH B1 (N13; riding-research.md "Not built"), locked in by the user (E331: no Debug rows, no off-branches):
 *   keep to the road   let go of the stick on a road (`roads`) and the horse keeps its gait along it (GALLOP held with no
 *                      stick gallops it down the road); turned > 60° off the road's line, or at its end, it coasts as before
 *   rhythm spur        GALLOP tapped in time with the stride (its disc pulses on the beat) holds the gallop without a hold,
 *                      +4 % a tap in a row (≤ +12 %), at −2 STEED/s instead of −12 (rideAssist.ts RhythmSpur)
 *   skid stop          the reins pulled back (stick down / S) at a canter or faster: the horse sits back and skids to a stand
 *                      at 16 m/s² (a gallop in ~0.8 s, not ~1.6), and pivots quick with the stick aside
 *   panic              `panic(x, z, secs)`: a wolf's bite on the rider, lightning close by (ride.ts) — the horse rears if it
 *                      stood, then bolts away from the scare for `secs`, deaf to the reins; `onPanic`
 *   look behind        the free look stops at ±140° off the heading (the research's 120–150°), ±170° on the row
 *
 * The camera sits at the rider's eye (2.55 m × the horse's scale) over the saddle, with a gait bob (walk nod, trot
 * bounce, canter rock, gallop drive) and a lean into turns; the horse's own head, ears and mane are in the lower frame.
 * Weapons from the saddle (`EquipmentService.available`): `setMount({ speed, yaw })` every frame — the sabre's pass slash, the couched lance, the
 * bow's mounted draw / gait spread / carrier velocity / no arc (Bow.setMount) — and the spread halved on the gallop's float.
 *
 * The horse's body (NALATI-MERGE R2, the user's pick D1 (a)): while ridden the horse is a capsule lying along it, on its own
 * `CharacterMotor`, moved in main's 60 Hz fixed step (`step`, from Player.step) and drawn from the interpolated saddle
 * (`pose`, from Player.update with `game.alpha`). The rider's capsule is off. Walls, fences, yurts and trunks stop it
 * (it slides along a glancing one), the bridge deck carries it, and its climb limit is its own: 35° at a gallop up to 47°
 * at a walk (the user's on-foot rule, 0.35 m / 40°, is the player's). The jump is real vertical motion: Space, or by itself
 * at a canter+ when a castRay finds a rail / log at knee height a jump's reach ahead with the air clear above it.
 * Stampedes (R3, D8 (c)): a stampeding horse runs through a player on foot (Herd.ts, `passThrough`), but collides with a
 * rider — each touch jostles the horse sideways; at a gallop a hard one (closing ≥ 9 m/s: against or across the herd)
 * throws you (10 damage). Riding with the herd only jostles.
 *
 * The horse can't die (plan decision): at 20 % hp it bolts — you are thrown (10 damage) — gallops to the hitching rail
 * (`restAt`) and rests for 3 min, then is whole again. `onThrown`, `onMountChange`, `onBolt` for the HUD / audio.
 */

export interface MountOpts {
  /** Per-placement names; the runtime binds their platform state before mounting exists. */
  names?: NalatiRecord<Record<string, string>>;
  player: Player;
  forest: Forest;
  /** DRAW latched / the bow drawing: the horse holds its heading */
  isDrawing?: () => boolean;
  /** the player takes damage (thrown: 10) */
  hurt?: (damage: number) => void;
  /** where a bolting horse runs to and rests (the hitching rail) */
  restAt?: { x: number; z: number };
  /** B1: the shard's roads / tracks (centre lines) — let go of the stick on one and the horse keeps to it */
  roads?: readonly (readonly RoadXZ[])[];
}

interface Mountable { a: Animal; name: string; it: Interactable; restT: number; bolting: boolean; comeT: number; /** its key in the saved names (horseNames.ts) */ key: string }

const EYE = 2.3;                      // rider eye over the ground at horse scale 1 (withers 1.45 + a seated rider)
const LOOK_LIMIT = THREE.MathUtils.degToRad(140), BREAK_LOOK = THREE.MathUtils.degToRad(35);
const MOUNT_T = 0.55;                 // s: the swing up / down
const BOLT_AT = 0.2, REST_TIME = 180, WHISTLE_RANGE = 150;
// R2: the horse's body — a capsule lying along it (nose to rump, girth), its step, its climb limit by speed, the jump
// R3: the herd against a rider
// N17 (docs/design/nalati/riding-research.md "The Wildshard design"): the reins steer in the horse's frame, the view rides it
/** rad/s turn at full rein per gait (between them it blends by speed) — at a gallop 0.62 rad/s = a ~21 m radius */
/** the free look's return: after `delay` s without a look (slow → gallop), toward the ears at `rate` + `perMs` × speed per s */
const RECENTRE = { delaySlow: 1.2, delayFast: 0.8, rate: 1.1, perMs: 0.14, pitch: 0 };
/** the rider's eye (m / rad): bob per gait, the walk's side sway, the canter's pitch rock — kept small for comfort */
const BOB = { walk: 0.016, trot: 0.032, canter: 0.045, gallop: 0.038, sway: 0.014, rock: 0.022 };
const ROLL_PER_RATE = 0.05;          // rad of roll per rad/s of turn (scaled by speed up to 8 m/s)
const TILT_FOLLOW = 0.3;             // the share of the horse's slope pitch / roll the rider's view takes (a rider balances upright)
const SEAT_TILT = 0.13;
// B1: the skid stop, the rhythm spur's STEED, the panic
const PANIC_REAR = 0.5;   // s the horse rears first (from a walk or a stand), m/s it bolts at, its whirl (rein ×), the rear knob (higher lifts its neck into the rider's eye)
const _e = new THREE.Euler(0, 0, 0, 'YXZ'), _seat = new THREE.Vector3(), _tilt = new THREE.Euler(0, 0, 0, 'YXZ');
const angDiff = (a: number, b: number): number => Math.atan2(Math.sin(a - b), Math.cos(a - b));

export class Mount extends MountedBody {
  /** the horse under you (null on foot) */
  horse: Animal | null = null;
  input: InputService | null = null;
  equipment: (() => EquipmentService | null) | null = null;
  get mounted(): boolean { return this.horse !== null; }
  /** STEED stamina 0..100 */

  /** gallop exhausted: no gallop until STEED_RESUME */

  /** 'walk' | 'trot' | 'canter' | 'gallop' | 'stand' — for the HUD / audio */

  /** leaning low over the neck (full gallop, not drawing) */
  leanLow = 0;
  /** the GALLOP disc (touch, RideHUD) */
  touchGallop = false;
  /** the bucking mini-game (Taming.ts) owns the horse: no rider control, it sets `breakRoll` / `breakShake` */

  breakRoll = 0; breakShake = 0;
  /** MOUNT prompts for main's interactable list (one per mountable; label follows the state) */
  readonly interactables: Interactable[] = [];
  readonly mountables: Mountable[] = [];
  onMountChange?: ((horse: Animal | null) => void) | undefined;
  onThrown?: (() => void) | undefined;
  onBolt?: ((horse: Animal, name: string) => void) | undefined;

  onPanic?: ((horse: Animal, secs: number) => void) | undefined;
  /** B1: the rhythm spur (its streak / good taps), the beat now (the GALLOP disc pulses), a counter bumped per good tap */



  /** B1: keeping to a road with the stick let go (for the HUD / tests); skidding (s left); panicking (s left) */




  /** R3: jostles taken this ride (the stampede against the rider) and what threw you last ('stampede'), for the HUD / tests */



  private readonly player: Player;
  private swingT = 0; private swingDir = 0;
  private readonly swingFrom = new THREE.Vector3();




  private camYaw = 0; private camPitch = 0;   // the view as pose() left it (a change since = the player looked)
  private lookIdle = 0;          // s since the player last looked (the free-look clock)
  private sway = 0;
  private bobPh = 0; private rock = 0; private roll = 0;



  // ── the reins as drive() read them (input phase), for the fixed steps ──


  // ── the body (R2): the feet on the horse's motor, stepped at 60 Hz; the last step's pose for the interpolation ──



  private poseHeading = 0;



  // ── R3: the herd's shove (m/s, fading) and the view's jolt ──

  // ── B1: the gait kept on a road, the GALLOP press edge + the stride's clock, the reins' last sector, the panic's way ──


  private skidDip = 0;


  private readonly bodyWorld: MountedWorld = {
    get physics() { return app.physics; }, heightAt, waterLevel,
    wetAt: (x, z) => wildEnv.wetAt?.(x, z) === true,
    stampede: (owner, horse) => {
      if (!(owner instanceof Animal) || owner === horse) return null;
      const herd = HorseHerd.of(owner);
      return herd !== null && (herd.stampeding || (owner === herd.stallion && herd.stallionState === 'charge')) ? owner : null;
    },
    thrown: () => { this.dismount(true); this.opts.hurt?.(10); },
  };
  private readonly reinsFrame: ReinsFrame;
  private readonly consumedCommand = { steer: { keyX: 0, keyY: 0, stickX: 0, stickY: 0 }, sprint: false, jump: false };
  /** The device controls consumed by the last input phase, before the touch jump is cleared. */
  sampleCommand(): RideCommandSample { return this.consumedCommand; }
  constructor(private opts: MountOpts) {
    super(HORSE_SPEED);
    this.player = opts.player;
    const p = this.player;
    const makeFrame = (m: Mount): ReinsFrame => {
      const held = (action: 'move.forward' | 'move.back' | 'move.left' | 'move.right', key: string): number => (m.input ? m.input.held(action) : p.keys.has(key)) ? 1 : 0;
      return {
      get forward() { return held('move.forward', 'KeyW') - held('move.back', 'KeyS'); },
      get turn() { return held('move.right', 'KeyD') - held('move.left', 'KeyA'); },
      get touchX() { return p.touchMove.x; }, get touchY() { return p.touchMove.y; },
      get gallop() { return m.input ? m.input.held('ride.gallop') : p.keys.has('ShiftLeft') || p.keys.has('ShiftRight') || m.touchGallop; },
      get jump() { return m.input === null ? p.keys.has('Space') || p.touchJump : m.input.held('jump') || m.input.pressed('jump'); },
      get drawing() { return m.opts.isDrawing?.() ?? false; }, get moveScale() { return p.moveScale; },
      get phase() { return m.horse?.gaitPhase ?? 0; }, feet: m.feet,
      get roads() { return m.roadsOverride ?? m.opts.roads; }, inBounds: inChunk,
      refuses: (x, z) => m.refuse?.(x, z) === true,
      get wet() { return wildEnv.wetAt?.(m.feet.x, m.feet.z) === true || heightAt(m.feet.x, m.feet.z) < waterLevel() - 0.2; },
      };
    };
    this.reinsFrame = makeFrame(this);
  }

  /** B1: a GALLOP press (the disc's press, a Shift keydown) — counted even when the tap is shorter than a frame */
  gallopTap(): void { if (this.horse !== null) this.tapQueued = true; }

  private updateWeapons(mount: MountState | null): void {
    const equipment = this.equipment?.();
    if (equipment) {
      for (const weapon of equipment.available) {
        if (weapon instanceof Bow) weapon.setMount(mount);
        else if (weapon instanceof Sabre || weapon instanceof Spear) weapon.mount = mount;
      }
    }
  }

  /** a spot the horse refuses to ride into (the Storm Titan's fire line) — checked a stride ahead */
  refuse: ((x: number, z: number) => boolean) | null = null;
  /** E307: a playground's track, kept to instead of the shard's roads while it is open (null: the shard's again) */
  setRoads(roads: readonly (readonly RoadXZ[])[] | null): void { this.roadsOverride = roads; }
  private roadsOverride: readonly (readonly RoadXZ[])[] | null = null;

  /** register a horse you may ride (a camp horse, Tulpar): marks it owned (no herd AI, can't die) and adds a MOUNT prompt.
   *  A name you gave it at the rail (horseNames.ts, saved under `key`: per horse, E328) wins over `fallback` */
  addMountable(a: Animal, fallback: string, key = horseKey(a, fallback)): void {
    if (this.mountables.some((m) => m.a === a)) return;
    const name = (this.opts.names === undefined ? null : savedHorseName(key, this.opts.names)) ?? fallback;
    if (name !== fallback) a.label = name;
    a.mem['owned'] = 1;
    const it: Interactable = { position: a.position, radius: 3.3, label: `Mount ${name}`, onInteract: () => { if (this.horse === a) this.dismount(); else if (this.horse === null) this.mount(a); } };
    const m: Mountable = { a, name, it, restT: 0, bolting: false, comeT: 0, key };
    this.mountables.push(m);
    this.interactables.push(it);
  }
  removeMountable(a: Animal): void {
    const i = this.mountables.findIndex((m) => m.a === a);
    if (i === -1) return;
    const m = this.mountables[i];
    this.mountables.splice(i, 1);
    if (m !== undefined) { const j = this.interactables.indexOf(m.it); if (j !== -1) this.interactables.splice(j, 1); }
  }

  /** B1: name a horse you may ride (the rail's NAME prompt): its prompts, the STEED row and its tag take it; saved */
  rename(a: Animal, name: string): void {
    const m = this.mountables.find((x) => x.a === a);
    if (m === undefined || name.length === 0) return;
    m.name = name; a.label = name;
    if (this.opts.names !== undefined) saveHorseName(m.key, name, this.opts.names);
  }
  nameOf(a: Animal): string | null { return this.mountables.find((x) => x.a === a)?.name ?? null; }

  /** can this horse be ridden right now (not resting / bolting) */
  canRide(a: Animal): boolean {
    const m = this.mountables.find((x) => x.a === a);
    return a.alive && (m === undefined || (m.restT <= 0 && !m.bolting));
  }

  /** swing up onto `a` (a mountable, or the stallion for the taming rounds with `breaking`) */
  mount(a: Animal, breaking = false): boolean {
    if (this.horse !== null || !this.canRide(a)) return false;
    const p = this.player;
    p.setHover(false);
    this.horse = a; p.mountedOn = a;
    this.breaking = breaking;
    const herd = HorseHerd.of(a);
    if (herd !== null) herd.setRidden(a); else a.mem['ridden'] = 1;
    a.setMotion(a.yaw, 0, 2);
    this.heading = a.yaw; this.speed = 0; this.wUp = 0; this.yawRate = 0;
    this.target = 0; this.rateIn = 0; this.turnIn = 0; this.sector = 2; this.jumpQueued = false;
    this.camYaw = p.yaw; this.camPitch = p.pitch; this.lookIdle = 10;   // the first move swings the view round behind the ears
    this.swingFrom.copy(p.camera.position);
    this.swingT = 0; this.swingDir = 1;
    // the body: the horse leaves the creature physics (no upright post of its own) and gets the lying capsule
    a.driven = true; a.yOffset = 0;
    this.feet.copy(a.position);
    this.jostles = 0; this.shoveX = this.shoveZ = 0; this.jolt = 0;
    this.cruise = 0; this.gallopWas = false; this.sectorWas = 2; this.skidT = 0; this.panicT = 0; this.panicRear = 0; this.onRoad = false;
    this.spur.reset(); this.spur.good = 0; this.lastPhase = a.gaitPhase;
    const physics = app.physics;
    if (physics !== null) {
      this.motor = new CharacterMotor(physics, mountedMotorOptions(a.scale, a));
      this.settle();
    }
    this.land();
    this.eyeY = this.feet.y;
    p.ride = this;
    p.setBodyEnabled(false);   // the on-foot capsule leaves the world while you ride (the horse is the body; Player gates it on `ride`)
    wildEnv.playerMounted = true;
    this.onMountChange?.(a);
    return true;
  }

  /** the body placed fresh (mount, teleport): faced along the heading, backed out of anything it stands in, no glide */
  private settle(): void { this.settleBody(); this.poseHeading = this.heading; }

  /** off the horse, to its left side. `thrown`: tossed clear (the bolt, the bucking, the stampede) — a longer hop, no swing */
  dismount(thrown = false): void {
    const a = this.horse;
    if (a === null) return;
    const p = this.player;
    // the horse stays where its body is (on a bridge deck: on the deck), drawn on the ground from here on
    a.position.copy(this.feet);
    a.yaw = this.heading;
    a.driven = false; a.levelGround = false;
    a.yOffset = Math.max(0, this.feet.y - heightAt(this.feet.x, this.feet.z));
    if (this.motor !== null) { this.motor.dispose(); this.motor = null; }
    // the left side of the horse (animal convention: left = (cos yaw, −sin yaw)), clear of its body
    const side = thrown ? 2.2 : 1.15;
    let x = a.position.x + Math.cos(a.yaw) * side, z = a.position.z - Math.sin(a.yaw) * side;
    if (!inChunk(x, z, 3)) { x = a.position.x - Math.cos(a.yaw) * side; z = a.position.z + Math.sin(a.yaw) * side; }
    p.position.set(x, Math.max(heightAt(x, z), this.onDeck ? this.feet.y : -Infinity), z);
    p.velocity.set(0, 0, 0);
    p.onGround = true;
    p.ride = null;
    p.setBodyEnabled(true);
    this.horse = null; p.mountedOn = null;
    this.breaking = false; this.breakRoll = 0; this.breakShake = 0;
    const herd = HorseHerd.of(a);
    if (herd?.ridden === a) herd.setRidden(null); else a.mem['ridden'] = 0;
    a.setMotion(a.yaw, 0, 2);
    a.mem['rear'] = 0; a.mem['buck'] = 0; a.mem['turnLead'] = 0;
    wildEnv.playerMounted = false;
    this.updateWeapons(null);
    this.gait = 'stand';
    if (thrown) this.onThrown?.();
    this.onMountChange?.(null);
  }

  /** move horse + rider (respawn, a harness): the horse faces `yaw` (animal convention), the view along it */
  teleport(x: number, z: number, yaw: number): void {
    const a = this.horse;
    if (a === null) return;
    a.place(x, z, yaw); this.heading = yaw; this.speed = 0; a.speed = 0;
    this.feet.set(x, heightAt(x, z), z);
    this.settle();
    this.land();
    this.eyeY = this.feet.y; this.swingDir = 0;
    this.player.yaw = yaw - Math.PI; this.yawRate = 0;
    this.camYaw = this.player.yaw; this.camPitch = this.player.pitch;
  }

  /** call your horse (X / the HORSE tab): Tulpar within 150 m gallops to you */
  whistle(): Animal | null {
    if (this.horse !== null) return null;
    const p = this.player.position;
    let best: Mountable | null = null, bd = WHISTLE_RANGE;
    for (const m of this.mountables) {
      if (!this.canRide(m.a) || (m.a.mem['whistle'] ?? 0) === 0) continue;   // only a bonded horse answers (mem.whistle = 1)
      const d = m.a.position.distanceTo(p);
      if (d < bd) { bd = d; best = m; }
    }
    if (best === null) return null;
    best.comeT = 30;
    return best.a;
  }

  /**
   * B1: the horse under you panics at a scare at (x, z) — a wolf's bite, lightning close by: it rears if it stood or
   * walked, then bolts away from it for `secs`, deaf to the reins. False (nothing happens) on foot, while breaking a
   * stallion.
   */
  panic(x: number, z: number, secs: number): boolean {
    const a = this.horse;
    if (a === null || this.breaking) return false;
    const fresh = this.panicT <= 0;
    this.panicT = Math.max(this.panicT, secs);
    this.panicYaw = Math.atan2(this.feet.x - x, this.feet.z - z);
    if (fresh && Math.abs(this.speed) < 3) this.panicRear = PANIC_REAR;
    this.skidT = 0; this.spur.reset();
    this.jolt = Math.max(this.jolt, 0.7);
    if (fresh) this.onPanic?.(a, secs);
    return true;
  }

  // ── the input phase (Player.input hands the frame here while riding): the reins, read into intents ─────────────────

  drive(dt: number): void {
    const a = this.horse, p = this.player;
    if (a === null) { p.ride = null; return; }
    if (!a.alive || a.hidden) { this.dismount(true); return; }
    // ── the look the player gave since last frame (mouse, a LOOK drag, the aim assist): it restarts the free-look clock ──
    if (Math.abs(angDiff(p.yaw, this.camYaw)) > 1e-4 || Math.abs(p.pitch - this.camPitch) > 1e-4) this.lookIdle = 0;
    else this.lookIdle += dt;
    // ── input, in the HORSE's frame (never the camera's): forward / back = the reins' speed, left / right = turn ──
    const used = this.consumedCommand, frame = this.reinsFrame;
    used.steer.keyX = frame.turn; used.steer.keyY = frame.forward;
    used.steer.stickX = frame.touchX; used.steer.stickY = frame.touchY;
    used.sprint = frame.gallop; used.jump = frame.jump;
    this.read(dt, this.reinsFrame);
    this.input?.consume('jump');
    p.touchJump = false;
    a.mem['turnLead'] = this.turnLead;
    a.lookWeight = 0;   // no alert look-at under a rider (a stale one from the wait at the rail pulled the neck aside)
  }

  // ── one fixed step (Player.step, 60 Hz): the horse's body moves ───────────────────────────────────────────────────

  step(dt: number): void {
    const a = this.horse;
    if (a !== null) this.stepBody(dt, a, this.player, this.bodyWorld);
  }

  /** a stampeding horse `o` touched ours: a shove away from it (and along its run), a jolt in the view; at a gallop a
   *  hard hit (closing ≥ UNSEAT_CLOSING m/s) throws the rider */


  // ── every frame (Player.update, after the fixed steps): the saddle drawn between the last two steps ────────────────

  pose(dt: number, alpha: number): void {
    const a = this.horse, p = this.player;
    if (a === null) return;
    const locked = lockOn.state === 'locked';
    const heading = this.placeRider(dt, alpha, a, p, this.bodyWorld), px = a.position.x, pz = a.position.z;
    const sp = Math.abs(this.speed);
    const dHead = angDiff(heading, this.poseHeading);
    this.poseHeading = heading;
    // ── the camera rides the horse: the view turns with its heading (the rider's body is on it), your look is an offset
    //    on top — a free look that eases back behind the ears once you leave it alone (sooner and faster at speed). Held
    //    while you draw / aim (the Parthian shot) or while a lock-on steers the view; never at a stand (look around freely)
    if (!locked) {
      p.yaw += dHead;
      const moving = sp > 0.6 && !this.breaking;
      const delay = THREE.MathUtils.lerp(RECENTRE.delaySlow, RECENTRE.delayFast, Math.min(1, sp / HORSE_SPEED.gallop)) * (this.turnIn !== 0 ? 0.6 : 1);
      if (moving && !this.drawing && this.lookIdle > delay) {
        const ease = 1 - Math.exp(-dt * (RECENTRE.rate + sp * RECENTRE.perMs));
        p.yaw -= angDiff(p.yaw + Math.PI, heading) * ease;
        p.pitch += (RECENTRE.pitch - p.pitch) * ease * 0.7;
      }
    }
    const rel = angDiff(p.yaw + Math.PI, heading);
    const limit = this.breaking ? BREAK_LOOK : LOOK_LIMIT;   // hanging on: eyes down the neck
    if (Math.abs(rel) > limit) p.yaw = heading - Math.PI + Math.sign(rel) * limit;
    this.camYaw = p.yaw; this.camPitch = p.pitch;
    // gait bob, kept small (comfort): walk nod + a side sway, trot bounce (two a stride), canter rock, gallop drive
    const stride = sp < 3 ? 1.7 : sp < 6.5 ? 2.6 : sp < 11 ? 3.4 : 4.6;
    this.bobPh += dt * sp / stride * Math.PI * 2;
    const g1 = Math.sin(this.bobPh), g2 = Math.sin(this.bobPh * 2);
    const amp = this.gait === 'walk' ? BOB.walk : this.gait === 'trot' ? BOB.trot : this.gait === 'canter' ? BOB.canter : this.gait === 'gallop' ? BOB.gallop : 0.004 * Math.sin(performance.now() * 0.0015);
    const bob = this.gait === 'trot' ? Math.abs(g2) * amp * 1.4 - amp * 0.7 : this.gait === 'stand' ? amp : g1 * amp;
    this.bobY += (bob - this.bobY) * Math.min(1, dt * 18);
    const swayT = this.gait === 'walk' ? Math.cos(this.bobPh) * BOB.sway : this.gait === 'trot' ? Math.cos(this.bobPh) * BOB.sway * 0.4 : 0;
    this.sway += (swayT - this.sway) * Math.min(1, dt * 10);
    const rockT = this.gait === 'canter' ? Math.cos(this.bobPh) * BOB.rock : this.gait === 'gallop' ? Math.cos(this.bobPh) * BOB.rock * 0.6 : 0;
    this.rock += (rockT - this.rock) * Math.min(1, dt * 10);
    // a lean into the turn: the rider tips with the horse, ~2° at a galloping turn
    this.roll += ((-this.yawRate * Math.min(1, sp / 8)) * ROLL_PER_RATE - this.roll) * Math.min(1, dt * 4);
    this.skidDip += ((this.skidT > 0 ? 1 : 0) - this.skidDip) * Math.min(1, dt * 6);   // B1: thrown forward in the skid
    const lowT = this.galloping && this.speed > 11 && !this.drawing ? 1 : 0;
    this.leanLow += (lowT - this.leanLow) * Math.min(1, dt * 3);
    // R3: a jostle's jolt — a short shake and a tip away from the hit, fading in ~0.4 s
    this.jolt = Math.max(0, this.jolt - dt * 2.5);
    const jolt = this.jolt > 0 ? (Math.random() - 0.5) * this.jolt * 0.06 : 0;
    // the eye: over the saddle, forward over the withers when leaning low
    const scale = a.scale;
    const fwdOff = -0.04 - 0.06 * this.leanLow, eye = EYE * scale - 0.08 * this.leanLow;   // low over the neck, not into it
    const cam = p.camera;
    // the saddle point in the horse's own frame, tilted with it on a slope (its mesh pitches / rolls to the ground), so
    // the eye stays over the saddle on a side hill instead of floating off it
    const hm = a.mesh.rotation;
    _seat.set(this.sway, eye, fwdOff).applyEuler(_tilt.set(hm.x, heading, hm.z, 'YXZ'));
    const ex = px + _seat.x, ez = pz + _seat.z;
    const ey = this.eyeY + _seat.y + this.bobY;
    if (this.swingDir !== 0) {
      this.swingT = Math.min(1, this.swingT + dt / MOUNT_T);
      const u = this.swingT * this.swingT * (3 - 2 * this.swingT);
      cam.position.set(this.swingFrom.x + (ex - this.swingFrom.x) * u, this.swingFrom.y + (ey - this.swingFrom.y) * u + Math.sin(u * Math.PI) * 0.35, this.swingFrom.z + (ez - this.swingFrom.z) * u);
      if (this.swingT >= 1) this.swingDir = 0;
    } else cam.position.set(ex, ey, ez);
    const shake = this.breakShake > 0 ? (Math.random() - 0.5) * this.breakShake * 0.05 : 0;
    cam.position.y += shake + jolt;
    // a rider's eye rests a little below the horizon — the ears and the mane in the lower frame (every mounted mockup)
    // (+ a share of the horse's slope: its nose-down pitch tips the view down, its roll the other way round in the camera's frame)
    _e.set(p.pitch + this.rock - SEAT_TILT - 0.03 * this.leanLow - 0.06 * this.skidDip + shake * 0.4 - hm.x * TILT_FOLLOW, p.yaw, this.roll + this.breakRoll + jolt * 2 - hm.z * TILT_FOLLOW, 'YXZ');
    cam.rotation.copy(_e);
    // ── weapons from the saddle ──
    this.updateWeapons({ speed: this.speed, yaw: heading - Math.PI });
    const bow = this.equipment?.()?.available.find((weapon) => weapon instanceof Bow);
    if (bow instanceof Bow && this.gait === 'gallop' && Math.cos(this.bobPh) > 0.3) bow.extraSpreadDeg *= 0.5;
  }

  /**
   * The ground under a freshly placed body (a mount, a teleport — the feet start on the terrain): up onto the deck over
   * it, when one stands within 2.5 m (the Kunes bridge's planks over the gully) — a physics query, as every Nalati floor
   * is a collider since NALATI-MERGE P1.
   */
  private land(): void { this.landBody(this.bodyWorld); }

  /**
   * A jump's worth ahead (where the arc peaks at this speed): a rail / log / wall top at knee height with clear air over
   * it and ground beyond (the horse jumps it by itself), or a ditch / the brook with a far bank. Physics queries only.
   */


  /** every frame (main's loop): the horse can't die (bolt → rest → whole), companions answering the whistle, prompt labels */
  update(dt: number): void {
    const p = this.player.position;
    for (const m of this.mountables) {
      const a = m.a;
      if (!a.alive) continue;
      // at 20 % hp it bolts: throws the rider, runs for the rail, rests
      if (!m.bolting && m.restT <= 0 && a.hp < a.maxHp * BOLT_AT) {
        m.bolting = true; m.comeT = 0;
        if (this.horse === a) { this.dismount(true); this.opts.hurt?.(10); }
        a.mem['rear'] = 1;
        this.onBolt?.(a, m.name);
      }
      if (m.bolting) {
        a.mem['rear'] = Math.max(0, (a.mem['rear'] ?? 0) - dt * 1.2);
        const r = this.opts.restAt;
        const tx = r?.x ?? a.position.x, tz = r?.z ?? a.position.z;
        const d = Math.hypot(tx - a.position.x, tz - a.position.z);
        if (d > 3 && r !== undefined) { a.state = 'flee'; a.setMotion(Math.atan2(tx - a.position.x, tz - a.position.z), d > 20 ? HORSE_SPEED.gallop * 0.9 : HORSE_SPEED.trot, 2); }
        else { m.bolting = false; m.restT = REST_TIME; a.setMotion(a.yaw, 0, 1); a.state = 'graze'; }
      } else if (m.restT > 0) {
        m.restT -= dt;
        a.state = 'graze';
        if (m.restT <= 0) a.hp = a.maxHp;
      } else if (this.horse !== a && m.comeT > 0) {
        // whistled: gallop over, slow down, stop 3 m off facing you
        m.comeT -= dt;
        const d = Math.hypot(p.x - a.position.x, p.z - a.position.z);
        if (d > 3.2) { a.state = d > 12 ? 'flee' : 'wander'; a.setMotion(Math.atan2(p.x - a.position.x, p.z - a.position.z), d > 25 ? HORSE_SPEED.gallop * 0.85 : d > 8 ? HORSE_SPEED.canter * 0.7 : HORSE_SPEED.walk, 2.5); }
        else { m.comeT = 0; a.setMotion(Math.atan2(p.x - a.position.x, p.z - a.position.z), 0, 2); a.state = 'idle'; a.mem['toss'] = 1; }
      } else if (this.horse !== a) {
        // waiting: idle / graze in place, an ear to you
        if (a.speed < 0.1) a.state = Math.sin(performance.now() * 0.0002 + a.seed * 9) > 0.1 ? 'graze' : 'idle';
        a.lookTarget.copy(p); a.lookWeight = a.position.distanceTo(p) < 6 && a.state !== 'graze' ? 0.6 : 0;
      }
      m.it.label = this.horse === a ? 'Dismount' : m.restT > 0 || m.bolting ? `${m.name} is resting` : `Mount ${m.name}`;
      m.it.radius = this.horse === a ? 3.6 : m.restT > 0 || m.bolting ? 0 : 3.3;
    }
  }
}
