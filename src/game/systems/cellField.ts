/** Pure numeric cell-field host. The admitted AS guest chooses activation,
 * propagation, lifetime and contact effects. Generations and contact sample at
 * ten Hz; delayed writes preserve the original neighbour order. */
import * as v from 'valibot';
import { CellFieldSchema,type CellFieldRows } from '@wildshard/format/cellField';
import { isJsonData } from '@wildshard/format/json';
import { ProjectedState,type ReturnProgram } from '../population/returnProgram';
import type { Rng } from '@wildshard/engine/core/rng';

function freeze(value: unknown): void {
  if (value !== null && typeof value === 'object') { Object.freeze(value);Object.values(value).forEach(freeze); }
}

/** Plain rows and an already admitted module; no shard callbacks or rendering. */
export class CellField {
  readonly rows: CellFieldRows;
  private readonly modes: Uint8Array;
  private readonly lifetimes: Float32Array;
  private elapsed = 0;
  private clock = 0;
  private contactElapsed = 0;
  private readonly contact: ProjectedState | null;
  constructor(input: unknown, private readonly program: ReturnProgram, private readonly random: Rng) {
    if (!isJsonData(input)) throw new Error('Cell field rows must be plain JSON');
    const rows = v.parse(CellFieldSchema,input), names = Object.values(rows.channels);
    if (rows.states.active === rows.states.idle || rows.states.active === rows.states.spent
      || new Set(names).size !== names.length || names.some(name => Object.hasOwn(Object.prototype,name) || ['x','z','dt','count','cell','hit','prototype'].includes(name))) throw new Error('Ambiguous cell field bindings');
    this.rows = rows;freeze(rows);
    this.contact = this.rows.contact === undefined ? null : new ProjectedState(this.rows.contact.law, program);
    this.modes = new Uint8Array(this.rows.width * this.rows.depth).fill(this.rows.states.idle);
    this.lifetimes = new Float32Array(this.modes.length);
  }
  get length(): number { return this.modes.length; }
  state(cell: number): number { return this.modes[cell] ?? this.rows.states.spent; }
  remaining(cell: number): number { return this.lifetimes[cell] ?? 0; }
  x(cell: number): number { return this.rows.x + (cell % this.rows.width + .5) * this.rows.cell; }
  z(cell: number): number { return this.rows.z + (Math.floor(cell / this.rows.width) + .5) * this.rows.cell; }
  cellAt(x: number, z: number): number {
    if (!Number.isFinite(x) || !Number.isFinite(z)) return -1;
    const i = Math.floor((x - this.rows.x) / this.rows.cell), j = Math.floor((z - this.rows.z) / this.rows.cell);
    return i < 0 || j < 0 || i >= this.rows.width || j >= this.rows.depth ? -1 : j * this.rows.width + i;
  }
  activeAt(x: number, z: number): boolean { return this.state(this.cellAt(x, z)) === this.rows.states.active; }
  activate(x: number, z: number): void {
    const cell = this.cellAt(x, z);
    if (cell < 0) return;
    const result = this.program.project(this.rows.signals.activate, { ...this.rows.observations,
      x: this.x(cell), z: this.z(cell), [this.rows.channels.state]: this.state(cell) }, this.random);
    const lifetime = result[this.rows.channels.lifetime] ?? 0;
    if (lifetime <= 0) return;
    this.modes[cell] = this.rows.states.active; this.lifetimes[cell] = lifetime;
  }
  clear(): void { this.modes.fill(this.rows.states.idle); this.lifetimes.fill(0); this.clock = 0; this.elapsed = 0; this.contactElapsed = 0; this.contact?.reset(); }
  /** Sample the declared footprint once per decision interval. The guest owns
   * the contact cooldown, damage and mounted response; no caller builds a list
   * of field queries or retains another cooldown. */
  sense(dt: number, point: { readonly x: number; readonly z: number }, frame: Readonly<Record<string, number>>): Readonly<Record<string, number>> {
    if (this.contact === null || this.rows.contact === undefined) return {};
    this.contactElapsed += dt;
    if (this.contactElapsed + 1e-9 < .1) return {};
    const step = this.contactElapsed; this.contactElapsed = 0;
    const samples = this.rows.contact.samples.map(at => ({ hit: Number(this.activeAt(point.x + at.x, point.z + at.z)) }));
    return this.contact.project({ ...frame, dt: step, hit: Number(this.activeAt(point.x, point.z)), count: samples.length }, undefined, samples);
  }
  deactivate(): number[] {
    const changed: number[] = [];
    for (let cell = 0; cell < this.length; cell++) if (this.state(cell) === this.rows.states.active) { this.modes[cell] = this.rows.states.spent; changed.push(cell); }
    return changed;
  }
  /** Every generation observes the previous field. Newly active cells cannot
   * spread until the following generation, independent of array order. */
  update(dt: number, observations: Readonly<Record<string, number>>): number[] {
    this.elapsed += dt;
    if (this.elapsed + 1e-9 < .1) return [];
    const step = this.elapsed; this.elapsed = 0;
    const pulse = this.program.project(this.rows.signals.clock, { ...this.rows.observations, dt: step, [this.rows.channels.clock]: this.clock });
    this.clock = pulse[this.rows.channels.clock] ?? this.clock;
    const next: number[] = [], changed: number[] = [];
    for (let cell = 0; cell < this.length; cell++) {
      if (this.state(cell) !== this.rows.states.active) continue;
      const i = cell % this.rows.width, j = Math.floor(cell / this.rows.width);
      const neighbours = this.rows.neighbours.flatMap(([x, z]) => {
        const column = i + x, row = j + z;
        return column < 0 || row < 0 || column >= this.rows.width || row >= this.rows.depth ? []
          : [{ x, z, cell: row * this.rows.width + column, [this.rows.channels.state]: this.state(row * this.rows.width + column) }];
      });
      const result = this.program.project(this.rows.signals.step, { ...this.rows.observations, ...observations,
        dt: step, [this.rows.channels.lifetime]: this.remaining(cell), [this.rows.channels.pulse]: pulse[this.rows.channels.pulse] ?? 0, count: neighbours.length }, this.random, neighbours);
      this.lifetimes[cell] = result[this.rows.channels.lifetime] ?? 0;
      if ((result[this.rows.channels.lifetime] ?? 0) <= 0) { this.modes[cell] = this.rows.states.spent; changed.push(cell); }
      neighbours.forEach((row, at) => { if (((result[this.rows.channels.neighbours] ?? 0) & (1 << at)) !== 0) next.push(row.cell); });
    }
    for (const cell of next) this.activate(this.x(cell), this.z(cell));
    return changed;
  }
}

