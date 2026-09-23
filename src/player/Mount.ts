import * as THREE from 'three';
import type { Player } from './Player';
import type { Animal } from '../entities/Animal';
import type { Forest } from '../world/Forest';
import type { Interactable } from '../world/Cabin';
import type { MountState } from './Sabre';
import { heightAt, normalAt, inChunk, waterLevel } from '../world/Heightfield';
import { HorseHerd } from '../entities/Herd';
import { HORSE_SPEED } from '../entities/species/horse';
import { wildEnv } from '../entities/wildEnv';
import { riding } from './riding';

/**
 * Mount — riding a horse (Nalati row B7; docs/design/nalati/wolves-horses-taming.md "Riding", controls.md "The mounted
 * layout", combat.md "from the saddle"). The horse is an ordinary AnimalManager `Animal` (species/horse.ts); while you
 * ride it the herd AI lets go (`mem.ridden`, HorseHerd.setRidden) and this drives its `setMotion` from your input.
 *
 *   const mount = new Mount({ player, forest, kit, isDrawing: () => weapons.adsHeld });
 *   mount.addMountable(horse, 'Tulpar')        // a camp horse / Tulpar: a MOUNT prompt (`mount.interactables` → main's list)
 *   mount.mount(horse) / mount.dismount()
 *   game.onUpdate((dt) => mount.update(dt))    // companions (whistle, the bolt to the rail, resting), the prompt labels
 *   player.ride = mount (set by mount()) → Player.update hands each frame to `drive(dt)`
 *
 * Controls: MOVE (stick / WASD) = gait and direction — the horse turns toward where the stick points relative to your
 * look (walk < 45 % · trot 45–85 % · canter > 85 % on the stick; W holds trot then canter on the keyboard); GALLOP
 * (Shift / the GALLOP disc, hold) = 13 m/s and drains STEED (−12 /s; +15 /s at a walk / trot, +5 at a canter; exhausted →
 * no gallop until 25). While DRAW is latched (`isDrawing`) the horse holds its heading (A / D or the stick's x turn it
 * slowly) so you can shoot sideways; your look is free ±170° off the heading (the Parthian shot). Space = jump; the horse
 * also jumps a fence / log / brook by itself at a canter or faster. E / USE / DISMOUNT = off (to the left side).
 * Auto LEAN LOW at a full gallop when not drawing (lower, forward; drawing sits you up).
 *
 * The camera sits at the rider's eye (2.55 m × the horse's scale) over the saddle, with a gait bob (walk nod, trot
 * bounce, canter rock, gallop drive) and a lean into turns; the horse's own head, ears and mane are in the lower frame.
 * Weapons from the saddle (`kit`): `setMount({ speed, yaw })` every frame — the sabre's pass slash, the couched lance, the
 * bow's mounted draw / gait spread / carrier velocity / no arc (Bow.setMount) — and the spread halved on the gallop's float.
 *
 * The horse can't die (plan decision): at 20 % hp it bolts — you are thrown (10 damage) — gallops to the hitching rail
 * (`restAt`) and rests for 3 min, then is whole again. `onThrown`, `onMountChange`, `onBolt` for the HUD / audio.
 */

/** the weapon kit's riding hook (nalatiKit.ts): `setMount` hands the horse to the sabre, spear and bow (the bow sets its
 *  own mounted draw speed / spread / carrier velocity / no arc from it — multiplicatively, so a Golden Bow keeps its bonus) */
export interface MountKit {
  setMount: (m: MountState | null) => void;
  bow: { extraSpreadDeg: number };
}

export interface MountOpts {
  player: Player;
  forest: Forest;
  /** the Nalati weapon kit (nalatiKit.ts) — null in a harness without weapons */
  kit?: MountKit | null;
  /** DRAW latched / the bow drawing: the horse holds its heading */
  isDrawing?: () => boolean;
  /** the player takes damage (thrown: 10) */
  hurt?: (damage: number) => void;
  /** where a bolting horse runs to and rests (the hitching rail) */
  restAt?: { x: number; z: number };
}

interface Mountable { a: Animal; name: string; it: Interactable; restT: number; bolting: boolean; comeT: number }

