/**
 * The ambient flock (G466 H6): perched, wheeling, flushed and guiding flyers driven from one row
 * (`@wildshard/format/ambientLife#AmbientFlockSchema`). Render-free and server-safe: the caller draws `birds`
 * (`@wildshard/sdk/looks/ambientFlock` packs them into one posed draw) and voices `calls`.
 *
 * States: perched (head turns, the odd hop) → flushed by the player (a takeoff curve away from them, into a loop)
 * → wheeling on harmonic loops (`CirclingFlyer.wheel`) → landing on a free perch → perched. A row with no
 * `wheeling` keeps idle birds hidden. `guide(player, tx, tz)` borrows the formation's birds far from the player and
 * flies them past the player toward (tx, tz) on one quadratic through the row's start / pass / end offsets, then
 * back into a loop (`guide.after`) or hidden. Driftwood's gulls and Pine Hollow's breadcrumb ravens are its rows.
 *
 * Two more modes, each a row section:
 *   - `scavenge`: `gather(x, z, width, n)` borrows hidden birds to a site (a kill): they come in high from far off,
 *     circle, drop to the ground round it and feed (bouts of pecks, a look round, the odd hop, squabbles), lift and
 *     circle again when the player comes near, and leave when fed, timed out or `release`d. `siteVisit` reads it.
 *     Pine Hollow's ravens at a kill.
 *   - `visit`: one bird comes to a perch near the player while the caller's `light` (0 day .. 1 night) is in
 *     `enter`, stares or looks about, calls, does its perch acts (hitch, call, drum), relocates when flushed (toward
 *     `player.toward` when given) and leaves when `light` leaves `stay` or the player is far. A perch with `r` is a
 *     trunk: the bird clings to its bark on the side toward the player. Pine Hollow's owl (snag tops) and woodpecker.
 */
import { Rng } from '../core/rng';
import { CirclingFlyer, type AmbientWheelOrbit } from './ambientFlight';
import { terrainHeight } from '../world/terrainHeight';
import type { AmbientFlockData } from '@wildshard/format/ambientLife';

/** Hidden 0 · Perched 1 · Hop 2 · Takeoff 3 · Wheel 4 · Landing 5 · Guide 6 · Fly 7 · Circle 8 · Feed 9 · Visit 10 */
export type AmbientFlockState = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;
/** One flyer's pose and rig channels (flap, wing fold, head yaw, leg tuck, head pitch / peck, body upright), read by the drawer. */
export interface AmbientFlockBird {
  state: AmbientFlockState; x: number; y: number; z: number; yaw: number; pitch: number; roll: number;
  flap: number; fold: number; head: number; legs: number; peck: number; body: number;
  /** fly: the state on arrival; the site it serves (-1 none); orbit (centre, radius, altitude, rate, phase); peck bouts */
  next: AmbientFlockState; site: number; ox: number; oz: number; orad: number; oalt: number; ow: number; oph: number; pecks: number; peckT: number;
  /** the perch spot it settles on (visit) and its facing; a hop on the ground (from, to, clock) */
  sx: number; sy: number; sz: number; syaw: number; hx: number; hz: number; hopT: number; hopDur: number; gy: number; act: number;
  perch: number; loop: AmbientWheelOrbit; phase: number; scale: number; altOff: number;
  t: number; dur: number; timer: number; flush: number; flapT: number; burst: number; glide: number;
  headFrom: number; headTo: number; headT: number; headDur: number;
  ax: number; ay: number; az: number; bx: number; by: number; bz: number; tx: number; ty: number; tz: number; yaw0: number; call: boolean;
}
interface Point { x: number; y: number; z: number }
/** a perch: a point (a branch, a snag's top), or with `r` a trunk's centre and bark radius at that height; `w` weighs it */
export interface AmbientPerch extends Point { readonly r?: number; readonly w?: number }
/** The player as the flock reads it; the optional fields drive the scavenge and visit modes. */
export interface AmbientFlockPlayer extends Point {
  /** running / sprinting (the far flush radius) */ readonly fast?: boolean;
  /** 0 day .. 1 night (a visit row's window) */ readonly light?: number;
  /** the view's forward on the ground plane (a visitor arrives from behind it) */ readonly fx?: number; readonly fz?: number;
  /** where a flushed visitor heads (the nearest unseen place), or null */ readonly toward?: { readonly x: number; readonly z: number } | null;
}
/** a voice this frame: where, which cue, how loud */
export interface AmbientFlockCall extends Point { cue: string; gain: number }
/** a scavenge site's visit: none yet 0 · overhead 1 · feeding 2 · gone 3 */
export type AmbientSiteVisit = 0 | 1 | 2 | 3;
interface Site { x: number; z: number; width: number; visit: AmbientSiteVisit; feedLeft: number; leaveT: number; open: boolean }
const HIDDEN = 0, PERCHED = 1, HOP = 2, TAKEOFF = 3, WHEEL = 4, LANDING = 5, GUIDE = 6, FLY = 7, CIRCLE = 8, FEED = 9, VISIT = 10;
const TAU = Math.PI * 2;
const wrap = (a: number): number => Math.atan2(Math.sin(a), Math.cos(a));
/** `v` eased toward `to` at `rate` per second */
const toward = (v: number, to: number, rate: number, dt: number): number => v + (to - v) * Math.min(1, dt * rate);

