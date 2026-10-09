import * as v from 'valibot';
import { Vector3, MathUtils } from 'three';
import type { AnimalSim } from '@wildshard/engine/entities/AnimalSim';
import type { PackBrain } from '@wildshard/engine/ai/pack';
import type { AqbarsContext } from './aqbarsKeeper';

/** The real pack controller is owned and snapshotted by its group host, not copied into the elite. */
export type KokboriPack<A extends AnimalSim> = Pick<PackBrain<A>, 'homeX' | 'homeZ' | 'phase' | 'awareness' | 'scare'>;
export interface KokboriPorts<A extends AnimalSim> {
  readonly player: { readonly position: Vector3 }; readonly lair: { readonly x: number; readonly z: number };
  readonly phase2: () => boolean; readonly pack: () => KokboriPack<A> | null;
  readonly environment: () => { readonly playerCrouched: boolean; readonly playerFwdX: number; readonly playerFwdZ: number; readonly grassHeightAt: (x: number, z: number) => number };
  readonly random: () => number;
  readonly rings: { readonly setTime: (t: number) => void; readonly ring: (x: number, z: number, r: number, strength: number) => void; readonly hide: () => void };
  readonly hurt: (a: A, amount: number) => void; readonly feed: (text: string) => void;
  readonly sound: (cue: 'wolf_howl', at: Vector3) => void; readonly signature: () => void;
}
const finite = v.pipe(v.number(), v.finite());
const Saved = v.strictObject({ st: v.picklist(['den', 'hold', 'howl', 'hunt', 'home']), howlT: finite, stT: finite,
  howlHit: v.union([finite, v.literal(-Infinity)]), cd: finite, bit: v.boolean() });
