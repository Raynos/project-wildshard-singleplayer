import * as v from 'valibot';
import { Vector3 } from 'three';
import type { AnimalSim } from '@wildshard/engine/entities/AnimalSim';

export interface QyranPorts<A extends AnimalSim> {
  readonly player: { readonly position: Vector3 }; readonly rock: { readonly x: number; readonly z: number; readonly top: number };
  readonly phase2: () => boolean; readonly heightAt: (x: number, z: number) => number;
  readonly wind: () => { readonly x: number; readonly z: number }; readonly random: () => number;
  readonly isHead: (a: A, p: Vector3) => boolean;
  readonly tell: { readonly setTime: (t: number) => void; readonly aim: (from: Vector3, to: Vector3, alpha: number) => void;
    readonly chevron: (point: Vector3 | null) => void; readonly hide: () => void };
  readonly hurt: (a: A, amount: number) => void; readonly knock: (dx: number, dz: number) => void;
  readonly feed: (text: string) => void; readonly sound: (cue: 'eagle_cry', at: Vector3) => void; readonly signature: () => void;
}
const finite = v.pipe(v.number(), v.finite()), triple = v.tuple([finite, finite, finite]);
const Saved = v.strictObject({ st: v.picklist(['soar', 'tell', 'stoop', 'ground', 'climb']), stT: finite, stoopT: finite,
  ang: finite, centre: triple, tgt: triple, overYou: v.boolean() });
