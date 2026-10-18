import * as v from 'valibot';
import { toJsonSchema, type JsonSchema } from '@valibot/to-json-schema';
import { isJsonData } from '@wildshard/format/json';
import { validateCustomSchema } from '@wildshard/game/shardfile/customSchema';
import { encodeCanonicalJson, hashImmutableBytes } from './immutable';

/** Build-only custom content. Neither the Valibot parser nor author code enters the emitted product. */
export interface DefinedSection<T = unknown> {
  readonly name: string;
  readonly value: T;
  readonly jsonSchema: JsonSchema;
}

/** An index entry whose schema names a separately emitted custom JSON Schema. */
export interface DefinedSectionEntry {
  readonly name: string;
  readonly path: string;
  readonly schema: string;
  readonly hash: string;
  readonly bytes: number;
}

/** Relative product paths and their canonical bytes, ready for the product writer. */
export interface EmittedSections {
  readonly sections: readonly DefinedSectionEntry[];
  readonly files: ReadonlyMap<string, Uint8Array>;
}

const CUSTOM_NAME = /^custom\/[a-zA-Z][a-zA-Z0-9_-]{0,63}$/u;
const DRAFT = 'http://json-schema.org/draft-07/schema#';

function assertName(name: string): void {
  if (!CUSTOM_NAME.test(name)) throw new Error('Custom section name must be custom/<identifier>');
}

/** Validate serialized custom schemas and their data independently of the author module.
 * Unknown keywords/formats, external references and async validators refuse; validation never coerces,
 * supplies defaults or removes properties. The on-disk validator uses this same path as the authoring API. */
export function validateDefinedSection(schemaBytes: Uint8Array, value: unknown): unknown {
  if (schemaBytes.length > 1_000_000) throw new Error('Custom section schema exceeds its byte limit');
  const text = new TextDecoder('utf-8', { fatal: true }).decode(schemaBytes);
  const schema: unknown = JSON.parse(text);
  if (!isJsonData(schema) || typeof schema !== 'object' || schema === null || !('$schema' in schema) || schema.$schema !== DRAFT || encodeCanonicalJson(schema) !== text) throw new Error('Custom section schema must be canonical draft-07 JSON');
  return validateCustomSchema(schema, value);
}

/** Declare a private section in data/. Values are parsed by Valibot and then checked against the emitted
 * schema. Unsupported predicates and transforms refuse conversion instead of weakening disk admission. */
export function defineSection<S extends v.GenericSchema>(name: string, schema: S, value: v.InferInput<S>): DefinedSection<v.InferOutput<S>> {
  assertName(name);
  if (!isJsonData(value)) throw new Error('Custom section value must be plain JSON');
  const parsed = v.parse(schema, value);
  const jsonSchema = toJsonSchema(schema, { target: 'draft-07', errorMode: 'throw', typeMode: 'ignore' });
  validateDefinedSection(new TextEncoder().encode(encodeCanonicalJson(jsonSchema)), parsed);
  return { name, value: parsed, jsonSchema };
}

/** Preflight every definition before returning any output. Duplicate names and path escapes refuse;
 * authored order cannot change the sorted index, schema bytes or content hashes. */
export function emitDefinedSections(definitions: readonly DefinedSection[]): EmittedSections {
  const sections: DefinedSectionEntry[] = [], files = new Map<string, Uint8Array>();
  const names = new Set<string>();
  for (const definition of definitions) {
    assertName(definition.name);
    if (names.has(definition.name)) throw new Error(`Duplicate custom section: ${definition.name}`);
    names.add(definition.name);
    const schema = `schemas/${definition.name}.schema.json`, path = `sections/${definition.name}.json`;
    if (!isJsonData(definition.jsonSchema)) throw new Error('Custom section schema must be plain JSON');
    const schemaBytes = new TextEncoder().encode(encodeCanonicalJson(definition.jsonSchema));
    validateDefinedSection(schemaBytes, definition.value);
    const bytes = new TextEncoder().encode(encodeCanonicalJson(definition.value));
    files.set(schema, schemaBytes); files.set(path, bytes);
    sections.push({ name: definition.name, path, schema, hash: hashImmutableBytes(bytes), bytes: bytes.length });
  }
  sections.sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0);
  return { sections, files: new Map([...files].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)) };
}
