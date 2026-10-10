import * as v from 'valibot';
import { RhythmSpur, roadSteer, SPUR_WINDOW, type RoadXZ } from '../ride/rideAssist';
/** Resolved input and the admitted world queries; the caller owns a persistent frame port. */
export interface ReinsFrame {
  readonly forward: number; readonly turn: number; readonly touchX: number; readonly touchY: number;
  readonly gallop: boolean; readonly jump: boolean; readonly drawing: boolean; readonly moveScale: number;
  readonly phase: number; readonly feet: { readonly x: number; readonly z: number };
  readonly roads: readonly (readonly RoadXZ[])[] | undefined;
  readonly inBounds: (x: number, z: number, margin: number) => boolean;
  readonly refuses: (x: number, z: number) => boolean;
  readonly wet: boolean;
}
export interface HorseSpeeds { readonly walk: number; readonly trot: number; readonly canter: number; readonly gallop: number }
const SECTOR = 0.38;                 // the stick's forward / back sectors: |y| > 0.38 × its length (~67° either side of up / down)
const PIVOT_SPEED = 0.6, BACK_SPEED = 1.1;   // m/s: the stick beside you from a stand (a turn on the spot), reining back
/** rad/s turn at full rein per gait (between them it blends by speed) — at a gallop 0.62 rad/s = a ~21 m radius */
const TURN = { stand: 1.5, walk: 1.35, trot: 1.1, canter: 0.85, gallop: 0.62 };
const DRAW_TURN = 0.6;               // the rein's turn while you draw (a steadier line to shoot from)
const SKID_MIN = 7, SKID_TIME = 1.2, SKID_TURN = 1.6;
const PANIC_SPEED = 9.5, PANIC_TURN = 2;
const ROAD_TURN = 2.2, STEED_RESUME = 25;

const clamp = (x: number, a: number, b: number): number => Math.max(a, Math.min(b, x));
const lerp = (a: number, b: number, t: number): number => (1 - t) * a + t * b;
const angDiff = (a: number, b: number): number => Math.atan2(Math.sin(a - b), Math.cos(a - b));
const num = v.pipe(v.number(), v.finite());
const ReinsState = v.strictObject({ version: v.literal(1), steed: v.pipe(num, v.minValue(0), v.maxValue(100)), winded: v.boolean(), breaking: v.boolean(),
  heading: num, speed: num, wUp: num, grounded: v.boolean(), target: num, rateIn: num, turnIn: num, sector: v.picklist([-1, 0, 1, 2]),
  galloping: v.boolean(), drawing: v.boolean(), jumpWas: v.boolean(), jumpQueued: v.boolean(), cruise: num, gallopWas: v.boolean(), tapQueued: v.boolean(),
  clock: num, lastPhase: num, strideHz: num, sectorWas: v.picklist([-1, 0, 1, 2]), skidT: num, panicT: num, panicRear: num, panicYaw: num, jolt: num,
  onRoad: v.boolean(), beat: v.boolean(), spurFlash: v.pipe(num, v.integer(), v.minValue(0)), turnLead: num,
  spur: v.strictObject({ version: v.literal(1), streak: v.pipe(num, v.integer(), v.minValue(0), v.maxValue(3)), latchT: v.pipe(num, v.minValue(0)),
    good: v.pipe(num, v.integer(), v.minValue(0)), lastTap: num }) });