const EYE = 2.3;                      // rider eye over the ground at horse scale 1 (withers 1.45 + a seated rider)
const LOOK_LIMIT = THREE.MathUtils.degToRad(170), BREAK_LOOK = THREE.MathUtils.degToRad(35);
const MOUNT_T = 0.55;                 // s: the swing up / down
const STEED_MAX = 100, STEED_GALLOP = 12, STEED_WALK = 15, STEED_CANTER = 5, STEED_RESUME = 25;
const BOLT_AT = 0.2, REST_TIME = 180, WHISTLE_RANGE = 150;
const RADIUS = 0.75;
const SEAT_TILT = 0.13;
const FORD_DEPTH = 0.95;             // m of water a horse wades before it swims (its back stays dry)               // rad the saddle view looks down past the player's pitch
const _v = new THREE.Vector3(), _e = new THREE.Euler(0, 0, 0, 'YXZ');
const angDiff = (a: number, b: number): number => Math.atan2(Math.sin(a - b), Math.cos(a - b));

export class Mount {
  /** the horse under you (null on foot) */
  horse: Animal | null = null;
  get mounted(): boolean { return this.horse !== null; }
  /** STEED stamina 0..100 */
  steed = STEED_MAX;
  /** gallop exhausted: no gallop until STEED_RESUME */
  winded = false;
  /** 'walk' | 'trot' | 'canter' | 'gallop' | 'stand' — for the HUD / audio */
  gait: 'stand' | 'walk' | 'trot' | 'canter' | 'gallop' = 'stand';
  /** leaning low over the neck (full gallop, not drawing) */
  leanLow = 0;
  /** the GALLOP disc (touch, RideHUD) */
  touchGallop = false;
  /** the bucking mini-game (Taming.ts) owns the horse: no rider control, it sets `breakRoll` / `breakShake` */
  breaking = false;
  breakRoll = 0; breakShake = 0;
  /** MOUNT prompts for main's interactable list (one per mountable; label follows the state) */
  readonly interactables: Interactable[] = [];
  readonly mountables: Mountable[] = [];
  onMountChange?: ((horse: Animal | null) => void) | undefined;
  onThrown?: (() => void) | undefined;
  onBolt?: ((horse: Animal, name: string) => void) | undefined;

  private readonly player: Player;
  private swingT = 0; private swingDir = 0;
  private readonly swingFrom = new THREE.Vector3();
  private heading = 0;
  private speed = 0;
  private wUp = 0;               // keyboard W held time (trot → canter)
  private bobPh = 0; private bobY = 0; private rock = 0; private roll = 0;
  private eyeY = 0;
  private jumpT = -1; private jumpWas = false;
  private readonly vel = new THREE.Vector3();
  private readonly prev = new THREE.Vector3();

  constructor(private opts: MountOpts) {
    this.player = opts.player;
    document.addEventListener('keydown', (e) => {
      if (e.code === 'KeyX' && !e.repeat) this.whistle();
    });
  }

  /** hand over the weapon kit once it exists (the wiring builds the mount before main.ts builds the kit) */
  setKit(kit: MountKit | null): void { this.opts.kit = kit; }

  /** register a horse you may ride (a camp horse, Tulpar): marks it owned (no herd AI, can't die) and adds a MOUNT prompt */
  addMountable(a: Animal, name: string): void {
    if (this.mountables.some((m) => m.a === a)) return;
    a.mem['owned'] = 1;
    const it: Interactable = { position: a.position, radius: 3.3, label: `Mount ${name}`, onInteract: () => { if (this.horse === a) this.dismount(); else if (this.horse === null) this.mount(a); } };
    const m: Mountable = { a, name, it, restT: 0, bolting: false, comeT: 0 };
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
    this.horse = a; riding.horse = a;
    this.breaking = breaking;
    const herd = HorseHerd.of(a);
    if (herd !== null) herd.setRidden(a); else a.mem['ridden'] = 1;
    a.setMotion(a.yaw, 0, 2);
    this.heading = a.yaw; this.speed = 0; this.wUp = 0; this.jumpT = -1;
    this.swingFrom.copy(p.camera.position);
    this.swingT = 0; this.swingDir = 1;
    this.eyeY = heightAt(a.position.x, a.position.z);
    this.prev.copy(a.position);
    p.ride = this;
    wildEnv.playerMounted = true;
    this.onMountChange?.(a);
    return true;
  }

