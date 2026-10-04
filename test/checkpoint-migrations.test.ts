import { expect, it } from 'vitest';
import { assertMigrationCompatibility, migrateLogicalState, parseMigrations, type LogicalState } from '../src/game/shardfile/migrations';

const old: LogicalState = { version: 1, shared: [{ id: 7, name: 'door.open', type: 'bool', value: true }, { id: 8, name: 'stage', type: 'i32', value: 2 }],
  players: [{ actorId: 'actor.player', fields: [{ id: 10, name: 'oil', type: 'f64', value: 0.3 }] }] };
const target = { version: 2, shared: [{ id: 7, name: 'door.open', type: 'bool' as const, default: false }, { id: 8, name: 'stage', type: 'i32' as const, default: 0 }, { id: 9, name: 'new', type: 'string' as const, default: 'fresh' }],
  player: [{ id: 10, name: 'oil', type: 'f64' as const, default: 1 }] };
it('preserves ids, values and independent actors across additive schemas, with target defaults for new fields', () => {
  const value = migrateLogicalState(old, target); expect(value.shared.map((field) => field.value)).toEqual([true, 2, 'fresh']);
  expect(value.players[0]?.fields[0]?.value).toBe(0.3); expect(old.version).toBe(1);
});
it('applies consecutive declarative rename, drop, defaults and enum maps without executing author code', () => {
  const rows = parseMigrations([{ from: 1, to: 2, fields: [{ op: 'rename', scope: 'shared', id: 7, name: 'gate.open' }, { op: 'map', scope: 'shared', id: 8, type: 'string', values: [{ from: 2, to: 'complete' }], fallback: 'reject' }, { op: 'drop', scope: 'player', id: 10 }] },
    { from: 2, to: 3, fields: [{ op: 'default', scope: 'player', field: { id: 11, name: 'fuel', type: 'f64', value: 0.5 } }] }]);
  const next = { version: 3, shared: [{ ...target.shared[0], id: 7, name: 'gate.open', type: 'bool' as const, default: false }, { id: 8, name: 'stage', type: 'string' as const, default: 'start' }], player: [{ id: 11, name: 'fuel', type: 'f64' as const, default: 1 }] };
  const result = migrateLogicalState(old, next, rows); expect(result.shared.map((field) => field.value)).toEqual([true, 'complete']); expect(result.players[0]?.fields[0]?.value).toBe(0.5);
});
it('refuses ambiguous rows, unadmitted AS hooks, invalid value maps, implicit removals and downgraded revisions', () => {
  expect(() => parseMigrations([{ from: 1, to: 3, fields: [] }])).toThrow();
  expect(() => parseMigrations([{ from: 1, to: 2, fields: [], asHook: 'run.wasm' }])).toThrow();
  expect(() => migrateLogicalState(old, { ...target, shared: [] })).toThrow('explicit');
  expect(() => migrateLogicalState(old, { ...target, version: 0 })).toThrow('target');
  const rows = parseMigrations([{ from: 1, to: 2, fields: [{ op: 'map', scope: 'shared', id: 8, type: 'i32', values: [{ from: 1, to: 8 }], fallback: 'reject' }] }]);
  expect(() => migrateLogicalState(old, target, rows)).toThrow('Unmapped');
});
it('admits explicit declaration changes without guessing saved enum values, and never recycles dropped ids or scopes', () => {
  const previous = { ...target, version: 1 };
  const next = { version: 2, shared: [{ id: 7, name: 'gate.open', type: 'bool' as const, default: false }, { id: 8, name: 'stage', type: 'string' as const, default: 'fresh' }], player: [] };
  const rows = parseMigrations([{ from: 1, to: 2, fields: [
    { op: 'rename', scope: 'shared', id: 7, name: 'gate.open' },
    { op: 'map', scope: 'shared', id: 8, type: 'string', values: [{ from: 2, to: 'complete' }], fallback: 'reject' },
    { op: 'drop', scope: 'shared', id: 9 }, { op: 'drop', scope: 'player', id: 10 },
  ] }]);
  expect(() => assertMigrationCompatibility(previous, next, rows)).not.toThrow();
  expect(() => assertMigrationCompatibility(previous, next)).toThrow('explicit');
  expect(() => assertMigrationCompatibility(previous, { ...next, version: 1 }, rows)).toThrow('target');
  expect(() => assertMigrationCompatibility(previous, { ...next, player: target.player }, rows)).toThrow('reused');
  expect(() => assertMigrationCompatibility(previous, { ...next, player: [target.shared[0]].filter((field) => field !== undefined) }, rows)).toThrow('reused');
  const drop = parseMigrations([{ from: 1, to: 2, fields: [{ op: 'drop', scope: 'shared', id: 7 }] }]);
  expect(() => migrateLogicalState(old, target, drop)).toThrow('reused');
  expect(() => migrateLogicalState(old, { ...target, shared: target.shared.filter((field) => field.id !== 7), player: [{ id: 7, name: 'recycled', type: 'bool', default: false }, ...target.player] }, drop)).toThrow('reused');
});
it('composes a rename and enum map for one stable field in one version step, refusing conflicting edits', () => {
  const rows = parseMigrations([{ from: 1, to: 2, fields: [{ op: 'rename', scope: 'shared', id: 8, name: 'quest.result' },
    { op: 'map', scope: 'shared', id: 8, type: 'string', values: [{ from: 2, to: 'complete' }], fallback: 'reject' }] }]);
  const next = { ...target, shared: [{ id: 7, name: 'door.open', type: 'bool' as const, default: false }, { id: 8, name: 'quest.result', type: 'string' as const, default: 'fresh' }] };
  expect(migrateLogicalState(old, next, rows).shared[1]?.value).toBe('complete');
  expect(() => assertMigrationCompatibility({ ...target, version: 1, shared: target.shared.filter((field) => field.id !== 9) }, next, rows)).not.toThrow();
  const row = rows[0]; if (row === undefined) throw new Error('Missing migration row');
  expect(() => parseMigrations([{ ...row, fields: [...row.fields, { op: 'drop', scope: 'shared', id: 8 }] }])).toThrow();
  expect(() => parseMigrations([{ ...row, fields: [...row.fields, { op: 'rename', scope: 'shared', id: 8, name: 'ambiguous' }] }])).toThrow();
});
