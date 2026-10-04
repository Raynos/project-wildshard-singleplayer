/** V0 numeric effect operations; all records contain [op,a,b,c,d] f64 values. */
export const SCRIPT_OP = Object.freeze({ field: 1, spawn: 2, event: 3, position: 4 });
/** An effect request, decoded completely before the world changes. */
export interface ScriptEffect { op: number; a: number; b: number; c: number; d: number }
/** A host-owned entity; callers receive copies of its numeric state. */
export interface ScriptEntity { id: number; name: string; position: readonly [number, number, number]; fields: Readonly<Record<number, number>>; frozen: boolean; interactive: boolean }
/** A queued event delivered on a subsequent tick, never recursively during effect application. */
export interface ScriptEvent { type: number; target: number; value: number }
/** Content supplies legal field ranges, archetypes and event ids as data. */
export interface EffectRules { fields: Readonly<Record<number, readonly [number, number]>>; archetypes: readonly number[]; events: readonly number[]; maxEntities: number }
/** Complete transaction result; publication is a single host-owned state replacement. */
export interface EffectTransaction { commit: () => void; spawns: number; events: readonly ScriptEvent[] }
const coord = (n: number): boolean => Number.isFinite(n) && n >= -250 && n <= 250;
const id = (n: number): boolean => Number.isSafeInteger(n) && n > 0 && n <= 0x7fffffff;
function copy(e: ScriptEntity): ScriptEntity { return { ...e, position: [...e.position], fields: { ...e.fields } }; }
/** Owns numeric state so batches either replace all affected entities or change none. */
export class ScriptWorld {
  private entities = new Map<number, ScriptEntity>();
  private next = 1;
  private readonly rules: EffectRules;
  constructor(rules: EffectRules, entities: readonly ScriptEntity[]) {
    if (!Number.isSafeInteger(rules.maxEntities) || rules.maxEntities < 1 || rules.maxEntities > 10000 || entities.length > rules.maxEntities) throw new Error('Entity cap');
    for (const [key, range] of Object.entries(rules.fields)) if (!id(Number(key)) || !range.every(Number.isFinite) || range[0] > range[1]) throw new Error('Invalid field declaration');
    for (const ids of [rules.archetypes, rules.events]) if (ids.length > 1024 || ids.some((n) => !id(n)) || new Set(ids).size !== ids.length) throw new Error('Invalid effect declarations');
    this.rules = { ...rules, fields: Object.fromEntries(Object.entries(rules.fields).map(([k, v]) => [k, [...v]])), archetypes: [...rules.archetypes], events: [...rules.events] };
    for (const e of entities) {
      if (!id(e.id) || this.entities.has(e.id) || !e.position.every(coord)) throw new Error('Invalid entity');
      for (const [key, value] of Object.entries(e.fields)) this.field(Number(key), value);
      this.entities.set(e.id, copy(e)); this.next = Math.max(this.next, e.id + 1);
    }
  }
  /** Read-only copy, including the frozen/noninteractive quarantine state. */
  entity(handle: number): ScriptEntity | undefined { const e = this.entities.get(handle); return e ? copy(e) : undefined; }
  /** Snapshot of host-owned entity state, ordered by numeric handle. */
  state(): readonly ScriptEntity[] { return [...this.entities.values()].sort((a, b) => a.id - b.id).map(copy); }
  /** Quarantine or explicitly resume an entity after a failed script call. */
  freeze(handle: number, frozen: boolean): void { const e = this.entities.get(handle); if (e) this.entities.set(handle, { ...e, frozen, interactive: !frozen }); }
  private field(key: number, value: number): void {
    const range = this.rules.fields[key];
    if (!Number.isSafeInteger(key) || !range || !Number.isFinite(value) || value < range[0] || value > range[1]) throw new Error('Field id/value outside declared range');
  }
  /** Validate every effect and build a private next state; queued events cannot invoke another script here. */
  prepare(effects: readonly ScriptEffect[], self: number, spawnAllowance: number, eventAllowance: number): EffectTransaction {
    const before = this.entities, next = new Map(before), events: ScriptEvent[] = [];
    let nextId = this.next, spawns = 0;
    if (!next.has(self)) throw new Error('Unknown entity');
    for (const effect of effects) {
      const { op, a, b, c, d } = effect;
      if (![op, a, b, c, d].every(Number.isFinite)) throw new Error('Non-finite effect');
      const entity = next.get(self); if (!entity) throw new Error('Unknown entity');
      if (op === SCRIPT_OP.field) {
        this.field(a, b); if (c !== 0 || d !== 0) throw new Error('Reserved effect values');
        next.set(self, { ...entity, fields: { ...entity.fields, [a]: b } });
      } else if (op === SCRIPT_OP.position) {
        if (![a, b, c].every(coord) || d !== 0) throw new Error('Position outside bounds');
        next.set(self, { ...entity, position: [a, b, c] });
      } else if (op === SCRIPT_OP.spawn) {
        if (!id(a) || !this.rules.archetypes.includes(a) || ![b, c, d].every(coord)) throw new Error('Spawn outside declared range');
        if (++spawns > spawnAllowance || next.size >= this.rules.maxEntities || !id(nextId)) throw new Error('Spawn allowance');
        next.set(nextId, { id: nextId, name: `entity ${nextId}`, position: [b, c, d], fields: {}, frozen: false, interactive: true }); nextId++;
      } else if (op === SCRIPT_OP.event) {
        if (!id(a) || !this.rules.events.includes(a) || !next.has(b) || d !== 0) throw new Error('Event outside declared range');
        if (events.length >= eventAllowance) throw new Error('Event allowance'); events.push({ type: a, target: b, value: c });
      } else throw new Error('Unknown effect operation');
    }
    return { spawns, events, commit: () => { if (this.entities !== before) throw new Error('Stale effect transaction'); this.entities = next; this.next = nextId; } };
  }
}
