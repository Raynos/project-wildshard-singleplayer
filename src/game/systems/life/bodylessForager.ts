import * as v from 'valibot';
import { ForagerPolicySchema, type ForagerPolicyRows } from '@wildshard/format/ambientLife';

/** Caller-owned bodyless state; no actor, collider, RNG or clock is manufactured. */
export interface BodylessForagerState {
  mode: 'graze' | 'alert' | 'flee'; x: number; z: number; yaw: number;
  fx: number; fz: number; tx: number; tz: number; t: number; dur: number; h: number;
  timer: number; fleeLeft: number; zig: number; headPitch: number; ears: number; sit: number;
}
/** Borrowed motion channels; the caller maps these onto its own model. */
export interface ForagerMotion { y: number; hind: number; fore: number; pitch: number }
export interface ForagerRandom { range: (min: number, max: number) => number; int: (min: number, max: number) => number; next: () => number }
export interface ForagerGround { heightAt: (x: number, z: number) => number; canStep: (x: number, z: number) => boolean }
const TAU = Math.PI * 2;
const wrap = (a: number): number => Math.atan2(Math.sin(a), Math.cos(a));

/** Bodyless foraging policy. Visibility, seating, discarded paused time and
 * population ownership stay with the caller. Each step consumes only its lent RNG.
 * The first motion profile is a hop; Nalati's burrow keeper supplies the W3 retreat
 * profile and keeps its colony whistle and band-clock ownership. */
export class BodylessForager {
  private readonly rows: ForagerPolicyRows;
  private readonly random: ForagerRandom;
  private readonly ground: ForagerGround;
  constructor(rows: unknown, random: ForagerRandom, ground: ForagerGround) {
    this.rows = v.parse(ForagerPolicySchema, rows); this.random = random; this.ground = ground;
  }
  private posture(hr: BodylessForagerState, mode: BodylessForagerState['mode'], dt: number): void {
    const row = this.rows.posture[mode];
    hr.sit = row[1] === 0 ? row[0] : hr.sit + (row[0] - hr.sit) * Math.min(1, dt * row[1]);
    hr.headPitch += (row[2] - hr.headPitch) * Math.min(1, dt * row[3]);
    hr.ears += (row[4] - hr.ears) * Math.min(1, dt * row[5]);
  }
  private hop(hr: BodylessForagerState, len: number, dur: number, height: number): void {
    let tx = hr.x + Math.sin(hr.yaw) * len, tz = hr.z + Math.cos(hr.yaw) * len;
    if (!this.ground.canStep(tx, tz)) {
      // blocked: turn and try the other ways round
      for (const turn of [0.9, -0.9, 1.8, -1.8, Math.PI]) {
        const y = hr.yaw + turn, x2 = hr.x + Math.sin(y) * len, z2 = hr.z + Math.cos(y) * len;
        if (this.ground.canStep(x2, z2)) { hr.yaw = y; tx = x2; tz = z2; break; }
      }
      if (!this.ground.canStep(tx, tz)) { hr.mode = 'alert'; hr.timer = 1; return; }
    }
    hr.fx = hr.x; hr.fz = hr.z; hr.tx = tx; hr.tz = tz; hr.t = 0; hr.dur = dur; hr.h = height;
  }
  /** One already-scheduled step, observing the actual player's position. */
  step(hr: BodylessForagerState, motion: ForagerMotion, dt: number, player: { readonly x: number; readonly z: number }, fast: boolean): void {
    const pp = player, p = motion, rng = this.random, rows = this.rows;
    const d = Math.hypot(hr.x - pp.x, hr.z - pp.z);
    const scare = fast ? rows.scare[1] : rows.scare[0];
    if (hr.mode !== 'flee' && d < scare) { hr.mode = 'flee'; hr.fleeLeft = rng.range(...rows.fleeDistance); hr.zig = 0; hr.yaw = Math.atan2(hr.x - pp.x, hr.z - pp.z); hr.t = hr.dur; }
    else if (hr.mode === 'graze' && d < scare + rows.alertMargin) { hr.mode = 'alert'; hr.timer = rng.range(...rows.alertPause); }
    const hopping = hr.t < hr.dur;
    if (hopping) {
      hr.t += dt;
      const u = Math.min(1, hr.t / hr.dur);
      hr.x = hr.fx + (hr.tx - hr.fx) * u; hr.z = hr.fz + (hr.tz - hr.fz) * u;
      const arc = Math.sin(u * Math.PI);
      p.y = this.ground.heightAt(hr.x, hr.z) + arc * hr.h;
      // the bound: hind legs drive back off the ground, fore legs reach, then land fore-first
      p.hind = u < 0.35 ? Math.sin((u / 0.35) * Math.PI * 0.5) : 1 - (u - 0.35) / 0.65 * 1.5;
      p.fore = u < 0.5 ? -0.7 * Math.sin(u * TAU) : 0.5 * Math.sin((u - 0.5) * TAU);
      p.pitch = (0.5 - u) * (hr.mode === 'flee' ? 0.5 : 0.3);
    } else {
      p.y = this.ground.heightAt(hr.x, hr.z);
      p.hind += (0 - p.hind) * Math.min(1, dt * 10); p.fore += (0 - p.fore) * Math.min(1, dt * 10);
      p.pitch += (hr.sit * 0.22 - 0.04 - p.pitch) * Math.min(1, dt * 6);
    }
    hr.timer -= dt;
    switch (hr.mode) {
      case 'graze':
        this.posture(hr, 'graze', dt);
        if (!hopping && hr.timer <= 0) { hr.timer = rng.range(...rows.grazePause); hr.yaw += rng.range(...rows.turn); if (rng.next() < rows.grazing.chance) this.hop(hr, rng.range(...rows.grazing.length), rows.grazing.duration, rows.grazing.height); }
        break;
      case 'alert':
        this.posture(hr, 'alert', dt);
        if (hr.timer <= 0 && d > scare + rows.releaseMargin) { hr.mode = 'graze'; hr.timer = rng.range(...rows.settlePause); }
        break;
      case 'flee':
        this.posture(hr, 'flee', dt);
        if (!hopping) {
          if (hr.fleeLeft <= 0) { hr.mode = 'alert'; hr.timer = rng.range(...rows.fleePause); break; }
          hr.zig -= 1;
          const away = Math.atan2(hr.x - pp.x, hr.z - pp.z);
          if (hr.zig <= 0) { hr.zig = rng.int(...rows.escape.zigSteps); hr.yaw = away + rng.range(...rows.escape.spread); } else hr.yaw += wrap(away - hr.yaw) * rows.escape.steer;
          this.hop(hr, rows.escape.length, rows.escape.duration, rows.escape.height); hr.fleeLeft -= rows.escape.length;
        }
        break;
      default: break;
    }
  }
}