/** Shipping dusk elite decisions. The caller owns actor/pack identities, spawn order and the shared AI stream. */
export class KokboriKeeper<A extends AnimalSim> {
  private st: v.InferOutput<typeof Saved>['st'] = 'den';
  private howlT = 8; private stT = 0; private howlHit = -1; private cd = 0; private bit = false;
  private readonly back = new Vector3();
  private readonly playerDelta = { d: 0, yaw: 0 };
  constructor(private readonly ports: KokboriPorts<A>) {}
  private get p2(): boolean { return this.ports.phase2(); }
  private get pack(): KokboriPack<A> | null { return this.ports.pack(); }
  spawned(a: A): void { a.mem['howl'] = 0; this.st = 'den'; this.howlT = 8; }
  reset(a: A | null): void { this.st = 'home'; this.ports.rings.hide(); if (a !== null) a.mem['howl'] = 0; }
  disposeTell(): void { this.ports.rings.hide(); }
  private toPlayer(a: A): { d: number; yaw: number } {
    const p = this.ports.player.position;
    this.playerDelta.d = Math.hypot(p.x - a.position.x, p.z - a.position.z);
    this.playerDelta.yaw = Math.atan2(p.x - a.position.x, p.z - a.position.z); return this.playerDelta;
  }
  private goHome(a: A, c: AqbarsContext<A>, speed: number): void {
    const L = this.ports.lair; a.setMotion(c.pathYaw(a, L.x, L.z, 2), Math.hypot(L.x - a.position.x, L.z - a.position.z) > 3 ? speed : 0, 3);
  }
  private chase(a: A, c: AqbarsContext<A>, d: number, yaw: number): number { return d > 6 ? c.pathYaw(a, c.player.x, c.player.z, 0.6) : yaw; }
  private melee(p: Vector3): boolean { const pl = this.ports.player.position; return Math.hypot(p.x - pl.x, p.z - pl.z) < 3.8; }
  enterPhase2(a: A | null): void {
    if (this.pack && a) { this.pack.homeX = a.position.x; this.pack.homeZ = a.position.z; this.pack.phase = 'regroup'; }
    this.st = 'hunt'; this.cd = 1;
    this.ports.feed('Kokbori calls the pack back — and comes for you');
  }
  damage(a: A, p: Vector3): number {
    const wildEnv = this.ports.environment();
    // the weak point: an arrow from HIDDEN (crouched in tall grass) — and she is never soft in the howl
    const pl = this.ports.player.position;
    const hidden = wildEnv.playerCrouched && wildEnv.grassHeightAt(pl.x, pl.z) > 0.6;
    void a;
    return !this.melee(p) && hidden ? 2 : 1;
  }
  think(a: A, c: AqbarsContext<A>): void {
    const wildEnv = this.ports.environment();
    const tp = this.toPlayer(a);
    a.lookTarget.copy(c.player); a.lookWeight = 1;
    this.cd -= c.dt;
    switch (this.st) {
      case 'den': a.setMotion(tp.yaw, 0, 1.5); break;
      case 'home': this.goHome(a, c, 6); if (Math.hypot(a.position.x - this.ports.lair.x, a.position.z - this.ports.lair.z) < 4) this.st = 'den'; break;
      case 'hold': {
        // 24–32 m out (close enough to read her over the grass), sliding round you — and off your line of sight when you look at her
        const lookX = wildEnv.playerFwdX, lookZ = wildEnv.playerFwdZ;
        const ux = (a.position.x - c.player.x) / Math.max(1, tp.d), uz = (a.position.z - c.player.z) / Math.max(1, tp.d);
        const watched = lookX * ux + lookZ * uz > 0.9;
        const side = watched ? 1 : 0;
        const r = MathUtils.clamp(tp.d, 24, 32);
        const ang = Math.atan2(ux, uz) + side * 0.6;
        const gx = c.player.x + Math.sin(ang) * r, gz = c.player.z + Math.cos(ang) * r;
        const gd = Math.hypot(gx - a.position.x, gz - a.position.z);
        a.setMotion(gd > 2 ? Math.atan2(gx - a.position.x, gz - a.position.z) : tp.yaw, gd > 2 ? (watched ? 7 : 4) : 0, 3);
        a.mem['low'] = watched ? 0.6 : 0.2;
        break;
      }
      case 'howl': a.setMotion(a.yaw, 0, 1); break;
      case 'hunt': {
        a.mem['low'] = 0; a.mem['snarl'] = tp.d < 8 ? 1 : 0;
        if (a.attackPhase >= 0) break;
        if (tp.d < 3.5 && this.cd <= 0) { this.bit = false; a.startAttack(0.9); break; }
        a.setMotion(this.chase(a, c, tp.d, tp.yaw), tp.d > 2.5 ? 8 : 0, 3.5);
        break;
      }
      default: break;
    }
  }
  act(a: A): void {
    if (this.st !== 'hunt' || a.attackPhase < 0) return;
    const tp = this.toPlayer(a);

          a.setMotion(tp.yaw, 6, 4);
          if (a.attackPhase >= 0.7 && !this.bit) { this.bit = true; if (tp.d < 3.2) this.ports.hurt(a, 22); }
          if (a.attackPhase >= 1) { a.cancelAttack(); this.cd = 1.8; }
  }
  tick(a: A | null, dt: number, t: number, engaged: boolean, leashing: boolean): void {
    if (a === null) return;
    this.ports.rings.setTime(t);
    if (leashing && this.st !== 'home') this.st = 'home';
    if (engaged && (this.st === 'den' || this.st === 'home')) { this.st = this.p2 ? 'hunt' : 'hold'; this.howlT = 3; }
    this.stT += dt;
    if (this.st === 'hold' && !this.p2) {
      this.howlT -= dt;
      if (this.howlT <= 0) { this.st = 'howl'; this.stT = 0; this.howlHit = a.lastHitT; this.ports.signature(); this.ports.sound('wolf_howl', a.position); }
    }
    if (this.st === 'howl') {
      a.mem['howl'] = Math.min(1, this.stT / 0.3);
      // pale rings ripple out from her
      this.ports.rings.ring(a.position.x, a.position.z, 2 + ((this.stT * 11) % 12), 0.85 * (1 - ((this.stT * 11) % 12) / 12));
      if (a.lastHitT > this.howlHit) {
        // hit mid-howl: it breaks — she staggers, the pack scatters
        a.mem['howl'] = 0; this.ports.rings.hide();
        this.back.set(Math.sin(a.yaw), 0, Math.cos(a.yaw)).negate(); a.stagger(this.back, 1);
        this.pack?.scare(a.position.x, a.position.z, 80);
        this.ports.feed('The howl breaks — the pack scatters');
        this.st = 'hold'; this.howlT = 12;
      } else if (this.stT > 1.2) {
        a.mem['howl'] = 0; this.ports.rings.hide();
        if (this.pack) { this.pack.awareness = 1; this.pack.phase = 'encircle'; }
        this.ports.feed('PACK HOWL — the pack closes in');
        this.st = 'hold'; this.howlT = 11 + this.ports.random() * 4;
      }
    } else if (a.mem['howl'] !== 0) a.mem['howl'] = 0;
  }
  snapshot(): v.InferOutput<typeof Saved> { return { st: this.st, howlT: this.howlT, stT: this.stT, howlHit: this.howlHit, cd: this.cd, bit: this.bit }; }
  restore(input: unknown): void { const s = v.parse(Saved, input); this.st = s.st; this.howlT = s.howlT; this.stT = s.stT; this.howlHit = s.howlHit; this.cd = s.cd; this.bit = s.bit; }
}
