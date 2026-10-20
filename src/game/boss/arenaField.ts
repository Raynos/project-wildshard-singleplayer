/** Bounded arena field storage. AS chooses ignition, propagation and lifetime;
 * the host owns grid addressing, delayed writes and its ten-Hz clock. */
import type { ReturnProgram } from '../population/returnProgram';
import type { Rng } from '@wildshard/engine/core/rng';
import * as v from 'valibot';

const finite = v.pipe(v.number(), v.finite());
const count = v.pipe(finite, v.integer(), v.minValue(1), v.maxValue(64));
const offset = v.pipe(finite, v.integer(), v.minValue(-1), v.maxValue(1));
export const ArenaFieldSchema = v.strictObject({
  x: finite, z: finite, width: count, depth: count,
  cell: v.pipe(finite, v.minValue(.01)),
  observations: v.record(v.string(), finite),
  neighbours: v.pipe(v.array(v.tuple([offset, offset])), v.maxLength(8)),
  signals: v.strictObject({ ignite: v.string(), step: v.string(), clock: v.string() }),
});
export type ArenaFieldRows = v.InferOutput<typeof ArenaFieldSchema>;
/** Plain rows and an already admitted module; no shard callbacks or rendering. */
export class ArenaField {
  readonly rows: ArenaFieldRows;
  private readonly modes: Uint8Array;
  private readonly lifetimes: Float32Array;
  private elapsed = 0;
  private clock = 0;
  constructor(input: unknown, private readonly program: ReturnProgram, private readonly random: Rng) {
    this.rows = v.parse(ArenaFieldSchema, input);
    this.modes = new Uint8Array(this.rows.width * this.rows.depth);
    this.lifetimes = new Float32Array(this.modes.length);
  }
  get length(): number { return this.modes.length; }
  mode(cell: number): number { return this.modes[cell] ?? 2; }
  remaining(cell: number): number { return this.lifetimes[cell] ?? 0; }
  x(cell: number): number { return this.rows.x + (cell % this.rows.width + .5) * this.rows.cell; }
  z(cell: number): number { return this.rows.z + (Math.floor(cell / this.rows.width) + .5) * this.rows.cell; }
  cellAt(x: number, z: number): number {
    const i = Math.floor((x - this.rows.x) / this.rows.cell), j = Math.floor((z - this.rows.z) / this.rows.cell);
    return i < 0 || j < 0 || i >= this.rows.width || j >= this.rows.depth ? -1 : j * this.rows.width + i;
  }
  activeAt(x: number, z: number): boolean { return this.mode(this.cellAt(x, z)) === 1; }
  ignite(x: number, z: number): void {
    const cell = this.cellAt(x, z);
    if (cell < 0) return;
    const result = this.program.project(this.rows.signals.ignite, { ...this.rows.observations,
      x: this.x(cell), z: this.z(cell), mode: this.mode(cell) }, this.random);
    const lifetime = result['burn'] ?? 0;
    if (lifetime <= 0) return;
    this.modes[cell] = 1; this.lifetimes[cell] = lifetime;
  }
  clear(): void { this.modes.fill(0); this.lifetimes.fill(0); this.clock = 0; this.elapsed = 0; }
  extinguish(): number[] {
    const changed: number[] = [];
    for (let cell = 0; cell < this.length; cell++) if (this.mode(cell) === 1) { this.modes[cell] = 2; changed.push(cell); }
    return changed;
  }
  /** Every generation observes the previous field. Newly ignited cells cannot
   * spread until the following generation, independent of array order. */
  update(dt: number, observations: Readonly<Record<string, number>>): number[] {
    this.elapsed += dt;
    if (this.elapsed + 1e-9 < .1) return [];
    const step = this.elapsed; this.elapsed = 0;
    const pulse = this.program.project(this.rows.signals.clock, { ...this.rows.observations, dt: step, t: this.clock });
    this.clock = pulse['t'] ?? this.clock;
    const next: number[] = [], changed: number[] = [];
    for (let cell = 0; cell < this.length; cell++) {
      if (this.mode(cell) !== 1) continue;
      const i = cell % this.rows.width, j = Math.floor(cell / this.rows.width);
      const neighbours = this.rows.neighbours.flatMap(([x, z]) => {
        const column = i + x, row = j + z;
        return column < 0 || row < 0 || column >= this.rows.width || row >= this.rows.depth ? []
          : [{ x, z, cell: row * this.rows.width + column, mode: this.mode(row * this.rows.width + column) }];
      });
      const result = this.program.project(this.rows.signals.step, { ...this.rows.observations, ...observations,
        dt: step, burn: this.remaining(cell), spread: pulse['spread'] ?? 0, count: neighbours.length }, this.random, neighbours);
      this.lifetimes[cell] = result['burn'] ?? 0;
      if ((result['burn'] ?? 0) <= 0) { this.modes[cell] = 2; changed.push(cell); }
      neighbours.forEach((row, at) => { if (((result['mask'] ?? 0) & (1 << at)) !== 0) next.push(row.cell); });
    }
    for (const cell of next) this.ignite(this.x(cell), this.z(cell));
    return changed;
  }
}

/** Pure spatial refusal against a declared ring and an admitted field. Rule
 * enablement comes from the encounter's last bounded decision. */
export function arenaBlockedAt(field: ArenaField, point: { readonly x: number; readonly z: number },
  boundary: { readonly x: number; readonly z: number; readonly radius: number }, mask: number): boolean {
  return ((mask & 1) !== 0 && Math.hypot(point.x - boundary.x, point.z - boundary.z) > boundary.radius)
    || ((mask & 2) !== 0 && field.activeAt(point.x, point.z));
}
