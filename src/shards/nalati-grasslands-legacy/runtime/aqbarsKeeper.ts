import * as v from 'valibot';
import { Vector3, MathUtils } from 'three';
import type { AnimalSim } from '@wildshard/engine/entities/AnimalSim';

export interface AqbarsLedge { readonly x: number; readonly y: number; readonly z: number; readonly r: number }
export interface AqbarsContext<A> { readonly dt: number; readonly player: Vector3; readonly pathYaw: (a: A, x: number, z: number, every: number) => number }
export interface AqbarsPorts<A> {
  readonly player: { readonly position: Vector3 }; readonly lair: { readonly x: number; readonly z: number };
  readonly ledges: readonly AqbarsLedge[]; readonly heightAt: (x: number, z: number) => number; readonly phase2: () => boolean; readonly awareRadius: number;
  readonly isHead: (a: A, point: Vector3) => boolean;
  readonly ring: { readonly setTime: (t: number) => void; readonly ring: (x: number, z: number, radius: number, strength: number) => void; readonly hide: () => void };
  readonly hurt: (a: A, amount: number) => void; readonly knock: (dx: number, dz: number) => void;
  readonly feed: (text: string) => void; readonly sound: (name: 'leopard_growl', at: Vector3) => void; readonly signature: () => void;
}
const finite = v.pipe(v.number(), v.finite()), triple = v.tuple([finite, finite, finite]);
const Saved = v.strictObject({ st: v.picklist(['lurk', 'stalk', 'tell', 'leap', 'open', 'swipe', 'perch', 'home']), stT: finite, cd: finite,
  from: triple, to: triple, goal: v.nullable(v.strictObject({ x: finite, z: finite, y: finite })), hitDone: v.picklist([0, 1, 2]) });
