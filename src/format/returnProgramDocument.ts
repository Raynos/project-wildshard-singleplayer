import * as v from 'valibot';
import { DecisionScriptRowDocumentSchema, DecisionScriptsSchema, type DecisionScriptRowInput, type DecisionScriptRow } from './decisionScripts.ts';
import { ReturnProjectionV2Schema } from './returnProjectionV2.ts';
import { isJsonData } from './json.ts';

export interface ReturnProgramDocumentInput {
  script: DecisionScriptRowInput;
  bytes: string;
  v2?: v.InferInput<typeof ReturnProjectionV2Schema>;
  signal?: string;
}
export interface ReturnProgramDocument {
  script: DecisionScriptRow;
  bytes: string;
  v2?: v.InferOutput<typeof ReturnProjectionV2Schema>;
  signal?: string;
}

/** Complete existing return-guest wire, including its native ABI-1 metadata
 * and optional ABI-2 projection. Native installation still owns the module
 * bytes, imports, witnesses and resource/reference admission. */
export const ReturnProgramDocumentSchema: v.GenericSchema<unknown, ReturnProgramDocument> = v.pipe(
  v.unknown(), v.check(isJsonData),
  // Admit the caller's original script before record parsing can omit unsafe
  // property names. The native authority must never inspect a stripped clone.
  v.check(input => isJsonData(input) && typeof input === 'object' && input !== null && !Array.isArray(input)
    && v.safeParse(DecisionScriptsSchema, [Reflect.get(input, 'script')]).success, 'Complete native return-script admission'),
  v.strictObject({ script: DecisionScriptsSchema.pipe[2].item,
    bytes: v.pipe(v.string(), v.maxLength(2_000_000)), v2: v.exactOptional(ReturnProjectionV2Schema),
    signal: v.exactOptional(v.pipe(v.string(), v.minLength(1), v.maxLength(128))) }),
);

/** Exact return-program wire document. Native script defaults remain absent
 * until the existing installer parses them; complete validation is unchanged. */
export const ReturnProgramWireDocumentSchema: v.GenericSchema<unknown, ReturnProgramDocumentInput> = v.pipe(
  v.unknown(), v.check(isJsonData),
  v.strictObject({ script: DecisionScriptRowDocumentSchema,
    bytes: v.pipe(v.string(), v.maxLength(2_000_000)), v2: v.exactOptional(ReturnProjectionV2Schema),
    signal: v.exactOptional(v.pipe(v.string(), v.minLength(1), v.maxLength(128))) }),
);