/** A data-driven flock; `update` once a frame, then draw `birds` (hidden ones excepted) and voice `calls`. */
export class AmbientFlock {
  readonly birds: AmbientFlockBird[] = [];
  /** voices this frame (borrowed until the next update) */
  readonly calls: AmbientFlockCall[] = [];
  private readonly flight: CirclingFlyer;
  private readonly rng: Rng;
  private readonly loops: AmbientWheelOrbit[] = [];
  private readonly perchYaw: number[];
  private readonly occupied: Int8Array;
  private readonly pool: AmbientFlockCall[] = Array.from({ length: 8 }, () => ({ x: 0, y: 0, z: 0, cue: '', gain: 1 }));
  private readonly sites: Site[] = [];
  private voiceT = 0; private flapT = 0; private visitT = 0;
  private readonly p: Point = { x: 0, y: 0, z: 0 };
  private readonly q: Point = { x: 0, y: 0, z: 0 };
  private time = 0;
  private callTimer: number;
  readonly row: AmbientFlockData;
  private readonly perches: readonly AmbientPerch[];
  private readonly heightAt: (x: number, z: number) => number;

  /** `heightAt` defaults to the installed terrain (`world/terrainHeight`). */
  constructor(row: AmbientFlockData, perches: readonly AmbientPerch[] = [], heightAt: (x: number, z: number) => number = terrainHeight) {
    this.row = row; this.perches = perches; this.heightAt = heightAt;
    const rng = this.rng = new Rng(row.seed), w = row.wheeling, pr = row.perch;
    this.flight = new CirclingFlyer(row.flight, w?.wheel, row.wingbeats);
    this.callTimer = row.call?.first ?? 0;
    this.perchYaw = perches.map(() => rng.range(0, TAU));
    this.occupied = new Int8Array(perches.length);
    if (w !== null) w.loops.forEach(([ox, oz], i) => {
      const r = w.radius * rng.range(...w.loopRadius), speed = rng.range(...w.speed) / r;
      this.loops.push({ cx: w.centre.x + ox * w.radius, cz: w.centre.z + oz * w.radius, r, alt: rng.range(...w.altitude), w: speed * (i % 2 ? -1 : 1), p1: rng.range(0, 6.28), p2: rng.range(0, 6.28), p3: rng.range(0, 6.28), p4: rng.range(0, 6.28) });
    });
    const n = Math.min(row.count, w === null || pr === null ? row.count : perches.length + 16);
    const perched = pr === null ? 0 : Math.min(perches.length, Math.round(n * pr.share));
    const order = perches.map((_, i) => i);
    for (let i = order.length - 1; i > 0; i--) { const j = rng.int(0, i), oi = order[i] ?? 0, oj = order[j] ?? 0; order[i] = oj; order[j] = oi; }
    for (let i = 0; i < n; i++) {
      const b: AmbientFlockBird = {
        state: w === null ? HIDDEN : WHEEL, x: 0, y: 0, z: 0, yaw: 0, pitch: 0, roll: 0, flap: 0.12, fold: 0, head: 0, legs: 1, peck: 0, body: 0,
        next: HIDDEN, site: -1, ox: 0, oz: 0, orad: 8, oalt: 12, ow: 0.5, oph: 0, pecks: 0, peckT: 0, sx: 0, sy: 0, sz: 0, syaw: 0, hx: 0, hz: 0, hopT: 1, hopDur: 0, gy: 0, act: 0,
        perch: -1, loop: this.loopAt(i), phase: rng.range(0, 6.28), scale: w === null ? 1 : rng.range(...w.bodyScale), altOff: w === null ? 0 : rng.range(...w.bodyAltitude),
        t: 0, dur: 1, timer: w === null ? 0 : rng.range(...w.perchAfter), flush: pr === null ? 0 : pr.flush * rng.range(...pr.flushJitter),
        flapT: 0, burst: 0, glide: rng.range(1, 4), headFrom: 0, headTo: 0, headT: 1, headDur: 1,
        ax: 0, ay: 0, az: 0, bx: 0, by: 0, bz: 0, tx: 0, ty: 0, tz: 0, yaw0: 0, call: false,
      };
      const perch = order[i];
      if (i < perched && perch !== undefined) this.perchOn(b, perch);
      else if (w !== null) { b.t = rng.range(0, 100); this.flight.wheel(b.loop, b, this.time, this.p); b.x = this.p.x; b.y = this.p.y; b.z = this.p.z; }
      this.birds.push(b);
    }
  }

