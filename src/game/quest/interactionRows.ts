import * as v from 'valibot';
import { Vector3 } from 'three';
import type { SimHost } from '@wildshard/engine/sim';
import { test, type Flags } from '@wildshard/engine/world/interact/flags';

const name = v.pipe(v.string(), v.minLength(1), v.maxLength(96));
const names = v.pipe(v.array(name), v.maxLength(64));
const condition = v.strictObject({ all: v.exactOptional(names), any: v.exactOptional(names), none: v.exactOptional(names) });
const need = v.strictObject({ all: v.exactOptional(names), any: v.exactOptional(names), none: v.exactOptional(names), else: v.exactOptional(name) });
const row = v.strictObject({
  id: name, act: v.pipe(v.number(), v.safeInteger(), v.minValue(0)), at: name, crack: v.exactOptional(v.picklist(['light', 'heavy'])),
  needs: v.exactOptional(v.pipe(v.array(need), v.maxLength(16))), sets: v.pipe(names, v.minLength(1)),
});
const unique = (list: readonly (string | number)[]): boolean => new Set(list).size === list.length;
/**
 * Declared interaction rows (SF72): the transient `marks` an interaction keeps outside the durable flags (a raised well
 * bucket, an oiled bowl), each optionally starting set when its `initial` condition holds on the flags at install; the
 * `rows`, each a prompt or a crack (`crack: 'light' | 'heavy'`) at a named spot (`at`), answering a `script` command whose
 * value is its `act`: its `needs` are checked in order and the first unmet one refuses with its `else` reason, otherwise
 * its `sets` are raised (marks first, then durable flags); and `never`, the mark combinations a restore refuses.
 */
export const InteractionRowsSchema = v.pipe(
  v.strictObject({ marks: v.pipe(v.array(v.strictObject({ id: name, initial: v.exactOptional(condition) })), v.maxLength(256)),
    rows: v.pipe(v.array(row), v.maxLength(256)), never: v.exactOptional(v.pipe(v.array(condition), v.maxLength(64))) }),
  v.check(data => unique(data.marks.map(mark => mark.id)) && unique(data.rows.map(entry => entry.id)) && unique(data.rows.map(entry => entry.act)), 'unique mark ids, row ids and acts'),
);
/** Validated interaction rows (`InteractionRowsSchema`). */
export type InteractionRowsData = v.InferOutput<typeof InteractionRowsSchema>;
/** One declared row. */
export type InteractionRow = InteractionRowsData['rows'][number];
/** Compile authored interaction rows; an unknown field, a duplicate id or act, or an empty `sets` refuses. */
export function parseInteractionRows(input: unknown): InteractionRowsData { return v.parse(InteractionRowsSchema, input); }
/** A row's answer: it ran, or the `else` reason of its first unmet need (`'refused'` when the need names none). */
export type InteractionResult = { readonly ok: true } | { readonly ok: false; readonly reason: string };

/**
 * The rules of declared interaction rows over a shard's durable flags, free of meshes and prompts: the browser's
 * interactables call `run(row)` and present the answer, the renderer-free host's `installInteractionRows` runs the same
 * rows from tick commands. Marks are exact continuation (`snapshot` / `restore`); flags stay the flags' own.
 */
export class InteractionRules {
  readonly data: InteractionRowsData;
  private readonly flags: Pick<Flags, 'has' | 'set'>;
  private readonly marks = new Map<string, boolean>();
  private readonly rows = new Map<string, InteractionRow>();
  private readonly view = { has: (flag: string): boolean => this.has(flag) };
  constructor(flags: Pick<Flags, 'has' | 'set'>, data: InteractionRowsData) {
    this.flags = flags; this.data = data;
    for (const mark of data.marks) this.marks.set(mark.id, mark.initial !== undefined && test(flags, mark.initial));
    for (const entry of data.rows) this.rows.set(entry.id, entry);
  }
  /** A mark's state, else the durable flag's. */
  has(flag: string): boolean { return this.marks.get(flag) ?? this.flags.has(flag); }
  /** Set or clear a declared mark (a load restoring the world from its flags); an undeclared one throws. */
  mark(id: string, on = true): void {
    if (!this.marks.has(id)) throw new Error(`Unknown interaction mark ${id}`);
    this.marks.set(id, on);
  }
  /** The declared row, or throws. */
  row(id: string): InteractionRow {
    const found = this.rows.get(id); if (found === undefined) throw new Error(`Unknown interaction row ${id}`); return found;
  }
  /** Whether the row would run now, without running it. */
  check(id: string): InteractionResult {
    for (const want of this.row(id).needs ?? []) if (!test(this.view, want)) return { ok: false, reason: want.else ?? 'refused' };
    return { ok: true };
  }
  /** Run the row: on its needs, raise its marks, call `changed` (the view's beat), then raise its durable flags in order. */
  run(id: string, changed?: () => void): InteractionResult {
    const answer = this.check(id);
    if (!answer.ok) return answer;
    const sets = this.row(id).sets;
    for (const flag of sets) if (this.marks.has(flag)) this.marks.set(flag, true);
    changed?.();
    for (const flag of sets) if (!this.marks.has(flag)) this.flags.set(flag);
    return answer;
  }
  /** The marks as exact continuation, in declared order. */
  snapshot(): string { return JSON.stringify({ version: 1, marks: Object.fromEntries(this.marks) }); }
  /** Restore the marks; an unknown, missing or non-boolean mark, or a `never` combination, refuses and keeps the current state. */
  restore(input: string): void {
    const raw: unknown = JSON.parse(input), state = v.parse(v.strictObject({ version: v.literal(1), marks: v.record(v.string(), v.boolean()) }), raw);
    const keys = Object.keys(state.marks);
    if (keys.length !== this.marks.size || keys.some(key => !this.marks.has(key))) throw new Error('Incompatible interaction marks');
    const next = { has: (flag: string): boolean => state.marks[flag] ?? this.flags.has(flag) };
    if ((this.data.never ?? []).some(c => test(next, c))) throw new Error('Incompatible interaction marks');
    for (const key of keys) this.marks.set(key, state.marks[key] === true);
  }
}

