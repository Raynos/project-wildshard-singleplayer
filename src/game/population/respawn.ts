import type { RespawnRule, RespawnEntry } from '@wildshard/format/populationRespawn';
import type { RngStream } from '@wildshard/engine/core/rng';

/** Borrow a stream or its named authority. Named streams are looked up only when a death actually draws. */
type PopulationStream = { next: () => number } | { authority: { stream: (name: RngStream) => { next: () => number } }; name: RngStream };

/** Delayed population returns. Scheduling consumes one supplied draw, even for a fixed delay; taking never draws.
 * Native traversal is reverse death order, bounded to 256 and reuses its result; page owners can override traversal. */
export class RespawnQueue {
  readonly pending: RespawnEntry[] = [];
  private readonly due: RespawnEntry[] = [];
  constructor(private rules: Record<string, RespawnRule>, private stream: PopulationStream, private outOfSight: number) {}

  /** a kill at `now` (seconds): queue its replacement at (x, z) if the kind comes back at all */
  add(kind: string, variant: string | undefined, herd: number, x: number, z: number, now: number): RespawnEntry | null {
    const r = this.rules[kind];
    if (!r) return null;
    const stream = 'authority' in this.stream ? this.stream.authority.stream(this.stream.name) : this.stream;
    const e: RespawnEntry = { kind, variant, herd, x, z, due: now + r.delay.min + (r.delay.max - r.delay.min) * stream.next(), night: r.night === true };
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
    if (length > 256) throw new Error('Population return queue exceeds its native bound');
    for (let n = 0; n < 256; n++) {
      const i = length - 1 - n; if (i < 0) break;
      this.takeAt(i, now, px, pz, night, out);
    }
    return out;
  }
}
