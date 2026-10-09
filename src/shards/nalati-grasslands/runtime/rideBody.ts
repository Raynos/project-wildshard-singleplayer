import * as THREE from 'three';
import * as v from 'valibot';
import type { AnimalSim } from '@wildshard/engine/entities/AnimalSim';
import type { CharacterMotor, MotorOptions } from '@wildshard/engine/physics/CharacterMotor';
import type { Physics } from '@wildshard/engine/physics/Physics';
import { castRay, floorBelow } from '@wildshard/engine/physics/query';
import { tagOf } from '@wildshard/engine/physics/surface';
import { MountedReins, type HorseSpeeds } from './rideReins';

/** Explicit world queries and contact classification, shared by the page and trusted native host. */
export interface MountedWorld {
  readonly physics: Physics | null;
  readonly heightAt: (x: number, z: number) => number;
  readonly waterLevel: () => number;
  readonly wetAt: ((x: number, z: number) => boolean) | undefined;
  readonly stampede: (owner: unknown, horse: AnimalSim) => AnimalSim | null;
  readonly thrown: () => void;
}
/** Physical rider outputs; camera, HUD and equipment stay with presentation. */
export interface MountedRider {
  readonly position: THREE.Vector3; readonly velocity: THREE.Vector3;
  onGround: boolean; sprinting: boolean; crouching: boolean; speedFactor: number;
}
const STEED_MAX = 100, STEED_GALLOP = 12, STEED_WALK = 15, STEED_CANTER = 5;
const BODY = { length: 2.4, radius: 0.42, step: 0.45, snap: 0.5, kg: 450 };
const CLIMB = { walk: 47, gallop: 35 };   // degrees: the steepest ground climbed at a walk → at a full gallop (between: by speed)
const GRAVITY = 19.7, JUMP_V = 7.7;       // m/s², m/s: a 1.5 m arc over 0.78 s (clears the corral's 1.3 m rail)
const JUMP_APEX_T = JUMP_V / GRAVITY;     // s to the top of the arc (the auto jump takes off this far out, in time)
const JOSTLE_CD = 0.45, UNSEAT_CLOSING = 9;
const TURN_EASE = 4.5;               // 1/s: the turn's rate eases toward the rein (~0.22 s) — no snap, and the head leads it
const ACCEL = 3.6, ACCEL_HI = 2.2, COAST = 3.2, REIN = 8;   // m/s²: speeding up (the gallop's last gear slower), letting go, reining back
const SKID = 16, SKID_REAR = 0.28;   // m/s it starts from, m/s² it stops at, s at most, the pivot's rein ×
const STEED_RHYTHM = 2;              // STEED/s a gallop held by the rhythm costs (a held GALLOP: STEED_GALLOP)
const FORD_DEPTH = 0.95;             // m of water a horse wades before it swims (its back stays dry)               // rad the saddle view looks down past the player's pitch
const angDiff = (a: number, b: number): number => Math.atan2(Math.sin(a - b), Math.cos(a - b));
const PANIC_REAR_POSE = 0.45;
const WORLD = ['WORLD'] as const, CREATURE = ['CREATURE'] as const;
const _from = { x: 0, y: 0, z: 0 }, _dir = { x: 0, y: 0, z: 0 }, _want = { x: 0, y: 0, z: 0 };

const num = v.pipe(v.number(), v.finite()), point = v.tuple([num, num, num]);
const BodyState = v.strictObject({ version: v.literal(1), reins: v.unknown(), feet: point, prevFeet: point,
  prevHeading: num, yawRate: num, vy: num, onDeck: v.boolean(), swimming: v.boolean(), airT: num,
  blockedT: v.pipe(num, v.minValue(0)), shoveX: num, shoveZ: num, jostleCd: v.pipe(num, v.minValue(0)),
  eyeY: num, bobY: num, gait: v.picklist(['stand', 'walk', 'trot', 'canter', 'gallop']),
  jostles: v.pipe(num, v.integer(), v.minValue(0)), thrownBy: v.nullable(v.literal('stampede')) });

/** The shipping lying PLAYER capsule, including its native deck weight and gait-dependent slope rule. */
export function mountedMotorOptions(scale: number, owner: AnimalSim): MotorOptions {
  return { radius: BODY.radius * scale, height: BODY.radius * 2 * scale, length: BODY.length * scale,
    step: BODY.step * scale, maxClimbDeg: CLIMB.walk, snap: BODY.snap, group: 'PLAYER',
    blockedBy: ['WORLD', 'CREATURE', 'ITEM'], owner, weight: BODY.kg };
}

