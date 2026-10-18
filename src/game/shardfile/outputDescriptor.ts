import { assembleOutputFields, assembleOutputShardfile, isOutputIndex, outputBlobPath, parseOutputIndex, type OutputIndex } from '@wildshard/format/outputIndex';
import { builtValidationReceipt, validationSourceBytes, type ValidationReceipt } from '@wildshard/format/product';
import { isJsonData } from '@wildshard/format/json';
import { validateCustomSchema } from './customSchema';
import type { Shardfile } from '@wildshard/format/shardSchema';

/** Byte readers are injected: the section adapter runs in browsers and renderer-free Node admission. */
export interface OutputDescriptorReader {
  read: (path: string, maximum: number) => Promise<Uint8Array>;
  hash: (bytes: Uint8Array) => Promise<string>;
  cached?: (hash: string) => Promise<Uint8Array | null>;
  store?: (hash: string, bytes: Uint8Array) => Promise<boolean>;
  offline: boolean;
  /** Only a matching build-pinned index and source receipt permits unchecked assembly. */
  firstParty?: boolean;
}

export interface OutputDescriptor {
  readonly index: OutputIndex;
  readonly sections: ReadonlyMap<string, unknown>;
  readonly cached: boolean;
  readonly indexHash: string;
  readonly receipt?: ValidationReceipt;
}
// Existing hosts consume the unchanged Shardfile shape. Keying by its files array
// also preserves location through the hosts' shallow presentation-only copies.
const descriptors = new WeakMap<object, OutputDescriptor>();
const buildValidated = new WeakSet();

/** A visited index is not an offline copy when any of its section bytes were evicted. */
export class IncompleteOutputCacheError extends Error {
  constructor() { super('Shardfile needs a connection: incomplete section cache'); this.name = 'IncompleteOutputCacheError'; }
}

/** Only the exact root verified against the build receipt has the schema-output proof. */
export function isBuildValidatedOutput(value: unknown): value is Shardfile {
  return typeof value === 'object' && value !== null && buildValidated.has(value);
}

/** The admitted v2 index and parsed sections, if this source came from a split output. */
export function outputDescriptor(source: { readonly files: object }): OutputDescriptor | undefined { return descriptors.get(source.files); }

/** Carry verified transport metadata across the existing parser's owned copy. */
export function carryOutputDescriptor(from: unknown, to: Shardfile): void {
  if (typeof from !== 'object' || from === null || !('files' in from) || !Array.isArray(from.files)) return;
  const descriptor = descriptors.get(from.files);
  if (descriptor !== undefined) descriptors.set(to.files, descriptor);
}

// The build receipt proves the schema output type; callers cannot provide a
// receipt through data. Both digests are computed from the actual decoded input.
function buildValidatedSource(value: unknown, sourceHash: string, indexHash: string): value is Shardfile {
  return typeof value === 'object' && value !== null && builtValidationReceipt(sourceHash, indexHash) !== null;
}

/**
 * Read all sections needed by today's complete Shardfile hosts, checking exact
 * byte sizes and hashes before assembly. Already assembled in-memory models
 * remain host inputs; disk readers separately require a format-2 index.
 */
export async function resolveOutputDescriptor(input: unknown, reader: OutputDescriptorReader): Promise<unknown> {
  if (!isJsonData(input)) throw new Error('Shardfile descriptor requires bounded plain JSON');
  if (!isOutputIndex(input)) return input;
  const index = parseOutputIndex(input);
  const sections = new Map<string, unknown>();
  let cached = reader.cached !== undefined;
  const load = async (section: OutputIndex['sections'][number]): Promise<readonly [string, unknown]> => {
    let bytes = await reader.cached?.(section.hash);
    if (bytes === null || bytes === undefined) {
      if (reader.offline) throw new IncompleteOutputCacheError();
      bytes = await reader.read(section.path, section.bytes);
      if (bytes.length !== section.bytes || await reader.hash(bytes) !== section.hash) throw new Error('Shardfile section hash or size mismatch');
      if (reader.store === undefined || !await reader.store(section.hash, bytes)) cached = false;
    } else if (bytes.length !== section.bytes || await reader.hash(bytes) !== section.hash) throw new Error('Cached shardfile section hash or size mismatch');
    const value: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
    return [section.name, value];
  };
  // Each section is independently bounded; launch the complete inventory in
  // parallel, and settle every request before returning a failed admission.
  const results = await Promise.allSettled([...index.sections, ...index.schemas.map(row => ({ ...row, name: row.path, schema: row.path }))].map(load));
  const schemas = new Map<string, unknown>();
  for (const result of results) {
    if (result.status === 'rejected') throw result.reason;
    (result.value[0].startsWith('schemas/') ? schemas : sections).set(...result.value);
  }
  // G491: a build receipt never bypasses an authored custom schema at load.
  for (const row of index.sections) {
    if (row.name.startsWith('custom/')) validateCustomSchema(schemas.get(row.schema), sections.get(row.name));
  }
  const indexHash = await reader.hash(validationSourceBytes(input));
  const receipt = reader.firstParty === true ? builtValidationReceipt(index.build.sourceHash, indexHash) : null;
  let source: Shardfile;
  if (receipt === null) source = assembleOutputShardfile(index, sections);
  else {
    const fields = assembleOutputFields(index, sections, false);
    const actual = await reader.hash(validationSourceBytes(fields));
    if (actual !== index.build.sourceHash || !buildValidatedSource(fields, actual, indexHash)) throw new Error('Built shardfile source receipt mismatch');
    source = fields;
    buildValidated.add(source);
  }
  descriptors.set(source.files, { index, sections, cached, indexHash, ...(receipt === null ? {} : { receipt }) });
  return source;
}

/** Resolve only a declared format-2 blob, using its admitted kind/hash path. */
export function outputBlobUrl(source: Shardfile, ref: string, base: string): string {
  const hash = ref.replace(/^commons:/u, '');
  if (!/^[a-f0-9]{64}$/u.test(hash) || (ref.startsWith('commons:')
    ? !source.requires.commons.includes(hash) : !source.files.some(file => file.hash === hash))) throw new Error('Undeclared shardfile blob');
  const descriptor = outputDescriptor(source);
  if (descriptor === undefined) throw new Error('Blob reads require an admitted format-2 output');
  const file = descriptor.index.files.find(entry => entry.hash === hash);
  if (file === undefined) throw new Error('Missing shardfile blob path');
  return new URL(outputBlobPath(file), base).href;
}
