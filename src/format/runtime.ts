import * as v from 'valibot';
import { RuntimeCostSchema, runtimeAccountedBytes } from './runtimeCost.ts';
import { RuntimeBindsSchema } from './runtimeBinds.ts';
import { RuntimeSpawnsSchema } from './runtimeSpawns.ts';

const cost = v.pipe(RuntimeCostSchema, v.check((row) => {
  try { runtimeAccountedBytes(row); return true; } catch { return false; }
}, 'Runtime cost must contain a positive safe measured content bound'));

/** A compiled client-plan owner keeps its actual binds, spawns and measured cost,
 * without naming any TypeScript module or introducing another loader registry. */
export const ClientPlanRuntimeSchema: v.SchemaWithPipe<readonly [v.StrictObjectSchema<{ readonly kind: v.GenericSchema<ClientPlanRuntimeRowsInput['kind'], ClientPlanRuntimeRows['kind']>; readonly cost: v.GenericSchema<ClientPlanRuntimeRowsInput['cost'], ClientPlanRuntimeRows['cost']>; readonly binds: v.GenericSchema<ClientPlanRuntimeRowsInput['binds'], ClientPlanRuntimeRows['binds']>; readonly spawns: v.OptionalSchema<v.GenericSchema<Exclude<ClientPlanRuntimeRowsInput['spawns'], undefined>, Exclude<ClientPlanRuntimeRows['spawns'], undefined>>, undefined>; }, undefined>, v.CheckAction<{ [K in keyof ClientPlanRuntimeRows]: ClientPlanRuntimeRows[K] }, 'runtime spawns are declared exactly when runtime.binds names spawns'>]> = v.pipe(v.strictObject({
  kind: v.literal('client-plan'), cost, binds: RuntimeBindsSchema,
  spawns: v.optional(RuntimeSpawnsSchema),
}), v.check(row => (row.spawns !== undefined) === row.binds.includes('spawns'),
  'runtime spawns are declared exactly when runtime.binds names spawns'));
/** A shard's runtime declaration: only the compiled client plan (LD9 retired the copied-runtime `entry` arm). */
export const RuntimeSchema: v.GenericSchema<RuntimeDeclarationInput, RuntimeDeclaration> = ClientPlanRuntimeSchema;
/** Serializable runtime ownership, independent of its compiled or legacy constructor. */


/** Admitted data contracts, independent of validator implementation metadata. */
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
export type RuntimeDeclarationInput = ClientPlanRuntimeRowsInput;
export type RuntimeDeclaration = ClientPlanRuntimeRows;