  private loopAt(i: number): AmbientWheelOrbit {
    return this.loops[i % Math.max(1, this.loops.length)] ?? { cx: 0, cz: 0, r: 1, alt: 0, w: 0, p1: 0, p2: 0, p3: 0, p4: 0 };
  }
  private call(x: number, y: number, z: number, cue = this.row.call?.cue, gain = 1): void {
    const c = this.pool[this.calls.length];
    if (c === undefined || cue === undefined) return;
    c.x = x; c.y = y; c.z = z; c.cue = cue; c.gain = gain; this.calls.push(c);
  }
  private perchOn(b: AmbientFlockBird, perch: number): void {
    const p = this.perches[perch], pr = this.row.perch;
    if (p === undefined || pr === null) return;
    this.occupied[perch] = 1;
    b.perch = perch; b.state = PERCHED; b.x = p.x; b.y = p.y + this.row.foot; b.z = p.z;
    b.yaw = this.perchYaw[perch] ?? 0; b.pitch = 0; b.roll = 0; b.flap = -0.3; b.fold = 0.2; b.legs = 0; b.head = 0;
    b.t = 0; b.timer = this.rng.range(...pr.idle); b.headFrom = b.headTo = 0; b.headT = 1; b.headDur = 1;
  }
  private freePerch(b: AmbientFlockBird, player: Point, clear: number): number {
    let best = -1, bestScore = Infinity;
    for (let i = 0; i < this.perches.length; i++) {
      const p = this.perches[i];
      if (this.occupied[i] || p === undefined || Math.hypot(p.x - player.x, p.z - player.z) < clear) continue;
      const score = Math.hypot(p.x - b.x, p.z - b.z) * (0.5 + this.rng.next());
      if (score < bestScore) { bestScore = score; best = i; }
    }
    return best;
  }
  private wings(b: AmbientFlockBird, dt: number): void { [b.flap, b.fold] = this.flight.burst(b, dt, b.flap, b.fold, this.row.wingbeat, this.rng, true); }
  private headTurn(b: AmbientFlockBird, dt: number, head: { rate: number; range: number; duration: readonly [number, number] }): void {
    b.headT += dt / b.headDur;
    if (b.headT >= 1) {
      b.head = b.headTo;
      if (this.rng.next() < dt * head.rate) { b.headFrom = b.head; b.headTo = this.rng.range(-head.range, head.range); b.headT = 0; b.headDur = this.rng.range(...head.duration); }
    } else { const u = b.headT; b.head = b.headFrom + (b.headTo - b.headFrom) * u * u * (3 - 2 * u); }
  }
  private rejoin(b: AmbientFlockBird): void {
    b.loop = this.loopAt(this.rng.int(0, Math.max(0, this.loops.length - 1))); b.phase = this.rng.range(0, 6.28);
  }
  private takeoff(b: AmbientFlockBird, player: Point): void {
    const pr = this.row.perch, w = this.row.wheeling;
    if (pr === null || w === null) return;
    if (b.perch >= 0) this.occupied[b.perch] = 0;
    b.perch = -1;
    let ax = b.x - player.x, az = b.z - player.z;
    const d = Math.hypot(ax, az) || 1; ax /= d; az /= d;
    b.ax = b.x; b.ay = b.y; b.az = b.z; b.bx = b.x + ax * pr.takeoff.out; b.by = b.y + pr.takeoff.up; b.bz = b.z + az * pr.takeoff.out;
    this.rejoin(b);
    b.state = TAKEOFF; b.t = 0; b.dur = pr.takeoff.duration; b.legs = 0; b.burst = pr.takeoff.beats; b.flapT = 0;
    b.timer = this.rng.range(...w.perchAfter);
    this.call(b.x, b.y, b.z);
  }
  private land(b: AmbientFlockBird, perch: number): void {
    const p = this.perches[perch], pr = this.row.perch;
    if (p === undefined || pr === null) return;
    this.occupied[perch] = 1; b.perch = perch;
    b.ax = b.x; b.ay = b.y; b.az = b.z; b.tx = p.x; b.ty = p.y + this.row.foot; b.tz = p.z;
    const d = Math.hypot(b.tx - b.x, b.tz - b.z, b.ty - b.y);
    b.bx = b.x + Math.sin(b.yaw) * d * 0.45; b.bz = b.z + Math.cos(b.yaw) * d * 0.45; b.by = Math.max(b.y, b.ty + pr.landing.rise) + d * 0.08;
    b.state = LANDING; b.t = 0; b.dur = Math.max(pr.landing.minimum, d / pr.landing.speed); b.burst = 0; b.glide = 0.5;
  }
  private bez(b: AmbientFlockBird, cx: number, cy: number, cz: number, u: number, out: Point): Point {
    const v = 1 - u, w0 = v * v, w1 = 2 * v * u, w2 = u * u;
    out.x = b.ax * w0 + b.bx * w1 + cx * w2; out.y = b.ay * w0 + b.by * w1 + cy * w2; out.z = b.az * w0 + b.bz * w1 + cz * w2;
    return out;
  }
  private move(b: AmbientFlockBird, to: Point, dt: number, bank: number): void {
    this.flight.face(b, to.x - b.x, to.y - b.y, to.z - b.z, dt, bank); b.x = to.x; b.y = to.y; b.z = to.z;
  }

