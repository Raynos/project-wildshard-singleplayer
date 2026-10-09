import * as v from 'valibot';
import { Vector3 } from 'three';
import type { AnimalSim } from '@wildshard/engine/entities/AnimalSim';

/** The actual night roster owns these actors, its kill counter and its line/arrow policy. */
export interface QaraCrew<A extends AnimalSim> {
  readonly killsTonight: number;
  readonly spawnLine: (count: 3) => readonly A[];
  readonly dissolve: (a: A) => void;
}
export interface QaraPorts<A extends AnimalSim> {
  readonly player: { readonly position: Vector3 }; readonly lair: { readonly x: number; readonly z: number };
  readonly awareRadius: number; readonly phase2: () => boolean; readonly heightAt: (x: number, z: number) => number;
  readonly crew: QaraCrew<A> | null; readonly resolve: (id: string) => A | null;
  readonly lane: { readonly setTime: (t: number) => void; readonly hide: () => void;
    readonly lane: (x0: number, z0: number, x1: number, z1: number, width: number, alpha: number) => void };
  readonly hurt: (a: A, amount: number) => void; readonly knock: (dx: number, dz: number) => void;
  readonly feed: (text: string) => void; readonly sound: (cue: 'horse_squeal', at: Vector3) => void; readonly signature: () => void;
}
const finite = v.pipe(v.number(), v.finite()), triple = v.tuple([finite, finite, finite]);
const Saved = v.strictObject({ st: v.picklist(['wait', 'circle', 'wheel', 'charge', 'open', 'home']), stT: finite, chargeT: finite,
  pairs: v.picklist([0, 1]), struck: v.boolean(), c0: triple, c1: triple, line: v.pipe(v.array(v.string()), v.maxLength(3)) });
