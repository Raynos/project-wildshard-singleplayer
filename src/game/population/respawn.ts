import type { RespawnRule, RespawnEntry, RespawnTraversal } from '@wildshard/format/populationRespawn';
/** Delayed population returns. Scheduling uses one supplied draw, even for a fixed delay; taking never draws.
 * Native traversal is reverse death order, bounded to 256 and reuses its result; rows select page traversal. */
export class RespawnQueue {
  readonly pending: RespawnEntry[] = [];
  private readonly due: RespawnEntry[] = [];
  private readonly traversal: RespawnTraversal;
  constructor(private rules: Record<string, RespawnRule>, private outOfSight: number,
    traversal?: RespawnTraversal) {
    this.traversal = traversal ?? { order: 'reverse', limit: 256, result: 'reuse' };
    const limit = this.traversal.limit;
    if (limit !== null && (!Number.isSafeInteger(limit) || limit < 1)) throw new RangeError('Invalid population return bound');
  }

  /** The owner draws only for a declared returning kind, preserving lazy stream creation. */
  accepts(kind: string): boolean { return this.rules[kind] !== undefined; }

  /** a kill at `now` (seconds): queue its replacement at (x, z) if the kind comes back at all */
  add(kind: string, variant: string | undefined, herd: number, x: number, z: number, now: number, draw: number): RespawnEntry | null {
    const r = this.rules[kind];
    if (!r) return null;
    if (!Number.isFinite(draw) || draw < 0 || draw >= 1) throw new RangeError('Invalid population return draw');
    const e: RespawnEntry = { kind, variant, herd, x, z, due: now + r.delay.min + (r.delay.max - r.delay.min) * draw, night: r.night === true };
    this.pending.push(e);
    return e;
  }

  /** Remove one eligible entry without copying it; traversal and result ownership stay with each caller. */
  private takeAt(i: number, now: number, px: number, pz: number, night: number, out: RespawnEntry[]): void {
    const e = this.pending[i];
    if (e === undefined || now < e.due || (e.night && night < 0.5)) return;
    if ((e.x - px) ** 2 + (e.z - pz) ** 2 < this.outOfSight * this.outOfSight) return;
    out.push(e); this.pending.splice(i, 1);
  }

  /** Rows choose traversal and result ownership without changing pending-entry identity. */
  take(now: number, px: number, pz: number, night: number): RespawnEntry[] {
    const out = this.traversal.result === 'reuse' ? this.due : []; out.length = 0;
    const length = this.pending.length;
    if (this.traversal.limit !== null && length > this.traversal.limit) throw new Error('Population return queue exceeds its native bound');
    if (this.traversal.order === 'reverse') {
      for (let i = length - 1; i >= 0; i--) this.takeAt(i, now, px, pz, night, out);
    } else {
      for (let i = 0; i < this.pending.length;) {
        const before = this.pending.length;
        this.takeAt(i, now, px, pz, night, out);
        if (before === this.pending.length) i++;
      }
    }
    return out;
  }
}