  /** One frame: every bird's state, then this frame's `calls`. */
  update(dt: number, player: AmbientFlockPlayer): void {
    this.calls.length = 0;
    if (dt <= 0) return;
    this.time += dt;
    const { perch: pr, wheeling: w, guide: gd } = this.row, p = this.p, q = this.q;
    let flying = 0;
    for (const b of this.birds) {
      switch (b.state) {
        case PERCHED: {
          if (pr === null) break;
          if (Math.hypot(b.x - player.x, b.z - player.z) < b.flush && b.t > pr.settle) { this.takeoff(b, player); break; }
          b.t += dt; this.headTurn(b, dt, pr.head);
          b.flap += (-0.3 - b.flap) * Math.min(1, dt * 5); b.fold += (0.2 - b.fold) * Math.min(1, dt * 5);
          b.timer -= dt;
          if (b.timer <= 0) {
            b.timer = this.rng.range(...pr.every);
            if (this.rng.next() < pr.hop.chance) { b.state = HOP; b.t = 0; b.dur = pr.hop.duration; b.yaw0 = b.yaw; b.ay = b.y; b.head = b.headTo = b.headFrom = 0; b.headT = 1; b.bx = this.rng.range(-pr.hop.turn, pr.hop.turn); }
          }
          break;
        }
        case HOP: {
          if (pr === null) break;
          b.t += dt;
          const u = Math.min(1, b.t / b.dur), s = Math.sin(u * Math.PI);
          b.y = b.ay + s * pr.hop.height; b.yaw = b.yaw0 + b.bx * u; b.flap = -0.3 + s * 0.8; b.fold = 0.2; b.legs = s * 0.5;
          if (u >= 1) { b.state = PERCHED; b.y = b.ay; }
          break;
        }
        case TAKEOFF: {
          b.t += dt;
          const u = Math.min(1, b.t / b.dur);
          this.flight.wheel(b.loop, b, this.time, q);
          this.move(b, this.bez(b, q.x, q.y, q.z, u * u * (3 - 2 * u), p), dt, pr?.takeoff.bank ?? 0.35);
          b.legs += (1 - b.legs) * Math.min(1, dt * 2); this.wings(b, dt);
          if (u >= 1) { b.state = WHEEL; b.glide = 0; }
          flying++;
          break;
        }
        case WHEEL: {
          if (w === null) { b.state = HIDDEN; break; }
          this.flight.wheel(b.loop, b, this.time, p);
          this.move(b, p, dt, w.bank); b.legs = 1; this.wings(b, dt);
          b.timer -= dt;
          if (b.timer <= 0 && pr !== null) { const k = this.freePerch(b, player, pr.clear); if (k >= 0) this.land(b, k); else b.timer = 5; }
          flying++;
          break;
        }
        case GUIDE: {
          if (gd === null) break;
          b.t += dt;
          const u = Math.max(0, Math.min(1, b.t / b.dur));
          this.move(b, this.bez(b, b.tx, b.ty, b.tz, u, p), dt, gd.bank); this.wings(b, dt);
          if (b.call && gd.call !== null && u > gd.call) { b.call = false; this.call(b.x, b.y, b.z); }
          if (u >= 1) this.endGuide(b);
          flying++;
          break;
        }
        case LANDING: {
          if (pr === null) break;
          b.t += dt;
          const u = Math.min(1, b.t / b.dur), e = u < 0.5 ? 2 * u * u : 1 - (2 * (1 - u) * (1 - u)) * 0.85 - 0.15 * (1 - u);
          this.move(b, this.bez(b, b.tx, b.ty, b.tz, e, p), dt, pr.landing.bank);
          if (u > pr.landing.flare) {
            b.legs += (0 - b.legs) * Math.min(1, dt * 4); b.pitch += (0.45 - b.pitch) * Math.min(1, dt * 3);
            if (b.burst === 0 && b.glide > 0.2) { b.burst = 3; b.flapT = 0; }
          }
          this.wings(b, dt);
          if (u >= 1) { this.perchOn(b, b.perch); b.roll = 0; }
          flying++;
          break;
        }
        case FLY: this.stepFly(b, dt); break;
        case CIRCLE: this.stepCircle(b, dt); break;
        case FEED: this.stepFeed(b, dt); break;
        case VISIT: this.stepVisit(b, dt, player); break;
        case HIDDEN: if (this.row.visit !== null) this.tryVisit(b, player); break;
        default: break;
      }
    }
    if (this.row.scavenge !== null) this.stepSites(dt, player);
    const call = this.row.call;
    if (call === null) return;
    this.callTimer -= dt;
    if (this.callTimer > 0) return;
    this.callTimer = this.rng.range(...call.every);
    const k = this.rng.int(0, this.birds.length - 1);
    let b = this.birds[k];
    if (b === undefined || b.state === HIDDEN) return;
    if (flying > 0 && b.state === PERCHED) for (let j = 0; j < this.birds.length; j++) { const h = this.birds[(k + j) % this.birds.length]; if (h?.state === WHEEL) { b = h; break; } }
    this.call(b.x, b.y, b.z);
  }