/** All scalar history needed by the physical motor and rider projection; the capsule belongs to native continuation. */
export interface MountedBodyState {
  readonly version: 1; readonly reins: ReturnType<MountedReins['snapshot']>;
  readonly feet: number[]; readonly prevFeet: number[];
  readonly prevHeading: number; readonly yawRate: number; readonly vy: number;
  readonly onDeck: boolean; readonly swimming: boolean; readonly airT: number; readonly blockedT: number;
  readonly shoveX: number; readonly shoveZ: number; readonly jostleCd: number;
  readonly eyeY: number; readonly bobY: number; readonly gait: 'stand' | 'walk' | 'trot' | 'canter' | 'gallop';
  readonly jostles: number; readonly thrownBy: string | null;
}
/** The actual shipping mounted motor law, renderer-free; its native resources are explicitly installed by the caller. */
export class MountedBody extends MountedReins {

  gait: 'stand' | 'walk' | 'trot' | 'canter' | 'gallop' = 'stand';
  jostles = 0; thrownBy: string | null = null;
  motor: CharacterMotor | null = null;
  readonly feet = new THREE.Vector3(); readonly prevFeet = new THREE.Vector3();
  prevHeading = 0; yawRate = 0; vy = 0; onDeck = false; swimming = false;
  airT = -1; blockedT = 0; shoveX = 0; shoveZ = 0; jostleCd = 0;
  eyeY = 0; bobY = 0;
  private readonly vel = new THREE.Vector3();
  private contactHorse: AnimalSim | null = null; private contactWorld: MountedWorld | null = null;
  private contactHit: AnimalSim | null = null;
  private contactResult(): AnimalSim | null { return this.contactHit; }
  private readonly contact: Parameters<CharacterMotor['touching']>[2] = c => {
    const world = this.contactWorld, a = this.contactHorse;
    if (world === null || a === null) return true;
    const o = world.stampede(tagOf(c)?.owner, a);
    if (o === null) return true;
    this.contactHit = o; return false;
  };
  constructor(private readonly bodySpeeds: HorseSpeeds) { super(bodySpeeds); }

  /** Scalar continuation; the native capsule is captured separately and reconnected after world replacement. */
  snapshotBody(): MountedBodyState {
    return { version: 1 as const, reins: this.snapshot(), feet: this.feet.toArray(), prevFeet: this.prevFeet.toArray(),
      prevHeading: this.prevHeading, yawRate: this.yawRate, vy: this.vy, onDeck: this.onDeck, swimming: this.swimming,
      airT: this.airT, blockedT: this.blockedT, shoveX: this.shoveX, shoveZ: this.shoveZ, jostleCd: this.jostleCd,
      eyeY: this.eyeY, bobY: this.bobY, gait: this.gait, jostles: this.jostles, thrownBy: this.thrownBy };
  }
  /** Refuse malformed history atomically, before changing any live reins or feet. */
  restoreBody(value: unknown): void {
    const s = v.parse(BodyState, value), checked = new MountedReins(this.bodySpeeds);
    checked.restore(s.reins);
    this.restore(s.reins); this.feet.fromArray(s.feet); this.prevFeet.fromArray(s.prevFeet);
    this.prevHeading = s.prevHeading; this.yawRate = s.yawRate; this.vy = s.vy; this.onDeck = s.onDeck; this.swimming = s.swimming;
    this.airT = s.airT; this.blockedT = s.blockedT; this.shoveX = s.shoveX; this.shoveZ = s.shoveZ; this.jostleCd = s.jostleCd;
    this.eyeY = s.eyeY; this.bobY = s.bobY; this.gait = s.gait; this.jostles = s.jostles; this.thrownBy = s.thrownBy;
  }