/** The shipping pounce/swipe keeper. Views answer tell/sound ports; the real native body owns motion and strikes. */
export class AqbarsKeeper<A extends AnimalSim> {
  private st: v.InferOutput<typeof Saved>['st'] = 'lurk';
  private stT = 0; private cd = 2; private hitDone = 0;
  private readonly from = new Vector3(); private readonly to = new Vector3();
  private goal: { x: number; z: number; y: number } | null = null;
  private readonly playerDelta = { d: 0, yaw: 0 };
  private readonly goalPoint = { x: 0, z: 0, y: 0 };
  constructor(private readonly ports: AqbarsPorts<A>) {
    // Crags.buildCrags authors at most six ledges; refuse an incompatible recipe rather than truncate it.
    if (ports.ledges.length > 6) throw new RangeError('Aqbars ledge bound exceeded');
  }
  get state(): string { return this.st; }
  private get p2(): boolean { return this.ports.phase2(); }
  spawned(): void { this.st = 'lurk'; this.cd = 2; }
  reset(a: A | null): void { this.st = 'home'; this.ports.ring.hide(); if (a !== null) { a.mem['leap'] = 0; a.mem['low'] = 0; } }
  disposeTell(): void { this.ports.ring.hide(); }
  private toPlayer(a: A): { d: number; yaw: number } {
    const p = this.ports.player.position, dx = p.x - a.position.x, dz = p.z - a.position.z;
    this.playerDelta.d = Math.hypot(dx, dz); this.playerDelta.yaw = Math.atan2(dx, dz); return this.playerDelta;
  }
  private goHome(a: A, c: AqbarsContext<A>, speed: number): void {
    const L = this.ports.lair, dx = L.x - a.position.x, dz = L.z - a.position.z;
    a.setMotion(c.pathYaw(a, L.x, L.z, 2), Math.hypot(dx, dz) > 3 ? speed : 0, 3);
  }
  private chase(a: A, c: AqbarsContext<A>, d: number, yaw: number, near: number): number { return d > near ? c.pathYaw(a, c.player.x, c.player.z, 0.6) : yaw; }
  private standY(x: number, z: number): number {
    let y = this.ports.heightAt(x, z);
    for (let i = 0; i < 6; i++) { const l = this.ports.ledges[i]; if (l === undefined) break; if (Math.hypot(x - l.x, z - l.z) < l.r + 0.3) y = Math.max(y, l.y); }
    return y;
  }
  damage(a: A, p: Vector3): number {
    if (this.st === 'leap') return 2;                                   // the weak point: its airborne body
    if (this.st === 'open') return this.ports.isHead(a, p) ? 1.2 : 1;            // the skid: headshots ×3 (the manager's ×2.5 × 1.2)
    if (this.p2 && this.st === 'perch') return 0.25;                   // up on its ledge in phase 2
    return 1;
  }
  private perchFor(px: number, pz: number, py: number): AqbarsLedge | null {
    let best: AqbarsLedge | null = null, bd = Infinity;
    for (let i = 0; i < 6; i++) { const l = this.ports.ledges[i]; if (l === undefined) break;
      const up = l.y - py, d = Math.hypot(l.x - px, l.z - pz);
      if (up < 3 || up > 8 || d < 4 || d > 14) continue;
      if (d < bd) { bd = d; best = l; }
    }
    return best;
  }
  think(a: A, c: AqbarsContext<A>): void {
    const pl = c.player, tp = this.toPlayer(a);
    this.cd -= c.dt;
    a.lookTarget.copy(pl); a.lookWeight = this.st === 'lurk' ? 0.4 : 1;
    switch (this.st) {
      case 'lurk': a.setMotion(a.yaw, 0, 1); break;
      case 'home': this.goHome(a, c, 5); if (Math.hypot(a.position.x - this.ports.lair.x, a.position.z - this.ports.lair.z) < 3) this.st = 'lurk'; break;
      case 'stalk': case 'perch': {
        a.mem['low'] = this.st === 'stalk' ? 0.8 : 0.2;
        if (tp.d < 2.4 && this.cd <= 0) { this.st = 'swipe'; this.hitDone = 0; a.startAttack(1.0); a.setMotion(tp.yaw, 0, 6); break; }
        const perch = this.perchFor(pl.x, pl.z, pl.y);
        if (perch !== null && this.cd <= 0) {
          const dp = Math.hypot(perch.x - a.position.x, perch.z - a.position.z);
          if (dp < 1.4) { this.startTell(a, pl); break; }
          a.setMotion(Math.atan2(perch.x - a.position.x, perch.z - a.position.z), 5.5, 4);
        } else if (tp.d > 7 && tp.d < 12 && this.cd <= 0) this.startTell(a, pl);   // no ledge: a run-up pounce on open ground
        else a.setMotion(tp.d > 9 ? this.chase(a, c, tp.d, tp.yaw, 9) : tp.yaw, tp.d > 9 ? 4.2 : tp.d < 6 ? -1 : 0, 3);
        break;
      }
      case 'tell': a.setMotion(Math.atan2(this.to.x - a.position.x, this.to.z - a.position.z), 0, 6); break;
      case 'leap': case 'open': a.setMotion(a.yaw, 0, 2); break;
      case 'swipe': break;
      default: break;
    }
  }
  act(a: A): void {
    if (this.st !== 'swipe') return;
    const tp = this.toPlayer(a);

        a.setMotion(tp.yaw, 0, 5);
        const k = a.attackPhase;
        if (k >= 0.45 && this.hitDone === 0) { this.hitDone = 1; if (tp.d < 2.9) this.ports.hurt(a, 14); }
        if (k >= 0.8 && this.hitDone === 1) { this.hitDone = 2; if (tp.d < 2.9) this.ports.hurt(a, 14); }
        if (k >= 1 || k < 0) { a.cancelAttack(); this.st = this.p2 ? 'perch' : 'stalk'; this.cd = 1.4; if (this.p2) this.retreat(a); }
  }
  private startTell(a: A, pl: Vector3): void {
    this.st = 'tell'; this.stT = 0;
    this.from.copy(a.position);
    this.to.set(pl.x, 0, pl.z); this.to.y = this.ports.heightAt(pl.x, pl.z);
    a.mem['low'] = 1; a.mem['snarl'] = 1;
    this.ports.signature();
    this.ports.sound('leopard_growl', a.position);
  }
  private retreat(a: A): void {
    let best: AqbarsLedge | null = null, bd = -1;
    for (let i = 0; i < 6; i++) { const l = this.ports.ledges[i]; if (l === undefined) break; const up = l.y - this.ports.heightAt(l.x, l.z); const d = Math.hypot(l.x - a.position.x, l.z - a.position.z); if (up > 2.5 && d < 25 && d > bd) { bd = d; best = l; } }
    if (best !== null) { this.from.copy(a.position); this.to.set(best.x, best.y, best.z); this.st = 'leap'; this.stT = 0; this.goalPoint.x = best.x; this.goalPoint.z = best.z; this.goalPoint.y = best.y; this.goal = this.goalPoint; }
  }
  tick(a: A | null, dt: number, t: number, engaged: boolean, leashing: boolean): void {
    if (a === null) return;
    this.ports.ring.setTime(t);
    if (leashing && this.st !== 'home') this.st = 'home';
    // aware (inside 60 m) it already stalks you — down off the rock, along the ledges; the fight starts at 25 m
    if ((this.st === 'lurk' || (this.st === 'home' && !leashing)) && (engaged || a.position.distanceTo(this.ports.player.position) < this.ports.awareRadius)) { this.st = 'stalk'; this.cd = 1.5; }
    this.stT += dt;
    // stand on the ledge / rock under it (the Crags' ledges are platforms, not terrain)
    if (this.st !== 'leap') a.yOffset += ((this.standY(a.position.x, a.position.z) - this.ports.heightAt(a.position.x, a.position.z)) - a.yOffset) * Math.min(1, dt * 10);
    if (this.st === 'tell') {
      this.ports.ring.ring(this.to.x, this.to.z, 2.2, 0.6 + 0.4 * Math.min(1, this.stT / 0.3));
      if (this.stT > 1.0) { this.st = 'leap'; this.stT = 0; this.goal = null; this.from.copy(a.position); this.from.y = this.standY(a.position.x, a.position.z); }
    } else if (this.st !== 'leap') this.ports.ring.hide();
    if (this.st === 'leap') {
      // a ballistic arc from the perch to the ring (or up to a retreat ledge)
      const T = 0.6, k = Math.min(1, this.stT / T);
      const x = MathUtils.lerp(this.from.x, this.to.x, k), z = MathUtils.lerp(this.from.z, this.to.z, k);
      const y = MathUtils.lerp(this.from.y, this.to.y, k) + Math.sin(k * Math.PI) * 1.6;
      a.position.x = x; a.position.z = z; a.yOffset = y - this.ports.heightAt(x, z);
      a.yaw = a.desiredYaw = Math.atan2(this.to.x - this.from.x, this.to.z - this.from.z);
      a.mem['leap'] = Math.sin(k * Math.PI) * 0.6 + 0.4; a.mem['low'] = 0;
      if (k >= 1) {
        a.mem['leap'] = 0; a.mem['snarl'] = 0;
        this.ports.ring.hide();
        if (this.goal !== null) { this.st = 'perch'; this.cd = 3.5; return; }
        const p = this.ports.player.position;
        if (Math.hypot(p.x - this.to.x, p.z - this.to.z) < 1.9) {
          this.ports.hurt(a, 35); this.ports.knock(p.x - this.from.x, p.z - this.from.z);
          this.st = this.p2 ? 'perch' : 'stalk'; this.cd = 2.5; if (this.p2) this.retreat(a);
        } else { this.st = 'open'; this.stT = 0; this.ports.feed('Aqbars skids — OPEN'); }
      }
    }
    if (this.st === 'open') { a.mem['low'] = 0.1; if (this.stT > 1.5) { this.st = 'stalk'; this.cd = 1.2; } }
    if (this.st === 'perch' && this.p2 && this.stT > 4 && this.cd <= 0) this.st = 'stalk';
  }
  snapshot(): v.InferOutput<typeof Saved> { return v.parse(Saved, { st: this.st, stT: this.stT, cd: this.cd, hitDone: this.hitDone, from: this.from.toArray(), to: this.to.toArray(), goal: this.goal }); }
  restore(input: unknown): void { const s = v.parse(Saved, input); this.st = s.st; this.stT = s.stT; this.cd = s.cd; this.hitDone = s.hitDone; this.from.fromArray(s.from); this.to.fromArray(s.to); if (s.goal === null) this.goal = null; else { Object.assign(this.goalPoint, s.goal); this.goal = this.goalPoint; } }
}
