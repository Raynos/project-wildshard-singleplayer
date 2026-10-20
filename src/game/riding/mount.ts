import type { Scope } from '@wildshard/engine/app/scope';
import { type RoadXZ, type ReinsFrame, MountedBody, mountedMotorOptions, type MountedWorld } from '@wildshard/game/riding/physics';
import * as THREE from 'three';
import { app } from '@wildshard/engine/app/runtime';
import { Animal } from '@wildshard/engine/entities/AnimalView';
import type { InputService } from '@wildshard/engine/input/InputService';
import type { RideCommandSample } from '@wildshard/engine/input/commands';
import { CharacterMotor } from '@wildshard/engine/physics/CharacterMotor';
import { lockOn } from '@wildshard/engine/player/AimTargets';
import { playerModes } from '@wildshard/engine/player/modes';
import type { LevelContext } from '@wildshard/engine/level/context';
import type { MountProfile, MountActorRef } from '@wildshard/format/riding';
import type { AnimalManager } from '@wildshard/engine/entities/AnimalManager';
import type { Player } from '@wildshard/engine/player/Player';
import { inChunk, waterLevel } from '@wildshard/engine/world/Heightfield';
import type { Interactable } from '@wildshard/engine/world/interact/types';
import { terrainHeight as heightAt } from '@wildshard/engine/world/terrainHeight';
import { Bow } from '@wildshard/game/weapons/Bow';

const enteredMounts = new WeakMap<Scope, Mount>();
/** Borrow the native entered mount without constructing a riding controller. */
export function enteredMount(scope: Scope): Mount | undefined { return scope.disposed ? undefined : enteredMounts.get(scope); }
/** Population reads the actual mount, including before riding is installed. */
export function pageRidingMounted(ctx: Pick<LevelContext, 'scope'>): boolean { return enteredMount(ctx.scope)?.mounted === true; }

