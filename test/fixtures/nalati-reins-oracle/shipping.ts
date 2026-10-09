import * as THREE from 'three';
import { RhythmSpur, roadSteer, SPUR_WINDOW } from '../../../src/shards/nalati-grasslands/ride/rideAssist';
import type { ReinsFrame, HorseSpeeds } from '../../../src/shards/nalati-grasslands/runtime/rideReins';
const SECTOR = 0.38;                 // the stick's forward / back sectors: |y| > 0.38 × its length (~67° either side of up / down)
const PIVOT_SPEED = 0.6, BACK_SPEED = 1.1;   // m/s: the stick beside you from a stand (a turn on the spot), reining back
/** rad/s turn at full rein per gait (between them it blends by speed) — at a gallop 0.62 rad/s = a ~21 m radius */
const TURN = { stand: 1.5, walk: 1.35, trot: 1.1, canter: 0.85, gallop: 0.62 };
const DRAW_TURN = 0.6;               // the rein's turn while you draw (a steadier line to shoot from)
const SKID_MIN = 7, SKID_TIME = 1.2, SKID_TURN = 1.6;
const PANIC_SPEED = 9.5, PANIC_TURN = 2;
const ROAD_TURN = 2.2, STEED_RESUME = 25;

const angDiff = (a: number, b: number): number => Math.atan2(Math.sin(a - b), Math.cos(a - b));
export class ShippingReins {
  steed = 100; winded = false; breaking = false;
  heading = 0; speed = 0; wUp = 0; grounded = true;
  target = 0; rateIn = 0; turnIn = 0; sector = 2;
  galloping = false; drawing = false; jumpWas = false; jumpQueued = false;
  cruise = 0; gallopWas = false; tapQueued = false; clock = 0; lastPhase = 0; strideHz = 2;
  sectorWas = 2; skidT = 0; panicT = 0; panicRear = 0; panicYaw = 0; jolt = 0;
  onRoad = false; beat = false; spurFlash = 0; touchGallop = false;
  readonly spur = new RhythmSpur();
  get turnLead(): number { return this.a.mem.turnLead; }
  private readonly p;
  private readonly a;
  private readonly k;
  private readonly input;
  private readonly opts;
  private readonly feet;
  private readonly roadsOverride = null;
  private readonly refuse;
  constructor(private readonly frame: ReinsFrame, private readonly HORSE_SPEED: HorseSpeeds) {
    const keys = new Set<string>();
    this.k = keys;
    this.p = { touchMove: { get x() { return frame.touchX; }, get y() { return frame.touchY; } },
      get moveScale() { return frame.moveScale; }, get touchJump() { return frame.jump; }, set touchJump(_v: boolean) {} };
    this.a = { get gaitPhase() { return frame.phase; }, mem: { turnLead: 0 }, lookWeight: 0 };
    this.input = { held: (action: string): boolean => action === 'move.forward' ? frame.forward > 0 : action === 'move.back' ? frame.forward < 0 : action === 'move.right' ? frame.turn > 0 : action === 'move.left' ? frame.turn < 0 : action === 'ride.gallop' ? frame.gallop : false };
    this.opts = { get roads() { return frame.roads; } }; this.feet = frame.feet; this.refuse = frame.refuses;
  }
  read(dt: number): void {
    const p = this.p, a = this.a, k = this.k, drawing = this.frame.drawing, HORSE_SPEED = this.HORSE_SPEED;
    const inChunk = this.frame.inBounds;
    const wildEnv = { wetAt: (_x: number, _z: number) => this.frame.wet };
    const heightAt = (_x: number, _z: number) => 0, waterLevel = () => -1;
// BEGIN SHIPPING REINS
    const held = (action: 'move.forward' | 'move.back' | 'move.left' | 'move.right', key: string): number => (this.input ? this.input.held(action) : k.has(key)) ? 1 : 0;
    const fwdK = held('move.forward', 'KeyW') - held('move.back', 'KeyS'), strK = held('move.right', 'KeyD') - held('move.left', 'KeyA');
    const tx = p.touchMove.x, ty = p.touchMove.y, stick = Math.hypot(tx, ty);
    const turnIn = THREE.MathUtils.clamp(strK + tx, -1, 1);
    const gallopKey = this.input ? this.input.held('ride.gallop') : k.has('ShiftLeft') || k.has('ShiftRight') || this.touchGallop;
    this.wUp = fwdK > 0 ? this.wUp + dt : 0;
    // the stick's sector (8 ways): ahead (within ~67° of up) = go, the gait by how far it is pushed; beside = a collected
    // turn (at most a trot; a pivot on the spot from a stand); behind = rein in, then back up
    const sector = stick > 0.1 ? (ty > SECTOR * stick ? 1 : ty < -SECTOR * stick ? -1 : 0) : fwdK !== 0 ? fwdK : strK !== 0 ? 0 : 2;
    let target = 0;
    if (sector === 1) target = stick > 0.1 ? (stick < 0.45 ? HORSE_SPEED.walk : stick < 0.85 ? HORSE_SPEED.trot : HORSE_SPEED.canter) : this.wUp < 0.9 ? HORSE_SPEED.trot : HORSE_SPEED.canter;
    else if (sector === 0) target = THREE.MathUtils.clamp(this.speed, PIVOT_SPEED, HORSE_SPEED.trot);
    else if (sector === -1) target = this.speed > 0.5 ? 0 : -BACK_SPEED * (stick > 0.1 ? Math.min(1, -ty / 0.8) : 1);
    if (sector === 1) this.cruise = target; else if (sector === -1) this.cruise = 0;   // B1: the gait a road keeps
    if (this.steed <= 0) this.winded = true;
    if (this.winded && this.steed >= STEED_RESUME) this.winded = false;
    // ── B1: the rhythm spur — a GALLOP press scored against the stride (the horse's gait phase; 0 = the downbeat) ──
    this.clock += dt;
    const ph = a.gaitPhase, dph = (ph - this.lastPhase + 1) % 1;
    if (dt > 0 && dph < 0.5) this.strideHz += (dph / dt - this.strideHz) * Math.min(1, dt * 6);
    this.lastPhase = ph;
    const canSpur = this.speed > 6 && sector !== -1 && !this.winded && !this.breaking && this.panicT <= 0;
    const press = this.tapQueued || (gallopKey && !this.gallopWas);
    this.tapQueued = false;
    this.gallopWas = gallopKey;
    this.spur.update(dt);
    if (!canSpur && this.speed < 5) this.spur.reset();
    if (press && canSpur && this.spur.tap(this.clock, ph, 1 / Math.max(0.5, this.strideHz)) === 'good') this.spurFlash++;
    this.beat = canSpur && Math.min(ph, 1 - ph) < SPUR_WINDOW;
    const galloping = (gallopKey || this.spur.latched) && sector !== -1 && !this.winded && !this.breaking;
    if (galloping) target = HORSE_SPEED.gallop * this.spur.boost;
    // ── B1: the skid stop — the reins pulled back at a canter or faster ──
    if (sector === -1 && this.sectorWas !== -1 && this.speed > SKID_MIN && this.grounded && !this.breaking) {
      this.skidT = SKID_TIME; this.jolt = Math.max(this.jolt, 0.35);
    }
    if (sector !== -1) this.skidT = 0;
    this.sectorWas = sector;
    // ── B1: keep to the road — the stick let go on a road: the gait held (GALLOP gallops it), the reins along the road ──
    let turnSteer = turnIn;
    this.onRoad = false;
    const roads = this.roadsOverride ?? this.opts.roads;
    if (roads !== undefined && sector === 2 && !this.breaking && p.moveScale !== 0 && (this.speed > HORSE_SPEED.walk * 0.8 || galloping)) {
      const r = roadSteer(roads, this.feet.x, this.feet.z, this.heading, 5 + Math.abs(this.speed) * 0.9);
      if (r !== null) {
        this.onRoad = true;
        if (!galloping) target = Math.max(this.cruise, HORSE_SPEED.walk);
        turnSteer = THREE.MathUtils.clamp(-angDiff(r.yaw, this.heading) * ROAD_TURN, -1, 1);
      }
    }
    // ── B1: the panic — rear (from a stand), then bolt away from the scare, deaf to the reins ──
    if (this.panicT > 0) {
      this.panicT = Math.max(0, this.panicT - dt); this.panicRear = Math.max(0, this.panicRear - dt);
      target = this.panicRear > 0 ? 0 : PANIC_SPEED;
      turnSteer = THREE.MathUtils.clamp(-angDiff(this.panicYaw, this.heading) * 2.5, -1, 1);
    }
    if (this.breaking || p.moveScale === 0) target = 0;                       // the bucking rounds; a boss intro locks the reins
    // (steep ground is the motor's: the horse's climb limit by gait, in step)
    const ahead = 2 + this.speed * 0.4;
    const ax = this.feet.x + Math.sin(this.heading) * ahead, az = this.feet.z + Math.cos(this.heading) * ahead;
    if (!inChunk(ax, az, 6)) target = Math.min(target, 0);
    // a line the horse will not cross (the Storm Titan's grass fire): it stops dead and shies
    if (target > 0 && this.refuse?.(ax, az) === true) target = 0;
    // fording: in the river / the brook the horse wades at a walk-trot, swimming (held at FORD_DEPTH) where it is deeper
    const wet = wildEnv.wetAt?.(this.feet.x, this.feet.z) === true || heightAt(this.feet.x, this.feet.z) < waterLevel() - 0.2;
    if (wet) target = Math.sign(target) * Math.min(Math.abs(target), HORSE_SPEED.walk * 1.6);
    // the jump is an edge: queued until a fixed step takes it
    const jumpDown = k.has('Space') || p.touchJump; p.touchJump = false;
    if (jumpDown && !this.jumpWas && !this.breaking) this.jumpQueued = true;
    this.jumpWas = jumpDown;
    this.target = target; this.turnIn = turnSteer; this.sector = sector; this.galloping = galloping; this.drawing = drawing;
    // the rein's turn (rad/s at full rein by speed, in step): stick right = heading down (animal yaw)
    this.rateIn = this.breaking ? 0 : -turnSteer * (drawing && this.panicT <= 0 ? DRAW_TURN : 1) * (this.skidT > 0 ? SKID_TURN : this.panicT > 0 ? PANIC_TURN : 1);
    // the head leads the turn: the neck swings to the rein first (eased in horse.ts), the body's turn follows it
    a.mem['turnLead'] = THREE.MathUtils.clamp(this.rateIn * this.maxRate() / TURN.stand, -1, 1);
    a.lookWeight = 0;   // no alert look-at under a rider (a stale one from the wait at the rail pulled the neck aside)
// END SHIPPING REINS
  }
  maxRate(): number {
    const HORSE_SPEED = this.HORSE_SPEED;
    const sp = Math.abs(this.speed);
    return sp < HORSE_SPEED.walk ? THREE.MathUtils.lerp(TURN.stand, TURN.walk, sp / HORSE_SPEED.walk)
      : sp < HORSE_SPEED.trot ? THREE.MathUtils.lerp(TURN.walk, TURN.trot, (sp - HORSE_SPEED.walk) / (HORSE_SPEED.trot - HORSE_SPEED.walk))
      : sp < HORSE_SPEED.canter ? THREE.MathUtils.lerp(TURN.trot, TURN.canter, (sp - HORSE_SPEED.trot) / (HORSE_SPEED.canter - HORSE_SPEED.trot))
      : THREE.MathUtils.lerp(TURN.canter, TURN.gallop, Math.min(1, (sp - HORSE_SPEED.canter) / (HORSE_SPEED.gallop - HORSE_SPEED.canter)));
  }

}
