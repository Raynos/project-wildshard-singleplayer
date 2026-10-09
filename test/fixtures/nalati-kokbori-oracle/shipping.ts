import * as THREE from 'three';
import type { AnimalSim as Animal } from '../../../src/engine/entities/AnimalSim';
import type { AqbarsContext as ThinkCtx } from '../../../src/shards/nalati-grasslands/runtime/aqbarsKeeper';
import type { KokboriPorts } from '../../../src/shards/nalati-grasslands/runtime/kokboriKeeper';
class Phase {
  protected p2 = false;
  enterPhase2(): void { this.p2 = true; }
}
/** Authenticated pre-extraction page decisions; only renderer/environment services are injected. */
export class KokboriOracle extends Phase {
  private st: 'den' | 'hold' | 'howl' | 'hunt' | 'home' = 'den';
  private howlT = 8; private stT = 0; private howlHit = -1; private cd = 0; private bit = false;
  private readonly rings; private readonly def;
  constructor(private readonly env: KokboriPorts<Animal>, private readonly animal: Animal) { super(); this.rings = env.rings; this.def = { lair: env.lair }; }
  private get pack() { return this.env.pack(); }
  private engagement(_engaged: boolean): void { /* view-only pinning */ }
  private sig(): void { this.env.signature(); }
  private toPlayer(a: Animal) { const p = this.env.player.position; return { d: Math.hypot(p.x - a.position.x, p.z - a.position.z), yaw: Math.atan2(p.x - a.position.x, p.z - a.position.z) }; }
  private goHome(a: Animal, c: ThinkCtx<Animal>, speed: number): void { const L = this.def.lair; a.setMotion(c.pathYaw(a, L.x, L.z, 2), Math.hypot(L.x - a.position.x, L.z - a.position.z) > 3 ? speed : 0, 3); }
  private chase(a: Animal, c: ThinkCtx<Animal>, d: number, yaw: number): number { return d > 6 ? c.pathYaw(a, c.player.x, c.player.z, 0.6) : yaw; }
  private melee(p: THREE.Vector3): boolean { const pl = this.env.player.position; return Math.hypot(p.x - pl.x, p.z - pl.z) < 3.8; }
  spawned(): void { this.animal.mem['howl'] = 0; this.st = 'den'; this.howlT = 8; }
  reset(): void { this.p2 = false; this.st = 'home'; this.rings.hide(); this.animal.mem['howl'] = 0; }
  override enterPhase2(): void {
// BEGIN SHIPPING enterPhase2

    super.enterPhase2();
    const a = this.animal;
    if (this.pack && a) { this.pack.homeX = a.position.x; this.pack.homeZ = a.position.z; this.pack.phase = 'regroup'; }
    this.st = 'hunt'; this.cd = 1;
    this.env.feed('Kokbori calls the pack back — and comes for you');
  
// END SHIPPING enterPhase2
  }
  damage(a: Animal, p: THREE.Vector3): number {
    const wildEnv = this.env.environment();
// BEGIN SHIPPING damage

    // the weak point: an arrow from HIDDEN (crouched in tall grass) — and she is never soft in the howl
    const pl = this.env.player.position;
    const hidden = wildEnv.playerCrouched && wildEnv.grassHeightAt(pl.x, pl.z) > 0.6;
    void a;
    return !this.melee(p) && hidden ? 2 : 1;
  
// END SHIPPING damage
  }
  think(a: Animal, c: ThinkCtx<Animal>): void {
    const wildEnv = this.env.environment();
// BEGIN SHIPPING think

    const tp = this.toPlayer(a);
    a.lookTarget.copy(c.player); a.lookWeight = 1;
    this.cd -= c.dt;
    switch (this.st) {
      case 'den': a.setMotion(tp.yaw, 0, 1.5); break;
      case 'home': this.goHome(a, c, 6); if (Math.hypot(a.position.x - this.def.lair.x, a.position.z - this.def.lair.z) < 4) this.st = 'den'; break;
      case 'hold': {
        // 24–32 m out (close enough to read her over the grass), sliding round you — and off your line of sight when you look at her
        const lookX = wildEnv.playerFwdX, lookZ = wildEnv.playerFwdZ;
        const ux = (a.position.x - c.player.x) / Math.max(1, tp.d), uz = (a.position.z - c.player.z) / Math.max(1, tp.d);
        const watched = lookX * ux + lookZ * uz > 0.9;
        const side = watched ? 1 : 0;
        const r = THREE.MathUtils.clamp(tp.d, 24, 32);
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
  
// END SHIPPING think
  }
  act(a: Animal, _c: ThinkCtx<Animal>): void {
// BEGIN SHIPPING act

    if (this.st !== 'hunt' || a.attackPhase < 0) return;
    const tp = this.toPlayer(a);

          a.setMotion(tp.yaw, 6, 4);
          if (a.attackPhase >= 0.7 && !this.bit) { this.bit = true; if (tp.d < 3.2) this.env.hurt(a, 22); }
          if (a.attackPhase >= 1) { a.cancelAttack(); this.cd = 1.8; }
  
// END SHIPPING act
  }
  tick(dt: number, t: number, engaged: boolean, leashing: boolean): void {
    const _v = new THREE.Vector3();
    const app = { rng: { stream: (_name: string) => ({ next: this.env.random }) } };
// BEGIN SHIPPING tick

    this.engagement(engaged);
    const a = this.animal;
    if (!a) return;
    this.rings.setTime(t);
    if (leashing && this.st !== 'home') this.st = 'home';
    if (engaged && (this.st === 'den' || this.st === 'home')) { this.st = this.p2 ? 'hunt' : 'hold'; this.howlT = 3; }
    this.stT += dt;
    if (this.st === 'hold' && !this.p2) {
      this.howlT -= dt;
      if (this.howlT <= 0) { this.st = 'howl'; this.stT = 0; this.howlHit = a.lastHitT; this.sig(); this.env.sound('wolf_howl', a.position); }
    }
    if (this.st === 'howl') {
      a.mem['howl'] = Math.min(1, this.stT / 0.3);
      // pale rings ripple out from her
      this.rings.ring(a.position.x, a.position.z, 2 + ((this.stT * 11) % 12), 0.85 * (1 - ((this.stT * 11) % 12) / 12));
      if (a.lastHitT > this.howlHit) {
        // hit mid-howl: it breaks — she staggers, the pack scatters
        a.mem['howl'] = 0; this.rings.hide();
        _v.set(Math.sin(a.yaw), 0, Math.cos(a.yaw)).negate(); a.stagger(_v, 1);
        this.pack?.scare(a.position.x, a.position.z, 80);
        this.env.feed('The howl breaks — the pack scatters');
        this.st = 'hold'; this.howlT = 12;
      } else if (this.stT > 1.2) {
        a.mem['howl'] = 0; this.rings.hide();
        if (this.pack) { this.pack.awareness = 1; this.pack.phase = 'encircle'; }
        this.env.feed('PACK HOWL — the pack closes in');
        this.st = 'hold'; this.howlT = 11 + app.rng.stream('ai').next() * 4;
      }
    } else if (a.mem['howl'] !== 0) a.mem['howl'] = 0;
  
// END SHIPPING tick
  }
  snapshot() { return { st: this.st, howlT: this.howlT, stT: this.stT, howlHit: this.howlHit, cd: this.cd, bit: this.bit }; }
}
