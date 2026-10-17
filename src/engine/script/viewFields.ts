import { DecisionHost, type DecisionScript, type DecisionBinding, type DecisionSnapshot } from './decision';
import type { ScriptV1Event } from '@wildshard/format/scriptAbiV1';

/** Client-private numeric presentation state. These values never enter authoritative state, saves or replication. */
export interface ViewField { readonly id: number; readonly name: string; readonly type: 'bool' | 'i32' | 'f64'; readonly privacy: 'host'; readonly default: number | boolean; readonly min?: number; readonly max?: number }
function valid(field: ViewField, value: number): boolean {
  return Number.isFinite(value) && value >= (field.min ?? -Number.MAX_VALUE) && value <= (field.max ?? Number.MAX_VALUE)
    && (field.type === 'bool' ? value === 0 || value === 1 : field.type !== 'i32' || Number.isInteger(value) && value >= -2147483648 && value <= 2147483647);
}
/** Isolated client-only ABI-v1 host. Its only world command is view.field 105; it holds no simulation object or port. */
export class ViewFieldHost {
  readonly host: DecisionHost;
  private values: ReadonlyMap<number, number>;
  private readonly fields: ReadonlyMap<number, ViewField>;
  constructor(options: { readonly fields: readonly ViewField[]; readonly scripts: readonly DecisionScript[]; readonly bindings: readonly DecisionBinding[];
    readonly modules: ReadonlyMap<string, Uint8Array>; readonly seed: readonly [number, number] }) {
    this.fields = new Map(options.fields.map(field => [field.id, { ...field }]));
    if (this.fields.size !== options.fields.length || new Set(options.fields.map(field => field.name)).size !== options.fields.length || options.fields.length > 24
      || options.fields.some(field => !['host'].includes(field.privacy) || !Number.isSafeInteger(field.id) || field.id < 1 || field.id > 0x7fffffff || !/^[a-z][a-z0-9.-]*$/u.test(field.name)
        || !['bool', 'i32', 'f64'].includes(field.type) || (field.type === 'bool' ? typeof field.default !== 'boolean' : typeof field.default !== 'number')
        || (field.min !== undefined && !Number.isFinite(field.min)) || (field.max !== undefined && !Number.isFinite(field.max)) || !valid(field, Number(field.default)))
      || options.scripts.some(script => script.side !== 'view' || script.lists.length > 0 || script.reads.some(read => read !== 'random')
        || script.commands.some(command => command !== 'view.field') || Object.values(script.ids.fields ?? {}).some(id => !this.fields.has(id))))
      throw new Error('View fields require isolated host-private numeric declarations');
    this.values = new Map(options.fields.map(field => [field.id, Number(field.default)]));
    this.host = new DecisionHost({ ...options, world: {
      read: () => { throw new Error('View field host has no simulation reads'); },
      list: () => { throw new Error('View field host has no simulation lists'); },
      failed: () => undefined,
      prepare: commands => {
        const writes = new Map<number, number>();
        for (const [op, target, id, value, reserved] of commands) {
          const field = this.fields.get(id);
          if (op !== 105 || target !== 0 || reserved !== 0 || field === undefined || !valid(field, value)) throw new Error('Invalid client-private field write');
          writes.set(id, value);
        }
        return { commit: () => { this.values = new Map([...this.values, ...writes]); } };
      },
    } });
  }
  /** Presentation adapters read copied numbers by declared name; there is no setter into a sim world. */
  value(name: string): number | undefined { const field = [...this.fields.values()].find(row => row.name === name); return field === undefined ? undefined : this.values.get(field.id); }
  enqueue(binding: number, event: ScriptV1Event): void { this.host.enqueue(binding, event); }
  step(tick: number): void { this.host.step(tick); }
  /** Tooling may inspect the scheduler continuation, independently of game saves. */
  snapshot(): DecisionSnapshot { return this.host.snapshot(); }
}
