import * as THREE from 'three';
import type { AnimalSim } from '../../../src/engine/entities/AnimalSim';
import type { GhostRosterMember, GhostRosterPorts } from '../../../src/shards/nalati-grasslands/runtime/ghostRosterKeeper';
export type Animal = AnimalSim & {hidden: boolean};
export interface Rider extends GhostRosterMember<Animal> { readonly mats: readonly {fade: {value: number}}[] }
export interface Line { readonly riders: Rider[] }
const SHOOT = 62, RESPAWN = 60, FLAG_GROW = 1, FLAG_RISE = 2;
const MIST: readonly [number, number, number] = [0.18, 0.75, 0.85];
const GHOST_TIME = {value: 0};
const _v = new THREE.Vector3(), _w = new THREE.Vector3();
function ghostSeat(a: Animal, out: THREE.Vector3): void { out.copy(a.position); }
let random: () => number = () => { throw new Error('Unbound oracle stream'); };
const app = {rng: {stream: (name: string) => ({next: () => name === 'ai' ? random() : 0.5})}};
export class GhostRosterOracle {
 hold = false; freeze = false; killsTonight = 0; respawnT = -1;
 readonly lastPlayer = new THREE.Vector3(); readonly playerVel = new THREE.Vector3();
 readonly ctx: {player: GhostRosterPorts<Animal>['player']; clock: {readonly dayPhase: string};game: {renderer:null;camera:null}};
 readonly arrows: {update: (dt:number)=>void};
 readonly mist = {emit: (..._args: unknown[]): void => undefined, update: (..._args: unknown[]): void => undefined};
 readonly onRiderKilled: GhostRosterPorts<Animal>['killed'];
 constructor(readonly ports: GhostRosterPorts<Animal>, readonly riders: Rider[], readonly lines: Line[]) {
  this.ctx = {player:ports.player,clock:{get dayPhase(){return ports.phase();}},game:{renderer:null,camera:null}};
  this.arrows = {update:ports.arrows}; this.onRiderKilled = ports.killed;
 }
 private spawnLine(): void { this.ports.spawnLine(); }
 private steerLine(line: Line, dt: number): void { this.ports.steer(line, dt); }
 private retire(r: Rider): void { this.ports.retire(r); }
 private shoot(r: Rider): void { this.ports.shoot(r); }
 living(): number {
// BEGIN SHIPPING living
 let n = 0; for (const r of this.riders) if (!r.dead) n++; return n; 
// END SHIPPING living
 }
 dissolve(a: Animal): void {
// BEGIN SHIPPING dissolve

    const r = this.riders.find((x) => x.a === a);
    if (r?.dying === 0) { r.dying = 0.001; r.fadeTarget = 0; }
  
// END SHIPPING dissolve
 }
 dawn(): void {
// BEGIN SHIPPING dawn
 for (const r of this.riders) this.dissolve(r.a); this.respawnT = -1; 
// END SHIPPING dawn
 }
 night(): void {
// BEGIN SHIPPING night
 this.killsTonight = 0; if (!this.hold && this.living() === 0) this.respawnT = 2;
// END SHIPPING night
 }
 attach(): void {
// BEGIN SHIPPING attachClock
    if (this.ctx.clock.dayPhase === 'night') this.respawnT = 0.5;
// END SHIPPING attachClock
 }
 update(dt: number, t: number): void {
  random = this.ports.random;
// BEGIN SHIPPING update

    GHOST_TIME.value = t;
    const p = this.ctx.player.position;
    if (dt > 0) { this.playerVel.subVectors(p, this.lastPlayer).multiplyScalar(1 / dt); if (this.playerVel.length() > 20) this.playerVel.set(0, 0, 0); }
    this.lastPlayer.copy(p);
    // a new line: at nightfall, and a minute after the last one fell
    if (this.respawnT >= 0 && !this.hold) {
      this.respawnT -= dt;
      if (this.respawnT < 0 && this.ctx.clock.dayPhase === 'night') this.spawnLine();
    }
    for (const line of this.lines) this.steerLine(line, dt);
    if (this.freeze) for (const r of this.riders) { r.a.mem['tx'] = r.a.position.x; r.a.mem['tz'] = r.a.position.z; r.fireT = 99; }
    for (let i = this.riders.length - 1; i >= 0; i--) {
      const r = this.riders[i];
      if (r === undefined) continue;
      const a = r.a;
      a.mem['px'] = p.x; a.mem['pz'] = p.z;
      // death: tear into mist
      if (!a.alive && !r.dead) {
        r.dead = true; r.dying = Math.max(r.dying, 0.001); r.fadeTarget = 0;
        this.killsTonight++;
        this.onRiderKilled?.(a, this.killsTonight);
      }
      // the fade (materialise / dissolve)
      r.fade += (r.fadeTarget - r.fade) * Math.min(1, dt * (r.fadeTarget > r.fade ? 1.4 : 2.2));
      for (const m of r.mats) m.fade.value = r.fade;
      if (r.dying > 0) {
        r.dying += dt;
        if (r.dying < 1.3) {
          ghostSeat(a, _v);
          for (let k = 0; k < 4; k++) this.mist.emit(_v.x + (app.rng.stream('cosmetic').next() - 0.5) * 1.6, _v.y - app.rng.stream('cosmetic').next() * 1.4, _v.z + (app.rng.stream('cosmetic').next() - 0.5) * 1.6,
            (app.rng.stream('cosmetic').next() - 0.5) * 1.2, 0.6 + app.rng.stream('cosmetic').next(), (app.rng.stream('cosmetic').next() - 0.5) * 1.2, 1.4, 0.35 + app.rng.stream('cosmetic').next() * 0.4, MIST[0], MIST[1], MIST[2], FLAG_GROW | FLAG_RISE);
        } else { this.retire(r); this.riders.splice(i, 1); continue; }
      }
      if (r.dead || a.hidden) continue;
      // the smoke trail: mist off the legs and the cloak, left behind as it gallops
      // (small wisps, left BEHIND the horse: the body itself must stay readable through them)
      if (app.rng.stream('cosmetic').next() < dt * 22) {
        ghostSeat(a, _v);
        const back = _w.set(-Math.sin(a.yaw), 0, -Math.cos(a.yaw));
        this.mist.emit(_v.x + back.x * 1.1 + (app.rng.stream('cosmetic').next() - 0.5) * 0.7, _v.y + 0.3 - app.rng.stream('cosmetic').next() * 1.6, _v.z + back.z * 1.1 + (app.rng.stream('cosmetic').next() - 0.5) * 0.7,
          back.x * 2.2, 0.25, back.z * 2.2, 0.9 + app.rng.stream('cosmetic').next() * 0.5, 0.12 + app.rng.stream('cosmetic').next() * 0.14, MIST[0] * 0.6, MIST[1] * 0.6, MIST[2] * 0.6, FLAG_GROW | FLAG_RISE);
      }
      // shooting: inside SHOOT m, engaged (or a loose rider), on a timer
      r.fireT -= dt;
      const d = Math.hypot(p.x - a.position.x, p.z - a.position.z);
      if (!r.quiet && r.fireT <= 0 && d < SHOOT && d > 6 && (r.line === null || r.line.mode === 'engage')) { this.shoot(r); r.fireT = 3 + app.rng.stream('ai').next() * 1.8; }
    }
    // lines with nobody left: drop them; start the next one's clock
    for (let i = this.lines.length - 1; i >= 0; i--) {
      const line = this.lines[i];
      if (line?.riders.every((r) => r.dead || r.a.hidden || !this.riders.includes(r)) === true) {
        this.lines.splice(i, 1);
        if (this.living() === 0 && this.ctx.clock.dayPhase === 'night') this.respawnT = RESPAWN;
      }
    }
    this.arrows.update(dt);
    this.mist.update(dt, this.ctx.game.renderer, this.ctx.game.camera);
  
// END SHIPPING update
 }
}
