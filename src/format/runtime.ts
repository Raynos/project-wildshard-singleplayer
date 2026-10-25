import * as v from 'valibot';
import { RuntimeCostSchema, runtimeAccountedBytes } from './runtimeCost';
import { RuntimeBindsSchema } from './runtimeBinds';
import { RuntimeSpawnsSchema } from './runtimeSpawns';

const cost = v.pipe(RuntimeCostSchema, v.check((row) => {
  try { runtimeAccountedBytes(row); return true; } catch { return false; }
}, 'Runtime cost must contain a positive safe measured content bound'));

/** A first-party transition entry, relative to its own shard folder; never an asset URL or arbitrary import. */
export const LegacyRuntimeSchema: v.SchemaWithPipe<readonly [v.StrictObjectSchema<{ readonly entry: v.GenericSchema<LegacyRuntimeRowsInput['entry'], LegacyRuntimeRows['entry']>; readonly cost: v.OptionalSchema<v.GenericSchema<Exclude<LegacyRuntimeRowsInput['cost'], undefined>, Exclude<LegacyRuntimeRows['cost'], undefined>>, undefined>; readonly binds: v.OptionalSchema<v.GenericSchema<Exclude<LegacyRuntimeRowsInput['binds'], undefined>, Exclude<LegacyRuntimeRows['binds'], undefined>>, undefined>; readonly spawns: v.OptionalSchema<v.GenericSchema<Exclude<LegacyRuntimeRowsInput['spawns'], undefined>, Exclude<LegacyRuntimeRows['spawns'], undefined>>, undefined>; }, undefined>, v.CheckAction<{ [K in keyof LegacyRuntimeRows]: LegacyRuntimeRows[K] }, 'runtime spawns are declared exactly when runtime.binds names spawns'>]> = v.pipe(v.strictObject({
  entry: v.pipe(v.string(), v.maxLength(160), v.regex(/^runtime\/(?:[a-zA-Z0-9_-]+\/)*[a-zA-Z0-9_-]+\.ts$/u)),
  cost: v.optional(cost),
  /** Behaviour sections this runtime binds in its own play scope (./runtimeBinds.ts); absent = none. */
  binds: v.optional(RuntimeBindsSchema),
  /** The runtime's creatures as declared rows (./runtimeSpawns.ts); present exactly when `binds` names `spawns`. */
  spawns: v.optional(RuntimeSpawnsSchema),
}), v.check((row) => (row.spawns !== undefined) === (row.binds?.includes('spawns') ?? false), 'runtime spawns are declared exactly when runtime.binds names spawns'));
/** A compiled client-plan owner keeps its actual binds, spawns and measured cost,
 * without naming any TypeScript module or introducing another loader registry. */
export const ClientPlanRuntimeSchema: v.SchemaWithPipe<readonly [v.StrictObjectSchema<{ readonly kind: v.GenericSchema<ClientPlanRuntimeRowsInput['kind'], ClientPlanRuntimeRows['kind']>; readonly cost: v.GenericSchema<ClientPlanRuntimeRowsInput['cost'], ClientPlanRuntimeRows['cost']>; readonly binds: v.GenericSchema<ClientPlanRuntimeRowsInput['binds'], ClientPlanRuntimeRows['binds']>; readonly spawns: v.OptionalSchema<v.GenericSchema<Exclude<ClientPlanRuntimeRowsInput['spawns'], undefined>, Exclude<ClientPlanRuntimeRows['spawns'], undefined>>, undefined>; }, undefined>, v.CheckAction<{ [K in keyof ClientPlanRuntimeRows]: ClientPlanRuntimeRows[K] }, 'runtime spawns are declared exactly when runtime.binds names spawns'>]> = v.pipe(v.strictObject({
  kind: v.literal('client-plan'), cost, binds: RuntimeBindsSchema,
  spawns: v.optional(RuntimeSpawnsSchema),
}), v.check(row => (row.spawns !== undefined) === row.binds.includes('spawns'),
  'runtime spawns are declared exactly when runtime.binds names spawns'));
/** Existing trusted source declarations retain their exact wire shape. */
export const RuntimeSchema: v.GenericSchema<RuntimeDeclarationInput, RuntimeDeclaration> = v.union([LegacyRuntimeSchema, ClientPlanRuntimeSchema]);
/** Serializable runtime ownership, independent of its compiled or legacy constructor. */


/** Admitted data contracts, independent of validator implementation metadata. */
interface LegacyRuntimeRowsInputFields {
    entry: string;
    cost?: v.InferInput<typeof RuntimeCostSchema> | undefined;
    binds?: v.InferInput<typeof RuntimeBindsSchema> | undefined;
    spawns?: v.InferInput<typeof RuntimeSpawnsSchema> | undefined;
}
export type LegacyRuntimeRowsInput = { [Key in keyof LegacyRuntimeRowsInputFields]: LegacyRuntimeRowsInputFields[Key] };
interface LegacyRuntimeRowsFields {
    entry: string;
    cost?: v.InferOutput<typeof RuntimeCostSchema> | undefined;
    binds?: v.InferOutput<typeof RuntimeBindsSchema> | undefined;
    spawns?: v.InferOutput<typeof RuntimeSpawnsSchema> | undefined;
}
export type LegacyRuntimeRows = { [Key in keyof LegacyRuntimeRowsFields]: LegacyRuntimeRowsFields[Key] };
interface ClientPlanRuntimeRowsInputFields {
    kind: 'client-plan';
    cost: v.InferInput<typeof RuntimeCostSchema>;
    binds: v.InferInput<typeof RuntimeBindsSchema>;
    spawns?: v.InferInput<typeof RuntimeSpawnsSchema> | undefined;
}
export type ClientPlanRuntimeRowsInput = { [Key in keyof ClientPlanRuntimeRowsInputFields]: ClientPlanRuntimeRowsInputFields[Key] };
interface ClientPlanRuntimeRowsFields {
    kind: 'client-plan';
    cost: v.InferOutput<typeof RuntimeCostSchema>;
    binds: v.InferOutput<typeof RuntimeBindsSchema>;
    spawns?: v.InferOutput<typeof RuntimeSpawnsSchema> | undefined;
}
export type ClientPlanRuntimeRows = { [Key in keyof ClientPlanRuntimeRowsFields]: ClientPlanRuntimeRowsFields[Key] };
export type RuntimeDeclarationInput = (LegacyRuntimeRowsInput) | (ClientPlanRuntimeRowsInput);
export type RuntimeDeclaration = (LegacyRuntimeRows) | (ClientPlanRuntimeRows);