/** A placed point a row answers at: a prompt reaches `radius` from the player's eye, a crack `radius` plus its reach. */
export interface InteractionSpot { readonly x: number; readonly y: number; readonly z: number; readonly radius: number }
/** What `installInteractionRows` is lent. */
export interface InteractionRowPorts {
  /** the `script` command actor that carries the rows (`{ kind: 'script', actorId, value: row.act }`) */
  readonly actorId: string;
  /** the fixed-step adapter id (the marks' continuation) */
  readonly stepId: string;
  /** every row's spot by its `at` name (the built world's placements, baked) */
  readonly spots: Readonly<Record<string, InteractionSpot>>;
  readonly commands: () => readonly { readonly actorId: string; readonly value: number }[];
  /** the item that cracks: its light / heavy reach, and the act its crack reached this tick (null: none or cooling) */
  readonly crack?: { readonly reach: { readonly light: number; readonly heavy: number }; readonly cracked: () => number | null };
  /** a row ran (the shard's beat on it: a summons, a cue) */
  readonly done?: (row: string) => void;
}

/** The browser player's eye above the feet (engine Player EYE): prompts pick by eye distance (Interactables.pickInteractable). */
const EYE = 1.68;
/** The tick protocol's command allowance (sdk/tickProtocol.ts). */
const MAX_COMMANDS = 1024;

/**
 * The renderer-free host's interaction step (SF72): each tick's `script` commands on `actorId` run the row whose `act`
 * they name, when the player's eye stands within the row's spot radius (a crack row: only when the item's crack reached
 * that act this tick, within the spot's radius plus the crack's reach), through the same `InteractionRules` the browser's
 * interactables use. The marks are the step's exact continuation. Not modelled: the prompts' line of sight and the
 * nearest-prompt pick (a command names its row).
 */
export function installInteractionRows(host: SimHost, rules: InteractionRules, ports: InteractionRowPorts): void {
  const byAct = new Map(rules.data.rows.map(entry => {
    const spot = ports.spots[entry.at];
    if (spot === undefined) throw new Error(`Interaction row ${entry.id} has no spot ${entry.at}`);
    if (entry.crack !== undefined && ports.crack === undefined) throw new Error(`Interaction row ${entry.id} needs a cracking item`);
    return [entry.act, { entry, spot }] as const;
  }));
  const eye = new Vector3(), at = new Vector3();
  const act = (value: number): void => {
    const found = byAct.get(value); if (found === undefined) return;
    const { entry, spot } = found, crack = ports.crack;
    let reach = 0;
    if (entry.crack !== undefined && crack !== undefined) { if (crack.cracked() !== value) return; reach = crack.reach[entry.crack]; }
    eye.copy(host.player.position); eye.y += EYE;
    if (at.set(spot.x, spot.y, spot.z).distanceTo(eye) >= spot.radius + reach) return;
    if (rules.run(entry.id).ok) ports.done?.(entry.id);
  };
  host.onStep(ports.stepId, () => {
    const list = ports.commands();
    for (let i = 0; i < MAX_COMMANDS; i++) {
      const command = list[i]; if (command === undefined) break;
      if (command.actorId === ports.actorId) act(command.value);
    }
  }, { snapshot: () => rules.snapshot(), restore: value => { rules.restore(v.parse(v.string(), value)); } });
}
