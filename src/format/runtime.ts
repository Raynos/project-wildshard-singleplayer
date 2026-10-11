import * as v from 'valibot';
import { RuntimeCostSchema, runtimeAccountedBytes } from './runtimeCost';
import { RuntimeBindsSchema } from './runtimeBinds';
import { RuntimeSpawnsSchema } from './runtimeSpawns';

const cost = v.pipe(RuntimeCostSchema, v.check((row) => {
  try { runtimeAccountedBytes(row); return true; } catch { return false; }
}, 'Runtime cost must contain a positive safe measured content bound'));

/** A first-party transition entry, relative to its own shard folder; never an asset URL or arbitrary import. */
export const RuntimeSchema = v.pipe(v.strictObject({
  entry: v.pipe(v.string(), v.maxLength(160), v.regex(/^runtime\/(?:[a-zA-Z0-9_-]+\/)*[a-zA-Z0-9_-]+\.ts$/u)),
  cost: v.optional(cost),
  /** Behaviour sections this runtime binds in its own play scope (./runtimeBinds.ts); absent = none. */
  binds: v.optional(RuntimeBindsSchema),
  /** The runtime's creatures as declared rows (./runtimeSpawns.ts); present exactly when `binds` names `spawns`. */
  spawns: v.optional(RuntimeSpawnsSchema),
}), v.check((row) => (row.spawns !== undefined) === (row.binds?.includes('spawns') ?? false), 'runtime spawns are declared exactly when runtime.binds names spawns'));
/** Serializable declaration of the trusted TypeScript that remains during an 80/20 conversion. */
export type RuntimeDeclaration = v.InferOutput<typeof RuntimeSchema>;
