import { toJsonSchema, type JsonSchema } from '@valibot/to-json-schema';
import type { GenericSchema } from 'valibot';
import { EdgeProfileSchema, EdgeProfilesSchema } from '@wildshard/format/edgeProfiles';
import { PlumbingSchema } from '@wildshard/format/plumbing';
import { StateSchema } from '@wildshard/format/state';
import { CommonsCostsSchema } from '@wildshard/format/commonsCosts';
import { SHARDFILE_ADMISSION_LIMITS } from '@wildshard/format/admissionLimits';

/** JSON Schema plus explicit admission checks that JSON Schema cannot express. */
export interface FormatJsonSchema extends JsonSchema {
  'x-wildshard-checks'?: string[];
  'x-wildshard-string-length'?: 'utf16-code-units';
}

const plumbing = PlumbingSchema.pipe[0];
const input = plumbing.entries.input.pipe[0].item;
const debug = plumbing.entries.debug.pipe[0].item;
// These identities are the defining schemas, not message-based permissions for arbitrary author code.
const customSchemas = new Map<object, JsonSchema>([
  [input.entries.id, { type: 'string', maxLength: 128, pattern: '^[a-z][a-z0-9-]*(?:\\.[a-z][a-zA-Z0-9-]*)+$' }],
  [debug.entries.ask, { type: 'string', pattern: '^E[1-9][0-9]*$' }],
]);
const unicodeRegexes = new Set<object>([
  plumbing.entries.namespace.pipe[1],
  input.entries.actions.pipe[0].item.entries.keys.pipe[0].item.pipe[1],
  debug.entries.reviewBy.pipe[1],
]);
const stateField = StateSchema.pipe[0].entries.shared.pipe[0].item;
unicodeRegexes.add(stateField.entries.name.pipe[1]);
unicodeRegexes.add(CommonsCostsSchema.pipe[0].key.pipe[1]);
const edge = EdgeProfileSchema.pipe[0];
const finiteNumbers = new Set<object>([
  edge.entries.heights.item.pipe[1],
  stateField.entries.default.options[1].pipe[1],
  ...edge.entries.colours.item.items.map(channel => channel.pipe[1]),
]);

/**
 * Convert an author schema with the official converter, refusing every unrecognised custom check or transform.
 * The extracted format checks have explicit bridges. Plumbing's cross-field checks remain named mandatory
 * admission checks; Valibot string bounds use UTF-16 code units, unlike JSON Schema's Unicode code points.
 * This structural document never replaces the defining format parser's admission verdict.
 */
export function formatJsonSchema(schema: GenericSchema): FormatJsonSchema {
  return toJsonSchema(schema, {
    target: 'draft-2020-12', errorMode: 'throw', typeMode: 'output',
    overrideSchema: ({ valibotSchema }) => customSchemas.get(valibotSchema),
    overrideAction: ({ valibotAction, jsonSchema, errors }) => {
      if (valibotAction === EdgeProfileSchema.pipe[1]) {
        // Both arrays must have the same native sample count; bound each branch exactly.
        return { ...jsonSchema, anyOf: [256, 257].map(count => ({ properties: {
          heights: { minItems: count, maxItems: count }, colours: { minItems: count, maxItems: count },
        } })) };
      }
      if (valibotAction === PlumbingSchema.pipe[1]) {
        return { ...jsonSchema, 'x-wildshard-checks': ['@wildshard/format/plumbing#plumbingRules'] } satisfies FormatJsonSchema;
      }
      if (valibotAction === StateSchema.pipe[1]) {
        return { ...jsonSchema, 'x-wildshard-checks': ['@wildshard/format/state#stateRules'] } satisfies FormatJsonSchema;
      }
      if (valibotAction === CommonsCostsSchema.pipe[1]) {
        return { ...jsonSchema, maxProperties: SHARDFILE_ADMISSION_LIMITS.commons };
      }
      // JSON numbers cannot contain NaN or infinity. The existing ASCII regexes only use the Unicode flag.
      if (finiteNumbers.has(valibotAction) || unicodeRegexes.has(valibotAction)) return jsonSchema;
      if (errors === undefined && jsonSchema.type === 'string' &&
          (valibotAction.type === 'min_length' || valibotAction.type === 'max_length')) {
        return { ...jsonSchema, 'x-wildshard-string-length': 'utf16-code-units' } satisfies FormatJsonSchema;
      }
      return undefined;
    },
  });
}

/** The migrated wire roots, generated from their defining Valibot schemas; whole-shard extraction remains open. */
export function formatJsonSchemas(): Readonly<Record<'edge-profiles' | 'plumbing' | 'state' | 'commons-costs', FormatJsonSchema>> {
  const document = (name: string, schema: GenericSchema): FormatJsonSchema => ({
    ...formatJsonSchema(schema), title: name,
    $comment: 'DO-NOT-EDIT: generated from @wildshard/format by scripts/gen-format-schema.mjs. Structural schema; named checks and UTF-16 bounds still require the defining Valibot parser.',
  });
  return { 'edge-profiles': document('edge-profiles', EdgeProfilesSchema), plumbing: document('plumbing', PlumbingSchema),
    state: document('state', StateSchema), 'commons-costs': document('commons-costs', CommonsCostsSchema) };
}