  // ── the scavenge and visit modes ──
  /** fly from where it is to (x, y, z) at `speed` m/s, bowing along its heading and up by `lift`; `next` on arrival */
  private flyTo(b: AmbientFlockBird, x: number, y: number, z: number, speed: number, lift: number, next: AmbientFlockState): void {
    const d = Math.hypot(x - b.x, y - b.y, z - b.z), lead = b.state === FLY || b.state === CIRCLE ? d * 0.35 : d * 0.12;
    b.ax = b.x; b.ay = b.y; b.az = b.z;
    b.bx = (b.x + x) / 4 + (b.x + Math.sin(b.yaw) * lead) / 2; b.bz = (b.z + z) / 4 + (b.z + Math.cos(b.yaw) * lead) / 2; b.by = Math.max(b.y, y) + lift;
    b.tx = x; b.ty = y; b.tz = z; b.t = 0; b.dur = Math.max(0.8, d / speed); b.next = next; b.state = FLY;
  }
  /** appear at (x, y, z) already flying, heading for (tx, tz) */
  private spawnAt(b: AmbientFlockBird, x: number, y: number, z: number, tx: number, tz: number): void {
    b.x = x; b.y = y; b.z = z; b.yaw = Math.atan2(tx - x, tz - z); b.pitch = 0; b.roll = 0;
    b.fold = 0; b.legs = 1; b.body = 0; b.head = 0; b.peck = 0; b.burst = 4; b.flapT = 0;
  }
  /** a croak (two trading croaks when `pair`): one at a time across the flock, `voices.gap` apart */
  private caw(b: AmbientFlockBird, pair = false): void {
    const v = this.row.scavenge?.voices;
    if (v === undefined || this.time < this.voiceT) return;
    this.voiceT = this.time + this.rng.range(...v.gap);
    this.call(b.x, b.y, b.z, pair ? v.pair : v.call, v.gain);
  }
  /** wings clattering up (one for a flock going up together) */
  private flapCall(b: AmbientFlockBird): void {
    const v = this.row.scavenge?.voices;
    if (v === undefined || this.time < this.flapT) return;
    this.flapT = this.time + v.flapGap; this.call(b.x, b.y, b.z, v.flap, v.flapGain);
  }
  private stepFly(b: AmbientFlockBird, dt: number): void {
    b.t += dt;
    const u = Math.min(1, b.t / b.dur), p = this.bez(b, b.tx, b.ty, b.tz, u * u * (3 - 2 * u) * 0.3 + u * 0.7, this.p);
    const sag = this.row.visit?.sag ?? 0;
    if (sag > 0 && b.burst === 0) p.y -= sag * Math.sin(Math.min(1, 1 - b.glide / 0.3) * Math.PI); // a bounding flight sags in each glide
    this.move(b, p, dt, this.row.flight.bank);
    b.legs = toward(b.legs, 1, 3, dt); this.wings(b, dt);
    if (u < 1) return;
    const site = this.sites[b.site], sc = this.row.scavenge, vi = this.row.visit;
    if (b.next === CIRCLE && site !== undefined) this.circleOver(b, site, b.act === 1);
    else if (b.next === FEED && sc !== null) { b.state = FEED; b.timer = this.rng.range(...sc.land.pause); b.pecks = 0; b.pitch = sc.land.pitch; b.roll = 0; b.legs = 0; b.hopT = 1; }
    else if (b.next === VISIT && vi !== null) {
      b.state = VISIT; b.x = b.sx; b.y = b.sy; b.z = b.sz; if (b.syaw !== Infinity) b.yaw = b.syaw;
      b.pitch = vi.pose.pitch; b.roll = 0; b.legs = vi.pose.legs; b.body = vi.pose.body; b.timer = vi.acts === null ? 0 : this.rng.range(...vi.acts.first); b.act = 0;
      b.peckT = this.time + (vi.call === null ? 0 : this.rng.range(...vi.call.first));
    } else { b.state = HIDDEN; b.site = -1; }
  }

