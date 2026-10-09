import * as THREE from 'three';
import type { AnimalSim } from '../../../src/engine/entities/AnimalSim';
import type { ArgymaqHerd, ArgymaqPorts } from '../../../src/shards/nalati-grasslands/runtime/argymaqKeeper';
/** The frozen shipping clock/tell law, with the actual body and herd read/output ports. */
export class ArgymaqOracle {
  private laneT = 0; private runT = 0; private lastState = '';
  private readonly laneFrom = new THREE.Vector3(); private readonly laneTo = new THREE.Vector3();
  private readonly lane;
  constructor(private readonly env: ArgymaqPorts<AnimalSim>, private readonly animal: AnimalSim, private readonly herd: ArgymaqHerd<AnimalSim>) { this.lane = env.lane; }
  private get p2(): boolean { return this.env.phase2(); }
  private engagement(_engaged: boolean): void { /* view pinning is not a simulation decision */ }
  private sig(): void { this.env.signature(); }
  tick(dt: number, t: number, engaged: boolean): void {
// BEGIN SHIPPING CLOCKS

    this.engagement(engaged);
    const a = this.animal, h = this.herd;
    if (!a || !h) return;
    this.lane.setTime(t);
    // TRAMPLE: he rears (the herd's 'display') → the lane paints from his hooves to you; it holds through the charge
    const st = h.stallionState;
    if (st !== this.lastState) {
      if (st === 'display') { this.laneT = 1.2; this.laneFrom.copy(a.position); this.laneTo.copy(this.env.player.position); this.sig(); }
      if (st === 'charge') this.laneT = Math.max(this.laneT, 1.4);
      this.lastState = st;
    }
    if (this.laneT > 0) {
      this.laneT -= dt;
      const dx = this.laneTo.x - this.laneFrom.x, dz = this.laneTo.z - this.laneFrom.z, d = Math.hypot(dx, dz) || 1;
      const k = Math.max(0, d - 3) / d;   // to 3 m short of where you stood (no wash over your own feet)
      this.lane.lane(this.laneFrom.x, this.laneFrom.z, this.laneFrom.x + dx * k, this.laneFrom.z + dz * k, 3, 0.55 * Math.min(1, this.laneT * 2));
    } else this.lane.hide();
    // phase 2: HE RUNS — the herd at the gallop round the pasture, him at its head
    if (this.p2 && engaged && st !== 'beaten') { this.runT -= dt; if (this.runT <= 0) { this.runT = 8; h.leadAway(this.env.player.position.x, this.env.player.position.z); } }
// END SHIPPING CLOCKS
  }
  snapshot() { return { laneT: this.laneT, runT: this.runT, lastState: this.lastState, laneFrom: this.laneFrom.toArray(), laneTo: this.laneTo.toArray() }; }
}