  /** off the horse, to its left side. `thrown`: tossed clear (the bolt, the bucking) — a longer hop, no swing */
  dismount(thrown = false): void {
    const a = this.horse;
    if (a === null) return;
    const p = this.player;
    // the left side of the horse (animal convention: left = (cos yaw, −sin yaw)), clear of its body
    const side = thrown ? 2.2 : 1.15;
    let x = a.position.x + Math.cos(a.yaw) * side, z = a.position.z - Math.sin(a.yaw) * side;
    if (!inChunk(x, z, 3)) { x = a.position.x - Math.cos(a.yaw) * side; z = a.position.z + Math.sin(a.yaw) * side; }
    p.position.set(x, heightAt(x, z), z);
    p.velocity.set(0, 0, 0);
    p.onGround = true;
    p.ride = null;
    this.horse = null; riding.horse = null;
    this.breaking = false; this.breakRoll = 0; this.breakShake = 0;
    const herd = HorseHerd.of(a);
    if (herd?.ridden === a) herd.setRidden(null); else a.mem['ridden'] = 0;
    a.setMotion(a.yaw, 0, 2);
    a.mem['rear'] = 0; a.mem['buck'] = 0;
    wildEnv.playerMounted = false;
    const kit = this.opts.kit;
    if (kit) kit.setMount(null);
    this.gait = 'stand';
    if (thrown) this.onThrown?.();
    this.onMountChange?.(null);
  }

