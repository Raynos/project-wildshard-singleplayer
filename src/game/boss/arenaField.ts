/** Bounded arena field storage. AS chooses ignition, propagation and lifetime;
 * the host owns grid addressing, delayed writes and its ten-Hz clock. */
import type { ReturnProgram } from '../population/returnProgram';
import type { Rng } from '@wildshard/engine/core/rng';
import * as v from 'valibot';
import { EncounterSchedule, EncounterScheduleSchema, EncounterTrail } from './encounterPatrol';

const finite = v.pipe(v.number(), v.finite());
const count = v.pipe(finite, v.integer(), v.minValue(1), v.maxValue(64));
const offset = v.pipe(finite, v.integer(), v.minValue(-1), v.maxValue(1));
export const ArenaFieldSchema = v.strictObject({
  x: finite, z: finite, width: count, depth: count,
  cell: v.pipe(finite, v.minValue(.01)),
  observations: v.record(v.string(), finite),
  neighbours: v.pipe(v.array(v.tuple([offset, offset])), v.maxLength(8)),
  signals: v.strictObject({ ignite: v.string(), step: v.string(), clock: v.string() }),
  contact: v.optional(v.strictObject({ law: EncounterScheduleSchema,
    samples: v.pipe(v.array(v.strictObject({ x: finite, z: finite })), v.maxLength(8)) })),
});
export type ArenaFieldRows = v.InferOutput<typeof ArenaFieldSchema>;
/** Plain rows and an already admitted module; no shard callbacks or rendering. */
export class ArenaField {
  readonly rows: ArenaFieldRows;
  private readonly modes: Uint8Array;
  private readonly lifetimes: Float32Array;
  private elapsed = 0;
  private clock = 0;
  private contactElapsed = 0;
  private readonly contact: EncounterSchedule | null;
  constructor(input: unknown, private readonly program: ReturnProgram, private readonly random: Rng) {
    this.rows = v.parse(ArenaFieldSchema, input);
    this.contact = this.rows.contact === undefined ? null : new EncounterSchedule(this.rows.contact.law, program);
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
  clear(): void { this.modes.fill(0); this.lifetimes.fill(0); this.clock = 0; this.elapsed = 0; this.contactElapsed = 0; this.contact?.reset(); }
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

const numeric = v.record(v.string(), finite);
const schedule = v.strictObject({ id: v.string(), law: EncounterScheduleSchema });
/** A bounded set of authored clocks. The AS gate chooses which clocks advance;
 * projections observe shared health/phase inputs and publish one-shot effects.
 * Landing slots borrow a position history; no view or shard callback is stored. */
export const ArenaEncounterSchema = v.strictObject({
  gate: v.strictObject({ signal: v.string(), parameters: numeric }),
  schedules: v.pipe(v.array(schedule), v.maxLength(16)),
  shared: v.record(v.string(), v.strictObject({ clock: v.string(), slot: v.string() })),
  volley: v.strictObject({ launcher: v.string(), capacity: v.pipe(count, v.maxValue(8)),
    landing: EncounterScheduleSchema, trail: v.strictObject({ capacity: count, seconds: v.pipe(finite, v.minValue(.1)) }) }),
});
export interface ArenaClockEffect { readonly id: string; readonly index: number; readonly values: Readonly<Record<string, number>> }
/** The existing arena host owns attack cadence, delayed strikes and sharing of
 * cooldown slots. Choices and telegraph windows belong to the admitted guest. */
export class ArenaEncounter {
  readonly schedules: ReadonlyMap<string, EncounterSchedule>;
  readonly landings: readonly EncounterSchedule[];
  private readonly rows: v.InferOutput<typeof ArenaEncounterSchema>;
  private readonly trail: EncounterTrail;
  private elapsed = 0;
  constructor(input: unknown, private readonly program: ReturnProgram, private readonly random: Rng) {
    this.rows = v.parse(ArenaEncounterSchema, input);
    if (new Set(this.rows.schedules.map(row => row.id)).size !== this.rows.schedules.length) throw new Error('Duplicate arena clock');
    this.schedules = new Map(this.rows.schedules.map(row => [row.id, new EncounterSchedule(row.law, program)]));
    if (!this.schedules.has(this.rows.volley.launcher)) throw new Error('Missing arena launcher');
    this.landings = Array.from({ length: this.rows.volley.capacity }, () => new EncounterSchedule(this.rows.volley.landing, program));
    this.trail = new EncounterTrail(this.rows.volley.trail);
  }
  clock(id: string): EncounterSchedule { const clock = this.schedules.get(id); if (clock === undefined) throw new Error('Missing arena clock'); return clock; }
  reset(): void { this.elapsed = 0; this.trail.clear(); for (const clock of this.schedules.values()) clock.reset(); for (const clock of this.landings) clock.reset(); }
  /** No catch-up burst: one atomic projection batch at most every 100 ms. A
   * paused arena neither samples history nor consumes its borrowed RNG stream. */
  update(dt: number, frame: Readonly<Record<string, number>>, point: { readonly x: number; readonly z: number }): { dt: number; effects: readonly ArenaClockEffect[] } {
    this.elapsed += dt;
    if (this.elapsed + 1e-9 < .1) return { dt: 0, effects: [] };
    const step = this.elapsed; this.elapsed = 0;
    const gate = this.program.project(this.rows.gate.signal, { ...this.rows.gate.parameters, ...frame, dt: step });
    if (gate['active'] === 1) this.trail.update(step, point);
    const effects: ArenaClockEffect[] = [];
    for (const [index, row] of this.rows.schedules.entries()) {
      if (((gate['mask'] ?? 0) & (1 << index)) === 0) continue;
      const clock = this.clock(row.id), shared: Record<string, number> = {};
      // Explicit clock ids are scalar observations; the guest never receives
      // mutable schedules or a second owner of their retained slots.
      for (const [name, source] of Object.entries(this.rows.shared)) shared[name] = this.clock(source.clock).value(source.slot);
      const values = clock.project({ ...shared, ...frame, dt: step, count: this.trail.points.length }, this.random);
      effects.push({ id: row.id, index, values });
      if (row.id === this.rows.volley.launcher && values['strike'] === 1) {
        const at = this.trail.points[values['index'] ?? -1] ?? point, landing = this.landings.find(candidate => candidate.value('on') === 0);
        landing?.reset({ on: 1, x: at.x, z: at.z });
      }
    }
    if (gate['land'] === 1) for (const [index, clock] of this.landings.entries()) {
      if (clock.value('on') !== 1) continue;
      const x = clock.value('x'), z = clock.value('z');
      effects.push({ id: this.rows.volley.launcher, index, values: { ...clock.project({ ...frame, dt: step }, this.random), x, z, landing: 1 } });
    }
    return { dt: step, effects };
  }
}
