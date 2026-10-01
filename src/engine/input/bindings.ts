import * as v from 'valibot';
import { saves } from '../saves/runtime';
import type { Action } from './InputService';
import type { Scope } from '../app/scope';

const schema = v.record(v.string(), v.record(v.string(), v.array(v.string())));
const controls = saves.define({ key: 'controls', scope: 'global', version: 1, schema, initial: (): Record<string, Record<string, string[]>> => ({}) });
type Keys = Partial<Record<Action, readonly string[]>>;
/** A heading of the player-facing binding table; `column` 0 is the left half, 1 the right. */
export interface BindingGroupDef { id: string; label: string; column: 0 | 1 }
/** One plain-named table row over every context that binds `actions` with the same default key. `chips` gives each
 *  action its own key cell (a slot strip); `shares` names rows whose keys may overlap (their contexts block each other). */
export interface BindingRowDef { id: string; group: string; label: string; actions: readonly Action[]; chips?: boolean; shares?: readonly string[] }
export interface BindingTableDef { groups?: readonly BindingGroupDef[]; rows?: readonly BindingRowDef[] }
/** Context-local overrides retain unmodified defaults and swap conflicts explicitly. */
export class Bindings {
  private readonly defaults = new Map<string, Keys>();
  private overrides = controls.read();
  private readonly changed: () => void;
  private readonly groupDefs: BindingGroupDef[] = [];
  private readonly rowDefs: BindingRowDef[] = [];
  constructor(changed: () => void) { this.changed = changed; }
  define(context: string, keys: Keys): void { this.defaults.set(context, keys); }
  remove(context: string): void { this.defaults.delete(context); }
  /** The registered contexts, in registration order. */
  contexts(): readonly string[] { return [...this.defaults.keys()]; }
  defaultKeys(context: string): Keys { return { ...this.defaults.get(context) }; }
  /** Adds table groups and rows for as long as `scope` lives (the game's own, a level's riding rows). */
  describe(table: BindingTableDef, scope: Scope): void {
    const groups = [...(table.groups ?? [])], rows = [...(table.rows ?? [])];
    this.groupDefs.push(...groups); this.rowDefs.push(...rows);
    scope.onDispose(() => {
      for (const group of groups) this.groupDefs.splice(this.groupDefs.indexOf(group), 1);
      for (const row of rows) this.rowDefs.splice(this.rowDefs.indexOf(row), 1);
    });
  }
  get table(): { groups: readonly BindingGroupDef[]; rows: readonly BindingRowDef[] } { return { groups: this.groupDefs, rows: this.rowDefs }; }
  /** Saves `codes` as the action's keys in one context; the empty list unbinds it. */
  assign(context: string, action: Action, codes: readonly string[]): void {
    if (!this.defaults.has(context)) throw new Error(`Unknown binding context ${context}`);
    this.overrides = { ...this.overrides, [context]: { ...this.overrides[context], [action]: [...codes] } }; controls.write(this.overrides); this.changed();
  }
  keys(context: string): Keys {
    // Saved overrides cannot restore actions removed from a context's defaults.
    const defaults = this.defaults.get(context) ?? {};
    const overrides = Object.fromEntries(Object.entries(this.overrides[context] ?? {}).filter(([action]) => Object.hasOwn(defaults, action)));
    return { ...defaults, ...overrides };
  }
  entries(): readonly { context: string; action: Action; codes: readonly string[] }[] {
    return [...this.defaults.keys()].flatMap((context) => Object.entries(this.keys(context)).map(([action, codes]) => ({ context, action: action as Action, codes })));
  }
  conflict(context: string, action: Action, code: string): Action | undefined {
    return Object.entries(this.keys(context)).find(([other, codes]) => other !== action && codes.includes(code))?.[0] as Action | undefined;
  }
  rebind(context: string, action: Action, code: string, swap = false): Action | undefined {
    if (!this.defaults.has(context)) throw new Error(`Unknown binding context ${context}`);
    const conflict = this.conflict(context, action, code); if (conflict !== undefined && !swap) return conflict;
    const previous = this.keys(context)[action] ?? [], edits = { ...this.overrides[context], [action]: [code] };
    if (conflict !== undefined) edits[conflict] = [...previous];
    this.overrides = { ...this.overrides, [context]: edits }; controls.write(this.overrides); this.changed(); return undefined;
  }
  reset(): void { this.overrides = {}; controls.reset(); this.changed(); }
}