  /** Borrow up to `n` hidden birds to a site at (x, z) whose body is `width` m across; its id, or -1 (none free). */
  gather(x: number, z: number, width: number, n: number): number {
    const sc = this.row.scavenge;
    if (sc === null) return -1;
    const free = this.birds.filter((b) => b.state === HIDDEN).slice(0, n);
    if (free.length === 0) return -1;
    const id = this.sites.length, gy = this.heightAt(x, z), a = sc.arrive;
    this.sites.push({ x, z, width, visit: 1, feedLeft: this.rng.range(...sc.feed.time), leaveT: this.time + sc.feed.leave, open: true });
    for (const b of free) {
      const ang = this.rng.range(0, TAU), far = this.rng.range(...a.far);
      b.site = id; b.act = 0;
      this.spawnAt(b, x + Math.cos(ang) * far, gy + this.rng.range(...a.up), z + Math.sin(ang) * far, x, z);
      this.flyTo(b, x + Math.cos(ang) * a.near, gy + a.height, z + Math.sin(ang) * a.near, a.speed, a.lift, CIRCLE);
    }
    const lead = free[0];
    if (lead) this.caw(lead, free.length > 1); // they announce themselves coming in
    return id;
  }
  /** a site's visit (gone 3 once its birds have left, or for an unknown id) */
  siteVisit(id: number): AmbientSiteVisit { return this.sites[id]?.visit ?? 3; }
  /** the site's birds leave now (the body is gone) */
  release(id: number, player: Point): void {
    const s = this.sites[id];
    if (s === undefined || !s.open) return;
    for (const b of this.birds) if (b.site === id && b.state !== HIDDEN) this.depart(b, player);
    s.open = false; s.visit = 3;
  }
  private groundSpot(s: Site, i: number, n: number, ring: readonly [number, number]): [number, number] {
    const ang = (i / n) * TAU + this.rng.range(-0.5, 0.5), r = s.width + this.rng.range(...ring);
    return [s.x + Math.cos(ang) * r, s.z + Math.sin(ang) * r];
  }
  private circleOver(b: AmbientFlockBird, s: Site, high: boolean): void {
    const c = this.row.scavenge?.circle;
    if (c === undefined) return;
    b.state = CIRCLE; b.ox = s.x; b.oz = s.z; b.orad = this.rng.range(...c.radius);
    b.oalt = this.heightAt(s.x, s.z) + this.rng.range(...(high ? c.high : c.low));
    b.ow = this.rng.range(...c.speed) * (this.rng.next() < 0.5 ? -1 : 1); b.oph = Math.atan2(b.z - b.oz, b.x - b.ox);
    b.timer = this.rng.range(...c.timer);
  }
  private stepCircle(b: AmbientFlockBird, dt: number): void {
    const c = this.row.scavenge?.circle;
    if (c === undefined) return;
    this.flight.step(b, b, dt); b.timer -= dt; b.legs = 1;
    // soaring: mostly held wings, the odd few beats
    if (b.burst > 0 || this.rng.next() < dt * c.beat) this.wings(b, dt);
    else { b.flap = toward(b.flap, 0.1, 4, dt); b.fold = toward(b.fold, 0, 4, dt); }
    if (this.rng.next() < dt * c.call) this.caw(b, this.rng.next() < 0.35); // a croak from overhead now and then
  }
  private stepFeed(b: AmbientFlockBird, dt: number): void {
    const sc = this.row.scavenge, s = this.sites[b.site];
    if (sc === null) return;
    const f = sc.feed;
    if (s !== undefined) b.yaw += wrap(Math.atan2(s.x - b.x, s.z - b.z) - b.yaw) * Math.min(1, dt * 3);
    b.flap = toward(b.flap, f.wings[0], 6, dt); b.fold = toward(b.fold, f.wings[1], 6, dt); b.legs = toward(b.legs, 0, 8, dt);
    b.timer -= dt;
    if (b.pecks > 0) {
      b.peckT += dt * f.rate;
      b.peck = f.peck[0] + f.peck[1] * Math.max(0, Math.sin(b.peckT * Math.PI));
      b.head = toward(b.head, 0, 6, dt);
      if (b.peckT >= 1) { b.peckT = 0; b.pecks--; }
    } else {
      b.peck = toward(b.peck, f.peck[2], 5, dt);
      this.lookAbout(b, dt, f.look[0], f.look[1]);
      if (b.timer <= 0) {
        b.timer = this.rng.range(...f.pause);
        if (this.rng.next() < f.squabble) this.caw(b, true); // squabbling over the kill
        if (this.rng.next() < f.hop && s !== undefined) { // a hop (a flick of the wings)
          const [x, z] = this.groundSpot(s, this.rng.int(0, 5), 6, sc.land.ring);
          b.ax = b.x; b.az = b.z; b.hx = x; b.hz = z; b.hopT = 0; b.hopDur = f.hopTime; b.burst = 1;
        } else { b.pecks = this.rng.int(...f.pecks); b.peckT = 0; }
      }
    }
    if (b.hopT < 1) {
      b.hopT = Math.min(1, b.hopT + dt / b.hopDur);
      const u = b.hopT;
      b.x = b.ax + (b.hx - b.ax) * u; b.z = b.az + (b.hz - b.az) * u; b.y = this.heightAt(b.x, b.z) + sc.land.stand + Math.sin(u * Math.PI) * f.hopHeight;
      if (b.burst > 0) { b.fold = 0.3; b.flap = Math.sin(u * TAU) * 0.6; }
      if (u >= 1) b.burst = 0;
    } else b.y = this.heightAt(b.x, b.z) + sc.land.stand;
  }
  /** fly off away from the player, out of sight, then hidden */
  private depart(b: AmbientFlockBird, player: Point): void {
    const d = this.row.scavenge?.depart ?? this.row.visit?.depart;
    if (d === undefined) { b.state = HIDDEN; return; }
    const ang = Math.atan2(b.z - player.z, b.x - player.x) + this.rng.range(-d.spread, d.spread);
    if (b.state === FEED) { b.legs = 0; b.burst = 6; this.flapCall(b); }
    b.body = 0; b.site = -1;
    this.flyTo(b, b.x + Math.cos(ang) * d.distance, b.y + this.rng.range(...d.up), b.z + Math.sin(ang) * d.distance, d.speed, d.lift, HIDDEN);
  }
  private stepSites(dt: number, player: AmbientFlockPlayer): void {
    const sc = this.row.scavenge;
    if (sc === null) return;
    const flushAt = player.fast === true ? sc.flush[1] : sc.flush[0];
    this.sites.forEach((s, id) => {
      if (!s.open) return;
      const mine = this.birds.filter((b) => b.site === id);
      if (mine.length === 0) { s.open = false; s.visit = 3; return; }
      const dist = Math.hypot(s.x - player.x, s.z - player.z), near = Math.min(...mine.map((b) => Math.hypot(b.x - player.x, b.z - player.z)));
      const feeding = mine.some((b) => b.state === FEED);
      mine.forEach((b, k) => {
        if (b.state === FEED) {
          if (near >= flushAt) return;
          const l = sc.lift; b.legs = 0; b.burst = 7; b.act = 1;
          this.flyTo(b, b.x + this.rng.range(-l.side, l.side), b.y + this.rng.range(...l.up), b.z + this.rng.range(-l.side, l.side), l.speed, l.lift, CIRCLE);
          this.flapCall(b); this.caw(b);
        } else if (b.state === CIRCLE && dist > sc.feed.reland && b.timer <= 0 && this.time < s.leaveT) {
          const [x, z] = this.groundSpot(s, k, mine.length, sc.land.ring);
          b.act = 0; this.flyTo(b, x, this.heightAt(x, z) + sc.land.stand, z, sc.land.speed, sc.land.lift, FEED);
        }
      });
      s.visit = feeding ? 2 : 1;
      if (feeding) s.feedLeft -= dt;
      if (s.feedLeft <= 0 || this.time > s.leaveT) { for (const b of mine) this.depart(b, player); s.open = false; s.visit = 3; }
    });
  }

