import * as v from 'valibot';
import type { SaveStore } from '@wildshard/engine/saves/store';
import type { Scope } from '@wildshard/engine/app/scope';
import type { Shardfile } from './schema';
import { LogicalStateSchema, migrateLogicalState } from './migrations';

const schema = v.strictObject({ state: LogicalStateSchema, initialized: v.array(v.pipe(v.number(), v.integer(), v.minValue(1))) });
const definition = { key: 'platform.runtime-state', scope: 'shard' as const, version: 1,
  schema: v.nullable(schema), initial: (): v.InferOutput<typeof schema> | null => null };
/** The same bounded scalar values as declared simulation state; JSON continuations use a declared string field. */
export type RuntimeStateValue = number | boolean | string;
/** A declared host field, scoped to its runtime owner and durable under its stable placement identity. */
export interface RuntimeState {
  readonly read: () => RuntimeStateValue;
  readonly write: (value: RuntimeStateValue) => boolean;
}

/** Bind one host-owned shared state field. Its legacy reader runs only before that field's first durable initialization. */
export function installRuntimeState(store: SaveStore, scope: Scope, source: Pick<Shardfile, 'state' | 'migrations'>,
  instance: string, key: string, legacyRead: () => RuntimeStateValue | null): RuntimeState {
  const field = source.state.shared.find((row) => row.name === key);
  if (field?.privacy !== 'host') throw new Error(`Runtime state needs a declared host-owned shared field: ${key}`);
  const live = (): void => { if (scope.disposed) throw new Error('Runtime state owner is disposed'); };
  live();
  const slot = store.define(definition);
  const current = (): v.InferOutput<typeof schema> => {
    live();
    if (slot.status?.(instance) === 'future') throw new Error('Runtime state was saved by a newer platform');
    const prior = slot.read(instance);
    return { state: migrateLogicalState(prior?.state ?? { version: source.state.version, shared: [], players: [] }, source.state, source.migrations),
      initialized: prior?.initialized ?? [] };
  };
  const change = (value: RuntimeStateValue, initialize: boolean): boolean => {
    const doc = current(), row = doc.state.shared.find((entry) => entry.id === field.id);
    if (row === undefined) throw new Error(`Missing runtime state field: ${key}`);
    row.value = value;
    // Reuse the full state's typed/default/bounds checks before any save mutation.
    doc.state = migrateLogicalState(doc.state, source.state);
    if (initialize && !doc.initialized.includes(field.id)) doc.initialized.push(field.id);
    return slot.write(doc, instance);
  };
  const first = current();
  if (!first.initialized.includes(field.id)) change(legacyRead() ?? field.default, true);
  return { read: () => {
    const row = current().state.shared.find((entry) => entry.id === field.id);
    if (row === undefined) throw new Error(`Missing runtime state field: ${key}`);
    return row.value;
  }, write: (value) => change(value, true) };
}
