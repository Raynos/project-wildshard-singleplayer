import type { Vector3 } from 'three';

export interface EliteActor {
  readonly alive: boolean; readonly position: Vector3;
  readonly lookTarget: Vector3; lookWeight: number;
  setMotion: (yaw: number, speed: number, turn: number) => void;
}
export interface EliteDefinition {
  id: string; awareR: number; leashR: number; lair: { x: number; z: number; r: number };
}
export interface ElitePorts { player: { position: Vector3 }; random: () => number }
const heading = (x: number, z: number, tx: number, tz: number): number => Math.atan2(tx - x, tz - z);

/** Shared encounter actor lifecycle. Views provide spawn, retirement and tells through overrides. */
export abstract class EliteBrain<A extends EliteActor> {
  animal: A | null = null;
  protected p2 = false;
  protected mode = 'idle';
  protected modeT = 0;
  protected wx = 0; protected wz = 0; protected wanderT = 0;
  readonly def: EliteDefinition;
  protected readonly ports: ElitePorts;
  constructor(def: EliteDefinition, ports: ElitePorts) { this.def = def; this.ports = ports; }
  get brainState(): string { return this.mode; }
  get phase2(): boolean { return this.p2; }
  abstract spawn(): void;
  abstract despawn(): void;
  reset(): void { this.p2 = false; this.clearTells(); this.setMode('home'); }
  enterPhase2(): void { this.p2 = true; }
  tick(dt: number, t: number, engaged: boolean, leashing: boolean): void {
    const a = this.animal;
    if (!a?.alive) { this.clearTells(); return; }
    this.modeT += dt;
    if (leashing) { this.clearTells(); this.goHome(a); return; }
    if (engaged) this.fight(a, dt, t); else this.idle(a, dt);
  }
  protected abstract fight(a: A, dt: number, t: number): void;
  protected clearTells(): void { /* Optional presentation hook. */ }
  protected setMode(mode: string): void { this.mode = mode; this.modeT = 0; }
  protected toPlayer(a: A): { d: number; yaw: number } {
    const p = this.ports.player.position;
    return { d: Math.hypot(p.x - a.position.x, p.z - a.position.z), yaw: heading(a.position.x, a.position.z, p.x, p.z) };
  }
  protected idle(a: A, dt: number): void {
    const L = this.def.lair;
    this.wanderT -= dt;
    if (this.wanderT <= 0) {
      this.wanderT = 7 + this.ports.random() * 8;
      const ang = this.ports.random() * Math.PI * 2, r = this.ports.random() * L.r * 0.6;
      this.wx = L.x + Math.cos(ang) * r; this.wz = L.z + Math.sin(ang) * r;
    }
    const d = Math.hypot(this.wx - a.position.x, this.wz - a.position.z);
    a.setMotion(heading(a.position.x, a.position.z, this.wx, this.wz), d > 1.5 && this.wanderT < 5 ? 1.1 : 0, 1.5);
    const p = this.ports.player.position;
    a.lookTarget.copy(p); a.lookWeight = a.position.distanceTo(p) < this.def.awareR ? 0.8 : 0;
  }
  protected goHome(a: A): void {
    const L = this.def.lair, d = Math.hypot(L.x - a.position.x, L.z - a.position.z);
    a.setMotion(heading(a.position.x, a.position.z, L.x, L.z), d > 3 ? 4 : 0, 2.5);
    a.lookWeight = 0;
  }
}
