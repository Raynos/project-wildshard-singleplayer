/** Pine's retained Mulberry32 authoring stream; no page service, mutable world seed or runtime import. */
export class PineSeedStream {
  private state: number;
  constructor(seed: number) { this.state = seed >>> 0; }
  /** Next sample, with exactly the native generator's unsigned arithmetic and draw order. */
  next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  /** Original affine range, consuming one sample. */
  range(a: number, b: number): number { return a + (b - a) * this.next(); }
  /** Original inclusive integer interval, consuming one native range sample. */
  int(a: number, b: number): number { return Math.floor(this.range(a, b + 1)); }
  /** Original uniform choice and draw order; empty authored sets refuse instead of returning an absent shape. */
  pick<T>(values: readonly T[]): T {
    const value = values[Math.floor(this.next() * values.length)];
    if (value === undefined) throw new Error('Pine author choice requires a nonempty set');
    return value;
  }
}
