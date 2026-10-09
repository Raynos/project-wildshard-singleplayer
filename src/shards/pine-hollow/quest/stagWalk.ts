/**
 * The Ghost Stag's lead (quest beat 5) as decisions only, renderer-free: where it stands, when it moves on, when it is gone.
 * The page's StagLead (stagLead.ts) dresses the same walk with the apparition's coat, gait and bursts; the headless quest
 * (runtime/quest.ts) runs this walk alone. After dark it stares from a bend of the west road; come within 16 m (or run past
 * it toward the clearing) and it trots on for 1.3 s and fades; 1.1 s later it stares from the next bend; past the last it is
 * gone for good (`followed:stag`). Off (not the beat, or not night) it leaves and the walk starts again from the first bend.
 */

/** the west road out of the Hollow, its bend into the clearing, the stones' gap, inside the ring */
export const STAG_PATH: readonly (readonly [number, number])[] = [[30, -2], [58, 12], [86, 16], [120, 12], [158, 6], [155, -6], [151, -18]];
/** the stare's reach, the trot's and the fade's lengths (s), and how near the first bend it first appears */
export const STAG_NEAR = 16, STAG_TROT = 1.3, STAG_GONE = 1.1, STAG_FIRST = 70;

export type StagMode = 'none' | 'stare' | 'trot' | 'gone';
/** A walk's continuation as plain data. */
export interface StagWalkState { i: number; mode: StagMode; t: number }
/** What a step did: it appeared at a bend (first: the beat's first), faded at one, or is gone (done: past the last bend). */
export type StagStep = { kind: 'appear'; first: boolean } | { kind: 'fade' } | { kind: 'vanish'; done: boolean } | null;

const dist = (ax: number, az: number, bx: number, bz: number): number => Math.hypot(ax - bx, az - bz);

export class StagWalk {
  i = 0;
  mode: StagMode = 'none';
  t = 0;

  /** is the apparition out (staring, trotting or between bends)? */
  get out(): boolean { return this.mode !== 'none'; }

  /** One step. `on`: the beat is current and it is night. `at`: where the apparition stands (null: its bend). */
  step(dt: number, on: boolean, player: { x: number; z: number }, at: { x: number; z: number } | null = null): StagStep {
    if (!on) { const was = this.out; this.i = 0; this.mode = 'none'; return was ? { kind: 'vanish', done: false } : null; }
    let appeared: StagStep = null;
    if (!this.out) {
      const first = STAG_PATH[0];
      if (first === undefined || dist(player.x, player.z, first[0], first[1]) > STAG_FIRST) return null;
      this.appear(0); appeared = { kind: 'appear', first: true };
    }
    this.t += dt;
    if (this.mode === 'stare') {
      const bend = STAG_PATH[this.i], end = STAG_PATH[STAG_PATH.length - 1];
      const sx = at?.x ?? bend?.[0] ?? 0, sz = at?.z ?? bend?.[1] ?? 0;
      // you came near — or ran past it along the road (you are nearer the clearing than it is): it moves on
      const past = end !== undefined && dist(player.x, player.z, end[0], end[1]) + 4 < dist(sx, sz, end[0], end[1]);
      if (dist(player.x, player.z, sx, sz) < STAG_NEAR || past) { this.mode = 'trot'; this.t = 0; }
    } else if (this.mode === 'trot') {
      if (this.t > STAG_TROT) {
        if (this.i + 1 >= STAG_PATH.length) { this.mode = 'none'; this.i = 0; return { kind: 'vanish', done: true }; }
        this.i++; this.mode = 'gone'; this.t = 0; return { kind: 'fade' };
      }
    } else if (this.mode === 'gone' && this.t > STAG_GONE) {
      this.appear(this.i); return { kind: 'appear', first: false };
    }
    return appeared;
  }

  private appear(i: number): void { this.i = i; this.mode = 'stare'; this.t = 0; }

  save(): StagWalkState { return { i: this.i, mode: this.mode, t: this.t }; }
  load(state: StagWalkState): void { this.i = state.i; this.mode = state.mode; this.t = state.t; }
}
