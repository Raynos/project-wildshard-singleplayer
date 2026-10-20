import Ajv from 'ajv';
import { isJsonData, parseNamedJson } from '@wildshard/format/json';

/** Check authored draft-07 schemas without coercion, defaults, property removal,
 * remote references or async validation. Runtime counterpart of SDK section
 * admission, using the same pinned Ajv policy without a build dependency. */
export function validateCustomSchema(schema: unknown, value: unknown): unknown {
  if (!isJsonData(value)) throw new Error('Custom section value must be plain JSON');
  return validateSchema(schema, value);
}

/** Named payloads arrive as verified, byte-bounded JSON; their defining schema
 * supplies shape and bounds without introducing a custom-section node limit. */
export function validateNamedJsonSchema(schema: unknown, bytes: Uint8Array): unknown {
  return validateSchema(schema, parseNamedJson(bytes));
}

function validateSchema(schema: unknown, value: unknown): unknown {
  if (!isJsonData(schema) || typeof schema !== 'object' || schema === null
    || !('$schema' in schema) || schema.$schema !== 'http://json-schema.org/draft-07/schema#'
    || JSON.stringify(schema).length > 1_000_000) throw new Error('Custom schema requires bounded draft-07 JSON');
  const validator = new Ajv({ allErrors: false, strictKeywords: true, unknownFormats: true, jsonPointers: true });
  const validate = validator.compile(schema);
  if (validate.$async === true) throw new Error('Custom schemas cannot be asynchronous');
  if (validate(value) !== true) throw new Error(`Custom section value refuses its schema: ${validator.errorsText(validate.errors)}`);
  return value;
}
