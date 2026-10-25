import { outputBlobPath } from '@wildshard/format/outputAddress';
import { assembleOutputFields, assembleOutputShardfile, parseOutputDescriptorIndex, type OutputIndex } from '@wildshard/format/outputIndex';
import { builtValidationReceipt, validationSourceBytes, validationSourceBytesPaced, type ValidationReceipt } from '@wildshard/format/validationReceipt';
import { loadingStage, loadingUnits, waitFor } from '@wildshard/engine/boot/waits';
import { diagnosticNow } from '@wildshard/engine/core/clock';
import type { Shardfile } from '@wildshard/format/shardSchema';

/** Byte readers are injected: the section adapter runs in browsers and renderer-free Node admission. */
export interface OutputDescriptorReader {
  /** Admission will declare its device-selected asset bank after section verification. */
  deferAssetDeclarations?: boolean;
  /** Expected sizes come from the parsed product index, before any section reads. */
  declare?: (path: string, bytes: number) => void;
  read: (path: string, maximum: number) => Promise<Uint8Array>;
  hash: (bytes: Uint8Array) => Promise<string>;
  /** Trusted transport returns owned bytes already checked against this exact hash and size.
   * `stored` proves durable content-cache persistence, not merely a scheduled write. */
  verified?: (hash: string, path: string, maximum: number) => Promise<{ bytes: Uint8Array; cached: boolean; stored: boolean } | null>;
  cached?: (hash: string, path: string, maximum: number) => Promise<Uint8Array | null>;
  /** A verified cache hit also completes its named section/schema path. */
  cacheHit?: (path: string, hash: string, bytes: number) => void;
  store?: (hash: string, bytes: Uint8Array) => Promise<boolean>;
  /** Lazy online page reads build verified network bytes before best-effort persistence completes. */
  backgroundStore?: (hash: string, bytes: Uint8Array) => Promise<boolean>;
  /** A client may let its loading panel draw between complete schema checks. */
  pause?: () => Promise<void>;
  offline: boolean;
  /** Only a matching build-pinned index and source receipt permits unchecked assembly. */
  firstParty?: boolean;
  /** A previous visit read for its state lineage only: hash-checked sections assembled unparsed and never admitted, so an
   *  older build's product is not refused by this build's section schemas (the caller parses identity and state). */
  lineage?: boolean;
}

