import * as v from 'valibot';
import { isJsonData } from './json';

const id = v.pipe(v.string(), v.regex(/^[a-z][a-zA-Z0-9.:-]*$/u), v.maxLength(128));
const number = v.pipe(v.number(), v.finite(), v.minValue(0), v.maxValue(10000000));
const count = v.pipe(number, v.integer(), v.maxValue(1024));
const gate = v.strictObject({ kind: v.exactOptional(id), tags: v.exactOptional(v.pipe(v.array(id), v.maxLength(32))) });
const row = v.strictObject({ item: v.strictObject({ kind: id, variant: v.exactOptional(id) }), weight: number,
  count: v.exactOptional(v.union([count, v.pipe(v.tuple([count, count]), v.check(([low, high]) => low <= high, 'ordered count'))])),
  when: v.exactOptional(gate) });
/** Ordered each/weighted tables with conjunctive kind/tag gates; all draws stay in WeightedTable. */
export const SpawnTablesSchema = v.pipe(v.unknown(), v.check(isJsonData, 'Spawn tables must be plain JSON'),
  v.array(v.strictObject({ id, table: v.strictObject({ mode: v.picklist(['each', 'weighted']), rows: v.pipe(v.array(row), v.maxLength(256)) }),
    respawn: v.exactOptional(v.strictObject({ delay: number, away: number })) })), v.maxLength(256),
  v.check(rows => new Set(rows.map(value => value.id)).size === rows.length, 'unique spawn table ids'));
export type SpawnTables = v.InferOutput<typeof SpawnTablesSchema>;
/** Admit the complete table set before registering a live spawner. */
export function readSpawnTables(input: unknown): SpawnTables { return v.parse(SpawnTablesSchema, input); }