  /** move horse + rider (respawn, a harness): the horse faces `yaw` (animal convention), the view along it */
  teleport(x: number, z: number, yaw: number): void {
    const a = this.horse;
    if (a === null) return;
    a.place(x, z, yaw); this.heading = yaw; this.speed = 0; a.speed = 0;
    this.eyeY = heightAt(x, z); this.swingDir = 0;
    this.player.yaw = yaw - Math.PI;
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

  // ── per frame (Player.update hands the frame here while riding) ──────────────────────────────────────────────────

  drive(dt: number): void {
    const a = this.horse, p = this.player;
    if (a === null) { p.ride = null; return; }
    if (!a.alive || a.hidden) { this.dismount(true); return; }
    const k = p.keys;
    const drawing = this.opts.isDrawing?.() ?? false;
    // ── input ──
    const fwdK = (k.has('KeyW') ? 1 : 0) - (k.has('KeyS') ? 1 : 0), strK = (k.has('KeyD') ? 1 : 0) - (k.has('KeyA') ? 1 : 0);
    const fwd = THREE.MathUtils.clamp(fwdK + p.touchMove.y, -1, 1), str = THREE.MathUtils.clamp(strK + p.touchMove.x, -1, 1);
    const stick = Math.hypot(p.touchMove.x, p.touchMove.y);
    const gallopKey = k.has('ShiftLeft') || k.has('ShiftRight') || this.touchGallop;
    this.wUp = fwdK > 0 ? this.wUp + dt : 0;
    // ── gait → target speed ──
    let target = 0;
    if (stick > 0.1) target = stick < 0.45 ? HORSE_SPEED.walk : stick < 0.85 ? HORSE_SPEED.trot : HORSE_SPEED.canter;
    else if (fwdK > 0) target = this.wUp < 0.9 ? HORSE_SPEED.trot : HORSE_SPEED.canter;
    else if (fwdK < 0) target = this.speed > 1 ? 0 : -1.1;                      // S: rein in, then back up
    else if (Math.abs(strK) > 0) target = HORSE_SPEED.walk;
    if (this.steed <= 0) this.winded = true;
    if (this.winded && this.steed >= STEED_RESUME) this.winded = false;
    const galloping = gallopKey && !this.winded && !this.breaking;
    if (galloping) target = HORSE_SPEED.gallop;
    if (this.breaking) target = 0;
    // ── heading ──
    const look = p.yaw + Math.PI;                                                // the look direction, animal yaw convention
    const moving = Math.abs(fwd) > 0.08 || Math.abs(str) > 0.08;
    let desired = this.heading;
    if (!this.breaking) {
      if (drawing) desired = this.heading - str * 0.9;                           // DRAW latched: hold the line, A / D nudge it
      else if (moving) {
        // the stick / WASD in the look frame: forward = where you look
        const sin = Math.sin(p.yaw), cos = Math.cos(p.yaw);
        const mx = -sin * Math.max(0, fwd) + cos * str, mz = -cos * Math.max(0, fwd) - sin * str;
        desired = Math.hypot(mx, mz) > 0.05 ? Math.atan2(mx, mz) : look;
      }
    }
    const turnRate = this.speed < 2.5 ? 2.2 : this.speed < 6 ? 1.8 : this.speed < 10 ? 1.35 : 1.05;
    // steep ground ahead: no charging up a cliff — a slope past ~40° caps the gait at a walk
    const ahead = 2 + this.speed * 0.4;
    const ax = a.position.x + Math.sin(this.heading) * ahead, az = a.position.z + Math.cos(this.heading) * ahead;
    if (target > HORSE_SPEED.walk && normalAt(ax, az)[1] < 0.72 && heightAt(ax, az) > a.position.y + 0.8) target = HORSE_SPEED.walk;
    if (!inChunk(ax, az, 6)) target = Math.min(target, 0);
    // fording: in the river / the brook the horse wades at a walk-trot, swimming (held at FORD_DEPTH) where it is deeper
    const wet = wildEnv.wetAt?.(a.position.x, a.position.z) === true || heightAt(a.position.x, a.position.z) < waterLevel() - 0.2;
    if (wet) target = Math.sign(target) * Math.min(Math.abs(target), HORSE_SPEED.walk * 1.6);
    // ── integrate the way Animal.update will (so the camera and the mesh agree this frame) ──
    const dy = angDiff(desired, this.heading);
    this.heading += THREE.MathUtils.clamp(dy, -turnRate * dt, turnRate * dt);
    const accel = target > this.speed ? (this.speed > 8 ? 3.5 : 5.5) : 9;
    this.speed += THREE.MathUtils.clamp(target - this.speed, -accel * dt, accel * dt);
    a.setMotion(this.heading, this.speed, 50);        // the horse follows exactly (Animal integrates heading + speed)
    a.yaw = this.heading; a.speed = this.speed;
    a.state = this.speed > 6 ? 'flee' : this.speed > 0.2 ? 'wander' : 'idle';
    // ── collisions: trees and the world's boxes (fences, yurts), a larger body than on foot ──
    const nx = a.position.x + Math.sin(this.heading) * this.speed * dt, nz = a.position.z + Math.cos(this.heading) * this.speed * dt;
    const pushed = this.collide(nx, nz);
    if (pushed) { a.position.x = _v.x - Math.sin(this.heading) * this.speed * dt; a.position.z = _v.z - Math.cos(this.heading) * this.speed * dt; }
    // ── jump: Space, or on its own at a canter+ over a low obstacle ──
    const jumpDown = k.has('Space') || p.touchJump; p.touchJump = false;
    if (jumpDown && !this.jumpWas && this.jumpT < 0 && !this.breaking) this.jumpT = 0;
    this.jumpWas = jumpDown;
    if (this.jumpT < 0 && this.speed > 6 && this.obstacleAhead(a)) this.jumpT = 0;
    let lift = 0;
    if (this.jumpT >= 0) {
      this.jumpT += dt;
      const u = this.jumpT / 0.72;
      if (u >= 1) { this.jumpT = -1; this.bobY -= 0.12; }
      else { lift = Math.sin(u * Math.PI) * 1.05; a.mem['rear'] = u < 0.35 ? 0.35 : 0; if (u > 0.6 && u < 0.65) a.mem['kick'] = 1; }
    }

    // ── STEED ──
    this.gait = this.speed < 0.3 ? 'stand' : this.speed < 3 ? 'walk' : this.speed < 6.5 ? 'trot' : this.speed < 11 ? 'canter' : 'gallop';
    this.steed = THREE.MathUtils.clamp(this.steed + dt * (galloping && this.speed > 9 ? -STEED_GALLOP : this.gait === 'canter' ? STEED_CANTER : STEED_WALK), 0, STEED_MAX);
    // ── the rider ──
    const scale = a.scale;
    const px = a.position.x + Math.sin(this.heading) * this.speed * dt, pz = a.position.z + Math.cos(this.heading) * this.speed * dt;
    const g = this.groundAt(px, pz);
    this.eyeY += (g - this.eyeY) * Math.min(1, dt * 12);
    a.yOffset = g - heightAt(a.position.x, a.position.z) + lift;   // a bridge deck, the swim float — Animal adds it to its ground
    this.vel.set(Math.sin(this.heading) * this.speed, 0, Math.cos(this.heading) * this.speed);
    p.position.set(px, this.eyeY + lift, pz);
    p.velocity.copy(this.vel);
    p.onGround = true; p.sprinting = this.speed > 10; p.crouching = false; p.speedFactor = 0;
    // free look ±170° off the heading
    const rel = angDiff(look, this.heading);
    const limit = this.breaking ? BREAK_LOOK : LOOK_LIMIT;   // hanging on: eyes down the neck
    if (Math.abs(rel) > limit) p.yaw = this.heading - Math.PI + Math.sign(rel) * limit;
    // gait bob: walk nod, trot bounce (two a stride), canter rock, gallop drive
    const stride = this.speed < 3 ? 1.7 : this.speed < 6.5 ? 2.6 : this.speed < 11 ? 3.4 : 4.6;
    this.bobPh += dt * Math.abs(this.speed) / stride * Math.PI * 2;
    const g1 = Math.sin(this.bobPh), g2 = Math.sin(this.bobPh * 2);
    const amp = this.gait === 'walk' ? 0.022 : this.gait === 'trot' ? 0.05 : this.gait === 'canter' ? 0.075 : this.gait === 'gallop' ? 0.06 : 0.004 * Math.sin(performance.now() * 0.0015);
    const bob = this.gait === 'trot' ? Math.abs(g2) * amp * 1.4 - amp * 0.7 : this.gait === 'stand' ? amp : g1 * amp;
    this.bobY += (bob - this.bobY) * Math.min(1, dt * 18);
    const rockT = this.gait === 'canter' ? Math.cos(this.bobPh) * 0.035 : this.gait === 'gallop' ? Math.cos(this.bobPh) * 0.02 : 0;
    this.rock += (rockT - this.rock) * Math.min(1, dt * 10);
    this.roll += ((-dy * Math.min(1, this.speed / 8)) * 0.12 - this.roll) * Math.min(1, dt * 4);
    const lowT = galloping && this.speed > 11 && !drawing ? 1 : 0;
    this.leanLow += (lowT - this.leanLow) * Math.min(1, dt * 3);
    // the eye: over the saddle, forward over the withers when leaning low
    const fwdOff = -0.04 - 0.06 * this.leanLow, eye = EYE * scale - 0.08 * this.leanLow;   // low over the neck, not into it
    const cam = p.camera;
    const ex = px + Math.sin(this.heading) * fwdOff, ez = pz + Math.cos(this.heading) * fwdOff;
    const ey = this.eyeY + lift + eye + this.bobY;
    if (this.swingDir !== 0) {
      this.swingT = Math.min(1, this.swingT + dt / MOUNT_T);
      const u = this.swingT * this.swingT * (3 - 2 * this.swingT);
      cam.position.set(this.swingFrom.x + (ex - this.swingFrom.x) * u, this.swingFrom.y + (ey - this.swingFrom.y) * u + Math.sin(u * Math.PI) * 0.35, this.swingFrom.z + (ez - this.swingFrom.z) * u);
      if (this.swingT >= 1) this.swingDir = 0;
    } else cam.position.set(ex, ey, ez);
    const shake = this.breakShake > 0 ? (Math.random() - 0.5) * this.breakShake * 0.05 : 0;
    cam.position.y += shake;
    // a rider's eye rests a little below the horizon — the ears and the mane in the lower frame (every mounted mockup)
    _e.set(p.pitch + this.rock - SEAT_TILT - 0.03 * this.leanLow + shake * 0.4, p.yaw, this.roll + this.breakRoll, 'YXZ');
    cam.rotation.copy(_e);
    // ── weapons from the saddle ──
    const kit = this.opts.kit;
    if (kit) {
      kit.setMount({ speed: this.speed, yaw: this.heading - Math.PI });
      if (this.gait === 'gallop' && Math.cos(this.bobPh) > 0.3) kit.bow.extraSpreadDeg *= 0.5;   // the gallop's float: all four hooves off the ground
    }
    this.prev.copy(a.position);
  }

  /** what the horse stands on at (x, z): the terrain, a deck it is on (bridge, platform — within a step of where it is), or
   *  the swim float over deep water (the rider's eye stays above the river) */
  private groundAt(x: number, z: number): number {
    const terrain = heightAt(x, z);
    let g = terrain;
    for (const pf of this.player.platforms) { const y = pf(x, z); if (y !== undefined && y > g && y < this.eyeY + 0.9) g = y; }
    const wl = waterLevel();
    if (g < wl - FORD_DEPTH && (wildEnv.wetAt?.(x, z) === true || terrain < wl)) g = wl - FORD_DEPTH;
    return g;
  }

  /** push (x, z) out of trees / boxes; `_v` holds the corrected point; true if it moved */
  private collide(x: number, z: number): boolean {
    let moved = false;
    _v.set(x, 0, z);
    for (const t of this.opts.forest.nearby(x, z, RADIUS + 1)) {
      const dx = _v.x - t.x, dz = _v.z - t.z, d = Math.hypot(dx, dz), min = t.r + RADIUS;
      if (d < min && d > 1e-4) { _v.x = t.x + (dx / d) * min; _v.z = t.z + (dz / d) * min; moved = true; }
    }
    const airborne = this.jumpT >= 0;
    const gy = heightAt(x, z);
    for (const c of this.player.colliders) {
      if (gy + 1.9 < c.yBottom) continue;
      if (airborne && c.yTop < gy + 1.4) continue;            // cleared it
      const cos = Math.cos(-c.rot), sin = Math.sin(-c.rot);
      const lx = (_v.x - c.x) * cos - (_v.z - c.z) * sin, lz = (_v.x - c.x) * sin + (_v.z - c.z) * cos;
      const ox = c.hw + RADIUS - Math.abs(lx), oz = c.hd + RADIUS - Math.abs(lz);
      if (ox > 0 && oz > 0) {
        let nx = lx, nz = lz;
        if (ox < oz) nx = Math.sign(lx || 1) * (c.hw + RADIUS); else nz = Math.sign(lz || 1) * (c.hd + RADIUS);
        const c2 = Math.cos(c.rot), s2 = Math.sin(c.rot);
        _v.x = c.x + nx * c2 - nz * s2; _v.z = c.z + nx * s2 + nz * c2;
        moved = true;
      }
    }
    return moved;
  }

  /** a low box (fence rail, log) or a sudden dip (a ditch, the brook) 2–4 m ahead: the horse jumps it by itself */
  private obstacleAhead(a: Animal): boolean {
    const sx = Math.sin(this.heading), sz = Math.cos(this.heading);
    const g0 = heightAt(a.position.x, a.position.z);
    for (const d of [2.4, 3.4]) {
      const x = a.position.x + sx * d, z = a.position.z + sz * d;
      const g = heightAt(x, z);
      if (g < g0 - 1.0 && heightAt(x + sx * 2, z + sz * 2) > g + 0.6) return true;   // a ditch with a far bank
      for (const c of this.player.colliders) {
        if (c.yTop > g + 1.35 || c.yTop < g + 0.25) continue;
        const cos = Math.cos(-c.rot), sin = Math.sin(-c.rot);
        const lx = (x - c.x) * cos - (z - c.z) * sin, lz = (x - c.x) * sin + (z - c.z) * cos;
        if (Math.abs(lx) < c.hw + 0.3 && Math.abs(lz) < c.hd + 0.3) return true;
      }
    }
    return false;
  }

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