  private lookAbout(b: AmbientFlockBird, dt: number, range: number, rate: number): void {
    if (this.rng.next() < dt * rate) b.headTo = this.rng.range(-range, range);
    b.head = toward(b.head, b.headTo, 7, dt);
  }
  /** the best perch `rMin`..`rMax` from (x, z), its weight `w`, facing `to` when given (null: none) */
  private pickPerch(x: number, z: number, rMin: number, rMax: number, to: { readonly x: number; readonly z: number } | null | undefined): AmbientPerch | null {
    let best: AmbientPerch | null = null, bs = 0;
    for (const p of this.perches) {
      const d = Math.hypot(p.x - x, p.z - z);
      if (d < rMin || d > rMax) continue;
      const aim = to ? Math.max(0.1, ((p.x - x) * (to.x - x) + (p.z - z) * (to.z - z)) / (d * Math.hypot(to.x - x, to.z - z) || 1) + 1) : 1;
      const score = (p.w ?? 1) * aim * (0.6 + this.rng.next() * 0.8);
      if (score > bs) { bs = score; best = p; }
    }
    return best;
  }
  /** fly to a perch: on a trunk, onto its bark on the side toward the player, facing it */
  private settle(b: AmbientFlockBird, p: AmbientPerch, player: Point): void {
    const vi = this.row.visit;
    if (vi === null) return;
    if (p.r === undefined) { b.sx = p.x; b.sy = p.y + vi.pose.stand; b.sz = p.z; b.syaw = Infinity; this.flyTo(b, b.sx, b.sy, b.sz, vi.speed, vi.lift, VISIT); return; }
    const ang = Math.atan2(player.z - p.z, player.x - p.x) + this.rng.range(-vi.cling, vi.cling), rad = p.r + 0.05;
    b.sx = p.x + Math.cos(ang) * rad; b.sy = p.y; b.sz = p.z + Math.sin(ang) * rad; b.syaw = Math.atan2(-Math.cos(ang), -Math.sin(ang));
    this.flyTo(b, b.sx - Math.sin(b.syaw) * vi.approach[0], b.sy - vi.approach[1], b.sz - Math.cos(b.syaw) * vi.approach[0], vi.speed, vi.lift, VISIT);
  }
  private arriveFrom(b: AmbientFlockBird, p: AmbientPerch, player: AmbientFlockPlayer): void {
    const f = this.row.visit?.from;
    if (f === undefined) return;
    if (f.kind === 'behind') { const x = player.x - (player.fx ?? 0) * f.back, z = player.z - (player.fz ?? 1) * f.back; this.spawnAt(b, x, this.heightAt(x, z) + f.up, z, p.x, p.z); }
    else this.spawnAt(b, p.x + (p.x - player.x) * f.back, p.y + f.up, p.z + (p.z - player.z) * f.back, p.x, p.z);
    this.settle(b, p, player);
  }
  private tryVisit(b: AmbientFlockBird, player: AmbientFlockPlayer): void {
    const vi = this.row.visit, light = player.light ?? 0;
    if (vi === null || light < vi.enter[0] || light > vi.enter[1] || this.time < this.visitT) return;
    this.visitT = this.time + vi.every;
    const p = this.pickPerch(player.x, player.z, vi.near[0], vi.near[1], null);
    if (p !== null) this.arriveFrom(b, p, player);
  }
  /** The visitor out now onto the perch nearest (x, z) within `reach`, from behind `player`; false: no perch there. */
  visitAt(x: number, z: number, reach: number, player: AmbientFlockPlayer): boolean {
    const b = this.birds[0], p = this.pickPerch(x, z, 0, reach, null);
    if (b === undefined || p === null) return false;
    this.arriveFrom(b, p, player);
    return true;
  }
  /** Send the visitor away now; it comes back on the next try (captures). */
  visitSoon(): void { const b = this.birds[0]; if (b) b.state = HIDDEN; this.visitT = 0; }
  private stepVisit(b: AmbientFlockBird, dt: number, player: AmbientFlockPlayer): void {
    const vi = this.row.visit;
    if (vi === null) return;
    const d = Math.hypot(b.x - player.x, b.z - player.z), light = player.light ?? 0, acts = vi.acts;
    // the stare: the head follows you (most of the way round), the body faces off
    if (vi.stare > 0 && d < vi.stare) { b.headTo = Math.max(-vi.stareTurn, Math.min(vi.stareTurn, wrap(Math.atan2(player.x - b.x, player.z - b.z) - b.yaw))); b.head = toward(b.head, b.headTo, 2.5, dt); }
    else if (b.act <= 0) this.lookAbout(b, dt, vi.look[0], vi.look[1]);
    b.flap = toward(b.flap, -0.05, 6, dt); b.fold = toward(b.fold, 1, 6, dt);
    b.timer -= dt;
    const drum = acts?.drum ?? null;
    if (drum !== null && b.act > 0) { // the drum roll: knocks at `rate` a second, the head a blur against the trunk
      b.act -= dt; b.hopT += dt * drum.rate;
      b.peck = drum.peck[0] + drum.peck[1] * Math.abs(Math.sin(b.hopT * Math.PI));
    } else {
      b.peck = vi.sway > 0 ? vi.pose.peck + Math.sin(this.time * 0.7) * vi.sway : toward(b.peck, vi.pose.peck, 6, dt);
      if (acts !== null && b.timer <= 0) {
        b.timer = this.rng.range(...acts.every);
        const r = this.rng.next();
        if (r < acts.hitch[0]) b.y += acts.hitch[1]; // hitches up the trunk
        else if (r < acts.hitch[0] + acts.call) { if (d < vi.within && vi.callCue !== null) this.call(b.x, b.y, b.z, vi.callCue, vi.gain); }
        else if (drum !== null) {
          b.act = this.rng.range(...drum.length); b.hopT = 0;
          if (d < drum.within) { this.call(b.x, b.y, b.z, drum.cue, vi.gain); b.act = drum.voiced; }
        }
      }
    }
    const call = vi.call;
    if (call !== null && this.time >= b.peckT) { b.peckT = this.time + this.rng.range(...call.every); if (d < call.within) this.call(b.x, b.y, b.z, call.cue, vi.gain); }
    if (light < vi.stay[0] || light > vi.stay[1] || d > vi.leave) { b.burst = 3; b.pitch = 0; this.depart(b, player); this.visitT = this.time + vi.leaveWait; return; }
    if (d < vi.flush) { // flushed: on to another perch (toward where the player has not been), else away
      b.burst = 3; b.body = 0; b.pitch = 0; b.legs = vi.flushLegs;
      if (vi.callCue !== null && vi.flushCall) this.call(b.x, b.y, b.z, vi.callCue, vi.gain);
      const p = this.pickPerch(b.x, b.z, vi.relocate[0], vi.relocate[1], vi.aim ? player.toward : null);
      if (p !== null) this.settle(b, p, player); else { this.depart(b, player); this.visitT = this.time + vi.leaveWait; }
    }
  }