const invalidLine = new Error('Invalid Qara companion line');
/** Shipping night-captain policy. The real ghost roster supplies line/arrow ownership; this is not a replacement for it. */
export class QaraKeeper<A extends AnimalSim> {
  private st: v.InferOutput<typeof Saved>['st'] = 'wait';
  private stT = 0; private chargeT = 6; private pairs: 0 | 1 = 0; private struck = false;
  private line: readonly A[] = [];
  private readonly c0 = new Vector3(); private readonly c1 = new Vector3();
  constructor(private readonly ports: QaraPorts<A>) {}
  private get p2(): boolean { return this.ports.phase2(); }
  spawned(): void { this.st = 'wait'; }
  reset(): void { this.st = 'home'; this.ports.lane.hide(); }
  disposeLine(): void {
    this.ports.lane.hide();
    for (let i = 0; i < 3; i++) { const a = this.line[i]; if (a === undefined) break; if (a.alive) this.ports.crew?.dissolve(a); }
    this.line = [];
  }
  private melee(p: Vector3): boolean { const pl = this.ports.player.position; return Math.hypot(p.x - pl.x, p.z - pl.z) < 3.8; }
  canSpawn(): boolean { return this.ports.crew === null || this.ports.crew.killsTonight >= 5;   }
  damage(_a: A, p: Vector3): number { return this.st === 'open' && this.melee(p) ? 3 : 1;   }
  think(a: A, c: { readonly player: Vector3 }): void {
    const m = a.mem, tx = m['tx'], tz = m['tz'];
    a.lookTarget.copy(c.player); a.lookWeight = 0.5;
    if (tx === undefined || tz === undefined) { a.setMotion(a.yaw, 0, 1); return; }
    const dx = tx - a.position.x, dz = tz - a.position.z;
    a.setMotion(Math.atan2(dx, dz), Math.hypot(dx, dz) < 0.8 ? 0 : m['v'] ?? 9, m['turn'] ?? 2.4);
    }
  private drawLane(p: Vector3, alpha: number): void {
    const dx = p.x - this.c0.x, dz = p.z - this.c0.z, d = Math.hypot(dx, dz);
    if (d < 4) { this.ports.lane.hide(); return; }
    const k = (d - 3) / d;
    this.ports.lane.lane(this.c0.x, this.c0.z, this.c0.x + dx * k, this.c0.z + dz * k, 2.6, alpha);
    }
  private steer(a: A, x: number, z: number, speed: number, turn: number): void { a.mem['tx'] = x; a.mem['tz'] = z; a.mem['v'] = speed; a.mem['turn'] = turn;   }
  private lineDead(): boolean {
    for (let i = 0; i < 3; i++) if (this.line[i]?.alive === true) return false;
    return true;
  }
  private bindLine(members: readonly A[]): void {
    if (members.length > 3) throw invalidLine;
    for (let i = 0; i < 3; i++) {
      if (i >= members.length) break;
      const a = members[i];
      if (a === undefined) throw invalidLine;
      for (let j = 0; j < 3; j++) if (j < i && members[j]?.entityId === a.entityId) throw invalidLine;
    }
    this.line = members;
  }
  tick(a: A | null, dt: number, t: number, engaged: boolean, leashing: boolean): void {
    if (a === null) return;
    this.ports.lane.setTime(t);
    if (leashing && this.st !== 'home') this.st = 'home';
    if ((this.st === 'wait' || (this.st === 'home' && !leashing)) && (engaged || a.position.distanceTo(this.ports.player.position) < this.ports.awareRadius * 0.8)) {
      this.st = 'circle'; this.chargeT = 3;
      // his riders ride with him and loose their volleys (B11's line AI)
      if (this.ports.crew !== null && this.lineDead()) this.bindLine(this.ports.crew.spawnLine(3));
    }
    this.stT += dt;
    const p = this.ports.player.position;
    switch (this.st) {
      case 'wait': this.steer(a, a.position.x, a.position.z, 0, 1.5); break;
      case 'home':
        this.steer(a, this.ports.lair.x, this.ports.lair.z, 9, 2.4);
        if (Math.hypot(a.position.x - this.ports.lair.x, a.position.z - this.ports.lair.z) < 5) this.st = 'wait';
        break;
      case 'circle': {
        // gallop a ring round you, 22 m out
        const ang = Math.atan2(a.position.x - p.x, a.position.z - p.z) + 0.55;
        this.steer(a, p.x + Math.sin(ang) * 22, p.z + Math.cos(ang) * 22, 10, 2.2);
        this.chargeT -= dt;
        if (this.chargeT <= 0) { this.st = 'wheel'; this.stT = 0; this.ports.signature(); }
        break;
      }
      case 'wheel': {
        // the lane of ghost-fire: from him, through you, 12 m on — then he comes down it
        this.steer(a, p.x, p.z, 0.01, 5);
        this.c0.copy(a.position);
        const dx = p.x - a.position.x, dz = p.z - a.position.z, d = Math.hypot(dx, dz) || 1;
        this.c1.set(p.x + dx / d * 12, 0, p.z + dz / d * 12);
        this.drawLane(p, 0.22 + 0.2 * Math.min(1, this.stT / 0.4));
        if (this.stT > 1.3) { this.st = 'charge'; this.stT = 0; this.struck = false; this.ports.sound('horse_squeal', a.position); }
        break;
      }
      case 'charge': {
        this.steer(a, this.c1.x, this.c1.z, 18, 0.6);
        this.drawLane(p, 0.36);
        if (!this.struck && Math.hypot(p.x - a.position.x, p.z - a.position.z) < 1.9 && p.y - this.ports.heightAt(p.x, p.z) < 1.6) {
          this.struck = true; this.ports.hurt(a, 38); this.ports.knock(this.c1.x - this.c0.x, this.c1.z - this.c0.z);
        }
        const along = ((a.position.x - this.c0.x) * (this.c1.x - this.c0.x) + (a.position.z - this.c0.z) * (this.c1.z - this.c0.z)) / Math.max(1, this.c0.distanceToSquared(this.c1));
        if (along >= 0.97 || this.stT > 4) {
          this.ports.lane.hide();
          if (!this.struck) { this.st = 'open'; this.stT = 0; this.ports.feed('He passes — his back is OPEN'); }
          else this.nextCharge();
        }
        break;
      }
      case 'open':
        this.steer(a, a.position.x + Math.sin(a.yaw) * 6, a.position.z + Math.cos(a.yaw) * 6, 3, 1);
        if (this.stT > 2) this.nextCharge();
        break;
      default: break;
    }
    }
  private nextCharge(): void {
    // phase 2: the charges come in pairs
    if (this.p2 && this.pairs === 0) { this.pairs = 1; this.st = 'wheel'; this.stT = 0; return; }
    this.pairs = 0; this.st = 'circle'; this.chargeT = this.p2 ? 4.5 : 6.5;
    }
  snapshot(): v.InferOutput<typeof Saved> { return { st: this.st, stT: this.stT, chargeT: this.chargeT, pairs: this.pairs, struck: this.struck,
    c0: [this.c0.x, this.c0.y, this.c0.z], c1: [this.c1.x, this.c1.y, this.c1.z], line: this.line.map(a => a.entityId) }; }
  restore(input: unknown): void {
    const s = v.parse(Saved, input);
    if (new Set(s.line).size !== s.line.length) throw new Error('Duplicate Qara companion identity');
    const line = s.line.map(id => { const a = this.ports.resolve(id); if (a === null || a.entityId !== id) throw new Error('Missing Qara companion identity'); return a; });
    this.st = s.st; this.stT = s.stT; this.chargeT = s.chargeT; this.pairs = s.pairs; this.struck = s.struck;
    this.c0.fromArray(s.c0); this.c1.fromArray(s.c1); this.line = line;
  }
}