  settleBody(): void {
    const m = this.motor;
    if (m !== null) {
      m.release();
      // a capsule lying level on a slope digs its uphill end in: lift it clear (gravity sets it down on the next steps)
      const y0 = this.feet.y;
      let free = false;
      let up = 0;
      for (let i = 0; i < 9; i++) {
        if (free) break;
        this.feet.y = y0 + up; free = m.setYaw(this.feet, this.heading); up += 0.1;
      }
      // standing in something (the hitching rail at the camp horse's nose): back out along the heading, up to 2 m
      const bx = -Math.sin(this.heading), bz = -Math.cos(this.heading);
      for (let i = 0; i < 14; i++) {
        if (free) break;
        this.feet.x += bx * 0.15; this.feet.z += bz * 0.15; this.feet.y = y0;
        free = m.setYaw(this.feet, this.heading);
      }
    }
    this.vy = 0; this.grounded = true; this.airT = -1;
    this.prevFeet.copy(this.feet); this.prevHeading = this.heading;
  }
  landBody(world: MountedWorld): void {
    const f = this.feet, physics = world.physics, heightAt = world.heightAt;
    if (physics === null) return;
    const top = floorBelow(physics, f.x, f.z, f.y + 2.5, 2.6, this.motor?.collider);
    if (top !== undefined && top > f.y) { f.y = top; this.onDeck = top - heightAt(f.x, f.z) > 0.3; }
  }
  private obstacleAhead(world: MountedWorld, scale: number): boolean {
    const physics = world.physics, m = this.motor;
    if (physics === null || m === null) return false;
    const f = this.feet, s = scale;
    const sx = Math.sin(this.heading), sz = Math.cos(this.heading);
    const reach = this.speed * JUMP_APEX_T;               // the centre is over the obstacle at the top of the arc
    _dir.x = sx; _dir.y = 0; _dir.z = sz;
    _from.x = f.x; _from.y = f.y + 0.7 * s; _from.z = f.z;
    const low = castRay(physics, _from, _dir, reach + 0.6, WORLD, m.collider);
    if (low !== null && low.material !== 'ground' && Math.abs(low.normal.y) < 0.5 && low.distance > reach - 0.9) {
      _from.y = f.y + 1.75 * s;
      const high = castRay(physics, _from, _dir, low.distance + 1.2, WORLD, m.collider);
      const land = floorBelow(physics, f.x + sx * (low.distance + 2.2), f.z + sz * (low.distance + 2.2), f.y + 2.5, 5, m.collider);
      return high === null && land !== undefined;
    }
    // a ditch / the brook: the ground drops a metre 2.4–3.4 m ahead and rises again 2 m past it
    for (let i = 0; i < 2; i++) {
      const d = i === 0 ? 2.4 : 3.4;
      const x = f.x + sx * d, z = f.z + sz * d;
      const g = floorBelow(physics, x, z, f.y + 1, 6, m.collider);
      if (g === undefined || g > f.y - 1.0) continue;
      const far = floorBelow(physics, x + sx * 2, z + sz * 2, f.y + 2, 8, m.collider);
      if (far !== undefined && far > g + 0.6) return true;
    }
    return false;
  }
  stepBody(dt: number, a: AnimalSim, p: MountedRider, world: MountedWorld): void {
    const HORSE_SPEED = this.bodySpeeds, heightAt = world.heightAt, waterLevel = world.waterLevel;
    const f = this.feet;
    this.prevFeet.copy(f); this.prevHeading = this.heading;
    // ── turning: the rate eases toward the rein; the body turns only where its nose and rump have room ──
    this.yawRate += (this.rateIn * this.maxRate() - this.yawRate) * Math.min(1, dt * TURN_EASE);
    let heading = this.breaking ? a.yaw : this.heading + this.yawRate * dt;   // the bucking spins the horse itself (Taming)
    heading = Math.atan2(Math.sin(heading), Math.cos(heading));
    if (heading !== this.heading) {
      if (this.motor === null || this.motor.setYaw(f, heading)) this.heading = heading;
      else this.yawRate = 0;                                                    // boxed in: the turn is refused
    }
    // inertia: speeding up takes its time (a canter in ~2.5 s, the gallop's last gear slower); letting go coasts down,
    // the reins (back) stop it in a couple of lengths
    const accel = this.target > this.speed ? (this.speed > HORSE_SPEED.canter - 0.5 ? ACCEL_HI : ACCEL) : this.skidT > 0 ? SKID : this.sector === -1 || this.target < 0 ? REIN : COAST;
    // B1: the skid — the haunches down (the rear knob), until the horse stands
    if (this.skidT > 0) this.skidT = this.speed < 0.6 ? 0 : Math.max(0, this.skidT - dt);
    this.speed += THREE.MathUtils.clamp(this.target - this.speed, -accel * dt, accel * dt);
    // ── the jump: Space, or by itself at a canter+ over a rail / log / the brook a jump's reach ahead ──
    const wantJump = this.jumpQueued || (this.speed > 6 && this.grounded && this.obstacleAhead(world, a.scale));
    this.jumpQueued = false;
    if (wantJump && this.grounded && !this.breaking && !this.swimming) { this.vy = JUMP_V; this.grounded = false; this.airT = 0; }
    // on the ground no push down into it (the capsule's long flat underside snags on the ground's own contact if it
    // is pressed into it every step — the snap to ground takes it down slopes); in the air, gravity
    if (!this.grounded || this.vy > 0) this.vy -= GRAVITY * dt;
    // ── R3: the herd's shove fades ──
    const fade = Math.exp(-dt * 5);
    this.shoveX *= fade; this.shoveZ *= fade; this.jostleCd = Math.max(0, this.jostleCd - dt);
    // ── the move: the horse's climb limit by gait (47° at a walk → 35° at a gallop), then the motor ──
    const sx = Math.sin(this.heading), sz = Math.cos(this.heading);
    _want.x = (sx * this.speed + this.shoveX) * dt; _want.y = this.vy * dt; _want.z = (sz * this.speed + this.shoveZ) * dt;
    const m = this.motor;
    let grounded: boolean, freedom = 1;
    if (m !== null) {
      // by the gait the reins ask for (or the speed still carried): held at a gallop, a 40° bank stays refused — rein in
      // to a walk and the horse picks its way up
      const climbV = Math.max(Math.abs(this.speed), Math.abs(this.target));
      m.setClimb(THREE.MathUtils.lerp(CLIMB.walk, CLIMB.gallop, THREE.MathUtils.clamp((climbV - HORSE_SPEED.walk) / (HORSE_SPEED.gallop - HORSE_SPEED.walk), 0, 1)));
      const carried = this.grounded && m.carry(f);   // a deck that moves (none on Nalati yet): ride it first
      if (carried && this.vy <= 0) _want.y = 0;
      const r = m.move(f, _want, false);
      grounded = r.grounded; freedom = r.horizontalFreedom;
    } else {
      // no physics world (a node harness): the old ground follow, nothing stops it
      f.x += _want.x; f.z += _want.z; f.y = heightAt(f.x, f.z); grounded = true;
    }
    // on a deck: standing on a registered collider over the terrain (the Kunes bridge, a yurt's floor) — every Nalati
    // floor is real geometry since NALATI-MERGE P1, so the motor carries the horse on it (no floor functions left)
    this.onDeck = grounded && f.y - heightAt(f.x, f.z) > 0.3;
    // swimming: deeper than FORD_DEPTH the horse floats with its back dry (fording stays game code)
    const wl = waterLevel();
    this.swimming = f.y < wl - FORD_DEPTH && (world.wetAt?.(f.x, f.z) === true || heightAt(f.x, f.z) < wl);
    if (this.swimming) { f.y = wl - FORD_DEPTH; grounded = true; }
    // on a structure (a bridge deck, floor function or collider): the terrain under it is not what the hooves stand on, so
    // the body must not tilt to it — the Kunes bridge spans a gully and the horse pitched ~20° to the bank below, which
    // swung the seat (and the eye) forward over the neck: no head or ears in the frame on the bridge (NALATI-MERGE H4)
    a.levelGround = this.onDeck || f.y - heightAt(f.x, f.z) > 0.3;
    if (grounded && this.vy <= 0) {
      if (this.airT >= 0) this.bobY -= 0.12;                                     // the landing
      this.vy = 0; this.airT = -1;
    } else if (this.airT >= 0) this.airT += dt;
    this.grounded = grounded;
    // run into a wall: the gait drops to what the body actually made (no galloping in place against a fence) — once it
    // has held for a few steps, so one snag on a stone doesn't rein the horse in
    this.blockedT = freedom < 0.5 && Math.abs(this.speed) > 0.5 ? this.blockedT + dt : 0;
    if (this.blockedT > 0.06) {
      const made = Math.hypot(f.x - this.prevFeet.x, f.z - this.prevFeet.z) / dt;
      this.speed = Math.sign(this.speed) * Math.min(Math.abs(this.speed), made);
    }
    // ── R3: a stampeding horse against the rider: jostled; at a gallop, a hard hit throws you ──
    if (m !== null && this.jostleCd <= 0) {
      this.contactHorse = a; this.contactWorld = world; this.contactHit = null;
      try { m.touching(0.3, CREATURE, this.contact); }
      finally { this.contactHorse = null; this.contactWorld = null; }
      const hit = this.contactResult();
      if (hit !== null && this.jostleBody(hit)) { world.thrown(); return; }
    }
    // ── the horse follows exactly (Animal skips its own steering while driven; pose() places it) ──
    a.setMotion(this.heading, this.speed, 50);
    a.speed = this.speed;
    a.state = this.speed > 6 ? 'flee' : Math.abs(this.speed) > 0.2 ? 'wander' : 'idle';
    // the rear knob is a LEVEL (horse.ts eases toward it) and Mount owns it while you ride: the jump's take-off, the skid
    // sitting the horse back, the panic's first half-second — else 0. E320: the skid and the panic only ever raised it, so
    // after one the neck stood up in front of the rider's eye for good (the "cursed", face-on horse on the horse track)
    if (this.airT >= 0) {
      const u = this.airT / (2 * JUMP_APEX_T);
      a.mem['rear'] = u < 0.35 ? 0.35 : 0;
      if (u > 0.6 && u < 0.65) a.mem['kick'] = 1;
    } else if (!this.breaking) a.mem['rear'] = this.panicRear > 0 ? PANIC_REAR_POSE : this.skidT > 0 ? SKID_REAR : 0;
    // ── STEED ──
    this.gait = this.speed < 0.3 ? 'stand' : this.speed < 3 ? 'walk' : this.speed < 6.5 ? 'trot' : this.speed < 11 ? 'canter' : 'gallop';
    const rhythm = this.spur.latched;   // B1: a gallop the rhythm holds is almost free
    this.steed = THREE.MathUtils.clamp(this.steed + dt * (this.galloping && this.speed > 9 ? -(rhythm ? STEED_RHYTHM : STEED_GALLOP) : this.gait === 'canter' ? STEED_CANTER : STEED_WALK), 0, STEED_MAX);
    // ── the rider rides along: the carrier velocity for the bow, no walk of his own ──
    this.vel.set(sx * this.speed, this.vy, sz * this.speed);
    p.velocity.copy(this.vel);
    p.onGround = true; p.sprinting = this.speed > 10; p.crouching = false; p.speedFactor = 0;
  }
  jostleBody(o: AnimalSim): boolean {
    this.jostleCd = JOSTLE_CD; this.jostles++;
    const ox = Math.sin(o.yaw) * o.speed, oz = Math.cos(o.yaw) * o.speed;
    const mx = Math.sin(this.heading) * this.speed, mz = Math.cos(this.heading) * this.speed;
    const closing = Math.hypot(ox - mx, oz - mz);
    let nx = this.feet.x - o.position.x, nz = this.feet.z - o.position.z;
    const l = Math.hypot(nx, nz) || 1; nx /= l; nz /= l;
    const k = Math.min(3.5, 0.8 + closing * 0.25);
    this.shoveX = nx * k + (ox - mx) * 0.15; this.shoveZ = nz * k + (oz - mz) * 0.15;
    this.jolt = Math.max(this.jolt, Math.min(1, 0.3 + closing / 14));
    this.speed *= 0.92;
    if (this.gait === 'gallop' && closing >= UNSEAT_CLOSING) {
      this.thrownBy = 'stampede';
      return true;
    }
    return false;
  }
  /** The shipping feet/eye-height projection, called once after fixed motion; it owns no camera or renderer. */
  placeRider(dt: number, alpha: number, a: AnimalSim, p: Pick<MountedRider, 'position'>, world: MountedWorld): number {
    const t = THREE.MathUtils.clamp(alpha, 0, 1);
    const pf = this.prevFeet, f = this.feet;
    const glide = pf.distanceToSquared(f) < 25;   // a teleport is not a glide
    const px = glide ? pf.x + (f.x - pf.x) * t : f.x, pz = glide ? pf.z + (f.z - pf.z) * t : f.z;
    let py = glide ? pf.y + (f.y - pf.y) * t : f.y;
    const heading = glide ? this.prevHeading + angDiff(this.heading, this.prevHeading) * t : this.heading;
    // the hooves on the ground: the capsule rides on its lowest point, so on a slope its middle floats a little — draw the
    // horse on the floor under its middle (a physics query; decks and the jump keep the body's own height)
    const physics = world.physics;
    if (this.grounded && !this.onDeck && !this.swimming && this.airT < 0 && physics !== null && this.motor !== null) {
      const fl = floorBelow(physics, px, pz, py + 0.3, 0.9, this.motor.collider);
      if (fl !== undefined && fl < py) py = fl;
    }
    if (this.airT >= 0) this.eyeY = py; else this.eyeY += (py - this.eyeY) * Math.min(1, dt * 12);
    a.position.set(px, this.eyeY, pz);
    a.yaw = heading;
    p.position.set(px, this.eyeY, pz);
    return heading;
  }
}
