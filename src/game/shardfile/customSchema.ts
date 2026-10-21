import Ajv from 'ajv';
import { isJsonData, parseNamedJson } from '@wildshard/format/json';
import { schemaReferences } from './schemaReferences';

/** Check authored draft-07 schemas without coercion, defaults, property removal,
 * remote references or async validation. Runtime counterpart of SDK section
 * admission, using the same pinned Ajv policy without a build dependency. */
export function validateCustomSchema(schema: unknown, value: unknown): unknown {
  if (!isJsonData(value)) throw new Error('Custom section value must be plain JSON');
  return validateSchema(schema, value);
}

/** Browser admission separates JSON checking, Ajv setup, compilation and validation
 * with the caller's existing paint policy. The synchronous reader uses the same checks. */
export async function validateCustomSchemaPaced(schema: unknown, value: unknown, pause: () => Promise<void>): Promise<unknown> {
  if (!isJsonData(value)) throw new Error('Custom section value must be plain JSON');
  await pause();
  const checks = schemaChecks(schema, value);
  let result = checks.next();
  while (!result.done) { await pause(); result = checks.next(); }
  return result.value;
}

/** Named payloads arrive as verified, byte-bounded JSON; their defining schema
 * supplies shape and bounds without introducing a custom-section node limit. */
export function validateNamedJsonSchema(schema: unknown, bytes: Uint8Array): unknown {
  return validateSchema(schema, parseNamedJson(bytes));
}

function validateSchema(schema: unknown, value: unknown): unknown {
  const checks = schemaChecks(schema, value);
  let result = checks.next();
  while (!result.done) result = checks.next();
  return result.value;
}

function* schemaChecks(schema: unknown, value: unknown): Generator<void, unknown> {
  if (!isJsonData(schema) || typeof schema !== 'object' || schema === null
    || !('$schema' in schema) || schema.$schema !== 'http://json-schema.org/draft-07/schema#'
    || JSON.stringify(schema).length > 1_000_000) throw new Error('Custom schema requires bounded draft-07 JSON');
  yield;
  const validator = new Ajv({ allErrors: false, strictKeywords: true, unknownFormats: true, jsonPointers: true, inlineRefs: false });
  yield;
  const validate = validator.compile(schemaReferences(schema, JSON.stringify(schema)));
  if (validate.$async === true) throw new Error('Custom schemas cannot be asynchronous');
  yield;
  if (validate(value) !== true) throw new Error(`Custom section value refuses its schema: ${validator.errorsText(validate.errors)}`);
  return value;
}
