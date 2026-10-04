import { ScriptWorld, type EffectRules, type EffectTransaction, type ScriptEffect, type ScriptEntity } from './effects';

/** Server-script state effects. Player writes always use the invoking entity's host-bound actor id. */
export const SCRIPT_STATE_OP = Object.freeze({ shared: 5, player: 6 });
/** Numeric declared fields; bool uses 0/1. Strings are outside the numeric v0 script ABI. */
export interface ScriptStateField { id: number; name: string; type: 'bool' | 'i32' | 'f64'; privacy: 'public' | 'owner' | 'host'; default: number; min: number; max: number }
/** Shared fields belong to the host; player fields have one independent record per stable actor id. */
export interface ScriptStateDeclaration { shared: readonly ScriptStateField[]; player: readonly ScriptStateField[] }
/** A complete JSON-compatible state checkpoint, including quarantined entities and actor-scoped records. */
export interface ScriptWorldState { entities: readonly ScriptEntity[]; shared: readonly number[]; players: readonly { actorId: string; values: readonly number[] }[] }
function valid(field: ScriptStateField, value: number): boolean {
  return Number.isFinite(value) && value >= field.min && value <= field.max && (field.type === 'f64' || Number.isInteger(value))
    && (field.type !== 'bool' || value === 0 || value === 1) && (field.type !== 'i32' || value >= -2147483648 && value <= 2147483647);
}
/** Numeric effect world extended with declared shared and actor-scoped state, committed as one batch. */
export class DeclaredScriptWorld extends ScriptWorld {
  readonly declaration: ScriptStateDeclaration;
  private shared: number[];
  private players = new Map<string, number[]>();
  private readonly actors: ReadonlyMap<number, string>;
  constructor(rules: EffectRules, entities: readonly ScriptEntity[], declaration: ScriptStateDeclaration, actors: ReadonlyMap<number, string>) {
    super(rules, entities);
    if (declaration.shared.length + declaration.player.length > 24) throw new Error('Script state input capacity');
    for (const fields of [declaration.shared, declaration.player]) {
      if (new Set(fields.map((f) => f.id)).size !== fields.length || new Set(fields.map((f) => f.name)).size !== fields.length
        || fields.some((f) => !Number.isSafeInteger(f.id) || f.id < 1 || f.id > 0x7fffffff || !/^[a-z][a-z0-9.-]*$/u.test(f.name)
          || !Number.isFinite(f.min) || !Number.isFinite(f.max) || f.min > f.max || !valid(f, f.default))) throw new Error('Invalid state declaration');
    }
    this.declaration = { shared: declaration.shared.map((f) => Object.freeze({ ...f })).sort((a, b) => a.id - b.id), player: declaration.player.map((f) => Object.freeze({ ...f })).sort((a, b) => a.id - b.id) };
    this.actors = new Map(actors); this.shared = this.declaration.shared.map((f) => f.default);
    for (const [entity, actorId] of actors) {
      if (!this.entity(entity) || actorId.length === 0 || actorId.length > 128) throw new Error('Invalid actor binding');
      if (!this.players.has(actorId)) this.players.set(actorId, this.declaration.player.map((f) => f.default));
    }
  }
  /** Host-derived actor provenance; scripts never provide or replace it. */
  actor(handle: number): string | undefined { return this.actors.get(handle); }
  /** Trusted server input in declaration order, never another actor's private record. */
  input(handle: number): readonly number[] {
    const actor = this.actor(handle), values = actor === undefined ? this.declaration.player.map((f) => f.default) : this.players.get(actor);
    if (!values) throw new Error('Missing actor state');
    return [this.shared.length, values.length, ...this.shared, ...values];
  }
  /** A public/owner view; host-only fields are never projected to a player. Returned records are copies. */
  view(actorId: string): { shared: Readonly<Record<string, number>>; player: Readonly<Record<string, number>> } {
    const values = this.players.get(actorId);
    if (!values) throw new Error('Unknown actor');
    const fields = (list: readonly ScriptStateField[], data: readonly number[], shared: boolean): Record<string, number> => Object.fromEntries(list.flatMap((f, i) => (shared ? f.privacy !== 'public' : f.privacy === 'host') ? [] : [[f.name, data[i] ?? f.default]]));
    return { shared: fields(this.declaration.shared, this.shared, true), player: fields(this.declaration.player, values, false) };
  }
  /** Complete checkpoint ordered by stable actor id, independent of map insertion order. */
  checkpoint(): ScriptWorldState { return { entities: this.state(), shared: [...this.shared], players: [...this.players].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([actorId, values]) => ({ actorId, values: [...values] })) }; }
  /** Restore only matching actors and declared, typed field values. */
  restoreState(saved: ScriptWorldState): void {
    const check = (fields: readonly ScriptStateField[], values: readonly number[]): boolean => fields.length === values.length && fields.every((f, i) => valid(f, values[i] ?? Number.NaN));
    if (!check(this.declaration.shared, saved.shared) || saved.players.length !== this.players.size || new Set(saved.players.map((p) => p.actorId)).size !== saved.players.length
      || saved.players.some((p) => !this.players.has(p.actorId) || !check(this.declaration.player, p.values)) || [...this.actors.keys()].some((handle) => !saved.entities.some((e) => e.id === handle))) throw new Error('Invalid declared-state snapshot');
    super.restore(saved.entities); this.shared = [...saved.shared]; this.players = new Map(saved.players.map((p) => [p.actorId, [...p.values]]));
  }
  override prepare(effects: readonly ScriptEffect[], self: number, spawnAllowance: number, eventAllowance: number): EffectTransaction {
    const before = this.shared, shared = [...before], players = new Map(this.players), actorId = this.actor(self), ordinary: ScriptEffect[] = [];
    for (const effect of effects) {
      if (effect.op !== SCRIPT_STATE_OP.shared && effect.op !== SCRIPT_STATE_OP.player) { ordinary.push(effect); continue; }
      if (![effect.op, effect.a, effect.b, effect.c, effect.d].every(Number.isFinite) || effect.c !== 0 || effect.d !== 0) throw new Error('Invalid state effect');
      const isShared = effect.op === SCRIPT_STATE_OP.shared, fields = isShared ? this.declaration.shared : this.declaration.player;
      const index = fields.findIndex((f) => f.id === effect.a), field = fields[index];
      if (!field || !valid(field, effect.b)) throw new Error('Undeclared or invalid state field');
      if (isShared) shared[index] = effect.b;
      else {
        if (actorId === undefined) throw new Error('Player effect requires an actor');
        const values = [...(players.get(actorId) ?? [])]; values[index] = effect.b; players.set(actorId, values);
      }
    }
    const tx = super.prepare(ordinary, self, spawnAllowance, eventAllowance);
    return { spawns: tx.spawns, events: tx.events, commit: () => {
      if (this.shared !== before) throw new Error('Stale declared-state transaction');
      tx.commit(); this.shared = shared; this.players = players;
    } };
  }
}
