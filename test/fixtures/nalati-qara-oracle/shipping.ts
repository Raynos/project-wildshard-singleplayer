import * as THREE from 'three';
import type { AnimalSim as Animal } from '../../../src/engine/entities/AnimalSim';
import type { QaraPorts } from '../../../src/shards/nalati-grasslands/runtime/qaraKeeper';
/** Authenticated shipping method bodies; visual attachment is absent, while lane/crew events stay observable. */
export class QaraOracle {
  private st: 'wait' | 'circle' | 'wheel' | 'charge' | 'open' | 'home' = 'wait';
  private stT = 0; private chargeT = 6; private pairs = 0;
  private line: readonly Animal[] = []; private readonly c0 = new THREE.Vector3(); private readonly c1 = new THREE.Vector3(); private struck = false;
  private rider: { position: THREE.Vector3; rotation: { y: number } } | null = null;
  private readonly lane; private readonly def; private readonly env;
  constructor(private readonly ports: QaraPorts<Animal>, private readonly animal: Animal) {
    this.lane = ports.lane; this.def = { lair: ports.lair, awareR: ports.awareRadius };
    const crew = ports.crew;
    this.env = { player: ports.player, hurt: ports.hurt, knock: ports.knock, feed: ports.feed, sound: ports.sound,
      ghosts: crew === null ? null : { get killsTonight() { return crew.killsTonight; }, spawnLine: (_o: { count: 3 }) => crew.spawnLine(3) } };
  }
  private get p2(): boolean { return this.ports.phase2(); }
  private engagement(_engaged: boolean): void { /* residency pins are owned by the caller */ }
  private sig(): void { this.ports.signature(); }
  private melee(p: THREE.Vector3): boolean { const pl = this.ports.player.position; return Math.hypot(p.x - pl.x, p.z - pl.z) < 3.8; }
  spawned(): void { this.st = 'wait'; }
  reset(): void { this.st = 'home'; this.lane.hide(); }
  canSpawn(): boolean {
// BEGIN SHIPPING canSpawn
 return this.env.ghosts === null || this.env.ghosts.killsTonight >= 5; 
// END SHIPPING canSpawn
  }
  damage(_a: Animal, p: THREE.Vector3): number {
// BEGIN SHIPPING damage
 return this.st === 'open' && this.melee(p) ? 3 : 1; 
// END SHIPPING damage
  }
  think(a: Animal, c: { readonly player: THREE.Vector3 }): void {
// BEGIN SHIPPING think

    const m = a.mem, tx = m['tx'], tz = m['tz'];
    a.lookTarget.copy(c.player); a.lookWeight = 0.5;
    if (tx === undefined || tz === undefined) { a.setMotion(a.yaw, 0, 1); return; }
    const dx = tx - a.position.x, dz = tz - a.position.z;
    a.setMotion(Math.atan2(dx, dz), Math.hypot(dx, dz) < 0.8 ? 0 : m['v'] ?? 9, m['turn'] ?? 2.4);
  
// END SHIPPING think
  }
  private drawLane(p: THREE.Vector3, alpha: number): void {
// BEGIN SHIPPING drawLane

    const dx = p.x - this.c0.x, dz = p.z - this.c0.z, d = Math.hypot(dx, dz);
    if (d < 4) { this.lane.hide(); return; }
    const k = (d - 3) / d;
    this.lane.lane(this.c0.x, this.c0.z, this.c0.x + dx * k, this.c0.z + dz * k, 2.6, alpha);
  
// END SHIPPING drawLane
  }
  private steer(a: Animal, x: number, z: number, v: number, turn: number): void {
// BEGIN SHIPPING steer
 a.mem['tx'] = x; a.mem['tz'] = z; a.mem['v'] = v; a.mem['turn'] = turn; 
// END SHIPPING steer
  }
  tick(dt: number, t: number, engaged: boolean, leashing: boolean): void {
    const heightAt = this.ports.heightAt;
    const horseSaddle = (_a: Animal, _point: THREE.Vector3): void => { throw new Error("No visual rider attachment in this policy witness"); };
// BEGIN SHIPPING tick

    this.engagement(engaged);
    const a = this.animal;
    if (!a) return;
    this.lane.setTime(t);
    if (this.rider) { horseSaddle(a, this.rider.position); this.rider.rotation.y = a.yaw; }
    if (leashing && this.st !== 'home') this.st = 'home';
    if ((this.st === 'wait' || (this.st === 'home' && !leashing)) && (engaged || a.position.distanceTo(this.env.player.position) < this.def.awareR * 0.8)) {
      this.st = 'circle'; this.chargeT = 3;
      // his riders ride with him and loose their volleys (B11's line AI)
      if (this.env.ghosts !== null && this.line.every((r) => !r.alive)) this.line = this.env.ghosts.spawnLine({ count: 3 });
    }
    this.stT += dt;
    const p = this.env.player.position;
    switch (this.st) {
      case 'wait': this.steer(a, a.position.x, a.position.z, 0, 1.5); break;
      case 'home':
        this.steer(a, this.def.lair.x, this.def.lair.z, 9, 2.4);
        if (Math.hypot(a.position.x - this.def.lair.x, a.position.z - this.def.lair.z) < 5) this.st = 'wait';
        break;
      case 'circle': {
        // gallop a ring round you, 22 m out
        const ang = Math.atan2(a.position.x - p.x, a.position.z - p.z) + 0.55;
        this.steer(a, p.x + Math.sin(ang) * 22, p.z + Math.cos(ang) * 22, 10, 2.2);
        this.chargeT -= dt;
        if (this.chargeT <= 0) { this.st = 'wheel'; this.stT = 0; this.sig(); }
        break;
      }
      case 'wheel': {
        // the lane of ghost-fire: from him, through you, 12 m on — then he comes down it
        this.steer(a, p.x, p.z, 0.01, 5);
        this.c0.copy(a.position);
        const dx = p.x - a.position.x, dz = p.z - a.position.z, d = Math.hypot(dx, dz) || 1;
        this.c1.set(p.x + dx / d * 12, 0, p.z + dz / d * 12);
        this.drawLane(p, 0.22 + 0.2 * Math.min(1, this.stT / 0.4));
        if (this.stT > 1.3) { this.st = 'charge'; this.stT = 0; this.struck = false; this.env.sound('horse_squeal', a.position); }
        break;
      }
      case 'charge': {
        this.steer(a, this.c1.x, this.c1.z, 18, 0.6);
        this.drawLane(p, 0.36);
        if (!this.struck && Math.hypot(p.x - a.position.x, p.z - a.position.z) < 1.9 && p.y - heightAt(p.x, p.z) < 1.6) {
          this.struck = true; this.env.hurt(a, 38); this.env.knock(this.c1.x - this.c0.x, this.c1.z - this.c0.z);
        }
        const along = ((a.position.x - this.c0.x) * (this.c1.x - this.c0.x) + (a.position.z - this.c0.z) * (this.c1.z - this.c0.z)) / Math.max(1, this.c0.distanceToSquared(this.c1));
        if (along >= 0.97 || this.stT > 4) {
          this.lane.hide();
          if (!this.struck) { this.st = 'open'; this.stT = 0; this.env.feed('He passes — his back is OPEN'); }
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
  
// END SHIPPING tick
  }
  private nextCharge(): void {
// BEGIN SHIPPING nextCharge

    // phase 2: the charges come in pairs
    if (this.p2 && this.pairs === 0) { this.pairs = 1; this.st = 'wheel'; this.stT = 0; return; }
    this.pairs = 0; this.st = 'circle'; this.chargeT = this.p2 ? 4.5 : 6.5;
  
// END SHIPPING nextCharge
  }
  snapshot() { return { st: this.st, stT: this.stT, chargeT: this.chargeT, pairs: this.pairs, struck: this.struck, c0: [this.c0.x, this.c0.y, this.c0.z], c1: [this.c1.x, this.c1.y, this.c1.z], line: this.line.map(a => a.entityId) }; }
}
