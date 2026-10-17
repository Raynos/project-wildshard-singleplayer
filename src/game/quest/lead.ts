import * as v from 'valibot';
import { QuestLeadRowsSchema, type QuestLeadRows } from '@wildshard/format/questSteps';

/** A row-authored lead/follow walk; actors and integration remain on their native owners. */
export type QuestLeadMode = 'none' | 'stare' | 'trot' | 'gone';
/** A walk's continuation as plain data. */
export interface QuestLeadState { i: number; mode: QuestLeadMode; t: number }
/** What a step did: it appeared at a bend (first: the beat's first), faded at one, or is gone (done: past the last bend). */
export type QuestLeadEvent = { kind: 'appear'; first: boolean } | { kind: 'fade' } | { kind: 'vanish'; done: boolean } | null;

const dist = (ax: number, az: number, bx: number, bz: number): number => Math.hypot(ax - bx, az - bz);

export class QuestLeadWalk {
  readonly rows: QuestLeadRows;
  constructor(input: unknown) { this.rows = v.parse(QuestLeadRowsSchema, input); }
  i = 0;
  mode: QuestLeadMode = 'none';
  t = 0;

  /** is the apparition out (staring, trotting or between bends)? */
  get out(): boolean { return this.mode !== 'none'; }

  /** Admit appearance before a page actor integrates motion; native callers use step alone. This does not advance time. */
  begin(on: boolean, player: { x: number; z: number }): QuestLeadEvent {
    if (!on) { const was = this.out; this.i = 0; this.mode = 'none'; return was ? { kind: 'vanish', done: false } : null; }
    if (!this.out) {
      const first = this.rows.path[0];
      if (first === undefined || dist(player.x, player.z, first[0], first[1]) > this.rows.first) return null;
      this.appear(0); return { kind: 'appear', first: true };
    }
    return null;
  }

  /** One step. `on`: the beat is current and it is night. `at`: where the apparition stands (null: its bend). */
  step(dt: number, on: boolean, player: { x: number; z: number }, at: { x: number; z: number } | null = null): QuestLeadEvent {
    const appeared = this.begin(on, player);
    if (!on || !this.out) return appeared;
    this.t += dt;
    if (this.mode === 'stare') {
      const bend = this.rows.path[this.i], end = this.rows.path[this.rows.path.length - 1];
      const sx = at?.x ?? bend?.[0] ?? 0, sz = at?.z ?? bend?.[1] ?? 0;
      // you came near — or ran past it along the road (you are nearer the clearing than it is): it moves on
      const past = end !== undefined && dist(player.x, player.z, end[0], end[1]) + this.rows.past < dist(sx, sz, end[0], end[1]);
      if (dist(player.x, player.z, sx, sz) < this.rows.near || past) { this.mode = 'trot'; this.t = 0; }
    } else if (this.mode === 'trot') {
      if (this.t > this.rows.trot) {
        if (this.i + 1 >= this.rows.path.length) { this.mode = 'none'; this.i = 0; return { kind: 'vanish', done: true }; }
        this.i++; this.mode = 'gone'; this.t = 0; return { kind: 'fade' };
      }
    } else if (this.mode === 'gone' && this.t > this.rows.gone) {
      this.appear(this.i); return { kind: 'appear', first: false };
    }
    return appeared;
  }

  private appear(i: number): void { this.i = i; this.mode = 'stare'; this.t = 0; }

  save(): QuestLeadState { return { i: this.i, mode: this.mode, t: this.t }; }
  load(state: QuestLeadState): void {
    const saved = v.parse(v.strictObject({ i: v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(this.rows.path.length - 1)),
      mode: v.picklist(['none', 'stare', 'trot', 'gone']), t: v.pipe(v.number(), v.finite(), v.minValue(0)) }), state);
    this.i = saved.i; this.mode = saved.mode; this.t = saved.t;
  }
}
