import * as v from 'valibot';
import { RuntimeCostSchema, runtimeAccountedBytes } from './runtimeCost';
import { RuntimeBindsSchema } from './runtimeBinds';
import { RuntimeSpawnsSchema } from './runtimeSpawns';

const cost = v.pipe(RuntimeCostSchema, v.check((row) => {
  try { runtimeAccountedBytes(row); return true; } catch { return false; }
}, 'Runtime cost must contain a positive safe measured content bound'));

/** A first-party transition entry, relative to its own shard folder; never an asset URL or arbitrary import. */
export const LegacyRuntimeSchema = v.pipe(v.strictObject({
  entry: v.pipe(v.string(), v.maxLength(160), v.regex(/^runtime\/(?:[a-zA-Z0-9_-]+\/)*[a-zA-Z0-9_-]+\.ts$/u)),
  cost: v.optional(cost),
  /** Behaviour sections this runtime binds in its own play scope (./runtimeBinds.ts); absent = none. */
  binds: v.optional(RuntimeBindsSchema),
  /** The runtime's creatures as declared rows (./runtimeSpawns.ts); present exactly when `binds` names `spawns`. */
  spawns: v.optional(RuntimeSpawnsSchema),
}), v.check((row) => (row.spawns !== undefined) === (row.binds?.includes('spawns') ?? false), 'runtime spawns are declared exactly when runtime.binds names spawns'));
/** A compiled client-plan owner keeps its actual binds, spawns and measured cost,
 * without naming any TypeScript module or introducing another loader registry. */
export const ClientPlanRuntimeSchema = v.pipe(v.strictObject({
  kind: v.literal('client-plan'), cost, binds: RuntimeBindsSchema,
  spawns: v.optional(RuntimeSpawnsSchema),
}), v.check(row => (row.spawns !== undefined) === row.binds.includes('spawns'),
  'runtime spawns are declared exactly when runtime.binds names spawns'));
/** Existing trusted source declarations retain their exact wire shape. */
export const RuntimeSchema = v.union([LegacyRuntimeSchema, ClientPlanRuntimeSchema]);
/** Serializable runtime ownership, independent of its compiled or legacy constructor. */
export type RuntimeDeclaration = v.InferOutput<typeof RuntimeSchema>;