/** Shipping Storm-Wing decisions. The host owns deferred actor identity, altitude/body stepping and the shared AI stream. */
export class QyranKeeper<A extends AnimalSim> {
  private st: v.InferOutput<typeof Saved>['st'] = 'soar';
  private stT = 0; private stoopT = 8; private ang = 0;
  private readonly centre = new Vector3(); private readonly tgt = new Vector3();
  private readonly from = new Vector3(); private readonly delta = new Vector3();
  private overYou = false;
  constructor(private readonly ports: QyranPorts<A>) {}
  private get p2(): boolean { return this.ports.phase2(); }
  reset(): void { this.st = 'climb'; this.ports.tell.hide(); }
  disposeTell(): void { this.ports.tell.hide(); this.ports.tell.chevron(null); }
  private cruise(a: A | null): number {
    if (!this.overYou) return this.ports.rock.top + (this.p2 ? 52 : 34);
    // over you — but never inside the rock's flank the orbit swings across: 18 m clear of the ground under him
    const over = a !== null ? this.ports.heightAt(a.position.x, a.position.z) + 18 : -Infinity;
    return Math.max(this.ports.player.position.y + (this.p2 ? 36 : 24), over);
  }
  spawned(a: A): void {
    this.centre.set(this.ports.rock.x, 0, this.ports.rock.z);
    a.mem['altY'] = this.cruise(a); a.mem['flap'] = 0.3;
    this.st = 'soar'; this.stoopT = 8;
  }
  damage(a: A, p: Vector3): number {
    if (this.st === 'ground') return this.ports.isHead(a, p) ? 1 : 2.5;       // grounded: every hit a headshot
    return 1;
  }
  think(a: A, c: { readonly player: Vector3 }): void { a.lookTarget.copy(c.player); a.lookWeight = 1; a.setMotion(a.yaw, 0, 1); }
  tick(a: A | null, dt: number, t: number, engaged: boolean, leashing: boolean): void {
    if (a === null) return;
    const wind = this.ports.wind();
    this.ports.tell.setTime(t);
    this.stT += dt;
    const p = this.ports.player.position, m = a.mem;
    // the orbit centre: over you while engaged, back over the rock otherwise; always drifting downwind
    const home = leashing || !engaged;
    this.overYou = !home;
    const cx = home ? this.ports.rock.x : p.x, cz = home ? this.ports.rock.z : p.z;
    this.centre.x += (cx + wind.x * 12 - this.centre.x) * Math.min(1, dt * 0.4);
    this.centre.z += (cz + wind.z * 12 - this.centre.z) * Math.min(1, dt * 0.4);
    const R = 22;
    switch (this.st) {
      case 'soar': case 'climb': {
        this.ang += dt * 12 / R;
        const tx = this.centre.x + Math.cos(this.ang) * R, tz = this.centre.z + Math.sin(this.ang) * R;
        const k = this.st === 'climb' ? 1.5 : 3;
        a.position.x += (tx - a.position.x) * Math.min(1, dt * k); a.position.z += (tz - a.position.z) * Math.min(1, dt * k);
        a.yaw = a.desiredYaw = Math.atan2(-Math.sin(this.ang), Math.cos(this.ang));
        const cruise = this.cruise(a);
        const alt = m['altY'] ?? cruise;
        m['altY'] = this.st === 'climb' ? Math.min(cruise, alt + 9 * dt) : alt + (cruise + 2 * Math.sin(t * 0.5) - alt) * Math.min(1, dt * 0.6);
        m['flap'] = this.st === 'climb' ? 0.9 : 0.18 + 0.12 * Math.max(0, Math.sin(t * 0.6)); m['fold'] = 0; m['ground'] = 0; m['bank'] = 0.35;
        if (this.st === 'climb' && (m['altY'] ?? 0) >= cruise - 0.5) this.st = 'soar';
        if (engaged && this.st === 'soar') { this.stoopT -= dt; if (this.stoopT <= 0) { this.st = 'tell'; this.stT = 0; this.ports.signature(); this.ports.sound('eagle_cry', a.position); } }
        break;
    }
      case 'tell': {
        // hangs on the wind, wings half folding; a gold line streaks from it to you, the chevron at the screen edge
        const T = this.p2 ? 0.9 : 1.2;
        m['flap'] = 0.7; m['fold'] = 0.4 * (this.stT / T); m['bank'] = 0;
        a.yaw = a.desiredYaw = Math.atan2(p.x - a.position.x, p.z - a.position.z);
        a.headWorld(this.from);
        this.delta.set(p.x, p.y + 1.2, p.z);
        this.ports.tell.aim(this.from, this.delta, 0.4 + 0.6 * (this.stT / T));
        this.ports.tell.chevron(this.from);
        if (this.stT >= T) { this.st = 'stoop'; this.stT = 0; this.tgt.set(p.x, p.y + 0.9, p.z); }
        break;
    }
      case 'stoop': {
        m['fold'] = 1; m['flap'] = 0;
        this.from.set(a.position.x, m['altY'] ?? 0, a.position.z);
        this.delta.copy(this.tgt).sub(this.from);
        const L = this.delta.length(), step = 40 * dt;
        this.ports.tell.aim(this.from, this.tgt, 0.5);
        this.ports.tell.chevron(this.from);
        if (L <= step + 0.6) {
          this.ports.tell.hide(); this.ports.tell.chevron(null);
          a.position.x = this.tgt.x; a.position.z = this.tgt.z;
          if (Math.hypot(p.x - this.tgt.x, p.z - this.tgt.z) < 2.4 && p.y - this.ports.heightAt(p.x, p.z) < 1.5) {
            this.ports.hurt(a, 30); this.ports.knock(p.x - this.from.x, p.z - this.from.z);
            this.st = 'climb'; m['altY'] = this.tgt.y + 2;
          } else { this.st = 'ground'; this.stT = 0; m['altY'] = this.ports.heightAt(a.position.x, a.position.z) + 0.55 * a.scale; this.ports.feed('Qyran is GROUNDED'); }
          this.stoopT = this.p2 ? 4.5 + this.ports.random() * 1.5 : 7 + this.ports.random() * 2;
        } else {
          this.delta.multiplyScalar(step / L);
          a.position.x += this.delta.x; a.position.z += this.delta.z; m['altY'] = (m['altY'] ?? 0) + this.delta.y; m['altS'] = m['altY'];
          a.yaw = a.desiredYaw = Math.atan2(this.delta.x, this.delta.z);
      }
        break;
    }
      case 'ground': {
        m['ground'] = 1; m['fold'] = 0; m['flap'] = 0;
        m['altY'] = this.ports.heightAt(a.position.x, a.position.z) + 0.42 * a.scale;
        if (this.stT > 2) { this.st = 'climb'; m['ground'] = 0; }
        break;
    }
      default: break;
  }
    if (this.st !== 'tell' && this.st !== 'stoop') { this.ports.tell.hide(); this.ports.tell.chevron(null); }
  }
  snapshot(): v.InferOutput<typeof Saved> { return { st: this.st, stT: this.stT, stoopT: this.stoopT, ang: this.ang, centre: [this.centre.x, this.centre.y, this.centre.z], tgt: [this.tgt.x, this.tgt.y, this.tgt.z], overYou: this.overYou }; }
  restore(input: unknown): void { const s = v.parse(Saved, input); this.st = s.st; this.stT = s.stT; this.stoopT = s.stoopT; this.ang = s.ang; this.centre.fromArray(s.centre); this.tgt.fromArray(s.tgt); this.overYou = s.overYou; }
}
