import * as v from 'valibot';
import { Vector3 } from 'three';
import type { AnimalSim } from '@wildshard/engine/entities/AnimalSim';

/** The shipping herd state/read port; its own controller remains authoritative. */
export interface ArgymaqHerd<A> {
  readonly stallionState: string; readonly stallion: A | null;
  readonly leadAway: (x: number, z: number) => void;
}
export interface ArgymaqPorts<A> {
  readonly player: { readonly position: Vector3 }; readonly phase2: () => boolean;
  readonly lane: { readonly setTime: (t: number) => void; readonly hide: () => void;
    readonly lane: (x0: number, z0: number, x1: number, z1: number, width: number, strength: number) => void };
  readonly signature: () => void;
  /** The ride law owns taming and the adopted mount's presentation; the keeper only asks when the shipping rule wins. */
  readonly taming: () => { readonly phase: string; readonly tulpar: A | null } | null;
  readonly adopted: (mount: A) => void;
}
const finite = v.pipe(v.number(), v.finite()), triple = v.tuple([finite, finite, finite]);
const Saved = v.strictObject({ laneT: finite, runT: finite, lastState: v.string(), laneFrom: triple, laneTo: triple });
/** Argymaq's shipping trample tell and phase-two lead-away clocks, independent of the herd's decision/motion law. */
export class ArgymaqKeeper<A extends AnimalSim> {
  private laneT = 0; private runT = 0; private lastState = '';
  private readonly laneFrom = new Vector3(); private readonly laneTo = new Vector3();
  constructor(private readonly ports: ArgymaqPorts<A>) {}
  tick(a: A | null, h: ArgymaqHerd<A> | null, dt: number, t: number, engaged: boolean): void {
    if (a === null || h === null) return;
    const lane = this.ports.lane;
    lane.setTime(t);
    const st = h.stallionState;
    if (st !== this.lastState) {
      if (st === 'display') { this.laneT = 1.2; this.laneFrom.copy(a.position); this.laneTo.copy(this.ports.player.position); this.ports.signature(); }
      if (st === 'charge') this.laneT = Math.max(this.laneT, 1.4);
      this.lastState = st;
    }
    if (this.laneT > 0) {
      this.laneT -= dt;
      const dx = this.laneTo.x - this.laneFrom.x, dz = this.laneTo.z - this.laneFrom.z, d = Math.hypot(dx, dz) || 1;
      const k = Math.max(0, d - 3) / d;
      lane.lane(this.laneFrom.x, this.laneFrom.z, this.laneFrom.x + dx * k, this.laneFrom.z + dz * k, 3, 0.55 * Math.min(1, this.laneT * 2));
    } else lane.hide();
    if (this.ports.phase2() && engaged && st !== 'beaten') {
      this.runT -= dt;
      if (this.runT <= 0) { this.runT = 8; h.leadAway(this.ports.player.position.x, this.ports.player.position.z); }
    }
    const tm = this.ports.taming();
    const tul = tm?.phase === 'bonded' && h.stallion !== a ? tm.tulpar : null;
    if (tul !== null) this.ports.adopted(tul);
  }
  snapshot(): v.InferOutput<typeof Saved> { return v.parse(Saved, { laneT: this.laneT, runT: this.runT, lastState: this.lastState, laneFrom: this.laneFrom.toArray(), laneTo: this.laneTo.toArray() }); }
  restore(input: unknown): void { const s = v.parse(Saved, input); this.laneT = s.laneT; this.runT = s.runT; this.lastState = s.lastState; this.laneFrom.fromArray(s.laneFrom); this.laneTo.fromArray(s.laneTo); }
}