export type MountEvent = { kind: 'mount'; horse: string | null } | { kind: 'thrown' } | { kind: 'panic'; horse: string; seconds: number } | { kind: 'bolt'; horse: string; name: string };
interface Mountable { a: Animal; name: string; it: Interactable; restT: number; bolting: boolean; comeT: number; /** its key in the saved names (horseNames.ts) */ key: string }
const EYE = 2.3;                      // rider eye over the ground at horse scale 1 (withers 1.45 + a seated rider)
const LOOK_LIMIT = THREE.MathUtils.degToRad(140), BREAK_LOOK = THREE.MathUtils.degToRad(35);
const MOUNT_T = 0.55;                 // s: the swing up / down
const BOLT_AT = 0.2, REST_TIME = 180, WHISTLE_RANGE = 150;
const RECENTRE = { delaySlow: 1.2, delayFast: 0.8, rate: 1.1, perMs: 0.14, pitch: 0 };
const BOB = { walk: 0.016, trot: 0.032, canter: 0.045, gallop: 0.038, sway: 0.014, rock: 0.022 };
const ROLL_PER_RATE = 0.05;          // rad of roll per rad/s of turn (scaled by speed up to 8 m/s)
const TILT_FOLLOW = 0.3;             // the share of the horse's slope pitch / roll the rider's view takes (a rider balances upright)
const SEAT_TILT = 0.13;
const PANIC_REAR = 0.5;   // s the horse rears first (from a walk or a stand), m/s it bolts at, its whirl (rein ×), the rear knob (higher lifts its neck into the rider's eye)
const _e = new THREE.Euler(0, 0, 0, 'YXZ'), _seat = new THREE.Vector3(), _tilt = new THREE.Euler(0, 0, 0, 'YXZ');
const angDiff = (a: number, b: number): number => Math.atan2(Math.sin(a - b), Math.cos(a - b));
/** Client-only controller; trusted player/actor services bind a data profile and public actions use actor ids. */
export class Mount extends MountedBody {
  horse: Animal | null = null;
  input: InputService | null = null;
  wet = false; blockedAhead = false;
  stampedes: ReadonlySet<string> = new Set();
  private events: MountEvent[] = [];
  drainEvents(): MountEvent[] { const events = this.events; this.events = []; return events; }
  get mounted(): boolean { return this.horse !== null; }
  leanLow = 0;
  touchGallop = false;
  breakRoll = 0; breakShake = 0;
  readonly interactables: Interactable[] = [];
  readonly mountables: Mountable[] = [];
  private readonly player: Player;
  private swingT = 0; private swingDir = 0;
  private readonly swingFrom = new THREE.Vector3();
  private camYaw = 0; private camPitch = 0;   // the view as pose() left it (a change since = the player looked)
  private lookIdle = 0;          // s since the player last looked (the free-look clock)
  private sway = 0;
  private bobPh = 0; private rock = 0; private roll = 0;
  get gallopFloat(): boolean { return this.gait === 'gallop' && Math.cos(this.bobPh) > 0.3; }
  private poseHeading = 0;
  private skidDip = 0;
  private readonly bodyWorld: MountedWorld = {
    get physics() { return app.physics; }, heightAt, waterLevel,
    wetAt: () => this.wet,
    stampede: (owner, horse) => {
      if (!(owner instanceof Animal) || owner === horse) return null;
      return this.stampedes.has(owner.entityId) ? owner : null;
    },
    thrown: () => { this.dismount(true); this.hurt(); },
  };
  private readonly reinsFrame: ReinsFrame;
  private readonly consumedCommand = { steer: { keyX: 0, keyY: 0, stickX: 0, stickY: 0 }, sprint: false, jump: false };
  sampleCommand(): RideCommandSample { return this.consumedCommand; }
  constructor(private readonly ctx: LevelContext, player: Player, private readonly animals: AnimalManager, private readonly opts: MountProfile) {
    super(opts.speeds);
    const previous = enteredMounts.get(ctx.scope); enteredMounts.set(ctx.scope, this);
    ctx.scope.onDispose(() => { if (enteredMounts.get(ctx.scope) === this) { if (previous === undefined) enteredMounts.delete(ctx.scope); else enteredMounts.set(ctx.scope, previous); } });
    this.player = player; this.input = ctx.app.input;
    const p = this.player;
    const makeFrame = (m: Mount): ReinsFrame => {
      const held = (action: 'move.forward' | 'move.back' | 'move.left' | 'move.right', key: string): number => (m.input ? m.input.held(action) : p.keys.has(key)) ? 1 : 0;
      return {
      get forward() { return held('move.forward', 'KeyW') - held('move.back', 'KeyS'); },
      get turn() { return held('move.right', 'KeyD') - held('move.left', 'KeyA'); },
      get touchX() { return p.touchMove.x; }, get touchY() { return p.touchMove.y; },
      get gallop() { return m.input ? m.input.held('ride.gallop') : p.keys.has('ShiftLeft') || p.keys.has('ShiftRight') || m.touchGallop; },
      get jump() { return m.input === null ? p.keys.has('Space') || p.touchJump : m.input.held('jump') || m.input.pressed('jump'); },
      get drawing() { const weapon = m.ctx.app.equipment?.current; return weapon instanceof Bow && (weapon.adsHeld || weapon.drawing); }, get moveScale() { return p.moveScale; },
      get phase() { return m.horse?.gaitPhase ?? 0; }, feet: m.feet,
      get roads() { return m.roadsOverride ?? m.opts.roads; }, inBounds: inChunk,
      refuses: () => m.blockedAhead,
      get wet() { return m.wet || heightAt(m.feet.x, m.feet.z) < waterLevel() - 0.2; },
      };
    };
    this.reinsFrame = makeFrame(this);
  }
  gallopTap(): void { if (this.horse !== null) this.tapQueued = true; }
  private hurt(): void {
    const target = this.ctx.app.player; if (target === null) return;
    this.ctx.app.combat.hit({ source: 'env', sourceTags: ['env.ride'], target, amount: this.opts.thrownDamage,
      point: this.player.position, dir: this.player.velocity,
      cause: { kind: 'env.ride', label: this.opts.thrownLabel, text: this.opts.thrownLabel } });
  }
  setRoads(roads: readonly (readonly RoadXZ[])[] | null): void { this.roadsOverride = roads; }
  private roadsOverride: readonly (readonly RoadXZ[])[] | null = null;
  private actor(ref: MountActorRef): Animal { const id = typeof ref === 'string' ? ref : ref.entityId; const actor = this.animals.animals.find(value => value.entityId === id); if (actor === undefined) throw new Error('Unknown mount actor'); return actor; }
  addMountable(id: MountActorRef, fallback: string, savedKey?: string): void {
    const a = this.actor(id), key = savedKey ?? `${fallback}|${a.kind}:${a.variant}`;
    if (this.mountables.some((m) => m.a === a)) return;
    const name = this.opts.names[key] ?? fallback;
    if (name !== fallback) a.label = name;
    a.mem['owned'] = 1;
    const it: Interactable = { position: a.position, radius: 3.3, label: `Mount ${name}`, onInteract: () => { if (this.horse === a) this.dismount(); else if (this.horse === null) this.mount(a.entityId); } };
    const m: Mountable = { a, name, it, restT: 0, bolting: false, comeT: 0, key };
    this.mountables.push(m);
    this.interactables.push(it);
  }
  removeMountable(id: MountActorRef): void {
    const a = this.actor(id);
    const i = this.mountables.findIndex((m) => m.a === a);
    if (i === -1) return;
    const m = this.mountables[i];
    this.mountables.splice(i, 1);
    if (m !== undefined) { const j = this.interactables.indexOf(m.it); if (j !== -1) this.interactables.splice(j, 1); }
  }
  rename(id: MountActorRef, name: string): void {
    const a = this.actor(id);
    const m = this.mountables.find((x) => x.a === a);
    if (m === undefined || name.length === 0) return;
    m.name = name; a.label = name;
    this.opts.names[m.key] = name;
  }
  nameOf(id: MountActorRef): string | null { return this.mountables.find((x) => x.a.entityId === (typeof id === 'string' ? id : id.entityId))?.name ?? null; }
  canRide(id: MountActorRef): boolean {
    const a = this.actor(id);
    const m = this.mountables.find((x) => x.a === a);
    return a.alive && (m === undefined || (m.restT <= 0 && !m.bolting));
  }
  mount(id: MountActorRef, breaking = false): boolean {
    const a = this.actor(id);
    if (this.horse !== null || !this.canRide(a.entityId)) return false;
    const p = this.player;
    p.setHover(false);
    this.horse = a; p.mountedOn = a;
    this.breaking = breaking;
    a.mem['ridden'] = 1;
    a.setMotion(a.yaw, 0, 2);
    this.heading = a.yaw; this.speed = 0; this.wUp = 0; this.yawRate = 0;
    this.target = 0; this.rateIn = 0; this.turnIn = 0; this.sector = 2; this.jumpQueued = false;
    this.camYaw = p.yaw; this.camPitch = p.pitch; this.lookIdle = 10;   // the first move swings the view round behind the ears
    this.swingFrom.copy(p.camera.position);
    this.swingT = 0; this.swingDir = 1;
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
    playerModes(p).enter('ride', this); // SF34: the platform's ride mode hands the horse the frame
    p.setBodyEnabled(false);   // the on-foot capsule leaves the world while you ride (the horse is the body; Player gates it on `ride`)
    this.events.push({ kind: 'mount', horse: a.entityId });
    return true;
  }
  private settle(): void { this.settleBody(); this.poseHeading = this.heading; }
  dismount(thrown = false): void {
    const a = this.horse;
    if (a === null) return;
    const p = this.player;
    a.position.copy(this.feet);
    a.yaw = this.heading;
    a.driven = false; a.levelGround = false;
    a.yOffset = Math.max(0, this.feet.y - heightAt(this.feet.x, this.feet.z));
    if (this.motor !== null) { this.motor.dispose(); this.motor = null; }
    const side = thrown ? 2.2 : 1.15;
    let x = a.position.x + Math.cos(a.yaw) * side, z = a.position.z - Math.sin(a.yaw) * side;
    if (!inChunk(x, z, 3)) { x = a.position.x - Math.cos(a.yaw) * side; z = a.position.z + Math.sin(a.yaw) * side; }
    p.position.set(x, Math.max(heightAt(x, z), this.onDeck ? this.feet.y : -Infinity), z);
    p.velocity.set(0, 0, 0);
    p.onGround = true;
    playerModes(p).exit('ride');
    p.setBodyEnabled(true);
    this.horse = null; p.mountedOn = null;
    this.breaking = false; this.breakRoll = 0; this.breakShake = 0;
    a.mem['ridden'] = 0;
    a.setMotion(a.yaw, 0, 2);
    a.mem['rear'] = 0; a.mem['buck'] = 0; a.mem['turnLead'] = 0;
    this.gait = 'stand';
    if (thrown) this.events.push({ kind: 'thrown' });
    this.events.push({ kind: 'mount', horse: null });
  }
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
  whistle(): Animal | null {
    if (this.horse !== null) return null;
    const p = this.player.position;
    let best: Mountable | null = null, bd = WHISTLE_RANGE;
    for (const m of this.mountables) {
      if (!this.canRide(m.a.entityId) || (m.a.mem['whistle'] ?? 0) === 0) continue;   // only a bonded horse answers (mem.whistle = 1)
      const d = m.a.position.distanceTo(p);
      if (d < bd) { bd = d; best = m; }
    }
    if (best === null) return null;
    best.comeT = 30;
    return best.a;
  }
  panic(x: number, z: number, secs: number): boolean {
    const a = this.horse;
    if (a === null || this.breaking) return false;
    const fresh = this.panicT <= 0;
    this.panicT = Math.max(this.panicT, secs);
    this.panicYaw = Math.atan2(this.feet.x - x, this.feet.z - z);
    if (fresh && Math.abs(this.speed) < 3) this.panicRear = PANIC_REAR;
    this.skidT = 0; this.spur.reset();
    this.jolt = Math.max(this.jolt, 0.7);
    if (fresh) this.events.push({ kind: 'panic', horse: a.entityId, seconds: secs });
    return true;
  }
  drive(dt: number): void {
    const a = this.horse, p = this.player;
    if (a === null) { playerModes(p).exit('ride'); return; }
    if (!a.alive || a.hidden) { this.dismount(true); return; }
    if (Math.abs(angDiff(p.yaw, this.camYaw)) > 1e-4 || Math.abs(p.pitch - this.camPitch) > 1e-4) this.lookIdle = 0;
    else this.lookIdle += dt;
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
  step(dt: number): void {
    const a = this.horse;
    if (a !== null) this.stepBody(dt, a, this.player, this.bodyWorld);
  }
  pose(dt: number, alpha: number): void {
    const a = this.horse, p = this.player;
    if (a === null) return;
    const locked = lockOn.state === 'locked';
    const heading = this.placeRider(dt, alpha, a, p, this.bodyWorld), px = a.position.x, pz = a.position.z;
    const sp = Math.abs(this.speed);
    const dHead = angDiff(heading, this.poseHeading);
    this.poseHeading = heading;
    if (!locked) {
      p.yaw += dHead;
      const moving = sp > 0.6 && !this.breaking;
      const delay = THREE.MathUtils.lerp(RECENTRE.delaySlow, RECENTRE.delayFast, Math.min(1, sp / this.opts.speeds.gallop)) * (this.turnIn !== 0 ? 0.6 : 1);
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
    this.roll += ((-this.yawRate * Math.min(1, sp / 8)) * ROLL_PER_RATE - this.roll) * Math.min(1, dt * 4);
    this.skidDip += ((this.skidT > 0 ? 1 : 0) - this.skidDip) * Math.min(1, dt * 6);   // B1: thrown forward in the skid
    const lowT = this.galloping && this.speed > 11 && !this.drawing ? 1 : 0;
    this.leanLow += (lowT - this.leanLow) * Math.min(1, dt * 3);
    this.jolt = Math.max(0, this.jolt - dt * 2.5);
    const jolt = this.jolt > 0 ? (Math.random() - 0.5) * this.jolt * 0.06 : 0;
    const scale = a.scale;
    const fwdOff = -0.04 - 0.06 * this.leanLow, eye = EYE * scale - 0.08 * this.leanLow;   // low over the neck, not into it
    const cam = p.camera;
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
    _e.set(p.pitch + this.rock - SEAT_TILT - 0.03 * this.leanLow - 0.06 * this.skidDip + shake * 0.4 - hm.x * TILT_FOLLOW, p.yaw, this.roll + this.breakRoll + jolt * 2 - hm.z * TILT_FOLLOW, 'YXZ');
    cam.rotation.copy(_e);
  }
  private land(): void { this.landBody(this.bodyWorld); }
  update(dt: number): void {
    const p = this.player.position;
    for (const m of this.mountables) {
      const a = m.a;
      if (!a.alive) continue;
      if (!m.bolting && m.restT <= 0 && a.hp < a.maxHp * BOLT_AT) {
        m.bolting = true; m.comeT = 0;
        if (this.horse === a) { this.dismount(true); this.hurt(); }
        a.mem['rear'] = 1;
        this.events.push({ kind: 'bolt', horse: a.entityId, name: m.name });
      }
      if (m.bolting) {
        a.mem['rear'] = Math.max(0, (a.mem['rear'] ?? 0) - dt * 1.2);
        const r = this.opts.restAt;
        const tx = r?.x ?? a.position.x, tz = r?.z ?? a.position.z;
        const d = Math.hypot(tx - a.position.x, tz - a.position.z);
        if (d > 3 && r !== undefined) { a.state = 'flee'; a.setMotion(Math.atan2(tx - a.position.x, tz - a.position.z), d > 20 ? this.opts.speeds.gallop * 0.9 : this.opts.speeds.trot, 2); }
        else { m.bolting = false; m.restT = REST_TIME; a.setMotion(a.yaw, 0, 1); a.state = 'graze'; }
      } else if (m.restT > 0) {
        m.restT -= dt;
        a.state = 'graze';
        if (m.restT <= 0) a.hp = a.maxHp;
      } else if (this.horse !== a && m.comeT > 0) {
        m.comeT -= dt;
        const d = Math.hypot(p.x - a.position.x, p.z - a.position.z);
        if (d > 3.2) { a.state = d > 12 ? 'flee' : 'wander'; a.setMotion(Math.atan2(p.x - a.position.x, p.z - a.position.z), d > 25 ? this.opts.speeds.gallop * 0.85 : d > 8 ? this.opts.speeds.canter * 0.7 : this.opts.speeds.walk, 2.5); }
        else { m.comeT = 0; a.setMotion(Math.atan2(p.x - a.position.x, p.z - a.position.z), 0, 2); a.state = 'idle'; a.mem['toss'] = 1; }
      } else if (this.horse !== a) {
        if (a.speed < 0.1) a.state = Math.sin(performance.now() * 0.0002 + a.seed * 9) > 0.1 ? 'graze' : 'idle';
        a.lookTarget.copy(p); a.lookWeight = a.position.distanceTo(p) < 6 && a.state !== 'graze' ? 0.6 : 0;
      }
      m.it.label = this.horse === a ? 'Dismount' : m.restT > 0 || m.bolting ? `${m.name} is resting` : `Mount ${m.name}`;
      m.it.radius = this.horse === a ? 3.6 : m.restT > 0 || m.bolting ? 0 : 3.3;
    }
  }
}