export type MountedReinsState = v.InferOutput<typeof ReinsState>;
/** The shipping reins decision law, without input devices, renderer, global app or native resource allocation. */
export class MountedReins {
  steed = 100; winded = false; breaking = false;
  heading = 0; speed = 0; wUp = 0; grounded = true;
  target = 0; rateIn = 0; turnIn = 0; sector = 2;
  galloping = false; drawing = false; jumpWas = false; jumpQueued = false;
  cruise = 0; gallopWas = false; tapQueued = false; clock = 0; lastPhase = 0; strideHz = 2;
  sectorWas = 2; skidT = 0; panicT = 0; panicRear = 0; panicYaw = 0; jolt = 0;
  onRoad = false; beat = false; spurFlash = 0; turnLead = 0;
  readonly spur = new RhythmSpur();
  private readonly speeds: HorseSpeeds;
  constructor(speeds: HorseSpeeds) { this.speeds = speeds; }
  /** All decision clocks and queued input edges; physical motor and presentation continuation belong to their drivers. */
  snapshot(): MountedReinsState {
    return v.parse(ReinsState, { version: 1, steed: this.steed, winded: this.winded, breaking: this.breaking, heading: this.heading, speed: this.speed,
      wUp: this.wUp, grounded: this.grounded, target: this.target, rateIn: this.rateIn, turnIn: this.turnIn, sector: this.sector,
      galloping: this.galloping, drawing: this.drawing, jumpWas: this.jumpWas, jumpQueued: this.jumpQueued, cruise: this.cruise,
      gallopWas: this.gallopWas, tapQueued: this.tapQueued, clock: this.clock, lastPhase: this.lastPhase, strideHz: this.strideHz,
      sectorWas: this.sectorWas, skidT: this.skidT, panicT: this.panicT, panicRear: this.panicRear, panicYaw: this.panicYaw, jolt: this.jolt,
      onRoad: this.onRoad, beat: this.beat, spurFlash: this.spurFlash, turnLead: this.turnLead, spur: this.spur.snapshot() });
  }
  /** Validate the entire envelope before changing any live clock. */
  restore(value: unknown): void {
    const s = v.parse(ReinsState, value);
    if (s.spur.lastTap > s.clock) throw new RangeError('Rhythm press is ahead of the riding clock');
    this.spur.restore(s.spur);
    this.steed = s.steed; this.winded = s.winded; this.breaking = s.breaking; this.heading = s.heading; this.speed = s.speed;
    this.wUp = s.wUp; this.grounded = s.grounded; this.target = s.target; this.rateIn = s.rateIn; this.turnIn = s.turnIn; this.sector = s.sector;
    this.galloping = s.galloping; this.drawing = s.drawing; this.jumpWas = s.jumpWas; this.jumpQueued = s.jumpQueued; this.cruise = s.cruise;
    this.gallopWas = s.gallopWas; this.tapQueued = s.tapQueued; this.clock = s.clock; this.lastPhase = s.lastPhase; this.strideHz = s.strideHz;
    this.sectorWas = s.sectorWas; this.skidT = s.skidT; this.panicT = s.panicT; this.panicRear = s.panicRear; this.panicYaw = s.panicYaw;
    this.jolt = s.jolt; this.onRoad = s.onRoad; this.beat = s.beat; this.spurFlash = s.spurFlash; this.turnLead = s.turnLead;
  }
  read(dt: number, frame: ReinsFrame): void {
    const HORSE_SPEED = this.speeds, drawing = frame.drawing;
    const fwdK = frame.forward, strK = frame.turn;
    const tx = frame.touchX, ty = frame.touchY, stick = Math.hypot(tx, ty);
    const turnIn = clamp(strK + tx, -1, 1);
    const gallopKey = frame.gallop;
    this.wUp = fwdK > 0 ? this.wUp + dt : 0;
    // the stick's sector (8 ways): ahead (within ~67° of up) = go, the gait by how far it is pushed; beside = a collected
    // turn (at most a trot; a pivot on the spot from a stand); behind = rein in, then back up
    const sector = stick > 0.1 ? (ty > SECTOR * stick ? 1 : ty < -SECTOR * stick ? -1 : 0) : fwdK !== 0 ? fwdK : strK !== 0 ? 0 : 2;
    let target = 0;
    if (sector === 1) target = stick > 0.1 ? (stick < 0.45 ? HORSE_SPEED.walk : stick < 0.85 ? HORSE_SPEED.trot : HORSE_SPEED.canter) : this.wUp < 0.9 ? HORSE_SPEED.trot : HORSE_SPEED.canter;
    else if (sector === 0) target = clamp(this.speed, PIVOT_SPEED, HORSE_SPEED.trot);
    else if (sector === -1) target = this.speed > 0.5 ? 0 : -BACK_SPEED * (stick > 0.1 ? Math.min(1, -ty / 0.8) : 1);
    if (sector === 1) this.cruise = target; else if (sector === -1) this.cruise = 0;   // B1: the gait a road keeps
    if (this.steed <= 0) this.winded = true;
    if (this.winded && this.steed >= STEED_RESUME) this.winded = false;
    // ── B1: the rhythm spur — a GALLOP press scored against the stride (the horse's gait phase; 0 = the downbeat) ──
    this.clock += dt;
    const ph = frame.phase, dph = (ph - this.lastPhase + 1) % 1;
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
    const roads = frame.roads;
    if (roads !== undefined && sector === 2 && !this.breaking && frame.moveScale !== 0 && (this.speed > HORSE_SPEED.walk * 0.8 || galloping)) {
      const r = roadSteer(roads, frame.feet.x, frame.feet.z, this.heading, 5 + Math.abs(this.speed) * 0.9);
      if (r !== null) {
        this.onRoad = true;
        if (!galloping) target = Math.max(this.cruise, HORSE_SPEED.walk);
        turnSteer = clamp(-angDiff(r.yaw, this.heading) * ROAD_TURN, -1, 1);
      }
    }
    // ── B1: the panic — rear (from a stand), then bolt away from the scare, deaf to the reins ──
    if (this.panicT > 0) {
      this.panicT = Math.max(0, this.panicT - dt); this.panicRear = Math.max(0, this.panicRear - dt);
      target = this.panicRear > 0 ? 0 : PANIC_SPEED;
      turnSteer = clamp(-angDiff(this.panicYaw, this.heading) * 2.5, -1, 1);
    }
    if (this.breaking || frame.moveScale === 0) target = 0;                       // the bucking rounds; a boss intro locks the reins
    // (steep ground is the motor's: the horse's climb limit by gait, in step)
    const ahead = 2 + this.speed * 0.4;
    const ax = frame.feet.x + Math.sin(this.heading) * ahead, az = frame.feet.z + Math.cos(this.heading) * ahead;
    if (!frame.inBounds(ax, az, 6)) target = Math.min(target, 0);
    // a line the horse will not cross (the Storm Titan's grass fire): it stops dead and shies
    if (target > 0 && frame.refuses(ax, az)) target = 0;
    // fording: in the river / the brook the horse wades at a walk-trot, swimming (held at FORD_DEPTH) where it is deeper
    const wet = frame.wet;
    if (wet) target = Math.sign(target) * Math.min(Math.abs(target), HORSE_SPEED.walk * 1.6);
    // the jump is an edge: queued until a fixed step takes it
    const jumpDown = frame.jump;
    if (jumpDown && !this.jumpWas && !this.breaking) this.jumpQueued = true;
    this.jumpWas = jumpDown;
    this.target = target; this.turnIn = turnSteer; this.sector = sector; this.galloping = galloping; this.drawing = drawing;
    // the rein's turn (rad/s at full rein by speed, in step): stick right = heading down (animal yaw)
    this.rateIn = this.breaking ? 0 : -turnSteer * (drawing && this.panicT <= 0 ? DRAW_TURN : 1) * (this.skidT > 0 ? SKID_TURN : this.panicT > 0 ? PANIC_TURN : 1);
    // the head leads the turn: the neck swings to the rein first (eased in horse.ts), the body's turn follows it
    this.turnLead = clamp(this.rateIn * this.maxRate() / TURN.stand, -1, 1);
  }
  maxRate(): number {
    const HORSE_SPEED = this.speeds;
    const sp = Math.abs(this.speed);
    return sp < HORSE_SPEED.walk ? lerp(TURN.stand, TURN.walk, sp / HORSE_SPEED.walk)
      : sp < HORSE_SPEED.trot ? lerp(TURN.walk, TURN.trot, (sp - HORSE_SPEED.walk) / (HORSE_SPEED.trot - HORSE_SPEED.walk))
      : sp < HORSE_SPEED.canter ? lerp(TURN.trot, TURN.canter, (sp - HORSE_SPEED.trot) / (HORSE_SPEED.canter - HORSE_SPEED.trot))
      : lerp(TURN.canter, TURN.gallop, Math.min(1, (sp - HORSE_SPEED.canter) / (HORSE_SPEED.gallop - HORSE_SPEED.canter)));
  }

}
