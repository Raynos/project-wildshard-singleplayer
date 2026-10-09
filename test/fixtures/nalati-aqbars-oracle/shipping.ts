import * as THREE from 'three';
import type { AnimalSim as Animal } from '../../../src/engine/entities/AnimalSim';
import type { AqbarsPorts, AqbarsContext as ThinkCtx, AqbarsLedge as Ledge } from '../../../src/shards/nalati-grasslands/runtime/aqbarsKeeper';
/** Frozen page decisions, with their native body and authored input/output ports. No renderer stands in for a world. */
export class AqbarsOracle {
  private st: 'lurk' | 'stalk' | 'tell' | 'leap' | 'open' | 'swipe' | 'perch' | 'home' = 'lurk';
  private stT = 0; private cd = 2; private hitDone = 0;
  private readonly from = new THREE.Vector3(); private readonly to = new THREE.Vector3();
  private goal: { x: number; z: number; y: number } | null = null;
  private readonly ring; private readonly def;
  constructor(private readonly env: AqbarsPorts<Animal>, private readonly animal: Animal) {
    this.ring = env.ring; this.def = { lair: env.lair, awareR: env.awareRadius };
  }
  private get p2(): boolean { return this.env.phase2(); }
  private engagement(_engaged: boolean): void { /* view pinning is outside the decision law */ }
  private sig(): void { this.env.signature(); }
  private toPlayer(a: Animal): { d: number; yaw: number } { const p = this.env.player.position, dx = p.x - a.position.x, dz = p.z - a.position.z; return { d: Math.hypot(dx, dz), yaw: Math.atan2(dx, dz) }; }
  private goHome(a: Animal, c: ThinkCtx<Animal>, speed: number): void { const dx = this.def.lair.x - a.position.x, dz = this.def.lair.z - a.position.z; a.setMotion(c.pathYaw(a, this.def.lair.x, this.def.lair.z, 2), Math.hypot(dx, dz) > 3 ? speed : 0, 3); }
  private chase(a: Animal, c: ThinkCtx<Animal>, d: number, yaw: number, near: number): number { return d > near ? c.pathYaw(a, c.player.x, c.player.z, 0.6) : yaw; }
  spawned(): void { this.st = 'lurk'; this.cd = 2; }
  reset(): void { this.st = 'home'; this.ring.hide(); this.animal.mem['leap'] = 0; this.animal.mem['low'] = 0; }
  private standY(x: number, z: number): number {
    const heightAt = this.env.heightAt;
// BEGIN SHIPPING standY

    let y = heightAt(x, z);
    for (const l of this.env.ledges) if (Math.hypot(x - l.x, z - l.z) < l.r + 0.3) y = Math.max(y, l.y);
    return y;
  
// END SHIPPING standY
  }
  damage(a: Animal, p: THREE.Vector3): number {
    const isHead = this.env.isHead;
// BEGIN SHIPPING damage

    if (this.st === 'leap') return 2;                                   // the weak point: its airborne body
    if (this.st === 'open') return isHead(a, p) ? 1.2 : 1;            // the skid: headshots ×3 (the manager's ×2.5 × 1.2)
    if (this.p2 && this.st === 'perch') return 0.25;                   // up on its ledge in phase 2
    return 1;
  
// END SHIPPING damage
  }
  private perchFor(px: number, pz: number, py: number): Ledge | null {
// BEGIN SHIPPING perchFor

    let best: Ledge | null = null, bd = Infinity;
    for (const l of this.env.ledges) {
      const up = l.y - py, d = Math.hypot(l.x - px, l.z - pz);
      if (up < 3 || up > 8 || d < 4 || d > 14) continue;
      if (d < bd) { bd = d; best = l; }
    }
    return best;
  
// END SHIPPING perchFor
  }
  think(a: Animal, c: ThinkCtx<Animal>): void {
// BEGIN SHIPPING think

    const pl = c.player, tp = this.toPlayer(a);
    this.cd -= c.dt;
    a.lookTarget.copy(pl); a.lookWeight = this.st === 'lurk' ? 0.4 : 1;
    switch (this.st) {
      case 'lurk': a.setMotion(a.yaw, 0, 1); break;
      case 'home': this.goHome(a, c, 5); if (Math.hypot(a.position.x - this.def.lair.x, a.position.z - this.def.lair.z) < 3) this.st = 'lurk'; break;
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
  
// END SHIPPING think
  }
  act(a: Animal): void {
// BEGIN SHIPPING act

    if (this.st !== 'swipe') return;
    const tp = this.toPlayer(a);

        a.setMotion(tp.yaw, 0, 5);
        const k = a.attackPhase;
        if (k >= 0.45 && this.hitDone === 0) { this.hitDone = 1; if (tp.d < 2.9) this.env.hurt(a, 14); }
        if (k >= 0.8 && this.hitDone === 1) { this.hitDone = 2; if (tp.d < 2.9) this.env.hurt(a, 14); }
        if (k >= 1 || k < 0) { a.cancelAttack(); this.st = this.p2 ? 'perch' : 'stalk'; this.cd = 1.4; if (this.p2) this.retreat(a); }
  
// END SHIPPING act
  }
  private startTell(a: Animal, pl: THREE.Vector3): void {
    const heightAt = this.env.heightAt;
// BEGIN SHIPPING startTell

    this.st = 'tell'; this.stT = 0;
    this.from.copy(a.position);
    this.to.set(pl.x, 0, pl.z); this.to.y = heightAt(pl.x, pl.z);
    a.mem['low'] = 1; a.mem['snarl'] = 1;
    this.sig();
    this.env.sound('leopard_growl', a.position);
  
// END SHIPPING startTell
  }
  private retreat(a: Animal): void {
    const heightAt = this.env.heightAt;
// BEGIN SHIPPING retreat

    let best: Ledge | null = null, bd = -1;
    for (const l of this.env.ledges) { const up = l.y - heightAt(l.x, l.z); const d = Math.hypot(l.x - a.position.x, l.z - a.position.z); if (up > 2.5 && d < 25 && d > bd) { bd = d; best = l; } }
    if (best !== null) { this.from.copy(a.position); this.to.set(best.x, best.y, best.z); this.st = 'leap'; this.stT = 0; this.goal = { x: best.x, z: best.z, y: best.y }; }
  
// END SHIPPING retreat
  }
  tick(dt: number, t: number, engaged: boolean, leashing: boolean): void {
    const heightAt = this.env.heightAt;
// BEGIN SHIPPING tick

    this.engagement(engaged);
    const a = this.animal;
    if (!a) return;
    this.ring.setTime(t);
    if (leashing && this.st !== 'home') this.st = 'home';
    // aware (inside 60 m) it already stalks you — down off the rock, along the ledges; the fight starts at 25 m
    if ((this.st === 'lurk' || (this.st === 'home' && !leashing)) && (engaged || a.position.distanceTo(this.env.player.position) < this.def.awareR)) { this.st = 'stalk'; this.cd = 1.5; }
    this.stT += dt;
    // stand on the ledge / rock under it (the Crags' ledges are platforms, not terrain)
    if (this.st !== 'leap') a.yOffset += ((this.standY(a.position.x, a.position.z) - heightAt(a.position.x, a.position.z)) - a.yOffset) * Math.min(1, dt * 10);
    if (this.st === 'tell') {
      this.ring.ring(this.to.x, this.to.z, 2.2, 0.6 + 0.4 * Math.min(1, this.stT / 0.3));
      if (this.stT > 1.0) { this.st = 'leap'; this.stT = 0; this.goal = null; this.from.copy(a.position); this.from.y = this.standY(a.position.x, a.position.z); }
    } else if (this.st !== 'leap') this.ring.hide();
    if (this.st === 'leap') {
      // a ballistic arc from the perch to the ring (or up to a retreat ledge)
      const T = 0.6, k = Math.min(1, this.stT / T);
      const x = THREE.MathUtils.lerp(this.from.x, this.to.x, k), z = THREE.MathUtils.lerp(this.from.z, this.to.z, k);
      const y = THREE.MathUtils.lerp(this.from.y, this.to.y, k) + Math.sin(k * Math.PI) * 1.6;
      a.position.x = x; a.position.z = z; a.yOffset = y - heightAt(x, z);
      a.yaw = a.desiredYaw = Math.atan2(this.to.x - this.from.x, this.to.z - this.from.z);
      a.mem['leap'] = Math.sin(k * Math.PI) * 0.6 + 0.4; a.mem['low'] = 0;
      if (k >= 1) {
        a.mem['leap'] = 0; a.mem['snarl'] = 0;
        this.ring.hide();
        if (this.goal !== null) { this.st = 'perch'; this.cd = 3.5; return; }
        const p = this.env.player.position;
        if (Math.hypot(p.x - this.to.x, p.z - this.to.z) < 1.9) {
          this.env.hurt(a, 35); this.env.knock(p.x - this.from.x, p.z - this.from.z);
          this.st = this.p2 ? 'perch' : 'stalk'; this.cd = 2.5; if (this.p2) this.retreat(a);
        } else { this.st = 'open'; this.stT = 0; this.env.feed('Aqbars skids — OPEN'); }
      }
    }
    if (this.st === 'open') { a.mem['low'] = 0.1; if (this.stT > 1.5) { this.st = 'stalk'; this.cd = 1.2; } }
    if (this.st === 'perch' && this.p2 && this.stT > 4 && this.cd <= 0) this.st = 'stalk';
  
// END SHIPPING tick
  }
  snapshot() { return { st: this.st, stT: this.stT, cd: this.cd, hitDone: this.hitDone, from: this.from.toArray(), to: this.to.toArray(), goal: this.goal }; }
}
