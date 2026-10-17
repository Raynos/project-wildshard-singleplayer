/** Authored seconds before replacement and its existing night gate. */
export interface RespawnRule { delay: { min: number; max: number }; night?: boolean }

export interface RespawnEntry { kind: string; variant: string | undefined; herd: number; x: number; z: number; due: number; night: boolean }

export class RespawnQueue {
  readonly pending: RespawnEntry[] = [];
  private readonly due: RespawnEntry[] = [];
  constructor(private rules: Record<string, RespawnRule>, private rand: () => number, private outOfSight: number) {}

  /** a kill at `now` (seconds): queue its replacement at (x, z) if the kind comes back at all */
  add(kind: string, variant: string | undefined, herd: number, x: number, z: number, now: number): RespawnEntry | null {
    const r = this.rules[kind];
    if (!r) return null;
    const e: RespawnEntry = { kind, variant, herd, x, z, due: now + r.delay.min + (r.delay.max - r.delay.min) * this.rand(), night: r.night === true };
    this.pending.push(e);
    return e;
  }

  /** Remove one eligible entry without copying it; traversal and result ownership stay with each caller. */
  protected takeAt(i: number, now: number, px: number, pz: number, night: number, out: RespawnEntry[]): void {
    const e = this.pending[i];
    if (e === undefined || now < e.due || (e.night && night < 0.5)) return;
    if ((e.x - px) ** 2 + (e.z - pz) ** 2 < this.outOfSight * this.outOfSight) return;
    out.push(e); this.pending.splice(i, 1);
  }

  /** Native traversal retains its 256-entry refusal and reuses the result. */
  take(now: number, px: number, pz: number, night: number): RespawnEntry[] {
    const out = this.due; out.length = 0;
    const length = this.pending.length;
    if (length > 256) throw new Error('Driftwood ecology queue exceeds its native bound');
    for (let n = 0; n < 256; n++) {
      const i = length - 1 - n; if (i < 0) break;
      this.takeAt(i, now, px, pz, night, out);
    }
    return out;
  }
}