export interface OutputDescriptor {
  readonly index: OutputIndex;
  readonly sections: ReadonlyMap<string, unknown>;
  readonly cached: boolean;
  /** Background section writes settle here; explicit offline publication still awaits durable proof. */
  readonly cacheStored?: Promise<boolean>;
  readonly indexHash: string;
  readonly receipt?: ValidationReceipt;
}
// Existing hosts consume the unchanged Shardfile shape. Keying by its files array
// also preserves location through the hosts' shallow presentation-only copies.
const descriptors = new WeakMap<object, OutputDescriptor>();
const buildValidated = new WeakSet();
// Parallel product reads keep their transport overlap. Their synchronous
// schema checks share one queue so independent readers cannot refill one
// paint interval with several compiles. Node readers inject no paint policy.
let schemaChecks = Promise.resolve();
function checkCustomSection(work: () => unknown, pause: OutputDescriptorReader['pause']): Promise<unknown> {
  if (pause === undefined) return Promise.resolve().then(work);
  const checked = schemaChecks.then(async () => {
    await pause();
    const value = await loadingStage('admission', work);
    // Keep the completed check separate from its consumer's assembly/hash work.
    await pause();
    return value;
  });
  schemaChecks = checked.then(() => undefined, () => undefined);
  return checked;
}

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
  const index = parseOutputDescriptorIndex(input);
  if (index === null) return input;
  for (const file of [...index.sections, ...index.schemas]) reader.declare?.(file.path, file.bytes);
  // General readers declare the immutable bank before their first section read.
  // Admission defers blobs until its verified sections select a device tier;
  // the boot compiler reserves that same selected bank before section reads.
  // A historical lineage never reads blobs.
  if (reader.lineage !== true && reader.deferAssetDeclarations !== true) for (const file of index.files) reader.declare?.(outputBlobPath(file), file.compressed);
  const sections = new Map<string, unknown>();
  let cached = reader.cached !== undefined || reader.verified !== undefined;
  const stores: Promise<void>[] = [];
  let pendingStores = 0;
  const load = async (section: OutputIndex['sections'][number]): Promise<readonly [string, unknown]> => {
    const verified = reader.verified === undefined ? null : await reader.verified(section.hash, section.path, section.bytes);
    let bytes = verified?.bytes ?? await reader.cached?.(section.hash, section.path, section.bytes);
    if (verified !== null && verified !== undefined) {
      bytes = verified.bytes;
      if (bytes.length !== section.bytes) throw new Error('Shardfile section hash or size mismatch');
      if (!verified.stored) cached = false;
      if (verified.cached) reader.cacheHit?.(section.path, section.hash, verified.bytes.length);
    } else if (bytes === null || bytes === undefined) {
      if (reader.offline) throw new IncompleteOutputCacheError();
      bytes = await reader.read(section.path, section.bytes);
      if (bytes.length !== section.bytes || await reader.hash(bytes) !== section.hash) throw new Error('Shardfile section hash or size mismatch');
      if (reader.backgroundStore !== undefined) {
        // A scheduled write is not durable cache proof. Complete offline
        // admission still uses the awaited store path before publication.
        const store = reader.backgroundStore, wire = bytes;
        pendingStores++;
        stores.push(Promise.resolve().then(() => store(section.hash, wire)).then(ok => {
          if (!ok) cached = false; pendingStores--; return undefined;
        }, () => { cached = false; pendingStores--; return undefined; }));
      } else if (reader.store === undefined || !await reader.store(section.hash, bytes)) cached = false;
    } else {
      if (bytes.length !== section.bytes || await reader.hash(bytes) !== section.hash) throw new Error('Cached shardfile section hash or size mismatch');
      reader.cacheHit?.(section.path, section.hash, bytes.length);
    }
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
  if (reader.lineage === true) return assembleOutputFields(index, sections, false);
  const sourceBytes = (value: unknown): Uint8Array | Promise<Uint8Array> => reader.pause === undefined
    ? validationSourceBytes(value) : validationSourceBytesPaced(value, reader.pause, diagnosticNow);
  const candidate = reader.firstParty === true ? builtValidationReceipt(index.build.sourceHash) : null;
  const indexHash = candidate === null ? undefined : await reader.hash(await sourceBytes(input));
  const receipt = indexHash === undefined ? null : builtValidationReceipt(index.build.sourceHash, indexHash);
  // G728: the exact build receipt proves custom schemas too; every section/schema
  // byte above still passes its declared size and hash. Unproved inputs stay checked.
  const custom = index.sections.filter(row => row.name.startsWith('custom/'));
  if (receipt === null && custom.length > 0) await loadingStage('admission', async () => {
    const { validateCustomSchema, validateCustomSchemaPaced } = await import('./customSchema');
    const progress = loadingUnits('Product schemas', custom.length);
    progress(0);
    for (const [at, row] of custom.entries()) {
      await waitFor(`Validate ${row.name}`, checkCustomSection(async () => {
        const value = reader.pause === undefined
          ? validateCustomSchema(schemas.get(row.schema), sections.get(row.name))
          : await validateCustomSchemaPaced(schemas.get(row.schema), sections.get(row.name), reader.pause);
        progress(at + 1, row.name);
        return value;
      }, reader.pause), 'admission');
    }
  });
  // Unproved products keep the original serialized schema phase before paced
  // hashing; only a possible CI receipt needs that digest to decide the fast path.
  const digest = indexHash ?? await reader.hash(await sourceBytes(input));
  let source: Shardfile;
  if (receipt === null) source = assembleOutputShardfile(index, sections);
  else {
    const fields = assembleOutputFields(index, sections, false);
    const actual = await reader.hash(await sourceBytes(fields));
    if (actual !== index.build.sourceHash || !buildValidatedSource(fields, actual, digest)) throw new Error('Built shardfile source receipt mismatch');
    source = fields;
    buildValidated.add(source);
  }
  descriptors.set(source.files, { index, sections, get cached() { return cached && pendingStores === 0; }, indexHash: digest,
    ...(stores.length === 0 ? {} : { cacheStored: Promise.all(stores).then(() => cached) }),
    ...(receipt === null ? {} : { receipt }) });
  return source;
}

/** Per admitted file list: its own hashes and each hash's first index entry (outputBlobUrl ran a search of both per
 *  call, once per asset: O(files^2), ~28 ms of a neighbour's admission at 4x CPU). */
const blobLookups = new WeakMap<object, { readonly own: ReadonlySet<string>; readonly entries: ReadonlyMap<string, OutputIndex['files'][number]> }>();
function blobLookup(source: Shardfile, descriptor: OutputDescriptor): { readonly own: ReadonlySet<string>; readonly entries: ReadonlyMap<string, OutputIndex['files'][number]> } {
  let lookup = blobLookups.get(source.files);
  if (lookup === undefined) {
    const entries = new Map<string, OutputIndex['files'][number]>();
    for (const entry of descriptor.index.files) if (!entries.has(entry.hash)) entries.set(entry.hash, entry);
    lookup = { own: new Set(source.files.map(file => file.hash)), entries };
    blobLookups.set(source.files, lookup);
  }
  return lookup;
}

/** Resolve only a declared format-2 blob, using its admitted kind/hash path. */
export function outputBlobUrl(source: Shardfile, ref: string, base: string): string {
  const hash = ref.replace(/^commons:/u, '');
  const descriptor = outputDescriptor(source), lookup = descriptor === undefined ? undefined : blobLookup(source, descriptor);
  if (!/^[a-f0-9]{64}$/u.test(hash) || (ref.startsWith('commons:')
    ? !source.requires.commons.includes(hash) : !(lookup?.own.has(hash) ?? source.files.some(file => file.hash === hash)))) throw new Error('Undeclared shardfile blob');
  if (descriptor === undefined || lookup === undefined) throw new Error('Blob reads require an admitted format-2 output');
  const file = lookup.entries.get(hash);
  if (file === undefined) throw new Error('Missing shardfile blob path');
  return new URL(outputBlobPath(file), base).href;
}
