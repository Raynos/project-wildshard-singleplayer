import { parseLootTables } from '@wildshard/format/lootEconomy';
import { WeightedTable, type TableSpec, type TableDrop } from '@wildshard/engine/ai/weighted';
import { app } from '@wildshard/engine/app/runtime';
import type { Scope } from '@wildshard/engine/app/scope';

export interface LootContext { kind: string; variant?: string | undefined; owned?: (id: string) => boolean }
export interface LootTableRow { id: string; domain: 'coins' | 'trophies'; table: TableSpec<string, LootContext> }
/** Compile admitted kind/variant/ownership selectors; WeightedTable still owns draw order and RNG use. */
export function readLootTables(input: unknown): LootTableRow[] {
  return parseLootTables(input).map(({ id, domain, table }) => ({ id, domain, table: { mode: table.mode,
    rows: table.rows.map(({ match, ...row }) => ({ ...row, when: (ctx: LootContext) => ctx.kind === match.kind
      && (match.variant === undefined || ctx.variant === match.variant) && (match.unowned !== true || ctx.owned?.(row.item) !== true) })) } }));
}
interface Entry { row: LootTableRow; scope: Scope | undefined }
const entries: Entry[] = [];

/** Authored rewards resolve against the active resident; unscoped rows support pure content tools. */
export function registerLootTable(row: LootTableRow, scope?: Scope): void {
  if (scope?.disposed === true) throw new Error('Cannot register loot on a disposed scope');
  const existing = entries.findIndex((entry) => entry.scope === scope && entry.row.id === row.id);
  if (existing !== -1) {
    if (scope !== undefined) throw new Error(`Duplicate loot table: ${row.id}`);
    entries.splice(existing, 1);
  }
  const entry = { row, scope }; entries.push(entry);
  scope?.onDispose(() => { const i = entries.indexOf(entry); if (i !== -1) entries.splice(i, 1); });
}
export function getLootTable(id: string): LootTableRow | undefined {
  const active = app.levelScope, ordered = entries.slice().reverse();
  const matches = (entry: Entry): boolean => entry.row.id === id || entry.row.domain === id;
  return (active === null ? undefined : ordered.find((entry) => matches(entry) && entry.scope?.belongsTo(active) === true))?.row
    ?? ordered.find((entry) => matches(entry) && entry.scope === undefined)?.row;
}
/** Fixed awards need no caller RNG; callers supplying a random stream retain its exact draw order. */
export function rollLoot(id: string, context: LootContext, next: () => number = () => 0): TableDrop<string>[] {
  const row = getLootTable(id);
  return row === undefined ? [] : new WeightedTable(row.table).roll(context, next);
}
