// Copied from the facade lab (src/dev/nd-lab/facade/rng.ts, round-7-lab-facade) into the clean room.
// Seeded randomness for the facade grammar: mulberry32, so every build of a tower is the same tower (lab P3, E169).

export class Rng {
  private s: number;
  constructor(seed: number) { this.s = (seed * 2654435761) >>> 0; }
  next(): number {
    this.s = (this.s + 0x6d2b79f5) >>> 0;
    let t = this.s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  range(a: number, b: number): number { return a + (b - a) * this.next(); }
  int(a: number, b: number): number { return Math.floor(this.range(a, b + 1)); }
  chance(p: number): boolean { return this.next() < p; }
  pick<T>(arr: readonly T[]): T {
    const v = arr[Math.floor(this.next() * arr.length)];
    if (v === undefined) throw new Error('Rng.pick on an empty list');
    return v;
  }
  /** pick by weight: `w` holds [item, weight] pairs */
  weighted<T>(w: readonly (readonly [T, number])[]): T {
    let sum = 0;
    for (const [, x] of w) sum += x;
    let r = this.next() * sum;
    for (const [item, x] of w) { r -= x; if (r <= 0) return item; }
    const last = w[w.length - 1];
    if (last === undefined) throw new Error('Rng.weighted on an empty list');
    return last[0];
  }
  /** a child stream: the same seed + salt always gives the same stream, whatever was drawn before */
  fork(salt: number): Rng { return new Rng((this.s ^ Math.imul(salt + 1, 0x9e3779b1)) >>> 0); }
}
