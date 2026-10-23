import type Ajv from 'ajv';
import { isJsonData, parseNamedJson } from '@wildshard/format/json';
import { encodeCanonicalJson } from './immutable';

const DRAFT = 'http://json-schema.org/draft-07/schema#';

/** Validate named JSON with the caller's schema compiler under the existing byte bounds. */
export function validateNamedJson(schemaBytes: Uint8Array, bytes: Uint8Array, Validator: typeof Ajv): unknown {
  return validateDefinedSchema(schemaBytes, parseNamedJson(bytes), Validator);
}

/** Shared canonical draft-07 validation policy; the dependency is supplied only by schema consumers. */
export function validateDefinedSchema(schemaBytes: Uint8Array, value: unknown, Validator: typeof Ajv): unknown {
  if (schemaBytes.length > 1_000_000) throw new Error('Custom section schema exceeds its byte limit');
  const text = new TextDecoder('utf-8', { fatal: true }).decode(schemaBytes);
  const schema: unknown = JSON.parse(text);
  if (!isJsonData(schema) || typeof schema !== 'object' || schema === null || !('$schema' in schema) || schema.$schema !== DRAFT || encodeCanonicalJson(schema) !== text) throw new Error('Custom section schema must be canonical draft-07 JSON');
  const validator = new Validator({ allErrors: false, strictKeywords: true, unknownFormats: true, jsonPointers: true });
  const validate = validator.compile(schema);
  if (validate.$async === true) throw new Error('Custom section schemas cannot be asynchronous');
  if (validate(value) !== true) throw new Error(`Custom section value refuses its schema: ${validator.errorsText(validate.errors)}`);
  return value;
}
