import { ReturnProgram } from '@wildshard/game/population/returnProgram';
import * as v from 'valibot';
import { Vector3 } from 'three';
import type { AnimalSim } from '@wildshard/engine/entities/AnimalSim';

let admitted: ReturnProgram | null = null;
/** Both native and entered population owners bind their already admitted law. */
export function bindEliteAdmission(input: unknown): void { admitted = ReturnProgram.page(input); }
export function eliteAdmission(): ReturnProgram { if (admitted === null) throw new Error('Unbound elite admission'); return admitted; }
const stateId = (value: string): number => value === 'display' ? 1 : value === 'charge' ? 2 : value === 'beaten' ? 3 : 0;

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
const Saved = v.strictObject({ laneT: finite, runT: finite, lastState: v.string(), elapsed: v.optional(finite, 0), laneFrom: triple, laneTo: triple });
/** Argymaq's shipping trample tell and phase-two lead-away clocks, independent of the herd's decision/motion law. */
export class ArgymaqKeeper<A extends AnimalSim> {
  private laneT = 0; private runT = 0; private lastState = ''; private elapsed = 0;
  private readonly decisions = eliteAdmission();
  private readonly observed = { dt: 0, state: 0, previousState: 0, laneT: 0, runT: 0, phase2: 0, engaged: 0, bonded: 0, same: 0, health: 1 };
  private readonly laneFrom = new Vector3(); private readonly laneTo = new Vector3();
  private readonly ports: ArgymaqPorts<A>;
  constructor(ports: ArgymaqPorts<A>) { this.ports = ports; }
  tick(a: A | null, h: ArgymaqHerd<A> | null, dt: number, t: number, engaged: boolean): void {
    if (a === null || h === null) return;
    const lane = this.ports.lane;
    lane.setTime(t);
    this.elapsed += dt;
    if (this.elapsed + 1e-9 >= .1) {
      const st = h.stallionState, tm = this.ports.taming();
      const observed = this.observed;
      observed.dt = this.elapsed; observed.state = stateId(st); observed.previousState = stateId(this.lastState);
      observed.laneT = this.laneT; observed.runT = this.runT; observed.phase2 = Number(this.ports.phase2()); observed.engaged = Number(engaged);
      observed.bonded = Number(tm?.phase === 'bonded'); observed.same = Number(h.stallion === a); observed.health = a.hp / a.maxHp;
      const result = this.decisions.project('argymaqTick', observed);
      this.elapsed = 0; this.lastState = st;
      this.laneT = result['laneT'] ?? this.laneT; this.runT = result['runT'] ?? this.runT;
      if (result['capture'] === 1) { this.laneFrom.copy(a.position); this.laneTo.copy(this.ports.player.position); }
      if (result['signature'] === 1) this.ports.signature();
      if (result['lead'] === 1) h.leadAway(this.ports.player.position.x, this.ports.player.position.z);
      if (result['adopt'] === 1 && tm?.tulpar !== null && tm?.tulpar !== undefined) this.ports.adopted(tm.tulpar);
    }
    if (this.laneT > 0) {
      const dx = this.laneTo.x - this.laneFrom.x, dz = this.laneTo.z - this.laneFrom.z, d = Math.hypot(dx, dz) || 1;
      const k = Math.max(0, d - 3) / d;
      lane.lane(this.laneFrom.x, this.laneFrom.z, this.laneFrom.x + dx * k, this.laneFrom.z + dz * k, 3, 0.55 * Math.min(1, this.laneT * 2));
    } else lane.hide();
  }
  snapshot(): v.InferOutput<typeof Saved> { return v.parse(Saved, { laneT: this.laneT, runT: this.runT, lastState: this.lastState, elapsed: this.elapsed, laneFrom: this.laneFrom.toArray(), laneTo: this.laneTo.toArray() }); }
  restore(input: unknown): void { const s = v.parse(Saved, input); this.laneT = s.laneT; this.runT = s.runT; this.lastState = s.lastState; this.elapsed = s.elapsed; this.laneFrom.fromArray(s.laneFrom); this.laneTo.fromArray(s.laneTo); }
}
