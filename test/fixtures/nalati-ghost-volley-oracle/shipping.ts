import * as THREE from 'three';
import type { AnimalSim } from '../../../src/engine/entities/AnimalSim';
import type { GhostVolleyPorts } from '../../../src/shards/nalati-grasslands/runtime/ghostVolleyKeeper';
const ARROW_SPEED = 34, ARROW_G = 5;
const MIST: readonly [number, number, number] = [0.18, 0.75, 0.85];
const FLAG_GROW = 1;
const _v = new THREE.Vector3(), _w = new THREE.Vector3(), _d = new THREE.Vector3();
let random: () => number = () => { throw new Error('Unbound oracle AI stream'); };
let seat: GhostVolleyPorts<AnimalSim>['seat'] = () => { throw new Error('Unbound oracle seat'); };
const app = { rng: { stream: (_name: string) => ({ next: () => random() }) } };
function ghostSeat(a: AnimalSim, out: THREE.Vector3): void { seat(a, out); }
export class GhostVolleyOracle {
  readonly ctx: { player: GhostVolleyPorts<AnimalSim>['player'] };
  readonly playerVel = new THREE.Vector3(); readonly lastPlayer = new THREE.Vector3();
  shooter: AnimalSim | null = null;
  readonly arrows: { launch: (o: THREE.Vector3, v: THREE.Vector3, options: {damageScale: number}) => void };
  readonly mist = { burst: (..._args: unknown[]): void => undefined };
  constructor(readonly ports: GhostVolleyPorts<AnimalSim>) {
    this.ctx = {player: ports.player}; this.arrows = {launch: (o, v) => { ports.launch(o, v); }};
  }
  update(dt: number): void {
// BEGIN SHIPPING updateVelocity

    const p = this.ctx.player.position;
    if (dt > 0) { this.playerVel.subVectors(p, this.lastPlayer).multiplyScalar(1 / dt); if (this.playerVel.length() > 20) this.playerVel.set(0, 0, 0); }
    this.lastPlayer.copy(p);
// END SHIPPING updateVelocity
  }
  shoot(r: {a: AnimalSim}): void {
    random = this.ports.random; seat = this.ports.seat;
// BEGIN SHIPPING shoot

    const a = r.a, p = this.ctx.player.position;
    ghostSeat(a, _v); _v.y += 0.7 * a.scale;                 // from the rider's shoulders
    const dist = Math.hypot(p.x - _v.x, p.z - _v.z);
    const tFlight = dist / ARROW_SPEED;
    _w.set(p.x + this.playerVel.x * tFlight * 0.8, p.y + 1.2, p.z + this.playerVel.z * tFlight * 0.8);
    const dx = _w.x - _v.x, dz = _w.z - _v.z, dy = _w.y - _v.y, h = Math.hypot(dx, dz);
    const v2 = ARROW_SPEED * ARROW_SPEED, g = ARROW_G;
    const disc = v2 * v2 - g * (g * h * h + 2 * dy * v2);
    const th = disc >= 0 ? Math.atan((v2 - Math.sqrt(disc)) / (g * Math.max(h, 1e-3))) : Math.PI / 4;
    const spread = THREE.MathUtils.degToRad(1.4);
    const yaw = Math.atan2(dx, dz) + (app.rng.stream('ai').next() - 0.5) * spread * 2, pitch = th + (app.rng.stream('ai').next() - 0.5) * spread;
    _d.set(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch)).multiplyScalar(ARROW_SPEED);
    this.shooter = a;
    this.arrows.launch(_v, _d, { damageScale: 1 });
    this.mist.burst(_v, 6, 0.8, 0.4, 0.5, 0.2, MIST, 0.2, FLAG_GROW, 0.15);
// END SHIPPING shoot
  }
}