  /** Borrow the formation's birds (idle ones at least `guide.borrow` from the player) and fly them past the player
   *  toward (tx, tz). false = no guide row, too near, or too few free birds. */
  guide(player: Point, tx: number, tz: number): boolean {
    const gd = this.row.guide;
    if (gd === null) return false;
    let dx = tx - player.x, dz = tz - player.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 1) return false;
    dx /= dist; dz /= dist;
    const rx = dz, rz = -dx, h = this.heightAt, gy = Math.max(player.y, h(player.x, player.z));
    const sx = player.x - dx * gd.start[0] + rx * gd.start[1], sz = player.z - dz * gd.start[0] + rz * gd.start[1], sy = Math.max(gy, h(sx, sz)) + gd.start[2];
    const px = player.x + dx * gd.pass[0] + rx * gd.pass[1], pz = player.z + dz * gd.pass[0] + rz * gd.pass[1], py = gy + gd.pass[2];
    const L = Math.min(gd.end.max, Math.max(gd.end.min, dist));
    let ground = gy;
    for (let k = 1; k <= 6; k++) { const f = (L * k) / 6; ground = Math.max(ground, h(player.x + dx * f, player.z + dz * f)); }
    const ex = player.x + dx * L, ez = player.z + dz * L, ey = ground + gd.end.up;
    // the quadratic through P at its chord fraction t: control = (P − (1−t)²S − t²E) / 2t(1−t)
    const a = Math.hypot(px - sx, py - sy, pz - sz), c = Math.hypot(ex - px, ey - py, ez - pz), t = Math.min(0.8, Math.max(0.2, a / (a + c))), k2 = 2 * t * (1 - t);
    const cx = (px - (1 - t) ** 2 * sx - t * t * ex) / k2, cy = Math.max(py, (py - (1 - t) ** 2 * sy - t * t * ey) / k2), cz = (pz - (1 - t) ** 2 * sz - t * t * ez) / k2;
    const dur = (a + c) / gd.speed;
    const free = (b: AmbientFlockBird): boolean => b.state === HIDDEN || ((b.state === WHEEL || b.state === PERCHED) && Math.hypot(b.x - player.x, b.z - player.z) >= gd.borrow);
    if (this.birds.filter(free).length < gd.formation.length) return false;
    gd.formation.forEach(([back, side, up], k) => {
      let best: AmbientFlockBird | undefined, bestScore = -Infinity;
      for (const b of this.birds) {
        if (!free(b)) continue;
        const score = Math.hypot(b.x - player.x, b.z - player.z) + (b.state === PERCHED ? 0 : 1e6);
        if (score > bestScore) { bestScore = score; best = b; }
      }
      if (best === undefined) return;
      const b = best;
      if (b.perch >= 0) this.occupied[b.perch] = 0;
      b.perch = -1;
      const ox = -dx * back + rx * side, oz = -dz * back + rz * side;
      b.ax = sx + ox; b.ay = sy + up; b.az = sz + oz; b.bx = cx + ox; b.by = cy + up; b.bz = cz + oz; b.tx = ex + ox; b.ty = ey + up; b.tz = ez + oz;
      b.x = b.ax; b.y = b.ay; b.z = b.az; b.yaw = Math.atan2(dx, dz); b.pitch = 0; b.roll = 0; b.legs = 1; b.head = 0;
      b.state = GUIDE; b.t = -k * gd.stagger; b.dur = dur; b.call = k === 0; b.burst = 3 + k; b.flapT = k * 1.3; b.glide = 0;
    });
    return true;
  }

  /** a guide pass is over: hidden, or on along the heading and up, then back into a loop (the takeoff curve) */
  private endGuide(b: AmbientFlockBird): void {
    const after = this.row.guide?.after ?? null, w = this.row.wheeling;
    if (after === null || w === null) { b.state = HIDDEN; return; }
    const hx = Math.sin(b.yaw), hz = Math.cos(b.yaw);
    b.ax = b.x; b.ay = b.y; b.az = b.z; b.bx = b.x + hx * after.ahead; b.by = b.y + after.up; b.bz = b.z + hz * after.ahead;
    this.rejoin(b);
    this.flight.wheel(b.loop, b, this.time, this.q);
    b.state = TAKEOFF; b.t = 0; b.dur = Math.max(8, Math.hypot(this.q.x - b.x, this.q.z - b.z) / after.speed);
    b.timer = this.rng.range(...w.perchAfter); b.call = false;
  }
}
